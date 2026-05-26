# Letterboxd Logger

A Chrome extension that detects the movie you're watching and logs it to your Letterboxd diary — without leaving the tab.

**[Install from Chrome Web Store](https://chromewebstore.google.com/detail/letterboxd-logger/olkcnoejmimamfgcicapioeobmoiahcc)**

---

![Letterboxd Logger popup showing Oppenheimer detected on Netflix with star rating UI](assets/screenshot-1.png)

---

## What it does

You finish a movie on Netflix. You want to log it on Letterboxd. Normally: open a new tab, search for the film, find the right entry, click the diary icon, set your rating. Five steps, broken flow.

With Letterboxd Logger: click the extension icon, rate the film, hit Log. Done in under ten seconds, without leaving Netflix.

The extension detects the movie title from the player page, searches Letterboxd for the matching film, and submits your diary entry — rating, review, watched date, and like — directly to the Letterboxd API using your existing browser session. No account setup. No API keys. No separate login.

## Supported platforms

| Platform | Detection method |
|---|---|
| Netflix | `[data-uia="video-title"]` → `h4` in player → `document.title` |
| MUBI | `document.title` (includes year: `"Film Name (2000) \| MUBI"`) |
| Amazon Prime Video | `h1[class*="title"]` → `document.title` |
| JioHotstar | `h1` → `document.title` (strips "Watch … - JioHotstar") |

## Features

- **Auto-detects** the movie title from whichever platform you're on
- **Half-star ratings** — 0.5 through 5, matching Letterboxd's own interface
- **Quick review** — write a short note without opening a new tab
- **Watched today** toggle with automatic diary date
- **Like** toggle
- **Wrong film?** — manual title correction if the search picks the wrong result
- **Login check** — shows a clear error if you're not signed into Letterboxd, rather than silently failing

## How it works

### Title detection

Each platform exposes the movie title differently. The content script (`content.js`) runs a priority-ordered selector chain for each platform and falls back to `document.title` with suffix stripping. MUBI is the cleanest — their page title includes the year in parentheses, which gets parsed out and passed to the Letterboxd search.

### Letterboxd integration

Letterboxd doesn't have a public API. The extension works around this in two ways:

**Search:** The `/s/search/films/{query}/` endpoint returns an HTML fragment (loaded via AJAX on the main search page) that includes React component data attributes. The film's internal ID (`lid`) is embedded as JSON inside `data-postered-identifier` on each result element — parsed and stored for the subsequent API calls.

**Logging:** Reverse-engineering the network traffic from Letterboxd's own web app revealed two undocumented endpoints:
- `PATCH /api/v0/me/rate/{filmId}` — sets the star rating
- `POST /api/v0/production-log-entries` — creates the diary entry with date, like, and review

Both use the `com.xk72.webparts.csrf` cookie as the `x-csrf-token` header. The extension reads this via the `chrome.cookies` API (no scraping) and attaches it to each request alongside the user's existing session cookies.

**Cloudflare:** The Letterboxd API returns 403 from the extension's background service worker — Cloudflare blocks requests without a browser fingerprint. All fetch calls run from the popup context instead, which Chrome sends with full browser headers.

### Auth check

On popup open, the extension checks for the `letterboxd.signed.in.as` session cookie. If absent, it surfaces an error with a direct link to the Letterboxd sign-in page rather than letting the user fill out a form that will silently fail.

## Architecture

```
letterboxd-extension/
├── manifest.json      Manifest V3 config — permissions, host rules, content scripts
├── content.js         Injected into streaming tabs — platform detection, title extraction
├── popup.html         Extension popup UI — states: detecting, confirm, logging, done, error
├── popup.js           Popup logic — auth check, Letterboxd search, rating UI, diary submission
├── background.js      Service worker — available for future use
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

**Manifest V3.** The extension uses the current Chrome extension standard: declarative content scripts, a service worker background script, and `chrome.scripting` for programmatic injection when the content script hasn't loaded yet.

**No dependencies.** Zero npm packages. Zero build step. Plain HTML, CSS, and vanilla JavaScript — load it directly from the folder.

## Installation

### From the Chrome Web Store
[Install Letterboxd Logger](https://chromewebstore.google.com/detail/letterboxd-logger/olkcnoejmimamfgcicapioeobmoiahcc) — one click, no setup.

### From source
```bash
git clone https://github.com/prashantapurkayastha/letterboxd-logger.git
```
1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the cloned folder
4. The extension icon appears in your toolbar

**Requirement:** you must be logged into Letterboxd in the same Chrome browser.

## Privacy

The extension communicates only with `letterboxd.com`, using the user's existing login session. It reads one cookie (`com.xk72.webparts.csrf`) for CSRF authentication and no other cookies. No data is collected, stored, or sent to any third party. Full privacy policy: [prashantapurkayastha.github.io/letterbox-track](https://prashantapurkayastha.github.io/letterbox-track/)

## Known limitations

- **TV shows** — the extension runs on Netflix watch pages for both movies and shows. It will detect a show's title but Letterboxd only tracks films, so the search may return no result.
- **Letterboxd session scope** — the CSRF token is tied to your browser session. If Letterboxd logs you out mid-session, the next log attempt will fail with a 403 until you sign back in.
- **MUBI locale** — tested on `mubi.com/en/in/` and `mubi.com/en/` paths. Other locale prefixes should work but haven't been verified across all regions.

## Roadmap

- [ ] Keyboard shortcut (`Cmd+Shift+L`) to open the popup without clicking
- [ ] Film poster shown in popup from Letterboxd search result
- [ ] Rewatch toggle
- [ ] JioHotstar TV show support
- [ ] Firefox port (Manifest V3 compatible with minor adjustments)

## License

MIT
