// background.js — service worker, handles all Letterboxd API calls
// Background scripts are NOT subject to CORS, unlike popup or content scripts

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "letterboxd_search") {
    searchLetterboxd(request.title).then(sendResponse).catch(e => {
      sendResponse({ error: e.message });
    });
    return true; // keep channel open for async
  }

  if (request.action === "letterboxd_log") {
    logToLetterboxd(request.payload).then(sendResponse).catch(e => {
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  }
});

async function getCsrf() {
  const cookie = await chrome.cookies.get({
    url: "https://letterboxd.com",
    name: "com.xk72.webparts.csrf"
  });
  return cookie ? cookie.value : null;
}

async function searchLetterboxd(title) {
  const csrf = await getCsrf();
  const headers = { "Accept": "application/json" };
  if (csrf) headers["x-csrf-token"] = csrf;

  const query = encodeURIComponent(title);
  const resp = await fetch(
    `https://letterboxd.com/api/v0/search?input=${query}&include=FilmSearchItem&perPage=5`,
    { credentials: "include", headers }
  );

  if (!resp.ok) throw new Error(`Search HTTP ${resp.status}`);
  const data = await resp.json();

  const filmItem = data.items?.find(i => i.type === "FilmSearchItem");
  if (!filmItem?.film) return { filmId: null, slug: null, url: `https://letterboxd.com/search/films/${query}/` };

  const film = filmItem.film;
  const slug = film.slug;
  return {
    filmId: film.id,
    slug,
    name: film.name,
    year: film.releaseYear,
    url: `https://letterboxd.com/film/${slug}/`,
  };
}

async function logToLetterboxd({ filmId, rating, watchedToday, liked, review }) {
  const csrf = await getCsrf();
  if (!csrf) return { ok: false, error: "not_logged_in" };

  const headers = {
    "Content-Type": "application/json; charset=UTF-8",
    "Accept": "application/json",
    "x-csrf-token": csrf,
  };

  const results = [];

  // Rate the film
  if (rating > 0) {
    const r = await fetch(`https://letterboxd.com/api/v0/me/rate/${filmId}`, {
      method: "PATCH",
      credentials: "include",
      headers,
      body: JSON.stringify({ rating }),
    });
    results.push({ action: "rate", status: r.status, ok: r.ok });
  }

  // Add diary entry
  const diaryBody = { filmId };
  if (watchedToday) diaryBody.diaryDate = new Date().toISOString().split("T")[0];
  if (liked) diaryBody.like = true;
  if (review?.trim()) diaryBody.review = { text: review.trim(), containsSpoilers: false };

  const r2 = await fetch("https://letterboxd.com/api/v0/me/log-entry", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(diaryBody),
  });
  results.push({ action: "log", status: r2.status, ok: r2.ok });

  return { ok: results.every(r => r.ok), results };
}
