// popup.js — controls the extension popup UI

const RATING_LABELS = {
  0.5: "Half a star — Painful",
  1: "One star — Bad",
  1.5: "One and a half — Poor",
  2: "Two stars — Mediocre",
  2.5: "Two and a half — Okay",
  3: "Three stars — Good",
  3.5: "Three and a half — Very good",
  4: "Four stars — Great",
  4.5: "Four and a half — Excellent",
  5: "Five stars — A masterpiece",
};

let state = {
  title: null,
  year: null,
  platform: "Netflix",
  filmId: null,
  productionId: null,
  slug: null,
  letterboxdUrl: null,
  rating: 0,
  watchedToday: true,
  liked: false,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function showState(name) {
  ["detecting", "error", "confirm", "logging", "done"].forEach((s) => {
    $(`state-${s}`).classList.toggle("active", s === name);
  });
}

// ── Star rating ───────────────────────────────────────────────────────────────
function buildStars() {
  const wrap = $("stars-wrap");
  wrap.innerHTML = "";
  // 5 full stars, each split into two halves for half-star support
  for (let i = 1; i <= 5; i++) {
    // half star
    const half = document.createElement("span");
    half.className = "star half-star";
    half.dataset.value = i - 0.5;
    half.textContent = "½";
    half.title = `${i - 0.5} stars`;
    // full star
    const full = document.createElement("span");
    full.className = "star";
    full.dataset.value = i;
    full.textContent = "★";
    full.title = `${i} stars`;

    [half, full].forEach((el) => {
      el.addEventListener("mouseenter", () => highlightStars(parseFloat(el.dataset.value)));
      el.addEventListener("mouseleave", () => highlightStars(state.rating));
      el.addEventListener("click", () => setRating(parseFloat(el.dataset.value)));
    });

    wrap.appendChild(half);
    wrap.appendChild(full);
  }
}

function highlightStars(value) {
  document.querySelectorAll(".star").forEach((el) => {
    el.classList.toggle("active", parseFloat(el.dataset.value) <= value);
  });
  $("rating-label").textContent = value > 0
    ? RATING_LABELS[value] || ""
    : "Tap to rate";
}

function setRating(value) {
  state.rating = value;
  highlightStars(value);
}

// ── Toggle controls ───────────────────────────────────────────────────────────
function initToggles() {
  $("toggle-watched").addEventListener("click", () => {
    state.watchedToday = !state.watchedToday;
    $("toggle-watched-el").classList.toggle("on", state.watchedToday);
  });
  $("toggle-like").addEventListener("click", () => {
    state.liked = !state.liked;
    $("toggle-like-el").classList.toggle("on", state.liked);
  });
}

// ── Wrong film override ───────────────────────────────────────────────────────
function initWrongFilm() {
  $("wrong-film-btn").addEventListener("click", () => {
    const wrap = $("manual-wrap");
    wrap.classList.toggle("show");
    if (wrap.classList.contains("show")) {
      $("manual-input").value = state.title;
      $("manual-input").focus();
      $("manual-input").addEventListener("input", (e) => {
        state.title = e.target.value;
        $("film-title").textContent = e.target.value;
      });
    }
  });
}

// ── Letterboxd API calls ──────────────────────────────────────────────────────

function getCsrf() {
  return new Promise(resolve => {
    chrome.cookies.get({ url: "https://letterboxd.com", name: "com.xk72.webparts.csrf" },
      cookie => resolve(cookie ? cookie.value : null));
  });
}

async function findOnLetterboxd(title) {
  const query = encodeURIComponent(title);
  const fallback = { filmId: null, slug: null, url: `https://letterboxd.com/search/films/${query}/` };
  try {
    const resp = await fetch(`https://letterboxd.com/s/search/films/${query}/`, { credentials: "include" });
    console.log("Search status:", resp.status);
    if (!resp.ok) return fallback;

    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const component = doc.querySelector('.react-component[data-item-slug]');
    if (!component) { console.warn("No film component found"); return fallback; }

    const slug = component.dataset.itemSlug;
    let filmId = null;
    let productionId = null;
    try {
      const identifier = JSON.parse(component.dataset.posteredIdentifier);
      filmId = identifier.lid;
    } catch (e) { console.warn("Could not parse filmId:", e); }

    // Fetch the film JSON to confirm IDs
    try {
      const filmJson = await fetch(`https://letterboxd.com/film/${slug}/json/`, { credentials: "include" });
      const filmData = await filmJson.json();
      // lid from JSON is the productionId — same as filmId from posteredIdentifier
      productionId = filmData.lid || filmId;
    } catch (e) { console.warn("Could not fetch film JSON:", e); productionId = filmId; }

    console.log("Found:", { slug, filmId, productionId });
    return { filmId, productionId, slug, url: `https://letterboxd.com/film/${slug}/` };
  } catch (e) {
    console.warn("Search error:", e);
    return fallback;
  }
}


async function logToLetterboxd() {
  if (!state.filmId) {
    chrome.tabs.create({ url: state.letterboxdUrl });
    return;
  }
  showState("logging");
  try {
    const csrf = await getCsrf();
    if (!csrf) {
      showState("error");
      $("error-message").innerHTML =
        'You\'re not logged into Letterboxd. <a href="https://letterboxd.com/sign-in/" target="_blank" style="color:#e8b84b">Sign in</a> and try again.';
      return;
    }

    const headers = {
      "Content-Type": "application/json; charset=UTF-8",
      "Accept": "application/json",
      "x-csrf-token": csrf,
    };

    const review = $("review-input").value.trim();
    const diaryBody = {
      productionId: state.productionId || state.filmId,
      diaryDetails: {
        diaryDate: state.watchedToday ? new Date().toISOString().split("T")[0] : undefined,
        rewatch: false,
      },
      tags: [],
    };
    if (state.rating > 0) diaryBody.rating = state.rating;
    if (state.liked) diaryBody.like = true;
    if (review) diaryBody.review = { text: review, containsSpoilers: false };

    const fetches = [
      fetch("https://letterboxd.com/api/v0/production-log-entries", {
        method: "POST", credentials: "include", headers,
        body: JSON.stringify(diaryBody),
      }),
    ];
    if (state.rating > 0) {
      fetches.push(fetch(`https://letterboxd.com/api/v0/me/rate/${state.filmId}`, {
        method: "PATCH", credentials: "include", headers,
        body: JSON.stringify({ rating: state.rating }),
      }));
    }

    const [logResp, ...otherResps] = await Promise.all(fetches);
    console.log("Log entry status:", logResp.status);

    if (!logResp.ok) {
      const text = await logResp.text();
      console.warn("Log entry response:", text.slice(0, 300));
      if (logResp.status === 401 || logResp.status === 403) {
        showState("error");
        $("error-message").innerHTML =
          'You\'re not logged into Letterboxd. <a href="https://letterboxd.com/sign-in/" target="_blank" style="color:#e8b84b">Sign in</a> and try again.';
      } else {
        showState("error");
        $("error-message").textContent =
          `Couldn't save to Letterboxd (HTTP ${logResp.status}). Try opening on Letterboxd directly.`;
      }
      return;
    }

    const allOk = otherResps.every(r => r.ok);
    showDone(state.letterboxdUrl, { partial: !allOk });
  } catch (e) {
    console.error("Log error:", e);
    chrome.tabs.create({ url: state.letterboxdUrl });
    showDone(state.letterboxdUrl, { fallback: true });
  }
}

function showDone(url, opts = {}) {
  state.letterboxdUrl = url;
  showState("done");
  if (opts.fallback) {
    $("done-title").textContent = "Opened on Letterboxd";
    $("done-sub").textContent = "Log it from the film page";
  } else {
    $("done-title").textContent = `${state.title} logged!`;
    $("done-sub").textContent = state.rating > 0
      ? `${state.rating} ★ · ${state.watchedToday ? "Watched today" : "Added to diary"}`
      : state.watchedToday ? "Watched today · No rating" : "Added to diary";
    if (opts.partial) $("done-sub").textContent += " (some actions may not have saved)";
  }
  $("done-link").addEventListener("click", () => chrome.tabs.create({ url }));
}

// ── Open on Letterboxd ────────────────────────────────────────────────────────
function openOnLetterboxd() {
  chrome.tabs.create({ url: state.letterboxdUrl || `https://letterboxd.com/search/films/${encodeURIComponent(state.title)}/` });
}

// ── Main init ─────────────────────────────────────────────────────────────────
async function init() {
  showState("detecting");
  buildStars();
  initToggles();
  initWrongFilm();

  // Hook up action buttons
  $("btn-log").addEventListener("click", logToLetterboxd);
  $("btn-open").addEventListener("click", openOnLetterboxd);

  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const SUPPORTED_PLATFORMS = [
    { match: url => url.includes("netflix.com/watch"), name: "Netflix" },
    { match: url => url.includes("mubi.com") && url.includes("/films/"), name: "MUBI" },
    { match: url => url.includes("primevideo.com") && url.includes("/detail/"), name: "Prime Video" },
    { match: url => url.includes("hotstar.com") && url.includes("/movies/"), name: "JioHotstar" },
  ];

  const matched = tab?.url && SUPPORTED_PLATFORMS.find(p => p.match(tab.url));
  if (!matched) {
    showState("error");
    $("error-message").textContent =
      "Open a movie on Netflix, MUBI, Prime Video or JioHotstar first, then click the extension.";
    return;
  }

  // Ask content script for the movie info
  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { action: "getMovieInfo" });
  } catch (e) {
    // Content script not injected yet — try programmatic injection
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      response = await chrome.tabs.sendMessage(tab.id, { action: "getMovieInfo" });
    } catch (e2) {
      showState("error");
      $("error-message").textContent =
        "Could not connect to the tab. Try refreshing the page.";
      return;
    }
  }

  if (!response || !response.success) {
    showState("error");
    $("error-message").textContent =
      response?.error || "Could not detect the movie. Try again after the movie starts.";
    return;
  }

  // Got the title — update state and find on Letterboxd
  state.title = response.title;
  state.year = response.year;
  state.platform = response.platform;

  $("film-title").textContent = state.title;
  $("film-year").textContent = state.year ? `${state.year}` : "";
  $("film-platform").textContent = state.platform;
  $("platform-badge").textContent = state.platform;

  // Search Letterboxd in parallel with showing the UI
  showState("confirm");

  const lbd = await findOnLetterboxd(state.title);

  state.filmId = lbd.filmId;
  state.productionId = lbd.productionId;
  state.slug = lbd.slug;
  state.letterboxdUrl = lbd.url;
}

init();
