// content.js — detects movie info from Netflix, MUBI, Prime Video, and JioHotstar

(function () {
  const host = window.location.hostname;
  const href = window.location.href;

  function getPlatform() {
    if (host.includes("netflix.com")) return "Netflix";
    if (host.includes("mubi.com")) return "MUBI";
    if (host.includes("primevideo.com")) return "Prime Video";
    if (host.includes("hotstar.com")) return "JioHotstar";
    return null;
  }

  // ── Netflix ───────────────────────────────────────────────────────────────
  function getNetflixInfo() {
    const dataTitle = document.querySelector('[data-uia="video-title"]');
    if (dataTitle?.textContent.trim()) return { title: cleanNetflix(dataTitle.textContent.trim()) };
    const h4 = document.querySelector('.watch-video--player-view h4, .VideoContainer h4, .ellipsize-text h4');
    if (h4?.textContent.trim()) return { title: cleanNetflix(h4.textContent.trim()) };
    if (document.title) return { title: cleanNetflix(document.title) };
    return null;
  }

  function cleanNetflix(raw) {
    return raw
      .replace(/\s*[-–|]\s*Watch.*$/i, "")
      .replace(/\s*[-–|]\s*Netflix.*$/i, "")
      .replace(/^\s*Netflix\s*[-–|]\s*/i, "")
      .replace(/\s*\|\s*Netflix.*$/i, "")
      .replace(/\s*\(S\d+:E\d+\).*/i, "")
      .replace(/\s*Season \d+.*/i, "")
      .trim();
  }

  // ── MUBI ──────────────────────────────────────────────────────────────────
  function getMubiInfo() {
    const raw = document.title;
    if (!raw) return null;
    const match = raw.match(/^(.+?)\s*\((\d{4})\)\s*\|/);
    if (match) return { title: match[1].trim(), year: match[2] };
    const title = raw.replace(/\s*\|\s*MUBI.*$/i, "").trim();
    return title ? { title } : null;
  }

  // ── Prime Video ───────────────────────────────────────────────────────────
  function getPrimeInfo() {
    const h1 = document.querySelector('h1[class*="title"]');
    if (h1?.textContent.trim()) return { title: h1.textContent.trim() };
    const autoTitle = document.querySelector('[data-automation-id*="title"]');
    if (autoTitle?.textContent.trim()) return { title: autoTitle.textContent.trim() };
    if (document.title) {
      const title = document.title.replace(/^Prime Video:\s*/i, "").trim();
      if (title) return { title };
    }
    return null;
  }

  // ── JioHotstar ────────────────────────────────────────────────────────────
  function getHotstarInfo() {
    // Strategy 1: h1 — consistently present on movie/watch pages
    const h1 = document.querySelector('h1');
    if (h1?.textContent.trim()) return { title: h1.textContent.trim() };

    // Strategy 2: document.title — "Watch Movie Name - JioHotstar"
    if (document.title) {
      const title = document.title
        .replace(/^Watch\s+/i, "")
        .replace(/\s*[-–]\s*JioHotstar.*$/i, "")
        .replace(/\s*[-–]\s*Hotstar.*$/i, "")
        .trim();
      if (title) return { title };
    }
    return null;
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getMovieInfo") {
      const platform = getPlatform();
      if (!platform) {
        sendResponse({ success: false, error: "Unsupported platform." });
        return true;
      }

      let info = null;
      if (platform === "Netflix") info = getNetflixInfo();
      if (platform === "MUBI") info = getMubiInfo();
      if (platform === "Prime Video") info = getPrimeInfo();
      if (platform === "JioHotstar") info = getHotstarInfo();

      if (info?.title) {
        sendResponse({ success: true, title: info.title, year: info.year || null, platform, url: href });
      } else {
        sendResponse({ success: false, error: `Could not detect movie title on ${platform}. Try refreshing the page.` });
      }
    }
    return true;
  });
})();
