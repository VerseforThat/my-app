# Verse for That — Legal Site

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
