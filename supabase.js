// ── Supabase Client ──
const SUPABASE_URL = 'https://uzbzxxkrtvexymtginbx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KAXm649e5TRLNAqbOerduA_vBngU3Xg';

const sb = {
  async query(method, path, body) {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation,resolution=merge-duplicates' : 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error('Supabase ' + method + ' ' + path + ': ' + err);
    }
    const text = await resp.text();
    return text ? JSON.parse(text) : [];
  },

  // Load all bookings for a community
  async loadBookings(community) {
    return await sb.query('GET', 'bookings?community=eq.' + encodeURIComponent(community) + '&order=date.desc,time.desc&limit=2000');
  },

  // Upsert (insert or update) bookings
  async upsertBookings(bookings) {
    if (!bookings.length) return [];
    return await sb.query('POST', 'bookings', bookings);
  },

  // Delete a booking
  async deleteBooking(id) {
    await fetch(SUPABASE_URL + '/rest/v1/bookings?id=eq.' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    });
  },

  // Check which gcal_ids already exist for a community
  async getExistingGcalIds(community) {
    const rows = await sb.query('GET', 'bookings?community=eq.' + encodeURIComponent(community) + '&gcal_id=not.is.null&select=gcal_id');
    return new Set(rows.map(r => r.gcal_id));
  },
};

// ── Current community (from calendar selector) ──
function getCurrentCommunity() {
  const sel = document.getElementById('sync-cal-id');
  if (!sel) return 'T5';
  const val = sel.value;
  if (val.includes('k4c8b7')) return 'T3';
  if (val.includes('c069be')) return 'T7';
  return 'T5';
}

// ── DB state (in-memory, loaded from Supabase) ──
// db.bookings is already defined in app.js — we populate it here
let currentCommunity = 'T5';
let pendingSyncCount = 0; // gcal events parsed but not yet saved

async function initSupabase() {
  currentCommunity = getCurrentCommunity();
  updateCommunityBadge();
  try {
    showDbStatus('loading');
    const rows = await sb.loadBookings(currentCommunity);
    db.bookings = rows;
    renderAll();
    showDbStatus('ok', rows.length + ' 筆');
  } catch(e) {
    showDbStatus('error', e.message);
    showToast('Supabase 連線失敗，使用本地快取');
    // Fallback to localStorage
    const local = localStorage.getItem('T5_bookings_v1');
    if (local) { try { db = JSON.parse(local); renderAll(); } catch(_) {} }
  }
}

async function switchCommunity() {
  currentCommunity = getCurrentCommunity();
  updateCommunityBadge();
  await initSupabase();
}

function updateCommunityBadge() {
  const badge = document.getElementById('community-badge');
  if (badge) {
    badge.textContent = currentCommunity;
    badge.style.background = currentCommunity === 'T5' ? '#7ab648' : currentCommunity === 'T3' ? '#4285f4' : '#ea4335';
  }
}

function showDbStatus(state, msg) {
  const el = document.getElementById('db-status');
  if (!el) return;
  const colors = { loading: '#fbbc04', ok: '#34a853', error: '#ea4335' };
  el.style.color = colors[state] || '#999';
  el.textContent = state === 'loading' ? '載入中...' : state === 'ok' ? '✓ ' + msg : '✗ ' + msg;
}

// ── Override saveDB to write to Supabase ──
async function saveBookingToSupabase(booking) {
  try {
    booking.community = currentCommunity;
    await sb.upsertBookings([booking]);
  } catch(e) {
    showToast('儲存失敗：' + e.message);
  }
}

async function deleteBookingFromSupabase(id) {
  try {
    await sb.deleteBooking(id);
  } catch(e) {
    showToast('刪除失敗：' + e.message);
  }
}

// ── Sync button in header ──
function updateSyncBadge(count) {
  pendingSyncCount = count;
  const btn = document.getElementById('header-sync-btn');
  const badge = document.getElementById('sync-pending-badge');
  if (!btn) return;
  btn.style.display = count > 0 ? 'inline-flex' : 'none';
  if (badge) badge.textContent = count;
}

async function commitSyncToSupabase() {
  if (!gcalParsed || !gcalParsed.length) { showToast('沒有待同步的資料'); return; }
  const toSave = gcalParsed.filter(b => !b._exists);
  if (!toSave.length) { showToast('所有資料已是最新'); updateSyncBadge(0); return; }

  showToast('同步中...');
  try {
    const records = toSave.map(b => {
      const { _exists, _selected, _raw, ...clean } = b;
      clean.community = currentCommunity;
      return clean;
    });
    await sb.upsertBookings(records);

    // Update local db
    records.forEach(r => {
      if (!db.bookings.find(b => b.id === r.id)) db.bookings.push(r);
    });
    renderAll();
    updateSyncBadge(0);
    showToast('✓ 已同步 ' + records.length + ' 筆到 Supabase');

    // Mark as exists in preview
    gcalParsed.forEach(b => { b._exists = true; b._selected = false; });
    document.getElementById('gcal-preview-header').innerHTML = '已同步完成，共 ' + records.length + ' 筆新增';
  } catch(e) {
    showToast('同步失敗：' + e.message);
  }
}

// ── Community switcher UI ──

function toggleCommunitySwitcher() {
  const dd = document.getElementById('community-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  // Close on outside click
  if (dd.style.display === 'block') {
    setTimeout(() => {
      document.addEventListener('click', closeSwitcherOnOutside, { once: true });
    }, 10);
  }
}

function closeSwitcherOnOutside(e) {
  const sw = document.getElementById('community-switcher');
  if (sw && !sw.contains(e.target)) {
    const dd = document.getElementById('community-dropdown');
    if (dd) dd.style.display = 'none';
  }
}

function selectCommunity(community, calId, label) {
  // Close dropdown
  const dd = document.getElementById('community-dropdown');
  if (dd) dd.style.display = 'none';

  // Update badge color and label
  const badge = document.getElementById('community-badge');
  if (badge) {
    badge.textContent = community;
    badge.style.background = COMMUNITY_COLORS[community] || '#7ab648';
  }

  // Update switcher label
  const switcherLabel = document.getElementById('community-switcher-label');
  if (switcherLabel) switcherLabel.textContent = label;

  // Mark active option
  document.querySelectorAll('.community-opt').forEach(btn => btn.classList.remove('active'));
  const activeOpt = document.getElementById('copt-' + community);
  if (activeOpt) activeOpt.classList.add('active');

  // Update hidden calendar input and display in sync tab
  const calInput = document.getElementById('sync-cal-id');
  if (calInput) calInput.value = calId;
  const calDisplay = document.getElementById('sync-cal-display');
  if (calDisplay) calDisplay.textContent = label;
  GCAL_CONFIG.calendarId = calId;

  // Reload data from Supabase for this community
  currentCommunity = community;
  showDbStatus('loading');
  sb.loadBookings(community).then(rows => {
    db.bookings = rows;
    renderAll();
    showDbStatus('ok', rows.length + ' 筆');
    showToast('已切換至 ' + label);
  }).catch(e => {
    showDbStatus('error', e.message);
    showToast('載入失敗：' + e.message);
  });
}

// Init switcher active state
document.addEventListener('DOMContentLoaded', function() {
  const activeOpt = document.getElementById('copt-T5');
  if (activeOpt) activeOpt.classList.add('active');
});