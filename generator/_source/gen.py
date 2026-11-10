#!/usr/bin/env python3
# Renders guest-appearance blog posts from content/<ref>.json + base.json into ../blog/<slug>.html
# RETIRED (2026-10-07, blog restyle PR B3). Kept as a record of how the guest posts
# were first generated; it must not run again. The live pages were tuned by hand after its
# last run: they carry the GTM snippet, canonicals, OG/Twitter tags, JSON-LD and the
# design system v2 chrome, and this script writes none of them (it inlines the retired v1
# stylesheet and an old nav and footer instead). Running it would wipe all of that.
#   New posts:   generator/video-blog/build_post.py (category guest-appearance)
#   Restyles:    scripts/migrate_posts_v2.py, then scripts/stamp_chrome.py
import sys
sys.exit("gen.py is retired and refuses to write into blog/: it would wipe the GTM snippet, "
         "canonicals, OG and JSON-LD on the live pages. Build posts with "
         "generator/video-blog/build_post.py instead (see generator/_source/README.md).")
import json, re, pathlib, html, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent   # project root (mikemoll-media)
css = (ROOT/'assets'/'site.css').read_text()
base = json.loads((ROOT/'_source'/'base.json').read_text())

STOP={"the","of","with","and","a","an","for","in","on"}
def initials(name):
    w=[x for x in re.split(r'[^A-Za-z0-9$]+',name) if x]
    sig=[x for x in w if x.lower() not in STOP] or w
    return "".join(x[0].upper() for x in sig[:2])[:3]

NAV='''<nav><div class="wrap nav-in">
    <a href="/" class="logo">Mike<span>.Moll</span></a>
    <div class="nav-links"><a href="/#free-resources">Free Resources</a><a href="/media">Media</a><a href="/#work" class="btn btn-primary">How I Help</a></div>
  </div></nav>'''
FOOT='''<footer><div class="wrap foot-in">
    <a href="/" class="logo">Mike<span>.Moll</span></a>
    <div class="fl"><a href="https://www.youtube.com/@mikemollco" target="_blank" rel="noopener">YouTube</a><a href="https://www.linkedin.com/in/themikemoll/" target="_blank" rel="noopener">LinkedIn</a><a href="https://www.instagram.com/themikemoll/" target="_blank" rel="noopener">Instagram</a></div>
    <p>&copy; 2026 Impact Leads LLC</p>
  </div></footer>'''
CTA='''  <div class="cta">
    <h3>Two ways I can help.</h3>
    <p>I work with experts on two things: making your offer more sellable, and getting you on podcasts so the right buyers find you. Feel free to explore.</p>
    <a href="/consulting" class="btn btn-primary">If you need help selling your offer</a>
    <a href="/podcast-workshop" class="btn btn-ghost">If you want to get on podcasts</a>
  </div>'''

PLAYER_JS = """<script>
(function(){document.querySelectorAll('.cover-hero.playable').forEach(function(el){
function load(){var u=el.dataset.embed,ty=el.dataset.type,h=el.dataset.h||'175',w=document.createElement('div');
if(ty==='youtube'){w.className='player';w.innerHTML='<iframe src="'+u+'?autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen frameborder="0" title="episode"></iframe>';}
else{w.className='player-embed';w.innerHTML='<iframe src="'+u+'" height="'+h+'" allow="autoplay *; encrypted-media *; clipboard-write" loading="lazy" frameborder="0" title="episode"></iframe>';}
el.replaceWith(w);}
el.addEventListener('click',load);el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();load();}});});})();
</script>"""

def player(b):
    show=html.escape(b['show']); host=html.escape(b['host'] or '')
    ep=b.get('episode_link') or ''
    embed=None; etype=None; h='175'
    if b.get('spotify_episode'):
        embed=f"https://open.spotify.com/embed/episode/{b['spotify_episode']}?theme=0"; etype='spotify'; h='232'
    elif 'podcasts.apple.com' in ep and '?i=' in ep:
        embed=ep.replace('https://podcasts.apple.com','https://embed.podcasts.apple.com'); etype='apple'; h='175'
    elif b.get('youtube_id'):
        embed=f"https://www.youtube-nocookie.com/embed/{b['youtube_id']}"; etype='youtube'
    elif b.get('captivate_id'):
        embed=f"https://player.captivate.fm/episode/{b['captivate_id']}"; etype='captivate'; h='170'
    if b.get('cover_url'):
        img=(f'<img width="600" height="600" src="{b["image_local"]}" alt="{show} cover" '
             f'onerror="this.onerror=null;this.src=\'{b["cover_url"]}\'">')
    else:
        img=f'<div class="ph">{initials(b["show"])}</div>'
    hostline=f'<p>Hosted by {host}</p>' if host else ''
    if embed:
        return (f'  <div class="cover-hero playable" data-embed="{embed}" data-type="{etype}" data-h="{h}" role="button" tabindex="0" aria-label="Play this episode">'
                f'<div class="cw">{img}<span class="play-badge">&#9654;</span></div>'
                f'<div class="ch-meta"><span class="s">Guest Appearance</span><h2>{show}</h2>{hostline}<span class="play-cue">Play this episode</span></div></div>\n')
    return (f'  <div class="cover-hero"><div class="cw">{img}</div>'
            f'<div class="ch-meta"><span class="s">Guest Appearance</span><h2>{show}</h2>{hostline}</div></div>\n')

def listen(b):
    if not b['listen']: return ''
    items="".join(f'<a href="{html.escape(x["url"])}" target="_blank" rel="noopener"><span class="d"></span>{html.escape(x["label"])}</a>' for x in b['listen'])
    return f'  <div class="listen">{items}</div>\n'

def about_links(b):
    if not b['about_links']: return ''
    items="".join(f'<a href="{html.escape(x["url"])}" target="_blank" rel="noopener">{html.escape(x["label"])}</a>' for x in b['about_links'])
    return f'    <div class="links">{items}</div>\n'

def render(ref, c):
    b=base[str(ref)]
    title=html.escape(c['post_title'])
    meta=[m for m in [c.get('date',''), (c['length_min']+' min') if c.get('length_min') else ''] if m]+['Guest Appearance']
    meta_html="".join(f'<span>{html.escape(m)}</span>' for m in meta)
    tldr="".join(f'      <li>{x}</li>\n' for x in c['tldr'])
    sections=c.get('intro_html','')
    for s in c.get('sections',[]):
        sections+=f'\n    <h2>{html.escape(s["h2"])}</h2>\n    {s["html"]}'
    doc=f'''<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{html.escape(c.get('meta_description', c['post_title']))}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script src="/visits.js" defer></script>
<style>
{css}
</style></head>
<body>
{NAV}
<article class="article">
  <div class="crumbs"><a href="/">Home</a> / <a href="/blog">Blog</a> / {title}</div>
  <span class="tag-chip">Podcast Episode</span>
  <h1>{title}</h1>
  <div class="post-meta">{meta_html}</div>
{player(b)}{listen(b)}  <div class="takeaways">
    <h2>TLDR</h2>
    <ul>
{tldr}    </ul>
  </div>

  <div class="prose">
    {sections}
  </div>

  <div class="guestcard">
    <span class="lab">About the show</span>
    <h3>{html.escape(b['show'])}</h3>
    {c['about_blurb_html']}
{about_links(b)}  </div>

{CTA}

  <p style="margin-top:34px"><a href="/blog" class="text-link">&larr; All episodes and writing</a></p>
</article>
{FOOT}
{PLAYER_JS}
</body></html>'''
    out=ROOT/'blog'/(b['slug']+'.html'); out.write_text(doc)
    return b['slug']

if __name__=='__main__':
    cdir=ROOT/'_source'/'content'
    done=[]
    for f in sorted(cdir.glob('*.json')):
        c=json.loads(f.read_text()); ref=c['ref']
        done.append(render(ref,c))
    print("rendered",len(done),"posts:")
    for s in done: print("  blog/"+s+".html")
