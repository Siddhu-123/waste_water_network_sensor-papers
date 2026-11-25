// How team members' names are shown. The data keeps the short keys below (they
// drive filters, colours and saved identities), and this file only changes the
// text people see: first names on the public site, full names in the team tool.
// Paper author lists and PDF text are left alone.
(function (global) {
  "use strict";

  const TEAM = [
    { key: "Satya Siddhartha", first: "Satya", full: "Satya Siddhartha Balanagu" },
    { key: "Rijoy John", first: "Rijoy", full: "Rijoy John" },
    { key: "Ashis Jose", first: "Ashis", full: "Ashis Jose Kalathil" },
    { key: "Abraham", first: "Abraham", full: "Abraham Paul Jaison" },
    { key: "Wimukthi", first: "Wimukthi", full: "Wimukthi Rajapaksha" },
  ];

  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Each rule matches the key (or the full name) as a whole word. In the team
  // view the key is matched only when the rest of the full name does not follow,
  // so running it again changes nothing.
  function rules(publicView) {
    return TEAM.map((person) => {
      if (publicView) {
        const forms = [person.full, person.key].filter((v, i, a) => a.indexOf(v) === i && v !== person.first);
        if (!forms.length) return null;
        return { re: new RegExp("(?<![\\w])(?:" + forms.map(escape).join("|") + ")(?![\\w])", "g"), to: person.first };
      }
      if (person.full === person.key) return null;
      const rest = person.full.slice(person.key.length);
      return { re: new RegExp("(?<![\\w])" + escape(person.key) + "(?!" + escape(rest) + ")(?![\\w])", "g"), to: person.full };
    }).filter(Boolean);
  }

  const SKIP = "script,style,textarea,.textLayer,.annotationLayer,[data-keep-names],[class*='author']";

  function rewrite(text, list) {
    let out = text;
    for (const rule of list) out = out.replace(rule.re, rule.to);
    return out;
  }

  function apply(root, list) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP)) continue;
      const next = rewrite(node.nodeValue, list);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    const elements = root.querySelectorAll ? root.querySelectorAll("[title],[aria-label]") : [];
    for (const el of elements) {
      if (el.closest(SKIP)) continue;
      for (const attr of ["title", "aria-label"]) {
        const value = el.getAttribute(attr);
        if (!value) continue;
        const next = rewrite(value, list);
        if (next !== value) el.setAttribute(attr, next);
      }
    }
  }

  function start() {
    const list = rules(Boolean(global.PUBLIC_MODE));
    if (!list.length || !document.body) return;
    apply(document.body, list);
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; apply(document.body, list); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  global.TeamNames = {
    list: TEAM,
    first: (key) => (TEAM.find((p) => p.key === key) || { first: key }).first,
    full: (key) => (TEAM.find((p) => p.key === key) || { full: key }).full,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window);
