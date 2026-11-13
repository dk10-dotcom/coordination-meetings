#!/usr/bin/env python3
"""Makes dark.css, the app's dark look, from styles.css. Run it whenever styles.css changes colors:

    python3 test/tools/make-dark.py

It copies every declaration in styles.css that names a color, in the same order and inside the same @media
blocks, and turns light surfaces dark and dark text light; colors in between (the step colors, buttons) stay.
The page loads dark.css after styles.css. Every rule in it applies only while the page has the class `theme-dark`
(theme.js sets it before the page draws: from Settings → Appearance, or from the phone when that is Automatic).
The prefix is wrapped in :where(), so it adds nothing to a rule's weight and the rules keep the same order and
strength as in styles.css. Hand-tuned dark rules go in the TUNED block at the end.
"""
import colorsys, os, re

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC, OUT = os.path.join(ROOT, 'styles.css'), os.path.join(ROOT, 'dark.css')

ROOT_VARS = """  --ink: #E8ECF3;
  --text: #CDD4DF;
  --muted: #9EA8B8;
  --accent: #4C7FD8;
  --accent-soft: #1E2A40;
  --accent-line: #35507F;
  --ground: #0F1218;
  --card: #1A1E26;
  --line: #2C3340;
  --card-line: #2A303C;
  --field-line: #3B4353;
  --orange-soft: #2E1F16;
  --orange-line: #5C3A24;
  --orange-ink: #F0A878;
  --green-soft: #15281D;
  --green-line: #2E5A3D;
  --green-ink: #9AD6AE;
  --amber-soft: #2A2312;
  --amber-line: #6B5520;
  color-scheme: dark;"""

# Rules written by hand for things the automatic pass can't judge
TUNED = """
  .actionbar, body[data-view="start"] .actionbar { background: rgba(26, 30, 38, .92); border-color: rgba(255, 255, 255, .08); }
  .nav-home { border-color: #1A1E26; }
  .toast { background: #2C3340; color: #FFFFFF; }
  .avatar-pencil { border-color: #0F1218; }
  .ss-bar { background: #2C3340; }
  .slides-steps li { background: #222833; color: #7D889B; }
  .slide-img { border-radius: 14px; }
  img.sample-page, .sample img { background: #FFFFFF; }
"""

COLOR = re.compile(r'#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)|\bwhite\b|\bblack\b')
BG = ('background', 'background-color', 'background-image')
FG = ('color', 'fill', 'stroke', '-webkit-text-fill-color', 'text-decoration-color', 'caret-color')
EDGE = ('border', 'border-color', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-top-color',
        'border-bottom-color', 'border-left-color', 'border-right-color', 'outline', 'outline-color', 'box-shadow',
        'text-shadow', 'column-rule')


def parse(c):
    c = c.strip()
    if c == 'white': return (255, 255, 255, None)
    if c == 'black': return (0, 0, 0, None)
    if c.startswith('#'):
        h = c[1:]
        if len(h) == 3: h = ''.join(x * 2 for x in h)
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), None)
    n = [x.strip() for x in c[c.index('(') + 1:-1].split(',')]
    return (int(n[0]), int(n[1]), int(n[2]), n[3] if len(n) > 3 else None)


def fmt(r, g, b, a):
    r, g, b = [max(0, min(255, int(round(x)))) for x in (r, g, b)]
    return f'rgba({r}, {g}, {b}, {a})' if a is not None else f'#{r:02X}{g:02X}{b:02X}'


def hls(r, g, b): return colorsys.rgb_to_hls(r / 255, g / 255, b / 255)


def from_hls(h, l, s): return [x * 255 for x in colorsys.hls_to_rgb(h, l, s)]


def surface(m):
    r, g, b, a = parse(m.group(0)); h, l, s = hls(r, g, b)
    if l < 0.72: return m.group(0)                      # a real color (a button, a step card): keep it
    if l > 0.985 and s < 0.2: return fmt(26, 30, 38, a)  # white → the card color
    return fmt(*from_hls(h, 0.12 + (1 - l) * 0.55, min(s, 0.5) * 0.7), a)


def ink(m):
    r, g, b, a = parse(m.group(0)); h, l, s = hls(r, g, b)
    if l >= 0.5: return m.group(0)                      # white or light text: keep it
    return fmt(*from_hls(h, 0.93 - l * 0.55, s * 0.75), a)


def edge(m):
    r, g, b, a = parse(m.group(0)); h, l, s = hls(r, g, b)
    if r == g == b == 0: return m.group(0)               # black shadows stay
    if l > 0.62: return fmt(*from_hls(h, 0.2 + (1 - l) * 0.5, min(s, 0.5) * 0.7), a)
    if l < 0.3: return fmt(*from_hls(h, 0.8 - l, s * 0.7), a)
    return m.group(0)


def convert_decls(body):
    out = []
    for decl in body.split(';'):
        if ':' not in decl: continue
        prop, val = decl.split(':', 1); p = prop.strip().lower()
        if not COLOR.search(val): continue
        if p.startswith('--'):  # color variables set in a rule: judged by their name
            if re.search(r'soft|band|-t$|bg|tint', p): nv = COLOR.sub(surface, val)
            elif 'line' in p: nv = COLOR.sub(edge, val)
            elif re.search(r'-ink$', p) and p != '--tile-ink': nv = COLOR.sub(ink, val)
            else: continue
        elif p in BG or p == 'background': nv = COLOR.sub(surface, val)
        elif p in FG: nv = COLOR.sub(ink, val)
        elif p in EDGE or p.startswith('border') or p.startswith('outline'): nv = COLOR.sub(edge, val)
        else: continue
        out.append(f'{prop.strip()}: {nv.strip()}')
    return out


def strip_comments(s): return re.sub(r'/\*.*?\*/', '', s, flags=re.S)


def blocks(s):
    """Yields (prelude, body) for the top-level blocks of a stylesheet."""
    i, n = 0, len(s)
    while i < n:
        j = s.find('{', i)
        if j < 0: return
        depth, k = 1, j + 1
        while k < n and depth:
            depth += {'{': 1, '}': -1}.get(s[k], 0); k += 1
        yield s[i:j].strip(), s[j + 1:k - 1]
        i = k


PRE = ':where(:root.theme-dark) '


def scope(selectors):
    """Prefixes each selector in a list so it applies only in dark mode."""
    parts, depth, cur = [], 0, ''
    for ch in selectors:
        if ch in '([': depth += 1
        if ch in ')]': depth -= 1
        if ch == ',' and depth == 0: parts.append(cur); cur = ''
        else: cur += ch
    parts.append(cur)
    out = []
    for p in (x.strip() for x in parts):
        if p.startswith(':root'): out.append(':root.theme-dark' + p[5:])
        elif p.startswith('html'): out.append('html.theme-dark' + p[4:])
        else: out.append(PRE + p)
    return ', '.join(out)


def walk(css, indent=''):
    lines = []
    for pre, body in blocks(css):
        if pre.startswith('@keyframes') or pre.startswith('@font-face') or 'print' in pre: continue
        if pre.startswith('@media') or pre.startswith('@supports'):
            inner = walk(body, indent + '  ')
            if inner: lines += [f'{indent}{pre} {{'] + inner + [f'{indent}}}']
            continue
        if pre.startswith(':root') and pre.strip() == ':root': continue
        decls = convert_decls(body)
        if decls: lines.append(f'{indent}{scope(pre)} {{ ' + '; '.join(decls) + '; }')
    return lines


def main():
    css = strip_comments(open(SRC, encoding='utf-8').read())
    rules = walk(css)
    text = ('/* Huddle in dark mode. Made by test/tools/make-dark.py from styles.css: do not edit by hand,\n'
            '   except the hand-tuned rules, which are kept in that script. */\n'
            ':root.theme-dark {\n' + ROOT_VARS + '\n}\n'
            + '\n'.join(rules) + '\n/* hand-tuned */\n' + '\n'.join(scope(r.split('{')[0]) + ' {' + r.split('{', 1)[1] for r in TUNED.strip().splitlines()) + '\n')
    open(OUT, 'w', encoding='utf-8').write(text)
    print(f'Wrote dark.css: {len(rules)} rules.')


if __name__ == '__main__':
    main()
