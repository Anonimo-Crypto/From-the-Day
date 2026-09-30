// From the day I met you — PWA
const STORAGE_KEY = 'from_the_day_counters_v2';
const $ = id => document.getElementById(id);
const listEl = $('list'), modal = $('modal'), detail = $('detail'), sheet = $('sheet');
const personName = $('personName'), personDate = $('personDate'), personRel = $('personRel');

const ICON = {
  chevron: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};

let counters = [], openId = null, deleting = false, mode = null, currentLang = 'en', translations = {};
const LANGS = { en: 'English', es: 'Español', pt: 'Português', it: 'Italiano', ru: 'Русский' };

// ---------- i18n ----------
async function loadTranslations() {
  try { translations = await (await fetch('language.json')).json(); } catch { translations = { en: {} }; }
  const saved = localStorage.getItem('lang') || (navigator.language || 'en').slice(0, 2);
  currentLang = translations[saved] ? saved : 'en';
}
const t = k => (translations[currentLang] || {})[k] || (translations.en || {})[k] || k;
function applyTexts() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => el.innerHTML = t(el.dataset.i18n));
  $('addBtn').textContent = t('addButton'); $('exportBtn').textContent = t('exportButton');
  $('importBtn').textContent = t('importButton'); $('clearAllBtn').textContent = t('deleteAllButton');
  $('langBtn').textContent = currentLang.toUpperCase(); $('langBtn').title = t('languageButton');
  $('cancelBtn').textContent = t('cancelButton');
}

// ---------- datos ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const validDate = s => typeof s === 'string' && !isNaN(new Date(s));
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(counters)); } catch (e) { console.error(e); } }
function sanitize(arr) {
  return (Array.isArray(arr) ? arr : []).filter(c => c && typeof c.name === 'string' && validDate(c.isoDate)).map(c => ({
    id: String(c.id || uid()), name: c.name.slice(0, 60), relation: typeof c.relation === 'string' ? c.relation.slice(0, 40) : '', isoDate: c.isoDate, createdAt: c.createdAt || new Date().toISOString(),
    markers: (Array.isArray(c.markers) ? c.markers : []).filter(m => m && typeof m.name === 'string' && validDate(m.isoDate))
      .map(m => ({ id: String(m.id || uid()), name: m.name.slice(0, 60), isoDate: m.isoDate }))
  }));
}
function load() { try { counters = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { counters = []; } sort(); }
const sort = () => counters.sort((a, b) => new Date(a.isoDate) - new Date(b.isoDate));

// ---------- tiempo ----------
function diff(start, end) {
  const s = new Date(start), e = new Date(end);
  let y = e.getFullYear() - s.getFullYear(), mo = e.getMonth() - s.getMonth(), d = e.getDate() - s.getDate(),
      h = e.getHours() - s.getHours(), mi = e.getMinutes() - s.getMinutes(), se = e.getSeconds() - s.getSeconds();
  if (se < 0) { se += 60; mi--; } if (mi < 0) { mi += 60; h--; } if (h < 0) { h += 24; d--; }
  if (d < 0) { d += new Date(e.getFullYear(), e.getMonth(), 0).getDate(); mo--; }
  if (mo < 0) { mo += 12; y--; }
  return { y: Math.max(y, 0), mo, w: Math.floor(d / 7), d: d % 7, h };
}
function unitsHTML(p, keys) {
  const L = { y: ['year', 'years'], mo: ['month', 'months'], w: ['week', 'weeks'], d: ['day', 'days'], h: ['hour', 'hours'] };
  return keys.map(k => `<div><b data-k="${k}">${p[k]}</b><span>${t(L[k][p[k] === 1 ? 0 : 1])}</span></div>`).join('');
}
const fmtDate = (iso, time) => new Date(iso).toLocaleDateString(currentLang, { day: 'numeric', month: 'long', year: 'numeric' });

// ---------- lista ----------
function renderList() {
  listEl.innerHTML = '';
  if (!counters.length) { listEl.innerHTML = `<div class="empty">${t('emptyState')}</div>`; return; }
  counters.forEach(c => {
    const b = document.createElement('button');
    b.className = 'name-btn'; b.innerHTML = `<span></span>${ICON.chevron}`;
    b.firstChild.textContent = c.name;
    b.onclick = () => openDetail(c.id);
    listEl.appendChild(b);
  });
}

// ---------- detalle ----------
function openDetail(id) { openId = id; deleting = false; renderDetail(); detail.classList.remove('hidden'); }
function closeDetail() { openId = null; detail.classList.add('hidden'); }
function renderDetail() {
  const c = counters.find(x => x.id === openId); if (!c) return closeDetail();
  const p = diff(c.isoDate, new Date());
  sheet.innerHTML = `
    <div class="sheet-head">
      <button class="ibtn" id="backBtn" aria-label="${t('back')}">${ICON.back}</button>
      <h2></h2>
      <button class="ibtn danger" id="delPerson" aria-label="${t('deletePerson')}">${ICON.trash}</button>
    </div>
    <div class="screen">
      <div class="pill"><small>${t('met')}:</small><strong>${fmtDate(c.isoDate)}</strong></div>
      ${c.relation ? `<div class="pill"><small>${t('relation')}:</small><strong id="relText"></strong></div>` : ''}
      <div class="pill"><div class="units" id="mainUnits">${unitsHTML(p, ['y', 'mo', 'w', 'd', 'h'])}</div></div>
    </div>
    <div class="mk-head"><h3>${t('markers')}</h3>
      <div><button class="ibtn" id="addMk" aria-label="${t('addMarker')}">${ICON.plus}</button>
      <button class="ibtn danger ${deleting ? 'on' : ''}" id="togDel" aria-label="${t('toggleDelete')}">${ICON.trash}</button></div></div>
    <div class="screen ${deleting ? 'deleting' : ''}" id="mkList"></div>`;
  sheet.querySelector('h2').textContent = c.name;
  if (c.relation) $('relText').textContent = c.relation;
  const ml = $('mkList');
  if (!c.markers.length) ml.innerHTML = `<div class="empty">${t('noMarkers')}</div>`;
  c.markers.forEach(m => {
    const el = document.createElement('div'); el.className = 'pill marker'; el.dataset.id = m.id;
    el.innerHTML = `<div class="mname"></div><div class="units four">${unitsHTML(diff(m.isoDate, new Date()), ['y', 'mo', 'w', 'd'])}</div><button class="x" aria-label="${t('deleteButton')}">${ICON.x}</button>`;
    el.querySelector('.mname').textContent = `${m.name} · ${t('markerFor')} ${fmtDate(m.isoDate)}`;
    el.querySelector('.x').onclick = () => {
      if (confirm(t('deleteMarkerConfirm').replace('{name}', m.name))) { c.markers = c.markers.filter(k => k.id !== m.id); save(); renderDetail(); }
    };
    ml.appendChild(el);
  });
  $('backBtn').onclick = closeDetail;
  $('delPerson').onclick = () => { if (confirm(t('deleteConfirm').replace('{name}', c.name))) { counters = counters.filter(x => x.id !== c.id); save(); closeDetail(); renderList(); } };
  $('addMk').onclick = () => openForm('marker');
  $('togDel').onclick = () => { deleting = !deleting; renderDetail(); };
}
function tickDetail() { // actualiza solo los números, sin re-renderizar
  if (!openId || document.hidden) return;
  const c = counters.find(x => x.id === openId); if (!c) return;
  const set = (root, p) => root.querySelectorAll('b[data-k]').forEach(b => { b.textContent = p[b.dataset.k]; });
  set($('mainUnits'), diff(c.isoDate, new Date()));
  c.markers.forEach(m => { const el = sheet.querySelector(`.marker[data-id="${m.id}"]`); if (el) set(el, diff(m.isoDate, new Date())); });
}
setInterval(tickDetail, 1000);

// ---------- formulario ----------
function openForm(kind) {
  mode = kind; const person = kind === 'person';
  $('modalTitle').textContent = t(person ? 'modalTitle' : 'addMarker');
  $('nameLabel').textContent = t(person ? 'nameLabel' : 'markerName');
  $('dateLabel').textContent = t(person ? 'dateLabel' : 'markerDate');
  personName.placeholder = t(person ? 'namePh' : 'markerPh');
  personDate.type = person ? 'datetime-local' : 'date';
  personName.value = ''; personDate.value = ''; personRel.value = '';
  $('relWrap').classList.toggle('hidden', !person);
  $('relLabel').textContent = t('relationLabel'); personRel.placeholder = t('relationPh');
  modal.classList.remove('hidden'); personName.focus();
}
const closeForm = () => modal.classList.add('hidden');
$('cancelBtn').onclick = closeForm;
$('addForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = personName.value.trim(), date = new Date(personDate.value);
  if (!name || !personDate.value) return alert(t('fillError'));
  if (isNaN(date)) return alert(t('invalidDate'));
  if (mode === 'person') counters.push({ id: uid(), name, isoDate: date.toISOString(), createdAt: new Date().toISOString(), relation: personRel.value.trim(), markers: [] });
  else { const c = counters.find(x => x.id === openId); if (!c) return; c.markers.push({ id: uid(), name, isoDate: date.toISOString() }); }
  sort(); save(); closeForm(); mode === 'person' ? renderList() : renderDetail();
});
$('addBtn').onclick = () => openForm('person');
[modal, detail].forEach(m => m.addEventListener('click', e => { if (e.target === m) m === modal ? closeForm() : closeDetail(); }));
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!modal.classList.contains('hidden')) closeForm(); else if (openId) closeDetail(); });

// ---------- acciones globales ----------
$('clearAllBtn').onclick = () => { if (confirm(t('deleteAllConfirm'))) { counters = []; save(); renderList(); } };
$('exportBtn').onclick = () => {
  if (!counters.length) return alert(t('exportEmpty'));
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: 'From the day I met you', version: 3, counters }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `from-the-day-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
};
$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text()); const clean = sanitize(data.counters);
    if (!Array.isArray(data.counters) || !clean.length) throw new Error('invalid');
    if (!confirm(t('importConfirm').replace('{count}', clean.length))) return;
    counters = clean; sort(); save(); renderList(); alert(t('importSuccess'));
  } catch (err) { alert(t('importError')); } finally { e.target.value = ''; }
};
$('langBtn').onclick = () => {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="modal-card"><h2></h2><div class="lang-options"></div></div>`;
  m.querySelector('h2').textContent = t('languageModalTitle');
  Object.entries(LANGS).forEach(([code, label]) => {
    if (!translations[code]) return;
    const b = document.createElement('button'); b.className = 'lang-option' + (code === currentLang ? ' on' : ''); b.textContent = label;
    b.onclick = () => { currentLang = code; localStorage.setItem('lang', code); m.remove(); applyTexts(); renderList(); if (openId) renderDetail(); };
    m.querySelector('.lang-options').appendChild(b);
  });
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
};

(async function init() { await loadTranslations(); load(); applyTexts(); renderList(); })();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
