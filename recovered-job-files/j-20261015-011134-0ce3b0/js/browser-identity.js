// ==========================================
// Browser Identity (shared by library + PDF viewer)
// ==========================================
// Maps this browser (a random ID kept in localStorage) to the contributor name
// chosen in it. This is a convenience label, NOT a login or security boundary.
// Saved identity always wins over ?user= / ?contributor= URL params, which only
// seed an identity when none is set.
(function (global) {
  "use strict";

  const DEVICE_ID_KEY = "capstone_device_id";
  const MAP_KEY = "capstone_browser_identity_map";
  const LEGACY_USER_KEY = "capstone_user_name";
  const LEGACY_PDF_USER_KEY = "pdf_active_user";
  const UNKNOWN_NAME = "Unknown User";

  // In-memory state used when localStorage is blocked/full/unavailable.
  const memory = { browserId: "", name: "" };

  function storage() {
    try {
      return global.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  function read(key) {
    const store = storage();
    if (!store) return null;
    try {
      return store.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    const store = storage();
    if (!store) return false;
    try {
      store.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function cleanName(value) {
    const name = String(value == null ? "" : value).trim().replace(/\s+/g, " ").slice(0, 80);
    if (!name || name.toLowerCase() === UNKNOWN_NAME.toLowerCase()) return "";
    return name;
  }

  function generateUuid() {
    const c = global.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    if (c && typeof c.getRandomValues === "function") {
      const b = new Uint8Array(16);
      c.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
    // Last resort for very old browsers without Web Crypto.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // Existing capstone_device_id values are preserved verbatim.
  function getBrowserId() {
    if (memory.browserId) return memory.browserId;
    let id = read(DEVICE_ID_KEY);
    if (!id) {
      id = "dev_" + generateUuid();
      write(DEVICE_ID_KEY, id);
    }
    memory.browserId = id;
    return id;
  }

  function readMap() {
    try {
      const parsed = JSON.parse(read(MAP_KEY) || "null");
      if (parsed && typeof parsed === "object" && parsed.map && typeof parsed.map === "object") {
        return parsed;
      }
    } catch (e) {
      // Corrupt value: start a fresh map.
    }
    return { version: 1, map: {} };
  }

  function writeMap(data) {
    return write(MAP_KEY, JSON.stringify(data));
  }

  function writeCompatKeys(name) {
    write(LEGACY_USER_KEY, name);
    write(LEGACY_PDF_USER_KEY, name);
  }

  // Resolve the saved name: browserID mapping first, then legacy keys (which are
  // migrated into the mapping so nothing is lost). Returns "" when unset.
  function getSavedName() {
    const id = getBrowserId();
    const entry = readMap().map[id];
    const mapped = cleanName(entry && entry.name);
    if (mapped) {
      memory.name = mapped;
      return mapped;
    }
    const legacy = cleanName(read(LEGACY_USER_KEY)) || cleanName(read(LEGACY_PDF_USER_KEY));
    if (legacy) {
      setName(legacy);
      return legacy;
    }
    return memory.name;
  }

  function setName(value) {
    const name = cleanName(value);
    const id = getBrowserId();
    memory.name = name;
    const data = readMap();
    if (name) {
      data.map[id] = { name, updatedAt: new Date().toISOString() };
    } else {
      delete data.map[id];
    }
    writeMap(data);
    if (name) {
      writeCompatKeys(name);
    } else {
      const store = storage();
      try {
        if (store) {
          store.removeItem(LEGACY_USER_KEY);
          store.removeItem(LEGACY_PDF_USER_KEY);
        }
      } catch (e) {
        // Ignore: in-memory state is already cleared.
      }
    }
    return name;
  }

  function getName() {
    return getSavedName() || UNKNOWN_NAME;
  }

  function hasName() {
    return Boolean(getSavedName());
  }

  // URL params only seed an identity when this browser has none saved.
  function seedFromParams(search) {
    if (hasName()) return false;
    try {
      const params = new URLSearchParams(search == null ? global.location.search : search);
      const seed = cleanName(params.get("user") || params.get("contributor"));
      if (seed) {
        setName(seed);
        return true;
      }
    } catch (e) {
      // Ignore URL parsing errors.
    }
    return false;
  }

  // True when selections survive a reload (storage works and read-back matches).
  function isPersistent() {
    const probe = "capstone_identity_probe";
    const store = storage();
    if (!store) return false;
    try {
      store.setItem(probe, "1");
      const ok = store.getItem(probe) === "1";
      store.removeItem(probe);
      return ok;
    } catch (e) {
      return false;
    }
  }

  global.BrowserIdentity = {
    UNKNOWN_NAME,
    getBrowserId,
    getName,
    hasName,
    setName,
    seedFromParams,
    isPersistent,
  };
})(typeof window !== "undefined" ? window : globalThis);
