#!/usr/bin/env python3
"""Build partner.html (served at /p/<code>) from podcast-guesting.html.

The partner page is the podcast guesting page: same hero, same sections, same
order. Run this after every edit to podcast-guesting.html, and --check in
review. Everything outside those (head, header, footer) is
kept as it is in partner.html. What differs:
  - noindex, no canonical, no structured data (shares keep their /p/<code> URL)
  - the partner script and the "Shared with you by ..." note above the hero
  - a logo-only header and the short footer, so the only way on is the next step
  - the calls to action are tagged partner-*
  - no workshop opt-in (Mike, 2026-11-25: off partner pages until there's a better funnel for it)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


NOTE = '    <p class="topnote" id="topnote">Podcast guesting for service founders</p>\n'
SWAPS = [
    ('data-cta="podcast-guesting-book"', 'data-cta="partner-book"'),
    ('data-cta="podcast-guesting-sticky"', 'data-cta="partner-sticky"'),
]


def between(text, start, end):
    i = text.index(start)
    j = text.index(end, i) + len(end)
    return text[i:j]


def swap(text, start, end, new):
    i = text.index(start) + len(start)
    return text[:i] + new + text[text.index(end, i):]


def build():
    src = (ROOT / "podcast-guesting.html").read_text()
    page = (ROOT / "partner.html").read_text()
    style = between(src, "/* /podcast-guesting", "</style>").removesuffix("</style>").rstrip()
    main = between(src, '<main id="top">', "</main>")
    tail = between(src, '<div class="mbar"', "</script>")
    main = main.replace('<div class="wrap hero-wrap">\n', '<div class="wrap hero-wrap">\n' + NOTE, 1)
    # the note above the hero says it, so the eyebrow would repeat it
    main = re.sub(r'\s*<span class="eyebrow">Podcast guesting for service founders</span>', "", main, count=1)
    main = re.sub(r'  <section id="workshop".*?</section>\n', "", main, count=1, flags=re.S)
    main = main.replace("</section>\n\n</main>", "</section>\n</main>")
    page = swap(page, "/* page rules: start */\n", "/* page rules: end */", style + "\n")
    page = swap(page, "<!-- /chrome:header -->\n\n", "<!-- chrome:footer", main + "\n\n")
    page = page[:page.index("<!-- /chrome:footer -->")] + "<!-- /chrome:footer -->\n\n" + tail
    page += '\n\n<script src="/forms.js" defer></script>\n</body>\n</html>\n'
    for old, new in SWAPS:
        page = page.replace(old, new)
    return page


if __name__ == "__main__":
    page, path = build(), ROOT / "partner.html"
    if "--check" in sys.argv:
        if path.read_text() != page:
            sys.exit("partner.html is stale: run python3 scripts/build_partner.py")
        print("partner.html matches podcast-guesting.html")
    else:
        path.write_text(page)
