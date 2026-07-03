// From the day I met you — Beautiful live counter PWA
const STORAGE_KEY = 'from_the_day_counters_v2';
const listEl = document.getElementById('list');
const addBtn = document.getElementById('addBtn');
const modal = document.getElementById('modal');
const addForm = document.getElementById('addForm');
const personNameInput = document.getElementById('personName');
const personDateInput = document.getElementById('personDate');
const cancelBtn = document.getElementById('cancelBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const langBtn = document.getElementById('langBtn');

let counters = []; // {id, name, isoDate, createdAt}
let cardElements = {}; // id -> DOM card element
let rafId = null;
let isFirstRender = true;

// === Language / i18n System ===
let currentLang = localStorage.getItem('lang') || 'en';
let translations = {};

async function loadTranslations() {
  try {
    const res = await fetch('language.json');
    translations = await res.json();
  } catch (e) {
    console.error('Could not load language.json, falling back to English');
    translations = { en: {} }; // minimal fallback
  }
}

function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) || 
         (translations['en'] && translations['en'][key]) || 
         key;
}

function updateStaticTexts() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.innerHTML = t(key);
    }
  });

  // Update button texts
  if (addBtn) addBtn.textContent = t('addButton');
  if (exportBtn) exportBtn.textContent = t('exportButton');
  if (importBtn) importBtn.textContent = t('importButton');
  if (clearAllBtn) clearAllBtn.textContent = t('deleteAllButton');

  // Show current language on the button (🌐 ES, 🌐 EN, etc.)
  updateLanguageButton();
}

function updateLanguageButton() {
  if (langBtn) {
    const langCode = currentLang.toUpperCase();
    langBtn.textContent = `🌐 ${langCode}`;
    langBtn.title = `Change language (${langCode})`;
  }
}

function setLanguage(lang) {
  if (!translations[lang]) return;
  
  currentLang = lang;
  localStorage.setItem('lang', lang);
  
  updateStaticTexts();
  
  // Re-render cards so "Since:" and empty state update
  fullRender();
  
  // Close language modal
  const langModal = document.getElementById('langModal');
  if (langModal) langModal.remove();
}

// Utilities
function uid() { 
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); 
}

function save() { 
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counters)); 
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    counters = raw ? JSON.parse(raw) : [];
  } catch(e) { 
    counters = []; 
  }
  // Sort by date met (oldest first = longest time on top)
  sortCounters();
}

function sortCounters() {
  counters.sort((a, b) => new Date(a.isoDate) - new Date(b.isoDate));
}

// Accurate calendar-based diff
function diffDetailed(start, end) {
  const s = new Date(start);
  const e = new Date(end);

  let years = e.getFullYear() - s.getFullYear();
  let months = e.getMonth() - s.getMonth();
  let days = e.getDate() - s.getDate();
  let hours = e.getHours() - s.getHours();
  let minutes = e.getMinutes() - s.getMinutes();
  let seconds = e.getSeconds() - s.getSeconds();

  if (seconds < 0) { seconds += 60; minutes -= 1; }
  if (minutes < 0) { minutes += 60; hours -= 1; }
  if (hours < 0) { hours += 24; days -= 1; }

  if (days < 0) {
    const prevMonth = new Date(e.getFullYear(), e.getMonth(), 0);
    days += prevMonth.getDate();
    months -= 1;
  }
  if (months < 0) { months += 12; years -= 1; }

  const decades = Math.floor(years / 10);
  const remYears = years % 10;
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;

  return { decades, years: remYears, months, weeks, days: remDays, hours, minutes, seconds };
}

// English labels
function formatParts(parts) {
  const unitKeys = [
    ['decades', 'decade', 'decades'],
    ['years', 'year', 'years'],
    ['months', 'month', 'months'],
    ['weeks', 'week', 'weeks'],
    ['days', 'day', 'days'],
    ['hours', 'hour', 'hours'],
    ['minutes', 'minute', 'minutes'],
    ['seconds', 'second', 'seconds']
  ];

  const out = [];
  for (const [key, singularKey, pluralKey] of unitKeys) {
    const v = parts[key];
    if (v > 0) {
      const singular = t(singularKey);
      const plural = t(pluralKey);
      out.push(`${v} ${v === 1 ? singular : plural}`);
    }
  }
  return out;
}

// Create a single card (with entrance animation)
function createCard(item) {
  const start = new Date(item.isoDate);
  const parts = diffDetailed(start, new Date());
  const partsArr = formatParts(parts);

  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = item.id;

  // Title
  const title = document.createElement('div');
  title.className = 'title';
  
  const nameEl = document.createElement('div');
  nameEl.className = 'person';
  nameEl.textContent = `${item.name} — ${start.toLocaleString()}`;

  title.appendChild(nameEl);

  // Main counter
  const counterEl = document.createElement('div');
  counterEl.className = 'counter';
  const display = partsArr.length ? partsArr.slice(0, 4).join(' · ') : t('justNow');
  counterEl.textContent = display;

  // Full breakdown
  const breakdown = document.createElement('div');
  breakdown.className = 'breakdown';
  breakdown.textContent = 
    `${parts.decades}d · ${parts.years}y · ${parts.months}m · ${parts.weeks}w · ${parts.days}d · ${parts.hours}h · ${parts.minutes}m · ${parts.seconds}s`;

  // Controls
  const controls = document.createElement('div');
  controls.className = 'controls';

  const delBtn = document.createElement('button');
  delBtn.className = 'icon-btn';
  delBtn.textContent = t('deleteButton');
  delBtn.addEventListener('click', (e) => {
    e.stopImmediatePropagation();
    if (confirm(t('deleteConfirm').replace('{name}', item.name))) {
      deleteCounter(item.id);
    }
  });

  controls.appendChild(delBtn);

  card.appendChild(title);
  card.appendChild(counterEl);
  card.appendChild(breakdown);
  card.appendChild(controls);

  return card;
}

// Initial render with staggered entrance animations
function initialRender() {
  listEl.innerHTML = '';
  cardElements = {};

  if (counters.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<div class="small" style="padding:12px 4px">${t('emptyState')}</div>`;
    listEl.appendChild(empty);
    return;
  }

  const now = new Date();
  
  counters.forEach((item, index) => {
    const card = createCard(item);
    card.style.animationDelay = `${index * 90}ms`; // staggered entrance
    listEl.appendChild(card);
    cardElements[item.id] = card;
  });
  
  isFirstRender = false;
}

// Update only the text content of existing cards (no re-animation)
function updateLiveCounters() {
  const now = new Date();
  
  counters.forEach(item => {
    const card = cardElements[item.id];
    if (!card) return;

    const parts = diffDetailed(new Date(item.isoDate), now);
    const partsArr = formatParts(parts);

    // Update main counter
    const counterEl = card.querySelector('.counter');
    if (counterEl) {
      counterEl.textContent = partsArr.length 
        ? partsArr.slice(0, 4).join(' · ') 
        : t('justNow');
    }

    // Update breakdown
    const breakdownEl = card.querySelector('.breakdown');
    if (breakdownEl) {
      breakdownEl.textContent = 
        `${parts.decades}d · ${parts.years}y · ${parts.months}m · ${parts.weeks}w · ${parts.days}d · ${parts.hours}h · ${parts.minutes}m · ${parts.seconds}s`;
    }
  });
}

// Full re-render (used after add/delete/clear)
function fullRender() {
  // Clear old references
  cardElements = {};
  listEl.innerHTML = '';

  if (counters.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<div class="small" style="padding:12px 4px">${t('emptyState')}</div>`;
    listEl.appendChild(empty);
    return;
  }

  const now = new Date();
  
  counters.forEach((item, index) => {
    const card = createCard(item);
    // Only animate on very first load
    if (isFirstRender) {
      card.style.animationDelay = `${index * 90}ms`;
    } else {
      card.style.animation = 'none'; // prevent re-animation on updates
    }
    listEl.appendChild(card);
    cardElements[item.id] = card;
  });
  
  if (isFirstRender) isFirstRender = false;
}

// Delete one counter
function deleteCounter(id) {
  counters = counters.filter(c => c.id !== id);
  delete cardElements[id];
  save();
  fullRender();
}

// Live update loop (efficient — only updates text)
function tick() {
  updateLiveCounters();
  rafId = setTimeout(tick, 1000);
}

// === Event handlers ===

addBtn.addEventListener('click', () => {
  personNameInput.value = '';
  personDateInput.value = '';
  modal.classList.remove('hidden');
  personNameInput.focus();
});

cancelBtn.addEventListener('click', () => {
  modal.classList.add('hidden');
});

addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = personNameInput.value.trim();
  const iso = personDateInput.value;
  if (!name || !iso) return alert(t('fillError'));

  const date = new Date(iso);
  if (isNaN(date.getTime())) return alert(t('invalidDate'));

  const id = uid();
  counters.push({ 
    id, 
    name, 
    isoDate: date.toISOString(), 
    createdAt: new Date().toISOString() 
  });

  sortCounters();
  save();
  modal.classList.add('hidden');
  
  // Full re-render so new card appears in correct position with animation
  fullRender();
});

clearAllBtn.addEventListener('click', () => {
  if (!confirm(t('deleteAllConfirm'))) return;
  counters = [];
  cardElements = {};
  save();
  fullRender();
});

// === Export / Import (extra persistence features) ===

const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

exportBtn.addEventListener('click', () => {
  if (counters.length === 0) {
    alert(t('exportEmpty'));
    return;
  }
  const data = {
    exportedAt: new Date().toISOString(),
    app: 'From the day I met you',
    version: 2,
    counters: counters
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `from-the-day-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => {
  importFile.click();
});

importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.counters || !Array.isArray(data.counters)) {
      throw new Error('Invalid backup file');
    }

    const confirmMsg = t('importConfirm').replace('{count}', data.counters.length);
    if (!confirm(confirmMsg)) {
      importFile.value = '';
      return;
    }

    counters = data.counters;
    sortCounters();
    save();
    fullRender();
    alert(t('importSuccess'));
  } catch (err) {
    alert(t('importError'));
    console.error(err);
  }
  importFile.value = '';
});

// === Elegant Language Switcher ===

function showLanguageModal() {
  // Remove existing modal if any
  const existing = document.getElementById('langModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'langModal';
  modal.className = 'modal';
  
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 380px; position: relative;">
      <button class="lang-close-btn" onclick="document.getElementById('langModal').remove()">×</button>
      
      <h2 style="margin-bottom: 16px; text-align: center; margin-top: 8px;">${t('languageModalTitle')}</h2>
      
      <div class="lang-options">
        <button class="lang-option" data-lang="en">
          <span class="flag">🇬🇧</span>
          <span class="lang-name">English</span>
        </button>
        <button class="lang-option" data-lang="es">
          <span class="flag">🇪🇸</span>
          <span class="lang-name">Español</span>
        </button>
        <button class="lang-option" data-lang="pt">
          <span class="flag">🇵🇹</span>
          <span class="lang-name">Português</span>
        </button>
        <button class="lang-option" data-lang="it">
          <span class="flag">🇮🇹</span>
          <span class="lang-name">Italiano</span>
        </button>
        <button class="lang-option" data-lang="ru">
          <span class="flag">🇷🇺</span>
          <span class="lang-name">Русский</span>
        </button>
      </div>
      
      <button class="btn ghost" style="width:100%; margin-top:16px;" onclick="document.getElementById('langModal').remove()">
        ${t('cancelButton')}
      </button>
    </div>
  `;

  // Close modal when clicking on the backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);

  // Prevent clicks inside the card from bubbling to the backdrop
  const card = modal.querySelector('.modal-card');
  card.addEventListener('click', (e) => {
    e.stopImmediatePropagation();
  });

  // Add styles for lang options + close button (injected once)
  if (!document.getElementById('lang-styles')) {
    const style = document.createElement('style');
    style.id = 'lang-styles';
    style.textContent = `
      .lang-options { display: flex; flex-direction: column; gap: 8px; }
      .lang-option {
        display: flex; align-items: center; gap: 14px;
        padding: 14px 18px; border-radius: 12px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        color: var(--text); cursor: pointer; font-size: 1rem;
        transition: all 0.2s ease;
      }
      .lang-option:hover {
        background: rgba(68,170,255,0.1);
        border-color: var(--accent);
        transform: translateX(4px);
      }
      .lang-option .flag { font-size: 1.5rem; }
      .lang-option .lang-name { font-weight: 600; }

      .lang-close-btn {
        position: absolute;
        top: 12px;
        right: 16px;
        background: transparent;
        border: none;
        color: var(--muted);
        font-size: 28px;
        line-height: 1;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 50%;
        transition: all 0.2s ease;
      }
      .lang-close-btn:hover {
        color: #fff;
        background: rgba(255,255,255,0.1);
      }
    `;
    document.head.appendChild(style);
  }

  // Attach click handlers to language options
  modal.querySelectorAll('.lang-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const newLang = btn.dataset.lang;
      setLanguage(newLang);
    });
  });
}

langBtn.addEventListener('click', showLanguageModal);

// Init
(async function initApp() {
  await loadTranslations();
  load();                    // load counters
  initialRender();
  updateStaticTexts();       // apply current language to static texts
  tick();
})();

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => {
    console.log('%c[SW] Service worker registered', 'color:#555');
  }).catch(() => {});
}
