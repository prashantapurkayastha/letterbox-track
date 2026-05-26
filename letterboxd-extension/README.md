# Letterboxd Logger — Chrome Extension

Log movies from Netflix to Letterboxd in one click.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select this folder (`letterboxd-extension/`)
5. The extension icon appears in your Chrome toolbar

## How to use

1. Open Netflix and start playing a movie
2. Click the Letterboxd Logger extension icon in your toolbar
3. The extension auto-detects the movie name
4. Rate it (optional), add a quick review (optional), toggle options
5. Click **Log to Letterboxd**

You must be logged into Letterboxd in Chrome for the one-click log to work.
If not logged in, clicking **Log** will open the film page on Letterboxd instead.

## Notes

- Works on `netflix.com/watch/*` URLs (movies and shows)
- Title detection uses multiple DOM selectors with `document.title` as fallback
- Letterboxd lookup searches for the film and picks the first result
- "Wrong film?" lets you manually correct the title before logging
- Half-star ratings are supported

## Files

```
letterboxd-extension/
├── manifest.json      ← Extension config, permissions
├── content.js         ← Injected into Netflix tabs, extracts title
├── popup.html         ← Extension popup UI
├── popup.js           ← Popup logic: detection, search, rating, log
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Adding more platforms (Phase 2)

Add to `manifest.json` under `host_permissions`:
```json
"https://www.primevideo.com/*",
"https://mubi.com/*",
"https://www.hotstar.com/*"
```

Add to `content_scripts` matches:
```json
"https://www.primevideo.com/detail/*",
"https://mubi.com/films/*",
"https://www.hotstar.com/*"
```

Then extend `content.js` with platform-specific selectors for each.
