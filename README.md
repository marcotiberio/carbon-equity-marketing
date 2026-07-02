# Carbon Equity — Display Banners

Google Display Network (GDN) banner creatives with a **live copy editor**. All
ad copy lives in one file (`content.json`); the banner layouts/animations live in
`templates/`. Edit copy in the browser, preview every size live, then build
self-contained creatives ready to upload to Google Ads.

## Sizes

| Size    | Placement            | Copy |
|---------|----------------------|------|
| 300×600 | Half page            | 4 paragraphs + 3-line headline |
| 160×600 | Skyscraper           | 4 paragraphs + 3-line headline |
| 320×100 | Large mobile banner  | 3-line headline |
| 728×90  | Leaderboard          | 3 rotating slides + button |
| 320×50  | Mobile leaderboard   | 3 rotating slides (eyebrow + headline) |

## Editing copy (the "CMS")

```bash
npm run dev
```

Open the printed URL (**http://localhost:4000/editor/**). You get every banner
rendered live at true pixel size on the right and copy fields on the left — type
and the previews update instantly. **Save** writes straight back to
`content.json`. Commit and push to publish.

> The editor is also published to GitHub Pages (see below). There, since there's
> no write backend, **Save** downloads an updated `content.json` for you to
> commit — the copy still lives in git either way.

Only text is editable: layout, fonts, colours and animation are locked in the
templates, so editing copy can never break a design.

## Building upload-ready creatives

```bash
npm run build     # -> dist/<size>/index.html + only the assets each one uses
npm run zip       # -> dist/<size>.zip, ready to upload to Google Ads
```

Each `dist/<size>/` folder (or `.zip`) is fully self-contained — no runtime
fetches — as GDN requires. `dist/index.html` is a preview gallery.

## How it works

```
content.json      one source of truth — text only
templates/*.html  the 5 banners; copy nodes marked data-ce="…", logo tokenised
render.mjs        template + copy -> final HTML (shared by build AND editor)
build.mjs         writes dist/ creatives, copies each banner's assets
server.mjs        zero-dep dev server + saves content.json (npm run dev)
editor/           the live visual copy editor
assets/           fonts, hero image, contour lines (shared source)
```

`render.mjs` bakes the copy into a `window.CE` object plus a tiny hydration
script, so there's exactly one code path from copy to pixels whether you're in
the live editor or the production build.

## Publishing / GitHub Pages

Pushing to `main` runs `.github/workflows/pages.yml`, which rebuilds `dist/` and
deploys the editor + previews. Enable it once under **Settings → Pages → Build
and deployment → Source: GitHub Actions**. The live editor is then at
`…github.io/<repo>/editor/`.

## Note on GDN weight limits

The image-based units (300×600, 160×600, 320×100) share `hero.jpg` +
`contour-lines.png` + the two web fonts (~195 KB), which is over the 150 KB
initial-load ceiling some GDN placements enforce. If a creative is rejected for
size, compress `assets/hero.jpg` / `assets/contour-lines.png`; the text-only
units (728×90, 320×50) are already well under.
