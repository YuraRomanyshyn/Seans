/* Seans – lista filmów i seriali do obejrzenia.
   Dane: TMDB (themoviedb.org), dostępność na platformach w Polsce: JustWatch przez TMDB.
   Lista zapisuje się w pamięci telefonu (localStorage). */
(() => {
  'use strict';

  // ---------- Ustawienia ----------
  const REGION = 'PL';
  const LANG = 'pl-PL';
  const API = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p/';
  const STORE_LIST = 'seans.list.v1';
  const STORE_KEY = 'seans.tmdbKey';
  const STORE_HINT = 'seans.swipeHintDone';
  const DELETE_W = 96;

  // ---------- Pamięć ----------
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch (e) { toast('Nie udało się zapisać zmian w pamięci telefonu.'); return false; }
    }
  };

  const state = {
    list: store.get(STORE_LIST, []),
    key: store.get(STORE_KEY, ''),
    filter: 'all',
    page: 'list',
    query: '',
    results: [],
    openRow: null
  };

  const saveList = () => store.set(STORE_LIST, state.list);
  const keyOf = (type, id) => `${type}-${id}`;
  const findItem = (type, id) => state.list.find((i) => i.key === keyOf(type, id));

  // ---------- Pomocnicze ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const year = (d) => (d && /^\d{4}/.test(d) ? d.slice(0, 4) : '');
  const img = (path, size) => (path ? `${IMG}${size}${path}` : '');

  function plural(n, one, few, many) {
    if (n === 1) return one;
    const d = n % 10, h = n % 100;
    return d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? few : many;
  }
  function runtime(min) {
    if (!min) return '';
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h} godz.${m ? ` ${m} min` : ''}` : `${m} min`;
  }
  const typeLabel = (t) => (t === 'tv' ? 'Serial' : 'Film');
  const fmtVote = (v) => (typeof v === 'number' ? v.toFixed(1).replace('.', ',') : '');
  function fmtCount(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')} tys.`;
    return String(n);
  }
  const scoreHTML = (v) => (typeof v === 'number' ? `<span class="score" aria-label="Ocena ${fmtVote(v)}"><span class="star" aria-hidden="true">★</span><b>${fmtVote(v)}</b></span>` : '');

  const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg>',
    thumb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4-7a2.5 2.5 0 0 1 2.9 2.9L13 10h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.1 21H7"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };

  function posterHTML(path, title, size = 'w185', cls = 'poster') {
    if (path) return `<img class="${cls}" src="${img(path, size)}" alt="" loading="lazy" decoding="async">`;
    const letter = esc((title || '?').trim().charAt(0).toUpperCase());
    return `<div class="${cls} poster-ph" aria-hidden="true">${letter}</div>`;
  }

  // ---------- TMDB ----------
  class ApiError extends Error {
    constructor(msg, code) { super(msg); this.code = code; }
  }

  async function tmdb(path, params = {}, signal) {
    const key = state.key;
    if (!key) throw new ApiError('Brak klucza TMDB. Dodaj go w ustawieniach.', 'nokey');
    const url = new URL(API + path);
    Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
    const isToken = key.startsWith('eyJ');
    if (!isToken) url.searchParams.set('api_key', key);
    let res;
    try {
      res = await fetch(url, { signal, headers: isToken ? { Authorization: `Bearer ${key}`, accept: 'application/json' } : { accept: 'application/json' } });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new ApiError('Brak połączenia z internetem.', 'offline');
    }
    if (res.status === 401) throw new ApiError('Klucz TMDB jest nieprawidłowy. Sprawdź go w ustawieniach.', 'badkey');
    if (res.status === 429) throw new ApiError('Za dużo zapytań naraz. Spróbuj za chwilę.', 'rate');
    if (!res.ok) throw new ApiError(`TMDB nie odpowiada (błąd ${res.status}). Spróbuj ponownie.`, 'http');
    return res.json();
  }

  function normalizeResult(r) {
    const type = r.media_type === 'tv' ? 'tv' : 'movie';
    return {
      id: r.id,
      type,
      title: type === 'tv' ? r.name : r.title,
      original: type === 'tv' ? r.original_name : r.original_title,
      year: year(type === 'tv' ? r.first_air_date : r.release_date),
      poster: r.poster_path || '',
      backdrop: r.backdrop_path || '',
      overview: r.overview || '',
      vote: r.vote_count ? r.vote_average : null,
      votes: r.vote_count || 0
    };
  }

  function cleanProviderName(name) {
    return name.replace(/\s+(Standard|Basic)?\s*with Ads$/i, '').trim();
  }

  function parseProviders(wp) {
    const pl = wp && wp.results && wp.results[REGION];
    if (!pl) return { link: '', groups: [] };
    const seen = new Set();
    const pick = (arr) => (arr || [])
      .slice()
      .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
      .map((p) => ({ name: cleanProviderName(p.provider_name), logo: p.logo_path }))
      .filter((p) => { const k = p.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    const groups = [
      { label: 'W abonamencie', items: pick(pl.flatrate) },
      { label: 'Za darmo', items: pick([...(pl.free || []), ...(pl.ads || [])]) },
      { label: 'Wypożyczenie lub zakup', items: pick([...(pl.rent || []), ...(pl.buy || [])]) }
    ].filter((g) => g.items.length);
    return { link: pl.link || '', groups };
  }

  async function fetchDetails(type, id) {
    const d = await tmdb(`/${type}/${id}`, { language: LANG, append_to_response: 'watch/providers' });
    let overview = d.overview || '';
    let tagline = d.tagline || '';
    let overviewLang = 'pl';
    if (!overview) {
      try {
        const en = await tmdb(`/${type}/${id}`, { language: 'en-US' });
        overview = en.overview || '';
        if (!tagline) tagline = en.tagline || '';
        overviewLang = 'en';
      } catch (e) { /* zostaje pusty opis */ }
    }
    return {
      id: d.id,
      type,
      title: type === 'tv' ? d.name : d.title,
      original: type === 'tv' ? d.original_name : d.original_title,
      year: year(type === 'tv' ? d.first_air_date : d.release_date),
      poster: d.poster_path || '',
      backdrop: d.backdrop_path || '',
      overview,
      overviewLang,
      tagline,
      genres: (d.genres || []).map((g) => g.name),
      vote: d.vote_count ? d.vote_average : null,
      votes: d.vote_count || 0,
      runtime: type === 'movie' ? d.runtime : null,
      seasons: type === 'tv' ? d.number_of_seasons : null,
      providers: parseProviders(d['watch/providers']),
      providersAt: Date.now()
    };
  }

  // ---------- Nawigacja ----------
  function go(page) {
    state.page = page;
    $('#page-list').hidden = page !== 'list';
    $('#page-search').hidden = page !== 'search';
    $('#page-random').hidden = page !== 'random';
    $$('.tab').forEach((t) => (t.getAttribute('data-goto') === page ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current')));
    window.scrollTo(0, 0);
    if (page === 'search' && !state.query) setTimeout(() => $('#search-input').focus(), 50);
    if (page === 'list') renderList();
  }

  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) go(g.getAttribute('data-goto'));
  });

  // ---------- Strona 1: Moja lista ----------
  function visibleItems() {
    const items = state.list.slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    if (state.filter === 'todo') return items.filter((i) => !i.watched);
    if (state.filter === 'done') return items.filter((i) => i.watched);
    return items;
  }

  function controlsHTML(item, size = '') {
    return `
      <button type="button" class="check ${size}" data-act="watched" aria-pressed="${item.watched ? 'true' : 'false'}">
        <span class="box">${ICON.check}</span>${item.watched ? 'Obejrzane' : 'Nieobejrzane'}
      </button>
      <span class="thumbs" role="group" aria-label="Ocena">
        <button type="button" class="thumb up" data-act="up" aria-pressed="${item.rating === 1}" aria-label="Podobało mi się">${ICON.thumb}</button>
        <button type="button" class="thumb down" data-act="down" aria-pressed="${item.rating === -1}" aria-label="Nie podobało mi się">${ICON.thumb}</button>
      </span>`;
  }

  function renderList() {
    const items = visibleItems();
    const ul = $('#watchlist');
    state.openRow = null;
    ul.innerHTML = items.map((i) => `
      <li class="row${i.watched ? ' is-watched' : ''}" data-key="${esc(i.key)}">
        <button type="button" class="row-delete" data-act="delete" tabindex="-1" aria-label="Usuń ${esc(i.title)} z listy">${ICON.trash}Usuń</button>
        <div class="row-content" data-act="open" role="button" tabindex="0" aria-label="${esc(i.title)}, pokaż szczegóły">
          ${posterHTML(i.poster, i.title)}
          <div class="row-main">
            <h3 class="row-title">${esc(i.title)}</h3>
            <p class="row-meta"><span class="tag">${typeLabel(i.type)}</span>${i.year ? `<span>${esc(i.year)}</span>` : ''}</p>
            <div class="row-controls">${controlsHTML(i)}</div>
          </div>
        </div>
      </li>`).join('');

    const all = state.list.length;
    const done = state.list.filter((i) => i.watched).length;
    $('#count-all').textContent = all;
    $('#count-done').textContent = done;
    $('#count-todo').textContent = all - done;

    const empty = $('#list-empty');
    if (!all) {
      empty.hidden = false;
      $('h2', empty).textContent = 'Pusta sala';
      $('p', empty).textContent = 'Nie masz jeszcze żadnych tytułów. Wyszukaj film albo serial i dodaj go do listy.';
      $('button', empty).hidden = false;
    } else if (!items.length) {
      empty.hidden = false;
      $('h2', empty).textContent = state.filter === 'done' ? 'Jeszcze nic' : 'Wszystko obejrzane';
      $('p', empty).textContent = state.filter === 'done'
        ? 'Zaznacz „Obejrzane” przy tytule, a pojawi się tutaj.'
        : 'Nie masz nic do nadrobienia. Czas poszukać czegoś nowego.';
      $('button', empty).hidden = state.filter === 'done';
    } else {
      empty.hidden = true;
    }
    $('#swipe-hint').hidden = !(items.length && !store.get(STORE_HINT, false));
  }

  $$('.seg').forEach((b) => b.addEventListener('click', () => {
    state.filter = b.dataset.filter;
    $$('.seg').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
    renderList();
  }));

  function updateItem(key, patch) {
    const it = state.list.find((i) => i.key === key);
    if (!it) return null;
    Object.assign(it, patch);
    saveList();
    return it;
  }

  function toggleWatched(key) {
    const it = state.list.find((i) => i.key === key);
    if (it) updateItem(key, { watched: !it.watched });
  }
  function setRating(key, val) {
    const it = state.list.find((i) => i.key === key);
    if (it) updateItem(key, { rating: it.rating === val ? 0 : val });
  }

  let lastRemoved = null;
  function removeItem(key) {
    const idx = state.list.findIndex((i) => i.key === key);
    if (idx < 0) return;
    const [it] = state.list.splice(idx, 1);
    saveList();
    lastRemoved = { it, idx };
    store.set(STORE_HINT, true);
    renderList();
    toast(`Usunięto „${it.title}”`, 'Cofnij', () => {
      if (!lastRemoved) return;
      state.list.splice(Math.min(lastRemoved.idx, state.list.length), 0, lastRemoved.it);
      lastRemoved = null;
      saveList();
      renderList();
    });
  }

  // Kliknięcia w liście
  $('#watchlist').addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (!row) return;
    const key = row.dataset.key;
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (suppressClick) { suppressClick = false; return; }

    if (a === 'delete') { removeItem(key); return; }
    if (state.openRow) { closeRow(state.openRow); return; }
    if (a === 'watched') { toggleWatched(key); renderList(); return; }
    if (a === 'up') { setRating(key, 1); renderList(); return; }
    if (a === 'down') { setRating(key, -1); renderList(); return; }
    if (a === 'open') {
      const it = state.list.find((i) => i.key === key);
      if (it) openDetail(it);
    }
  });
  $('#watchlist').addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.row-content')) {
      e.preventDefault();
      const it = state.list.find((i) => i.key === e.target.closest('.row').dataset.key);
      if (it) openDetail(it);
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.matches('.row-content')) {
      removeItem(e.target.closest('.row').dataset.key);
    }
  });

  // ---------- Przesunięcie w lewo = usuń ----------
  let drag = null;
  let suppressClick = false;

  function setX(row, x, animate) {
    const c = $('.row-content', row);
    row.classList.toggle('dragging', !animate);
    if (x < 0) row.classList.add('revealing');
    c.style.transform = x ? `translateX(${x}px)` : '';
  }
  function closeRow(row) {
    setX(row, 0, true);
    setTimeout(() => { if (state.openRow !== row && !(drag && drag.row === row)) row.classList.remove('revealing'); }, 280);
    $('.row-delete', row).tabIndex = -1;
    if (state.openRow === row) state.openRow = null;
  }
  function openRow(row) {
    if (state.openRow && state.openRow !== row) closeRow(state.openRow);
    setX(row, -DELETE_W, true);
    $('.row-delete', row).tabIndex = 0;
    state.openRow = row;
    store.set(STORE_HINT, true);
    $('#swipe-hint').hidden = true;
  }

  const wl = $('#watchlist');
  wl.addEventListener('pointerdown', (e) => {
    const content = e.target.closest('.row-content');
    if (!content || e.button > 0) return;
    const row = content.parentElement;
    drag = {
      row, content,
      x0: e.clientX, y0: e.clientY,
      base: state.openRow === row ? -DELETE_W : 0,
      x: 0, active: false, dead: false, id: e.pointerId,
      width: row.getBoundingClientRect().width
    };
  });
  wl.addEventListener('pointermove', (e) => {
    if (!drag || drag.dead || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag.dead = true; return; }
      if (Math.abs(dx) < 10) return;
      drag.active = true;
      if (state.openRow && state.openRow !== drag.row) closeRow(state.openRow);
      try { drag.content.setPointerCapture(e.pointerId); } catch (_) {}
    }
    let x = drag.base + dx;
    if (x > 0) x = x / 4;                       // opór w prawo
    if (x < -drag.width) x = -drag.width;
    drag.x = x;
    setX(drag.row, x, false);
  });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    if (!d.active) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 350);
    if (d.x < -d.width * 0.6) {               // pełne przesunięcie = od razu usuń
      setX(d.row, -d.width, true);
      setTimeout(() => removeItem(d.row.dataset.key), 180);
    } else if (d.x < -DELETE_W / 2) {
      openRow(d.row);
    } else {
      closeRow(d.row);
    }
  }
  wl.addEventListener('pointerup', endDrag);
  wl.addEventListener('pointercancel', (e) => { if (drag && drag.active) endDrag(e); else drag = null; });

  document.addEventListener('pointerdown', (e) => {
    if (state.openRow && !state.openRow.contains(e.target)) closeRow(state.openRow);
  });

  // ---------- Strona 2: Wyszukiwarka ----------
  const input = $('#search-input');
  const status = $('#search-status');
  let searchTimer = null;
  let searchCtrl = null;

  function setStatus(text, isError) {
    status.textContent = text;
    status.classList.toggle('error', !!isError);
  }

  function renderSkeleton() {
    $('#results').innerHTML = Array.from({ length: 5 }, () => `
      <li class="skeleton"><div class="result" aria-hidden="true">
        <div class="poster"></div>
        <div class="row-main"><div class="sk-line" style="width:70%"></div><div class="sk-line" style="width:35%"></div><div class="sk-line" style="width:90%"></div></div>
        <span></span>
      </div></li>`).join('');
  }

  function renderResults() {
    $('#results').innerHTML = state.results.map((r, idx) => {
      const onList = !!findItem(r.type, r.id);
      return `
      <li>
        <button type="button" class="result" data-idx="${idx}">
          ${posterHTML(r.poster, r.title)}
          <div class="row-main">
            <h3 class="row-title">${esc(r.title)}</h3>
            <p class="row-meta"><span class="tag">${typeLabel(r.type)}</span>${r.year ? `<span>${esc(r.year)}</span>` : ''}${scoreHTML(r.vote)}${onList ? `<span class="on-list">${ICON.check}Na liście</span>` : ''}</p>
            ${r.overview ? `<p class="result-overview">${esc(r.overview)}</p>` : ''}
          </div>
          ${ICON.chev}
        </button>
      </li>`;
    }).join('');
  }

  async function runSearch(q) {
    q = q.trim();
    state.query = q;
    if (searchCtrl) searchCtrl.abort();
    if (q.length < 2) {
      state.results = [];
      renderResults();
      setStatus(q.length ? 'Wpisz co najmniej 2 znaki.' : '');
      return;
    }
    if (!state.key) { setStatus('Najpierw dodaj klucz TMDB w ustawieniach.', true); openSettings(); return; }
    searchCtrl = new AbortController();
    renderSkeleton();
    setStatus('Szukam…');
    try {
      const data = await tmdb('/search/multi', { query: q, language: LANG, include_adult: 'false', page: 1 }, searchCtrl.signal);
      state.results = (data.results || []).filter((r) => r.media_type === 'movie' || r.media_type === 'tv').map(normalizeResult);
      renderResults();
      setStatus(state.results.length
        ? `${state.results.length} ${plural(state.results.length, 'wynik', 'wyniki', 'wyników')}`
        : `Brak wyników dla „${q}”. Spróbuj innej pisowni albo tytułu oryginalnego.`);
    } catch (e) {
      if (e.name === 'AbortError') return;
      $('#results').innerHTML = '';
      setStatus(e.message, true);
      if (e.code === 'badkey') openSettings();
    }
  }

  input.addEventListener('input', () => {
    $('#search-clear').hidden = !input.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(input.value), 380);
  });
  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(searchTimer);
    runSearch(input.value);
    input.blur();
  });
  $('#search-clear').addEventListener('click', () => {
    input.value = '';
    $('#search-clear').hidden = true;
    runSearch('');
    input.focus();
  });
  $('#results').addEventListener('click', (e) => {
    const b = e.target.closest('.result[data-idx]');
    if (!b) return;
    const r = state.results[+b.dataset.idx];
    if (r) openDetail(findItem(r.type, r.id) || r);
  });

  // ---------- Karta szczegółów ----------
  const sheet = $('#sheet');
  const sheetBody = $('#sheet-body');
  const backdrop = $('#sheet-backdrop');
  let current = null;     // dane wyświetlanego tytułu
  let detailToken = 0;

  function lockScroll(on) { document.documentElement.style.overflow = on ? 'hidden' : ''; }

  function openDetail(data) {
    current = { ...data };
    renderDetail(true);
    backdrop.hidden = false;
    sheet.hidden = false;
    lockScroll(true);
    sheetBody.scrollTop = 0;
    loadDetail(data.type, data.id);
  }

  function closeDetail() {
    sheet.hidden = true;
    if ($('#settings').hidden) { backdrop.hidden = true; lockScroll(false); }
    current = null;
    detailToken++;
    if (state.page === 'list') renderList(); else if (state.page === 'search') renderResults(); else renderPicks();
  }

  async function loadDetail(type, id) {
    const token = ++detailToken;
    try {
      const d = await fetchDetails(type, id);
      if (token !== detailToken) return;
      current = { ...current, ...d, providersError: '' };
      // Odśwież zapisane dane, jeśli tytuł jest na liście
      const it = findItem(type, id);
      if (it) {
        updateItem(it.key, {
          title: d.title, year: d.year, poster: d.poster, backdrop: d.backdrop,
          overview: d.overview, overviewLang: d.overviewLang, tagline: d.tagline,
          genres: d.genres, runtime: d.runtime, seasons: d.seasons,
          vote: d.vote, votes: d.votes, voteAt: Date.now(),
          providers: d.providers, providersAt: d.providersAt
        });
      }
      renderDetail(false);
    } catch (e) {
      if (token !== detailToken) return;
      current = { ...current, providersError: e.message };
      renderDetail(false);
    }
  }

  function providersHTML(d, loading) {
    if (loading && !d.providers) {
      return `<div class="prov-list">${Array.from({ length: 3 }, () => '<div class="prov skeleton"><div class="poster" style="width:50px;aspect-ratio:1;border-radius:11px"></div></div>').join('')}</div>`;
    }
    let html = '';
    if (d.providersError) {
      html += `<p class="prov-empty">${esc(d.providersError)}${d.providers ? ` Poniżej dane z ${new Date(d.providersAt).toLocaleDateString('pl-PL')}.` : ''}</p>`;
    }
    const p = d.providers;
    if (!p) return html;
    if (!p.groups.length) {
      html += `<p class="prov-empty">Ten tytuł nie jest teraz dostępny na żadnej platformie w Polsce.</p>`;
    } else {
      html += `<div class="providers">${p.groups.map((g) => `
        <div class="prov-group">
          <h4>${esc(g.label)}</h4>
          <ul class="prov-list">${g.items.map((it) => `
            <li class="prov">${it.logo ? `<img src="${img(it.logo, 'w92')}" alt="" loading="lazy">` : '<div class="poster poster-ph" style="width:50px;aspect-ratio:1;border-radius:11px">?</div>'}<span>${esc(it.name)}</span></li>`).join('')}
          </ul>
        </div>`).join('')}</div>`;
    }
    if (p.link) html += `<a class="link small" href="${esc(p.link)}" target="_blank" rel="noopener">Zobacz szczegóły i ceny na JustWatch ↗</a>`;
    return html;
  }

  function renderDetail(loading) {
    const d = current;
    if (!d) return;
    const item = findItem(d.type, d.id);
    const meta = [typeLabel(d.type), d.year];
    if (d.runtime) meta.push(runtime(d.runtime));
    if (d.seasons) meta.push(`${d.seasons} ${plural(d.seasons, 'sezon', 'sezony', 'sezonów')}`);
    const genres = (d.genres || []).slice(0, 3).join(', ');
    if (genres) meta.push(genres);

    sheetBody.innerHTML = `
      <div class="hero${d.backdrop ? '' : ' no-backdrop'}">
        ${d.backdrop ? `<img class="hero-backdrop" src="${img(d.backdrop, 'w780')}" alt="">` : ''}
        <div class="hero-fade"></div>
      </div>
      <div class="detail-head">
        ${posterHTML(d.poster, d.title, 'w342')}
        <div style="min-width:0">
          <h2 class="sheet-title" id="sheet-title">${esc(d.title)}</h2>
          ${d.original && d.original !== d.title ? `<p class="muted small" style="margin-top:6px">${esc(d.original)}</p>` : ''}
          <p class="detail-meta">${meta.filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('')}</p>
          ${typeof d.vote === 'number'
            ? `<div class="score-big"><span class="num" aria-label="Ocena ${fmtVote(d.vote)} na 10"><span class="star" aria-hidden="true">★</span>${fmtVote(d.vote)}<small>/10</small></span><span class="src">TMDB · ${fmtCount(d.votes)} ${plural(d.votes, 'głos', 'głosy', 'głosów')}</span></div>`
            : (!loading ? '<div class="score-big"><span class="src">Brak ocen na TMDB</span></div>' : '')}
        </div>
      </div>

      ${item ? `<div class="detail-controls" id="detail-controls">${controlsHTML(item)}</div>` : ''}

      <div class="block">
        <h3 class="label">Opis</h3>
        ${d.tagline ? `<p class="tagline">${esc(d.tagline)}</p>` : ''}
        ${d.overview
          ? `<p class="overview">${esc(d.overview)}</p>${d.overviewLang === 'en' ? '<p class="muted tiny">Brak polskiego opisu, pokazuję angielski.</p>' : ''}`
          : `<p class="muted">${loading ? 'Wczytuję opis…' : 'Brak opisu tego tytułu.'}</p>`}
      </div>

      <div class="block">
        <h3 class="label">Gdzie obejrzeć w Polsce</h3>
        ${providersHTML(d, loading)}
      </div>

      ${item
        ? `<button type="button" class="btn btn-wide btn-danger-ghost" data-act="remove">${ICON.trash}Usuń z mojej listy</button>`
        : `<button type="button" class="btn btn-primary btn-wide" data-act="add">${ICON.plus}Dodaj do mojej listy</button>`}
    `;
  }

  sheetBody.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !current) return;
    const a = b.dataset.act;
    const key = keyOf(current.type, current.id);
    if (a === 'add') {
      if (!findItem(current.type, current.id)) {
        const { providersError, ...data } = current;
        state.list.push({ ...data, key, watched: false, rating: 0, addedAt: Date.now() });
        saveList();
        toast(`Dodano „${current.title}” do listy`);
      }
      renderDetail(false);
      return;
    }
    if (a === 'remove') { closeDetail(); removeItem(key); return; }
    if (a === 'watched') toggleWatched(key);
    if (a === 'up') setRating(key, 1);
    if (a === 'down') setRating(key, -1);
    const it = findItem(current.type, current.id);
    if (it) $('#detail-controls').innerHTML = controlsHTML(it);
  });

  $('#sheet-close').addEventListener('click', closeDetail);
  backdrop.addEventListener('click', () => {
    if (!$('#settings').hidden) closeSettings(); else closeDetail();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#settings').hidden) closeSettings(); else if (!sheet.hidden) closeDetail();
  });

  // Przesunięcie karty w dół zamyka ją
  [sheet, $('#settings')].forEach((sh) => {
    let y0 = null, dy = 0;
    sh.addEventListener('touchstart', (e) => {
      const body = $('.sheet-body', sh);
      y0 = body.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0;
    }, { passive: true });
    sh.addEventListener('touchmove', (e) => {
      if (y0 === null) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 0) { sh.style.transform = `translateY(${dy}px)`; sh.style.transition = 'none'; }
    }, { passive: true });
    sh.addEventListener('touchend', () => {
      if (y0 === null) return;
      sh.style.transition = 'transform .2s ease-out';
      if (dy > 110) {
        sh.style.transform = 'translateY(100%)';
        setTimeout(() => { sh.style.transform = ''; sh.style.transition = ''; sh === sheet ? closeDetail() : closeSettings(); }, 190);
      } else {
        sh.style.transform = '';
      }
      y0 = null;
    });
  });

  // ---------- Strona 3: Losuj ----------
  const MIN_VOTE = 5.8;
  const draw = { mode: 'list', picks: [], seenNew: new Set(), lastList: [] };
  const HINTS = {
    list: 'Trzy nieobejrzane tytuły z Twojej listy z oceną powyżej 5,8.',
    new: 'Trzy filmy lub seriale z oceną powyżej 5,8, które obejrzysz w abonamencie w Polsce.'
  };

  function setDrawStatus(text, isError) {
    const el = $('#draw-status');
    el.textContent = text;
    el.classList.toggle('error', !!isError);
  }

  $$('.rmode').forEach((b) => b.addEventListener('click', () => {
    draw.mode = b.dataset.mode;
    $$('.rmode').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
    $('#draw-hint').textContent = HINTS[draw.mode];
    $('#draw-label').textContent = 'Losuj 3 tytuły';
    draw.picks = [];
    renderPicks();
    setDrawStatus('');
  }));

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Uzupełnia brakujące oceny tytułów z listy (np. dodanych przed tą wersją appki)
  async function ensureVotes(items) {
    const missing = items.filter((i) => typeof i.vote !== 'number' && !(i.voteAt && Date.now() - i.voteAt < 7 * 864e5));
    let idx = 0;
    async function worker() {
      while (idx < missing.length) {
        const it = missing[idx++];
        try {
          const d = await tmdb(`/${it.type}/${it.id}`, { language: LANG });
          updateItem(it.key, { vote: d.vote_count ? d.vote_average : null, votes: d.vote_count || 0, voteAt: Date.now() });
        } catch (e) {
          if (e.code === 'badkey' || e.code === 'nokey' || e.code === 'offline') throw e;
        }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
  }

  async function drawFromList() {
    const todo = state.list.filter((i) => !i.watched);
    if (!todo.length) {
      return { picks: [], msg: state.list.length ? 'Wszystko z listy obejrzane. Spróbuj „Nowe propozycje”.' : 'Twoja lista jest pusta. Dodaj tytuły w wyszukiwarce albo spróbuj „Nowe propozycje”.' };
    }
    if (todo.some((i) => typeof i.vote !== 'number')) {
      setDrawStatus('Sprawdzam oceny tytułów z listy…');
      try { await ensureVotes(todo); } catch (e) { if (!todo.some((i) => typeof i.vote === 'number')) throw e; }
    }
    const pool = state.list.filter((i) => !i.watched && typeof i.vote === 'number' && i.vote > MIN_VOTE);
    if (!pool.length) return { picks: [], msg: 'Żaden nieobejrzany tytuł z listy nie ma oceny powyżej 5,8.' };
    // Unikaj powtórki poprzedniego losowania, jeśli jest z czego wybierać
    const fresh = pool.filter((i) => !draw.lastList.includes(i.key));
    const base = fresh.length >= 3 ? fresh : pool;
    const picks = shuffle(base).slice(0, 3);
    draw.lastList = picks.map((p) => p.key);
    const msg = pool.length < 3
      ? `Na liście ${pool.length === 1 ? 'jest tylko 1 nieobejrzany tytuł' : `są tylko ${pool.length} nieobejrzane tytuły`} z oceną powyżej 5,8.`
      : '';
    return { picks, msg };
  }

  function discoverPage(type, page) {
    return tmdb(`/discover/${type}`, {
      language: LANG,
      watch_region: REGION,
      with_watch_monetization_types: 'flatrate',
      'vote_average.gte': MIN_VOTE + 0.01,
      'vote_count.gte': type === 'movie' ? 300 : 150,
      include_adult: 'false',
      sort_by: 'popularity.desc',
      page
    });
  }

  async function drawNew() {
    const fetchType = async (type) => {
      const maxPage = type === 'movie' ? 25 : 15;
      let data = await discoverPage(type, 1 + Math.floor(Math.random() * maxPage));
      if (!data.results || !data.results.length) {
        const total = Math.max(1, Math.min(data.total_pages || 1, maxPage));
        data = await discoverPage(type, 1 + Math.floor(Math.random() * total));
      }
      return (data.results || []).map((r) => normalizeResult({ ...r, media_type: type }));
    };
    const [movies, tv] = await Promise.all([fetchType('movie'), fetchType('tv')]);
    let pool = [...movies, ...tv].filter((r) => typeof r.vote === 'number' && r.vote > MIN_VOTE && !findItem(r.type, r.id));
    const fresh = pool.filter((r) => !draw.seenNew.has(keyOf(r.type, r.id)));
    if (fresh.length >= 3) pool = fresh;
    const picks = shuffle(pool).slice(0, 3);
    picks.forEach((p) => draw.seenNew.add(keyOf(p.type, p.id)));
    return { picks, msg: picks.length ? '' : 'Nic nie wylosowałem. Spróbuj jeszcze raz.' };
  }

  async function runDraw() {
    if (!state.key) { setDrawStatus('Najpierw dodaj klucz TMDB w ustawieniach.', true); openSettings(); return; }
    const btn = $('#draw-btn');
    btn.disabled = true;
    btn.classList.add('rolling');
    setDrawStatus('Losuję…');
    try {
      const { picks, msg } = draw.mode === 'list' ? await drawFromList() : await drawNew();
      draw.picks = picks;
      renderPicks();
      setDrawStatus(msg);
      $('#draw-label').textContent = picks.length ? 'Losuj ponownie' : 'Losuj 3 tytuły';
      loadPickProviders(picks);
    } catch (e) {
      setDrawStatus(e.message, true);
      if (e.code === 'badkey') openSettings();
    } finally {
      btn.disabled = false;
      btn.classList.remove('rolling');
    }
  }
  $('#draw-btn').addEventListener('click', runDraw);

  function provLogosHTML(p) {
    if (!p) return '';
    const subs = (p.groups.find((g) => g.label === 'W abonamencie') || { items: [] }).items;
    if (!subs.length) return '<span class="more">Brak w abonamencie w Polsce</span>';
    return subs.slice(0, 5).map((it) => (it.logo ? `<img src="${img(it.logo, 'w92')}" alt="${esc(it.name)}" title="${esc(it.name)}" loading="lazy">` : '')).join('')
      + (subs.length > 5 ? `<span class="more">+${subs.length - 5}</span>` : '');
  }

  function renderPicks() {
    $('#picks').innerHTML = draw.picks.map((r, idx) => `
      <li>
        <button type="button" class="pick" data-idx="${idx}">
          ${posterHTML(r.poster, r.title, 'w185')}
          <div class="row-main">
            <h3 class="row-title">${esc(r.title)}</h3>
            <p class="row-meta"><span class="tag">${typeLabel(r.type)}</span>${r.year ? `<span>${esc(r.year)}</span>` : ''}${scoreHTML(r.vote)}</p>
            ${r.overview ? `<p class="result-overview">${esc(r.overview)}</p>` : ''}
            <div class="pick-provs" data-key="${esc(keyOf(r.type, r.id))}">${provLogosHTML(r.providers)}</div>
          </div>
        </button>
      </li>`).join('');
  }

  async function loadPickProviders(picks) {
    await Promise.all(picks.map(async (r) => {
      if (r.providers && r.providersAt && Date.now() - r.providersAt < 864e5) return;
      try {
        const wp = await tmdb(`/${r.type}/${r.id}/watch/providers`);
        r.providers = parseProviders(wp);
        r.providersAt = Date.now();
        const it = findItem(r.type, r.id);
        if (it) updateItem(it.key, { providers: r.providers, providersAt: r.providersAt });
        const box = $(`.pick-provs[data-key="${keyOf(r.type, r.id)}"]`);
        if (box) box.innerHTML = provLogosHTML(r.providers);
      } catch (e) { /* bez logotypów */ }
    }));
  }

  $('#picks').addEventListener('click', (e) => {
    const b = e.target.closest('.pick[data-idx]');
    if (!b) return;
    const r = draw.picks[+b.dataset.idx];
    if (r) openDetail(findItem(r.type, r.id) || r);
  });

  // ---------- Ustawienia ----------
  const settings = $('#settings');
  function openSettings(firstRun) {
    $('#key-input').value = state.key;
    $('#key-status').textContent = '';
    $('#key-status').className = 'small';
    $('#settings-title').textContent = firstRun ? 'Witaj w Seansie' : 'Ustawienia';
    backdrop.hidden = false;
    settings.hidden = false;
    lockScroll(true);
  }
  function closeSettings() {
    settings.hidden = true;
    if (sheet.hidden) { backdrop.hidden = true; lockScroll(false); }
  }
  $('#open-settings').addEventListener('click', () => openSettings(false));
  $('#settings-close').addEventListener('click', closeSettings);

  $('#key-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = $('#key-input').value.trim().replace(/^Bearer\s+/i, '');
    const st = $('#key-status');
    if (!val) { st.textContent = 'Wklej klucz, zanim zapiszesz.'; st.className = 'small err'; return; }
    const prev = state.key;
    state.key = val;
    st.textContent = 'Sprawdzam klucz…'; st.className = 'small';
    $('#key-save').disabled = true;
    try {
      await tmdb('/configuration');
      store.set(STORE_KEY, val);
      st.textContent = 'Klucz działa. Możesz szukać tytułów.'; st.className = 'small ok';
      $('#key-input').blur();
      setTimeout(() => { closeSettings(); if (!state.list.length) go('search'); }, 900);
    } catch (err) {
      state.key = prev;
      st.textContent = err.code === 'badkey' ? 'TMDB nie przyjął tego klucza. Skopiuj go jeszcze raz w całości.' : err.message;
      st.className = 'small err';
    } finally {
      $('#key-save').disabled = false;
    }
  });

  // Eksport / import kopii
  $('#export-btn').addEventListener('click', async () => {
    const payload = JSON.stringify({ app: 'seans', version: 1, exportedAt: new Date().toISOString(), items: state.list }, null, 2);
    const name = `seans-lista-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([payload], name, { type: 'application/json' });
    const bs = $('#backup-status');
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Seans – kopia listy' });
        bs.textContent = 'Kopia gotowa.';
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    bs.textContent = `Zapisano plik ${name}.`;
  });

  $('#import-input').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    const bs = $('#backup-status');
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const items = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(items)) throw new Error('format');
      let added = 0, updated = 0;
      items.forEach((it) => {
        if (!it || !it.id || !it.type) return;
        const key = keyOf(it.type, it.id);
        const ex = state.list.find((x) => x.key === key);
        if (ex) { Object.assign(ex, { watched: !!it.watched, rating: it.rating || 0 }); updated++; }
        else { state.list.push({ ...it, key, watched: !!it.watched, rating: it.rating || 0, addedAt: it.addedAt || Date.now() }); added++; }
      });
      saveList();
      renderList();
      bs.textContent = `Zaimportowano: ${added} ${plural(added, 'nowy tytuł', 'nowe tytuły', 'nowych tytułów')}, zaktualizowano ${updated}.`;
    } catch (err) {
      bs.textContent = 'To nie jest plik kopii z Seansu. Wybierz plik .json wyeksportowany z appki.';
    }
  });

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg, actionLabel, action) {
    const t = $('#toast');
    t.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;
    t.hidden = false;
    if (actionLabel) $('button', t).addEventListener('click', () => { action(); t.hidden = true; }, { once: true });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, actionLabel ? 5000 : 2600);
  }

  // ---------- Start ----------
  renderList();
  if (!state.key) openSettings(true);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
