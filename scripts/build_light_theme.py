#!/usr/bin/env python3
"""Generate light-theme overrides from the dark stylesheets.

Every declaration that uses a literal colour gets a light counterpart scoped to
html[data-theme="light"]: dark surfaces become light, light text becomes dark,
white overlays become dark overlays. Accent fills behind white text are kept.
Hand-written fixes go in css/theme-light.css, which loads after these files.

Run after changing colours in the dark CSS:
    python3 scripts/build_light_theme.py
"""
import colorsys
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ["css/base.css", "css/controls.css", "css/papers.css", "css/modals.css", "css/research-map.css", "css/mobile.css"]
SCOPE = 'html[data-theme="light"]'
COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)")
SKIP_SELECTOR = re.compile(r":root|^html$|^body$|\.theme-toggle")


def parse(c):
    if c.startswith("#"):
        h = c[1:]
        if len(h) in (3, 4):
            h = "".join(x * 2 for x in h)
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    parts = [p.strip() for p in c[c.index("(") + 1:-1].replace("/", ",").split(",")]
    r, g, b = (float(p) for p in parts[:3])
    a = float(parts[3].rstrip("%")) / (100 if parts[3].endswith("%") else 1) if len(parts) > 3 else 1.0
    return r, g, b, a


def fmt(r, g, b, a):
    r, g, b = (max(0, min(255, round(v))) for v in (r, g, b))
    if a >= 0.999:
        return f"#{r:02x}{g:02x}{b:02x}"
    return f"rgba({r}, {g}, {b}, {round(a, 3)})"


def hls(c):
    r, g, b, a = parse(c)
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return h, l, s, a


def from_hls(h, l, s, a):
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return fmt(r * 255, g * 255, b * 255, a)


def map_text(c):
    h, l, s, a = hls(c)
    if l <= 0.5:
        return c
    if s < 0.25:  # greys: light grey text -> slate
        return from_hls(h, max(0.18, 1.0 - l - 0.05), min(s, 0.2), a)
    return from_hls(h, min(0.36, max(0.24, 1.0 - l)), min(1.0, s), a)


def map_surface(c):
    h, l, s, a = hls(c)
    if l < 0.4 and s < 0.6:  # dark panel -> light panel
        return from_hls(h, min(0.985, 1.0 - l * 0.45), min(s, 0.35), a)
    if l > 0.85 and a < 0.5:  # white overlay -> dark overlay
        return fmt(15, 23, 42, a * 0.8)
    return c


def map_border(c):
    h, l, s, a = hls(c)
    if l < 0.4 and s < 0.6:
        return from_hls(h, 0.86, min(s, 0.3), a)
    if l > 0.85 and a < 0.5:
        return fmt(15, 23, 42, max(0.08, a))
    if s < 0.25 and a < 0.6:  # translucent grey hairline
        return fmt(15, 23, 42, min(0.22, a * 0.9))
    return c


def map_shadow(c):
    r, g, b, a = parse(c)
    if hls(c)[1] < 0.2:
        return fmt(15, 23, 42, a * 0.35)
    return c


def has_accent_fill(body):
    for m in re.finditer(r"background(?:-color|-image)?\s*:([^;]*)", body):
        for c in COLOR.findall(m.group(1)):
            h, l, s, a = hls(c)
            if s > 0.45 and 0.3 < l < 0.75 and a > 0.6:
                return True
    return False


def convert(prop, value, accent_fill):
    p = prop.strip().lower()
    if p in ("color", "fill", "stroke", "caret-color", "-webkit-text-fill-color", "text-decoration-color"):
        if accent_fill:
            return value
        fn = map_text
    elif p.startswith("background"):
        fn = map_surface
    elif p.startswith("border") or p.startswith("outline") or p == "scrollbar-color":
        fn = map_border
    elif p in ("box-shadow", "text-shadow", "filter"):
        fn = map_shadow
    else:
        return value
    return COLOR.sub(lambda m: fn(m.group(0)), value)


def scope(selectors):
    out = []
    for sel in selectors.split(","):
        sel = sel.strip()
        if not sel:
            continue
        if sel.startswith("html"):
            sel = SCOPE + sel[4:]
        else:
            sel = f"{SCOPE} {sel}"
        out.append(sel)
    return ",\n".join(out)


def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def blocks(css):
    """Yield (prelude, body) for top-level blocks, matching braces."""
    i, n = 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            return
        prelude = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
            k += 1
        yield prelude, css[j + 1:k - 1]
        i = k


def rules(css):
    out = []
    for prelude, body in blocks(css):
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            inner = rules(body)
            if inner:
                out.append(prelude + " {\n" + "\n".join("  " + line for line in "\n".join(inner).splitlines()) + "\n}")
            continue
        if prelude.startswith("@") or SKIP_SELECTOR.search(prelude):
            continue
        accent = has_accent_fill(body)
        decls = []
        for d in body.split(";"):
            if ":" not in d or not COLOR.search(d):
                continue
            prop, value = d.split(":", 1)
            if prop.strip().startswith("--"):
                continue
            new = convert(prop, value, accent)
            if new != value:
                decls.append(f"  {prop.strip()}: {new.strip()};")
        if decls:
            out.append(scope(prelude) + " {\n" + "\n".join(decls) + "\n}")
    return out


INLINE = re.compile(r"\b(color|background(?:-color)?|border(?:-[a-z]+)?)\s*:\s*(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))")


def inline_rules(paths):
    """Colours written into style="" attributes by the page or its scripts."""
    seen, out = set(), []
    for path in paths:
        for style in re.findall(r'style="([^"]*)"', (ROOT / path).read_text()):
            accent = has_accent_fill(style)
            for prop, value in INLINE.findall(style):
                key = (prop, value)
                if key in seen:
                    continue
                seen.add(key)
                new = convert(prop, value, accent)
                if new != value:
                    needle = f"{prop}: {value}"
                    out.append(f'{SCOPE} [style*="{needle}"] {{ {prop}: {new} !important; }}')
    return out


def build(sources, target, title, inline=()):
    parts = [f"/* {title}\n * Generated by scripts/build_light_theme.py; do not edit by hand. */\n"]
    if inline:
        parts.append("/* inline style attributes */\n" + "\n".join(inline_rules(inline)) + "\n")
    for src in sources:
        css = (ROOT / src).read_text() if src.endswith(".css") else extract_style(ROOT / src)
        out = rules(strip_comments(css))
        if out:
            parts.append(f"/* from {src} */\n" + "\n\n".join(out) + "\n")
    (ROOT / target).write_text("\n".join(parts))
    print(f"wrote {target}")


def extract_style(path):
    html = path.read_text()
    return "\n".join(re.findall(r"<style>(.*?)</style>", html, flags=re.S))


if __name__ == "__main__":
    scripts = ["index.html", "js/papers.js", "js/grey-literature.js", "js/instructor.js", "js/profile.js"]
    build(LIBRARY, "css/theme-light-auto.css", "Light theme overrides for the library page.", inline=scripts)
    build(["pdf-viewer.html"], "css/theme-light-viewer.css", "Light theme overrides for the PDF viewer.", inline=["pdf-viewer.html"])
