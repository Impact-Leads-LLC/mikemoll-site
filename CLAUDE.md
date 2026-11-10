# mikemoll.co: instructions for AI agents

Mike Moll's coaching site (podcast guesting first). Static HTML on Vercel: a merge to `main` is
production. README.md has the page conventions and the design system; read it before editing a page.

## Every new page goes through page-pipeline

**Every new page and every copy rewrite goes through `ai-skills/shared/page-pipeline`**
(`/Users/mikemoll/Claude/GitHub/ai-skills/shared/page-pipeline/SKILL.md`, read it whole). It picks or
adds the `brain.web_page_queue` row, checks which URL already owns the query, runs the gates and the
cadence check, records the review and opens the PR. The conventions in README.md are its step 4.

- **Where pages come from:** `brain.web_page_queue` with `site_key = 'coaching'` (second brain,
  project `rwycwbyfigxgvykuutwr`). Only `approved` rows get built. A page Mike names that isn't queued
  gets a row first (page-pipeline `references/queue-lifecycle.md`). Never start from `_template.html`
  without a row.
- **Blog posts from a video:** `ai-skills/coaching/video-blog`, which runs page-pipeline's overlap,
  gates, cadence and publish steps. `generator/video-blog/build_post.py` is its tool, not a way around
  the pipeline.
- **Small fixes** (titles, meta descriptions, alt text, schema, internal links): `ai-skills/shared/website-seo`
  Fix mode, one PR.
- **Copy gate:** `ai-skills/shared/anti-ai-writing` (checker, read-aloud test, critic agent) before
  Mike sees any copy.

## The audit gate for this repo

Run it from the repo root on your branch:

```bash
/usr/bin/python3 -I /Users/mikemoll/Claude/GitHub/ai-skills/shared/website-seo/scripts/seo_audit.py \
  --dir . --site https://www.mikemoll.co --exclude generator --baseline origin/main
```

- `--exclude generator`: `generator/chrome/*.html` are header and footer partials, not pages. Without
  it the audit reports about 65 false ERRORs.
- `--baseline origin/main`: the gate is "no new ERROR against main", not "no ERROR". Main carries one
  known ERROR today (S12: nothing links to `/mastermind.html`), which has nothing to do with a new page.
  If your copy of website-seo predates baseline mode, run the same command without `--baseline` on
  `origin/main` and on your branch, and compare the ERROR lists.
- Use `/usr/bin/python3`: the python.org 3.14 on this Mac fails SSL for `--url` audits.

Also run `python3 scripts/stamp_chrome.py --check` after touching the header or footer.

## Do not touch without Mike

- **Forms and lead routing:** `data-lead` forms and their fields, `forms.js`, `visits.js`, everything
  in `api/` (`lead.js`, `register.js`), and the booking scripts on `/booked`.
- **Tracking:** the Google Tag Manager container `GTM-WD3WQ8N` (the `<head>` script and the
  `<noscript>` iframe after `<body>`). Keep both on every page you copy or create.
- **`vercel.json`:** redirects, rewrites, headers, clean URLs.
- **SEO settings:** canonicals, redirects, `robots.txt`, noindex flags and the www host redirect.
  Titles, meta descriptions, Open Graph tags and JSON-LD change only through page-pipeline or
  website-seo Fix mode, never as a side effect of a design or copy edit. Add a new indexable page to
  `sitemap.xml` and `llms.txt` (page-pipeline does this).
- Existing `href`s and `data-cta` attributes.

## How to work in this repo

- Other sessions use this same checkout on their own branches. Run `git branch --show-current` before
  committing, or better, work in a worktree from `origin/main`.
- Branch, pull request, check the Vercel preview at 390px and 1280px, then merge. Never push to `main`
  directly and never force-push.
- Images: `ai-skills/shared/website-image-seo` (descriptive file name, compressed, alt text, real
  width and height on every `<img>`).
