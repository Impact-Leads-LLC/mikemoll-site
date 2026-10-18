# Deploy instructions — Mike Moll "Media & Guest Appearances" section

**What this is:** a new Media page, a Guest-Appearances directory, and 49 guest-appearance
blog posts for Mike Moll's site (the dark editorial "Undervalued Expert" design). Fully
built, SEO/GEO-optimized, and ready to go live.

**Target repo:** `github.com/Impact-Leads-LLC/mikemoll-site` (this repo deploys the live https://www.mikemoll.co site).

---

## Files to add to the repo (all live in THIS folder)

| Local file | Commit to repo path | Live URL |
|---|---|---|
| `media.html` | `/media.html` | https://www.mikemoll.co/media |
| `guest-appearances.html` | `/guest-appearances.html` | https://www.mikemoll.co/guest-appearances |
| `blog/<slug>.html` (49 files) | `/blog/<slug>.html` | https://www.mikemoll.co/blog/<slug> |

That's it for what MUST be added. See caveats below for `sitemap.xml` / `robots.txt` / `llms.txt`.

## How the repo works (match these conventions — already followed in the files)
- **Extensionless URLs**: the site serves `/blog/<slug>` from `blog/<slug>.html` (same as existing posts). Keep the `.html` files in `/blog/`.
- **CSS is inlined per page** (the repo does NOT use a shared stylesheet). Every file here already has the full dark-theme CSS inlined in a `<style>` block — do not strip it, do not add a stylesheet link.
- **Cover images load from external CDN URLs** (Apple/Spotify/YouTube), so **no image files are needed** for this to render. (Optional later: host local copies in `/images/` and repoint; a `download-covers.sh` script is in this folder if wanted.)
- **Blog category / tag**: these posts use the site's existing **"Guest Appearances"** category, with the "Podcast Episode" chip — matches the current blog taxonomy.
- **CTA links** point to `/consulting` and `/podcast-workshop` (existing pages). Nav links point to `/`, `/#free-resources`, `/media`, `/#work`.

## MUST DO to avoid breaking the existing site
1. **Do NOT blindly overwrite `robots.txt` or `sitemap.xml`.** The `robots.txt`, `sitemap.xml`, and `llms.txt` in this folder cover ONLY the new pages. If the repo already has these files, MERGE instead of replace:
   - Add every URL from this folder's `sitemap.xml` into the existing sitemap.
   - Keep the existing `robots.txt`; just make sure it isn't blocking `/media`, `/guest-appearances`, or `/blog/`, and that AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended) are allowed.
   - If the repo has NO such files, you can use the ones here as-is.
2. **Add "Media" to the site-wide header nav.** The new pages already include it, but the site's shared template/nav (e.g. `_template.html` and other existing pages) needs a link so "Media" shows everywhere:
   ```html
   <a href="/media">Media</a>
   ```
   Place it in the nav between the "Free Resources" link and the "How I Help" button. (Media is a standalone credibility page — it is NOT a free resource.)

## SEO/GEO already built in (no action needed, just don't strip it)
- Unique `<title>` + meta description per page; self-referencing absolute `<link rel="canonical">` to `https://www.mikemoll.co/...`; `robots` directive for rich previews.
- JSON-LD per episode: `PodcastEpisode` + `BreadcrumbList` + `Person` (Mike Moll) + `Organization`, `@id`-linked, socials in `sameAs`. (Validated, zero errors.)
- Open Graph + Twitter card tags on every page.
- `sitemap.xml`, `robots.txt` (AI crawlers welcomed), `llms.txt`.

## The 49 blog post slugs included
- blog/21st-century-entrepreneurship.html  ->  /blog/21st-century-entrepreneurship
- blog/6-figure-rebels-podcast.html  ->  /blog/6-figure-rebels-podcast
- blog/agency-profit-podcast.html  ->  /blog/agency-profit-podcast
- blog/be-bonfire-entrepreneurs.html  ->  /blog/be-bonfire-entrepreneurs
- blog/build-your-network.html  ->  /blog/build-your-network
- blog/business-mastermind-podcast.html  ->  /blog/business-mastermind-podcast
- blog/coach-up-with-kaneshi.html  ->  /blog/coach-up-with-kaneshi
- blog/digital-nomad-stories.html  ->  /blog/digital-nomad-stories
- blog/dogoodwork-podcast.html  ->  /blog/dogoodwork-podcast
- blog/downsizing-and-rebuilding-a-team-alicia-butler-pierre.html  ->  /blog/downsizing-and-rebuilding-a-team-alicia-butler-pierre
- blog/find-it-with-debbie.html  ->  /blog/find-it-with-debbie
- blog/fox-talks-business-podcast.html  ->  /blog/fox-talks-business-podcast
- blog/from-the-frame-up.html  ->  /blog/from-the-frame-up
- blog/global-citizen-life-podcast.html  ->  /blog/global-citizen-life-podcast
- blog/hailey-rowe-podcast.html  ->  /blog/hailey-rowe-podcast
- blog/innovabuzz-podcast.html  ->  /blog/innovabuzz-podcast
- blog/keepin-it-real-wcaramel-as-we-say-100.html  ->  /blog/keepin-it-real-wcaramel-as-we-say-100
- blog/leveraging-video-to-close-contracts-sara-nay.html  ->  /blog/leveraging-video-to-close-contracts-sara-nay
- blog/livin-that-life-digital-nomad-lifestyles.html  ->  /blog/livin-that-life-digital-nomad-lifestyles
- blog/misfit-entrepreneur.html  ->  /blog/misfit-entrepreneur
- blog/sage-thought-leadership-podcast.html  ->  /blog/sage-thought-leadership-podcast
- blog/sales-genius.html  ->  /blog/sales-genius
- blog/sproutworth-predictable-b2b-success.html  ->  /blog/sproutworth-predictable-b2b-success
- blog/startup-canada-podcast.html  ->  /blog/startup-canada-podcast
- blog/step-it-up-entrepreneur.html  ->  /blog/step-it-up-entrepreneur
- blog/take-back-time.html  ->  /blog/take-back-time
- blog/that-entrepreneur-life.html  ->  /blog/that-entrepreneur-life
- blog/the-10-minute-entrepreneur.html  ->  /blog/the-10-minute-entrepreneur
- blog/the-100-mba-show.html  ->  /blog/the-100-mba-show
- blog/the-authors-unite-show.html  ->  /blog/the-authors-unite-show
- blog/the-brand-called-you-tbcy.html  ->  /blog/the-brand-called-you-tbcy
- blog/the-cannoli-coach.html  ->  /blog/the-cannoli-coach
- blog/the-course-creation-podcast.html  ->  /blog/the-course-creation-podcast
- blog/the-entrepreneurs-tribe-podcast.html  ->  /blog/the-entrepreneurs-tribe-podcast
- blog/the-maverick-paradox-podcast.html  ->  /blog/the-maverick-paradox-podcast
- blog/the-more-life-podcast.html  ->  /blog/the-more-life-podcast
- blog/the-peak-performance-greatness-show.html  ->  /blog/the-peak-performance-greatness-show
- blog/the-resourceful-agent-radio-show.html  ->  /blog/the-resourceful-agent-radio-show
- blog/the-sales-evangelist.html  ->  /blog/the-sales-evangelist
- blog/the-solopreneur-grind-podcast.html  ->  /blog/the-solopreneur-grind-podcast
- blog/the-story-engine.html  ->  /blog/the-story-engine
- blog/the-thoughtful-entrepreneur.html  ->  /blog/the-thoughtful-entrepreneur
- blog/the-unforget-yourself-show.html  ->  /blog/the-unforget-yourself-show
- blog/tribe-of-leaders.html  ->  /blog/tribe-of-leaders
- blog/why-youre-working-too-hard-for-too-little-joe-rando.html  ->  /blog/why-youre-working-too-hard-for-too-little-joe-rando
- blog/win-the-hour-win-the-day.html  ->  /blog/win-the-hour-win-the-day
- blog/work-home-rockstar.html  ->  /blog/work-home-rockstar
- blog/work-in-programming.html  ->  /blog/work-in-programming
- blog/you-can-overcome-anything-podcast-show.html  ->  /blog/you-can-overcome-anything-podcast-show

---
_Reference: a live preview of the media page + one sample post is at https://mikemoll-media-preview.vercel.app (separate Vercel project, for visual reference only — the real deploy is this repo)._
