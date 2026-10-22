# mikemoll.co

Static site for Mike Moll. Plain HTML/CSS, no build step. Deploys on Vercel.

## Structure
- `index.html` — homepage
- `podcast.html` — the podcast page (serves at `/podcast`)
- `public/media/` — images (logos, photos, episode art). Small files, safe to commit.
- `public/audio/` — DO NOT commit audio/video. Host on YouTube/Spotify and embed.
- `vercel.json` — clean URLs + 301 redirects from the old GoHighLevel slugs
- `robots.txt`, `sitemap.xml`, `llms.txt` — SEO + AI-SEO
- `_template.html`: starting point for new pages, on design system v2 (see below).
  GTM, the favicon block, `visits.js` and `forms.js` are already wired in. No
  build step means no automatic includes, so copy this file rather than
  starting a page from scratch. When you add a page, also add its URL to
  `sitemap.xml` (unless it should stay `noindex`, like a thank-you page).
- `scroll-top.js`: shared "back to top" button on v1 pages, included via `<script src="/scroll-top.js" defer></script>` before `</body>`. v2 pages don't load it (the sticky header does the job).
- `favicon.ico`, `favicon.svg`, `apple-touch-icon.png` — the site icon (white M on a black circle). Every page links all three just before `</head>`; `_template.html` and both generator templates (`generator/_source/gen.py`, `build_pages.py`) already carry the block. Keep it when copying or generating pages:
  ```html
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  ```
- Every page includes the same Google Tag Manager container (`GTM-WD3WQ8N`): script tag high in `<head>`, noscript iframe right after `<body>`. Keep both when copying/editing pages.

## Design system v2
Every page runs on `assets/site-v2.css` (the light system first built for
`/podcast-guesting`). The old black `assets/site.css` was retired on 2026-10-07
once no page loaded it; don't bring it back. The rules and the component list
are at the top of `assets/site-v2.css`; `_template.html` is the reference page.
Blog posts add `assets/post.css`, and video posts add `assets/video-blog.css`.

To put a page on v2:
1. In `<head>`, replace the Google Fonts link and any stylesheet link with an
   empty `<!-- chrome:head -->` `<!-- /chrome:head -->` pair. Leave GTM, the
   title, canonical, OG, JSON-LD, the favicon block and the scripts alone.
2. Replace the page's `<nav>`/`<header>` and `<footer>` with marker pairs:
   - `<!-- chrome:header site -->`: logo + Consulting, Podcast guesting, Results, Media
   - `<!-- chrome:header podcast -->`: the same + the outlined "Free assessment" button
   - `<!-- chrome:header focus href="#apply" label="Apply" cta="mastermind-nav" -->`:
     campaign pages, logo + the page's one action
   - `<!-- chrome:header logo -->`: the logo only, no nav and no button, for a page
     with nothing to do next (`/booked`)
   - `<!-- chrome:footer full -->` or `<!-- chrome:footer focus -->` (legal row + socials)

   Each one is closed by `<!-- /chrome:header -->` or `<!-- /chrome:footer -->`.
3. Stamp it: `python3 scripts/stamp_chrome.py page.html`. The nav link for the
   page's own URL gets `aria-current="page"` (the ink link with the blue dot).
4. Rebuild the content with the v2 components and cut the inline `<style>` down
   to page-only rules. Keep every `href`, `data-cta` and `data-lead` as it was.
   If a page needs a shared component v2 lacks, build it inline under a
   `/* promote to site-v2 */` comment; a cleanup PR moves it into section 9c.
5. Check it at 390px and 1440px against the live page before merging.

Glyphs (the `.g` icons on benefit and feature cards): take one from the approved
library in the brain doc "Glyphs — Mike Moll" (coaching), or draw a new one
with the `glyph-maker` skill and get Mike's OK before it ships. Markup:
`<svg class="g" viewBox="0 0 44 44" aria-hidden="true">`, ink parts with no
class, the one blue part `class="a"` (a line) or `class="af"` (a fill). Never a
stock icon set or an emoji. A newly approved glyph goes into the brain doc's
library too.

Content components (site-v2.css section 9b, from /media, /guest-appearances and
/podcast; reuse them on the blog index and other content pages): `.cover` tile
(`.yt`, `.ini`), `.applist` appearance list (`.c2` two columns), `.eplist`
episode list, `.covergrid` static cover grid, `.statrow.c3` / `.lone` stat row
on navy, and `.closing .btns` for a two-door closing band. Cover `src` is the
show's `cover_url` from `generator/_source/appearances.json`, never `images/...`.

Page components (site-v2.css section 9c, promoted from the wave A/B pages; each
one has its markup in a comment above its rules):
- `.hero-wrap`: the space between the stamped header and an offer hero.
- Hero A variants: `.hero-photo.split` (a portrait in the right 40%, no gradient;
  `.shot` for a `<picture>`, `.solo` when no `.strip` follows), `.hero-photo.flip`
  (mirrored, for a photo whose people sit left) and `.note` beside the hero button.
  The page sets the photo crop (`object-position`) and its phone band height.
- `.figs` proof figures in the hero strip (`.c4` for four).
- `.hero-b.split`: type on the left, a player (`.embed`) or a card on the right;
  `.with-card` puts a lead magnet's opt-in card beside the copy and its `.learn` list.
- `.optin.stack`: the opt-in card in one column, plus `.optin .field label` (visible
  labels) and `.optin button.submit` (the `.btn` look for a form that can't take it).
- Form fields: `.form` (`.full`, `.radio`); `form.ap` is /consulting's application,
  listed beside it because form markup is frozen.
- `.said`: text-only quotes as a hairline pair.
- Podcast family only (Chris): the record band (`.rec-top`, `.fig-block`, `.dots20`)
  and the myths band (`.myths`, closing line `p.close`). The sticky phone bar
  (`.mbar`) stays inline on /podcast-guesting on purpose: it must not spread.

Under 961px the header links move into a "Menu" sheet (`generator/chrome/menu.html`,
the button plus a small inline script): it fills the screen under the header,
Escape closes it, Tab stays inside the header, and the page behind does not
scroll (`html.menu-open`). The CSS is in `assets/site-v2.css`, section 10.

The header and footer live once, in `generator/chrome/`. After editing a
partial, run `python3 scripts/stamp_chrome.py` (no arguments) to restamp every
page that carries a marker, and `python3 scripts/stamp_chrome.py --check` to
confirm nothing has drifted (exit 1 if a page is out of date). Only the text
between markers is ever rewritten.

## Get it live (first time, ~10 minutes)
1. **GitHub:** create a new repo at github.com/new named `mikemoll-site`. Upload this folder (drag-and-drop in the browser works, or use GitHub Desktop).
2. **Vercel:** go to vercel.com → Add New → Project → Import `mikemoll-site` → Deploy. You get a live `*.vercel.app` URL in ~30 seconds.
3. **Domain (later):** in Vercel → Project → Settings → Domains, add `mikemoll.co` and follow the DNS steps. Until then, keep the current site up.

## Adding media
Drop images into `public/media/` and reference them as `/media/your-file.webp`.

## Forms
The opt-in and apply forms are placeholders. Point them at your GoHighLevel form embed, or Formspree, before launch.

## Tags are merged, not replaced (and why that's slower)
GHL's `/contacts/upsert` treats the `tags` field you send as a full
**replacement** of the contact's tag list, not an addition — a known,
officially-acknowledged GHL API limitation. `api/lead.js` calls
`getExistingTags()` (in `api/_ghl.js`) before every upsert, merges the new
tag(s) in, and sends the complete set — otherwise every new form submission
would silently erase whatever tags were already on that contact.

There's no reliable "search contact by email" endpoint on this account —
GHL's list endpoint's `query` param mis-parses `+`/`@` in raw email
addresses, so `getExistingTags()` instead paginates the (confirmed
reliable) contact list and matches the email exactly, client-side, capped
at 1,000 contacts. This adds real latency to every form submission —
worst case (a brand-new contact, the common case for lead-magnet forms)
has to scan every page before concluding "not found," which took ~2.5s
against a ~480-contact account in testing. This will get slower as the
contact list grows. If GHL's search-by-email ever gets fixed/documented
properly, replacing the pagination scan with a single indexed lookup would
remove most of this latency.
