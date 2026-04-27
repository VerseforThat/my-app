"""
Build script — renders the Verse for That legal Markdown into styled
HTML pages for GitHub Pages hosting. Run once whenever the .md files
change. Output goes to /app/memory/legal-site/ ready to push.
"""
import os
import markdown

OUT_DIR = "/app/memory/legal-site"
SRC_DIR = "/app/memory"

CSS = """
:root {
  --bg: #F8F7F4;
  --surface: #FFFFFF;
  --text: #0B1426;
  --text-soft: #4F5A74;
  --accent: #6E4E14;
  --gold: #B8923F;
  --line: rgba(11, 20, 38, 0.10);
}
* { box-sizing: border-box; }
html { font-size: 17px; -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 56px 28px 96px;
}
@media (max-width: 540px) {
  .wrap { padding: 40px 22px 72px; }
  html { font-size: 16px; }
}
.eyebrow {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 18px;
  font-weight: 500;
}
h1 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-weight: 600;
  font-size: 2.6rem;
  line-height: 1.15;
  letter-spacing: -0.01em;
  margin: 0 0 8px;
}
h2 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-weight: 600;
  font-size: 1.55rem;
  line-height: 1.25;
  margin: 48px 0 14px;
  letter-spacing: -0.005em;
}
h3 {
  font-family: 'Inter', -apple-system, sans-serif;
  font-weight: 600;
  font-size: 1.05rem;
  margin: 28px 0 10px;
  color: var(--text);
}
p, li {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 1.13rem;
  color: var(--text);
}
ul, ol { padding-left: 22px; }
li { margin: 6px 0; }
a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: rgba(110, 78, 20, 0.4);
}
a:hover { text-decoration-color: var(--accent); }
strong, b { color: var(--text); font-weight: 700; }
em, i { color: var(--text-soft); }
hr {
  border: none;
  border-top: 1px solid var(--line);
  margin: 36px 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 18px 0;
  background: var(--surface);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 0 var(--line);
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 0.95rem;
}
th, td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}
th {
  background: rgba(110, 78, 20, 0.06);
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--accent);
}
tr:last-child td { border-bottom: none; }
code {
  font-family: 'SFMono-Regular', Menlo, Monaco, monospace;
  font-size: 0.92em;
  background: rgba(11, 20, 38, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
}
.meta {
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 13px;
  color: var(--text-soft);
  margin-top: 10px;
}
.nav {
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 14px;
  margin-bottom: 36px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}
.nav a { margin-right: 18px; text-decoration: none; color: var(--text-soft); }
.nav a:hover { color: var(--accent); }
.nav a.active { color: var(--accent); font-weight: 600; }
.footer {
  margin-top: 64px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 13px;
  color: var(--text-soft);
  text-align: center;
}
.footer .name { color: var(--accent); font-weight: 600; }
"""

GOOGLE_FONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">'
)


def page_template(title: str, page_key: str, body_html: str) -> str:
    nav_html = (
        '<nav class="nav">'
        f'  <a href="./" class="{ "active" if page_key == "home" else ""}">Home</a>'
        f'  <a href="./privacy.html" class="{ "active" if page_key == "privacy" else ""}">Privacy Policy</a>'
        f'  <a href="./terms.html" class="{ "active" if page_key == "terms" else ""}">Terms of Service</a>'
        '</nav>'
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#F8F7F4">
  <title>{title} · Verse for That</title>
  <meta name="description" content="Legal documents for Verse for That — a Bible verse companion app.">
  {GOOGLE_FONTS}
  <style>{CSS}</style>
</head>
<body>
  <div class="wrap">
    {nav_html}
    {body_html}
    <div class="footer">
      <p>© 2026 <span class="name">Verse for That</span> · Wendy Ardolino · <a href="mailto:tapworksapp@gmail.com">tapworksapp@gmail.com</a></p>
    </div>
  </div>
</body>
</html>
"""


def render_md_file(md_path: str, page_key: str, page_title: str) -> str:
    with open(md_path, "r") as f:
        md_text = f.read()
    html_body = markdown.markdown(
        md_text,
        extensions=["tables", "extra", "sane_lists"],
        output_format="html5",
    )
    return page_template(page_title, page_key, html_body)


def write(path: str, content: str) -> None:
    with open(path, "w") as f:
        f.write(content)
    print(f"  wrote {path} ({len(content):,} bytes)")


# ---------------- Build ---------------------------------------------------
print("Building Verse for That legal site...")

# Privacy
priv_html = render_md_file(
    f"{SRC_DIR}/privacy-policy.md", "privacy", "Privacy Policy"
)
write(f"{OUT_DIR}/privacy.html", priv_html)

# Terms
terms_html = render_md_file(
    f"{SRC_DIR}/terms-of-service.md", "terms", "Terms of Service"
)
write(f"{OUT_DIR}/terms.html", terms_html)

# Index landing page
index_body = """
<p class="eyebrow">Verse for That</p>
<h1>Legal &amp; Privacy</h1>
<p class="meta">A Bible verse companion app by Wendy Ardolino.</p>

<p>Verse for That is a quiet, judgment-free space. When life gets hard, tell us what
you're going through and we'll match a Bible verse to meet you there. Hear it spoken
aloud, save what speaks to you, and revisit it whenever you need.</p>

<p>This page links to the legal documents that govern your use of the app:</p>

<h2>Documents</h2>
<ul>
  <li><a href="./privacy.html"><strong>Privacy Policy</strong></a> — what data we collect, how we use it, and your rights.</li>
  <li><a href="./terms.html"><strong>Terms of Service</strong></a> — the agreement between you and us when you use the app.</li>
</ul>

<h2>Support</h2>
<p>For questions, account deletion requests, or anything else, please email
<a href="mailto:tapworksapp@gmail.com">tapworksapp@gmail.com</a>.</p>

<hr>
<p><em>Verse for That is an independent app and is not affiliated with, endorsed by, or sponsored by Anthropic, ElevenLabs, MongoDB, Apple, Google, Biblica, or any church or religious organization.</em></p>
"""
write(f"{OUT_DIR}/index.html", page_template("Legal", "home", index_body))

# .nojekyll — tells GitHub Pages to skip Jekyll processing (faster, no underscore-file issues)
write(f"{OUT_DIR}/.nojekyll", "")

# README.md for the repo
readme = """# Verse for That — Legal Site

Static legal & privacy site for the **Verse for That** mobile app, hosted on GitHub Pages.

**Live URLs**

- Home: https://wendyardolino.github.io/my-app/
- Privacy Policy: https://wendyardolino.github.io/my-app/privacy.html
- Terms of Service: https://wendyardolino.github.io/my-app/terms.html

## What's here

| File | Purpose |
|------|---------|
| `index.html` | Landing page with links to both documents |
| `privacy.html` | Full Privacy Policy |
| `terms.html` | Full Terms of Service |
| `.nojekyll` | Tells GitHub Pages to skip Jekyll processing |

## Updating

To update the documents:

1. Edit the source Markdown files in `/app/memory/privacy-policy.md` and
   `/app/memory/terms-of-service.md` inside the main repo (or wherever you keep them).
2. Re-run `python3 build.py` to regenerate the HTML.
3. Commit and push — GitHub Pages will rebuild automatically.

## How it was built

A small Python script (`build.py`) converts the Markdown files into styled HTML
using the `markdown` package. The styling matches the **Verse for That** app
palette — warm off-white background, navy text, dark-gold accents, with
Cormorant Garamond serif body type.

---

© 2026 Wendy Ardolino · tapworksapp@gmail.com
"""
write(f"{OUT_DIR}/README.md", readme)

# Copy the build script into the site folder for reproducibility
import shutil
shutil.copy(__file__, f"{OUT_DIR}/build.py")
print(f"  copied {__file__} -> {OUT_DIR}/build.py")

print("\nDone. Site is ready in:", OUT_DIR)
print("Files:")
for fn in sorted(os.listdir(OUT_DIR)):
    p = os.path.join(OUT_DIR, fn)
    print(f"  {fn:20s} {os.path.getsize(p):>8,} bytes")
