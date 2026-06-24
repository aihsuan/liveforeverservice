// ── Google Calendar OAuth & Sync ──
const GCAL_CONFIG = {
  clientId: '272901005979-0jurv83up3mjqlqjs837pqcitom5o5aq.apps.googleusercontent.com',
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
  calendarId: 'c_830b46389d01c1448260b276df1de59508e58dbe8f102017a317c66f38999da0@group.calendar.google.com',
};

const CAL_MAP = {
  'c_830b46389d01c1448260b276df1de59508e58dbe8f102017a317c66f38999da0@group.calendar.google.com': { name: 'T5', community: 'T5' },
  'c_k4c8b7jg3o9mhbeon2friejm48@group.calendar.google.com': { name: 'T3', community: 'T3' },
  'c_c069be5857913cc1959315f89da1d1453122e69ef51a4c8b172c35d4df9c74a8@group.calendar.google.com': { name: 'T7', community: 'T7' },
};

const COMMUNITY_COLORS = { T5: '#7ab648', T3: '#4285f4', T7: '#ea4335' };

const COMMUNITY_CAL = {
  'T5': 'c_830b46389d01c1448260b276df1de59508e58dbe8f102017a317c66f38999da0@group.calendar.google.com',
  'T3': 'c_k4c8b7jg3o9mhbeon2friejm48@group.calendar.google.com',
  'T7': 'c_c069be5857913cc1959315f89da1d1453122e69ef51a4c8b172c35d4df9c74a8@group.calendar.google.com',
};

const CLIENT_ID_KEY = 'T5_gcal_client_id';
let tokenClient = null;
let gcalAccessToken = null;

function getSavedClientId() { return GCAL_CONFIG.clientId; }
function saveClientId(id) { /* hardcoded, no-op */ }

function initGoogleAuth() {
  if (typeof google === 'undefined') {
    // Google script not loaded yet, show login screen
    setTimeout(initGoogleAuth, 500);
    return;
  }
  _buildTokenClient(GCAL_CONFIG.clientId);

  // Restore saved token if still valid
  try {
    const saved = JSON.parse(localStorage.getItem('T5_gcal_token') || 'null');
    if (saved && saved.expiry > Date.now() + 60000) {
      gcalAccessToken = saved.token;
      setGcalStatus('connected');
      hideLoginScreen();
      // Token valid — load Supabase data
      if (typeof initSupabase === 'function') initSupabase();
      return;
    }
  } catch(e) {}

  // No valid token — show login screen
  if (typeof showLoginScreen === 'function') showLoginScreen();
}

function _buildTokenClient(clientId) {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GCAL_CONFIG.clientId,
    scope: GCAL_CONFIG.scope,
    callback: (resp) => {
      if (resp.error) { showToast('Google 授權失敗：' + resp.error); setGcalStatus('disconnected'); return; }
      gcalAccessToken = resp.access_token;
      // Save token expiry (Google tokens last ~1 hour)
      const expiry = Date.now() + 55 * 60 * 1000;
      localStorage.setItem('T5_gcal_token', JSON.stringify({ token: resp.access_token, expiry }));
      setGcalStatus('connected');
      hideLoginScreen();
      // Load Supabase data first, then auto-check calendar for new events
      if (typeof initSupabase === 'function') {
        initSupabase().then(() => {
          fetchCalendarEvents();
        });
      } else {
        fetchCalendarEvents();
      }
    },
  });
}

function connectGoogle() {
  _buildTokenClient(GCAL_CONFIG.clientId);
  if (!tokenClient) { showToast('Google 服務載入中，請稍候再試'); return; }
  setGcalStatus('loading');
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function showClientIdModal() {
  let modal = document.getElementById('client-id-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'client-id-modal';
    modal.innerHTML = `
      <div onclick="closeClientIdModal()" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div onclick="event.stopPropagation()" style="background:var(--surface);border-radius:16px;border:0.5px solid var(--border-strong);padding:24px;width:100%;max-width:420px;">
          <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px;">連結 Google Calendar</div>
          <div style="font-size:13px;color:var(--text3);margin-bottom:16px;">填入 Google Cloud Console 的 OAuth Client ID</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input id="modal-client-id-input" type="password" placeholder="xxxxx.apps.googleusercontent.com"
              style="flex:1;font-family:monospace;font-size:13px;background:var(--surface2);border:0.5px solid var(--border-strong);border-radius:10px;padding:9px 12px;color:var(--text);"
              onkeydown="if(event.key==='Enter')connectGoogle()">
            <button onclick="toggleModalIdVisibility()" id="btn-modal-toggle" style="background:var(--surface2);border:0.5px solid var(--border-strong);border-radius:10px;padding:0 12px;font-size:13px;color:var(--text2);cursor:pointer;white-space:nowrap;">顯示</button>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:16px;">僅儲存在瀏覽器，不會外傳。<a href="https://console.cloud.google.com/" target="_blank" style="color:var(--accent)">前往 Google Cloud Console →</a></div>
          <div style="display:flex;gap:8px;">
            <button onclick="connectGoogle()" style="flex:1;padding:10px;border-radius:10px;background:#4285f4;color:white;font-size:14px;font-weight:500;cursor:pointer;border:none;font-family:inherit;">登入 Google</button>
            <button onclick="closeClientIdModal()" style="padding:10px 16px;border-radius:10px;background:var(--surface2);color:var(--text2);font-size:14px;cursor:pointer;border:0.5px solid var(--border-strong);font-family:inherit;">取消</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'block';
  const input = document.getElementById('modal-client-id-input');
  const saved = getSavedClientId();
  if (saved && input) input.value = saved;
  setTimeout(() => input && input.focus(), 50);
}

function closeClientIdModal() {
  const modal = document.getElementById('client-id-modal');
  if (modal) modal.style.display = 'none';
}

function toggleModalIdVisibility() {
  const input = document.getElementById('modal-client-id-input');
  const btn = document.getElementById('btn-modal-toggle');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '顯示' : '隱藏';
}

function toggleClientIdVisibility() {
  const input = document.getElementById('gcal-client-id-input');
  const btn = document.getElementById('btn-toggle-id');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '顯示' : '隱藏';
}

function disconnectGoogle() {
  if (gcalAccessToken) { google.accounts.oauth2.revoke(gcalAccessToken); gcalAccessToken = null; }
  localStorage.removeItem('T5_gcal_token');
  setGcalStatus('disconnected');
  document.getElementById('gcal-preview').innerHTML = '';
  document.getElementById('sync-actions').style.display = 'none';
  showToast('已登出 Google Calendar');
}

function setGcalStatus(status) {
  const dot = document.getElementById('gcal-dot');
  const label = document.getElementById('gcal-status-label');
  const connectBtn = document.getElementById('btn-gcal-connect');
  const disconnectBtn = document.getElementById('btn-gcal-disconnect');
  const refreshBtn = document.getElementById('btn-gcal-refresh');
  dot.className = 'gcal-dot ' + (status === 'connected' ? 'connected' : status === 'loading' ? 'loading' : '');
  label.textContent = status === 'connected' ? '已連結 Google Calendar' : status === 'loading' ? '連線中...' : '尚未連結';
  connectBtn.style.display = status === 'connected' ? 'none' : 'inline-flex';
  disconnectBtn.style.display = status === 'connected' ? 'inline-flex' : 'none';
  refreshBtn.style.display = status === 'connected' ? 'inline-flex' : 'none';
  const hBtn = document.getElementById('header-gcal-btn');
  const hLabel = document.getElementById('header-gcal-label');
  if (!hBtn) return;
  hBtn.className = 'header-gcal-btn' + (status === 'connected' ? ' connected' : status === 'loading' ? ' loading' : '');
  hLabel.textContent = status === 'connected' ? '已連結' : status === 'loading' ? '連線中...' : '登入';
}

function handleHeaderGcalClick() {
  if (gcalAccessToken) {
    // Already connected — jump to sync tab
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-sync').classList.add('active');
    document.querySelectorAll('.nav-tab')[6].classList.add('active');
  } else {
    connectGoogle();
  }
}

// ── Fetch events ──
async function fetchCalendarEvents() {
  if (!gcalAccessToken) return;
  setGcalStatus('loading');
  const now = new Date();
  const syncRange = document.getElementById('sync-months')?.value || 'default';
  let timeMin, timeMax;
  if (syncRange === 'curr') {
    // 本月 + 未來 6 個月（自動偵測用）
    timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    timeMax = new Date(now.getFullYear(), now.getMonth() + 7, 0, 23, 59, 59).toISOString();
  } else if (syncRange === 'past3') {
    // 過去 3 個月 + 本月（手動補資料用）
    timeMin = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
    timeMax = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  } else if (syncRange === 'next6') {
    // 未來 6 個月（手動補未來資料用）
    timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    timeMax = new Date(now.getFullYear(), now.getMonth() + 7, 0, 23, 59, 59).toISOString();
  } else {
    // default: 本月 + 未來 6 個月（自動偵測預設）
    timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    timeMax = new Date(now.getFullYear(), now.getMonth() + 7, 0, 23, 59, 59).toISOString();
  }
  try {
    // Auto-select calendar based on current community
    const _community = typeof currentCommunity !== 'undefined' ? currentCommunity : 'T5';
    const calId = COMMUNITY_CAL[_community] || GCAL_CONFIG.calendarId;
    GCAL_CONFIG.calendarId = calId;
    // Fetch all pages
    let allItems = [];
    let pageToken = null;
    let pageCount = 0;
    do {
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calId) + '/events');
      url.searchParams.set('timeMin', timeMin);
      url.searchParams.set('timeMax', timeMax);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', '500');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const resp = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + gcalAccessToken } });
      if (resp.status === 401) { gcalAccessToken = null; setGcalStatus('disconnected'); showToast('授權已過期，請重新連結'); return; }
      const data = await resp.json();
      if (data.error) { showToast('API 錯誤：' + data.error.message); return; }
      allItems = allItems.concat(data.items || []);
      pageToken = data.nextPageToken || null;
      pageCount++;
    } while (pageToken && pageCount < 10);
    setGcalStatus('connected');
    renderSyncPreview(allItems);
  } catch (e) {
    setGcalStatus('connected');
    showToast('讀取行事曆失敗：' + e.message);
  }
}

// ── Parse: 1 event = 1 booking ──
function parseGCalEvent(event) {
  const title = (event.summary || '').trim();
  const body = (event.description || '').replace(/<[^>]*>/g, '').trim();
  const startRaw = event.start && (event.start.dateTime || event.start.date) || '';
  const dateStr = startRaw.substring(0, 10);
  const timeStr = startRaw.length > 10 ? startRaw.substring(11, 16) : '00:00';

  // Community from current selection
  const _comm = typeof currentCommunity !== 'undefined' ? currentCommunity : 'T5';

  // Category
  let category = '住戶接待';
  if (/包場/.test(title)) category = '包場';
  else if (/森活聚落活動/.test(title)) category = '森活聚落活動';
  else if (/分享活動|分享/.test(title)) category = '分享活動';
  else if (/節氣/.test(title)) category = '節氣活動';
  else if (/餐飲消費/.test(title)) category = '餐飲消費';
  else if (/森活聚落/.test(title)) category = '森活聚落';
  else if (/接待使用|住戶接待/.test(title)) category = '住戶接待';

  // Service name
  const service = title.replace(/^T[357][-_]?/, '').replace(/-\d+[A-Za-z]-\d+[Pp]$/, '').replace(/-\d+[Pp]$/, '').replace(/-\d+[A-Za-z]$/, '').trim() || title;

  // 分享活動: 1 booking, total persons, rooms in note
  if (category === '分享活動' || category === '森活聚落') {
    const lines = body.split('\n').map(function(l) { return l.trim(); });
    const roomLines = lines.filter(function(l) { return /^\d+[A-Za-z]\s*[*xX]\s*\d+/.test(l); });
    if (roomLines.length > 0) {
      var totalPersons = 0;
      var roomNote = roomLines.map(function(l) {
        var m = l.match(/[*xX]\s*(\d+)/);
        if (m) totalPersons += parseInt(m[1]);
        return l.replace(/\s/g, '');
      }).join(' ');
      return [{ id: genId(), gcalId: event.id, date: dateStr, time: timeStr, community: _comm, room: '多戶', floor: '', unit: '', persons: totalPersons, service: service, category: category, amount: 0, note: roomNote, staff: '', source: 'gcal' }];
    }
    return [{ id: genId(), gcalId: event.id, date: dateStr, time: timeStr, community: _comm, room: '多戶', floor: '', unit: '', persons: 1, service: service, category: category, amount: 0, note: body.substring(0, 300), staff: '', source: 'gcal' }];
  }

  // Others: extract room and persons from title
  var roomMatch = title.match(/-(\d+[A-Za-z])-\d+[Pp]/) || title.match(/(\d+[A-Za-z])/);
  var personsMatch = title.match(/-(\d+)[Pp]/) || title.match(/(\d+)[Pp]/i) || body.match(/人數[：:\s]*(\d+)/);
  var room = roomMatch ? roomMatch[1].toUpperCase() : '?';
  var persons = personsMatch ? parseInt(personsMatch[1]) : 1;
  var parsed = parseRoom(room);
  return [{ id: genId(), gcalId: event.id, date: dateStr, time: timeStr, community: _comm, room: room, floor: parsed.floor, unit: parsed.unit, persons: persons, service: service, category: category, amount: 0, note: body.substring(0, 300), staff: '', source: 'gcal' }];
}


// Notification system
var notifItems = [];

function addNotif(message, type) {
  const notif = { id: Date.now(), message: message, type: type || 'info', time: new Date().toLocaleTimeString('zh-TW', {hour:'2-digit',minute:'2-digit'}) };
  notifItems.unshift(notif);
  if (notifItems.length > 20) notifItems.pop();
  renderNotifPanel();
  showNotifDot(true);
  const bell = document.getElementById('header-notif');
  if (bell) bell.style.display = 'inline-flex';
}

function renderNotifPanel() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!notifItems.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;font-size:13px;color:var(--text3)">沒有新通知</div>';
    return;
  }
  list.innerHTML = notifItems.map(n => {
    const icon = n.type === 'sync' ? '☁️' : n.type === 'warn' ? '⚠️' : '📅';
    return '<div style="padding:10px 16px;border-bottom:0.5px solid var(--border);font-size:13px;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span>' + icon + '</span>' +
        '<span style="flex:1;color:var(--text)">' + n.message + '</span>' +
        '<span style="font-size:11px;color:var(--text3);white-space:nowrap">' + n.time + '</span>' +
      '</div></div>';
  }).join('');
}

function showNotifDot(show) {
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = show ? 'block' : 'none';
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') {
    showNotifDot(false);
    setTimeout(() => document.addEventListener('click', closeNotifOnOutside, { once: true }), 10);
  }
}

function closeNotifOnOutside(e) {
  const notif = document.getElementById('header-notif');
  if (notif && !notif.contains(e.target)) {
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = 'none';
  }
}

function clearNotifs() {
  notifItems = [];
  renderNotifPanel();
  showNotifDot(false);
  const bell = document.getElementById('header-notif');
  if (bell) bell.style.display = 'none';
}

// Auto sync new items to Supabase without manual confirm
async function autoSyncToSupabase(newItems) {
  if (!newItems || !newItems.length) return;
  try {
    const comm = typeof currentCommunity !== 'undefined' ? currentCommunity : 'T5';
    const records = newItems.map(b => {
      const { _exists, _selected, _raw, ...clean } = b;
      clean.community = comm;
      return clean;
    });
    await sb.upsertBookings(records);

    // Update local db
    records.forEach(r => {
      if (!db.bookings.find(b => b.id === r.id)) db.bookings.push(r);
    });

    // Mark as synced
    gcalParsed.forEach(b => {
      b._exists = db.bookings.some(ex => ex.gcalId === b.gcalId || ex.gcal_id === b.gcalId);
      b._selected = !b._exists;
    });

    renderAll();
    updateSyncBadge(0);

    // Add notification
    addNotif(comm + ' 行事曆新增 ' + records.length + ' 筆預約已自動同步', 'sync');
    showToast('✓ ' + comm + ' 已自動同步 ' + records.length + ' 筆');

    document.getElementById('sync-actions').style.display = 'none';
    const header = document.getElementById('gcal-preview-header');
    if (header) header.innerHTML = '✓ 已同步完成，' + comm + ' 新增 <strong>' + records.length + '</strong> 筆';

  } catch(e) {
    showToast('自動同步失敗，請手動同步');
    updateSyncBadge(newItems.length);
    addNotif('自動同步失敗：' + e.message, 'warn');
  }
}

// ── Render sync preview ──
var gcalParsed = [];

function renderSyncPreview(events) {
  gcalParsed = [];
  var _filterComm = typeof currentCommunity !== 'undefined' ? currentCommunity : 'T5';
  events.forEach(function(ev) {
    if (!ev.summary || ev.summary.indexOf(_filterComm) === -1) return;
    var parsed = parseGCalEvent(ev);
    parsed.forEach(function(b) {
      var exists = db.bookings.some(function(existing) {
        return existing.gcalId === ev.id || existing.gcal_id === ev.id ||
               (existing.date === b.date && existing.room === b.room && existing.time === b.time);
      });
      gcalParsed.push(Object.assign({}, b, { _exists: exists, _selected: !exists, _raw: ev.summary }));
    });
  });

  var newCount = gcalParsed.filter(function(b) { return !b._exists; }).length;
  var existsCount = gcalParsed.filter(function(b) { return b._exists; }).length;
  document.getElementById('gcal-preview-header').innerHTML =
    '從行事曆找到 <strong>' + events.length + '</strong> 個事件，含 ' + (typeof currentCommunity !== 'undefined' ? currentCommunity : 'T5') + ' 的 <strong>' + gcalParsed.length + '</strong> 筆' +
    (newCount > 0 ? '（<span style="color:var(--green-600)">' + newCount + ' 筆新增</span>、' + existsCount + ' 筆已存在）' : '（全部已存在）');

  var previewEl = document.getElementById('gcal-preview');
  if (!gcalParsed.length) {
    previewEl.innerHTML = '<div class="empty"><div class="empty-icon">📅</div><p>沒有找到含 ' + (typeof currentCommunity !== 'undefined' ? currentCommunity : 'T5') + ' 的事件</p></div>';
    document.getElementById('sync-actions').style.display = 'none';
    return;
  }

  previewEl.innerHTML = gcalParsed.map(function(b, i) {
    var catMap = { '住戶接待': 'booking', '包場': 'venue', '分享活動': 'share', '餐飲消費': 'meal', '節氣活動': 'share', '森活聚落': 'community' };
    var tag = '<span class="parse-tag ' + (catMap[b.category] || 'unknown') + '">' + b.category + '</span>';
    return '<div class="sync-preview-item">' +
      '<input type="checkbox" class="sync-checkbox" id="sync-cb-' + i + '" ' + (b._selected ? 'checked' : '') + ' ' + (b._exists ? 'disabled' : '') + ' onchange="gcalParsed[' + i + ']._selected=this.checked">' +
      '<div class="sync-preview-body">' +
        '<div class="sync-preview-title">' +
          '<span class="room-badge" style="font-size:11px;padding:1px 7px">' + (b.room === '?' ? (b.community || 'T5') : b.room) + '</span> ' + b.service + ' ' +
          (b._exists ? '<span class="sync-badge-exists">已存在</span>' : '<span class="sync-badge-new">新增</span>') +
        '</div>' +
        '<div class="sync-preview-meta">' +
          '<span>📅 ' + b.date + '</span><span>🕐 ' + b.time + '</span><span>👥 ' + b.persons + ' 人</span><span>' + tag + '</span>' +
        '</div>' +
        (b.note ? '<div style="margin-top:4px;font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:400px">📝 ' + b.note + '</div>' : '') +
        '<div style="margin-top:3px;font-size:10px;color:var(--text3)">原始：' + b._raw + '</div>' +
      '</div></div>';
  }).join('');
  // Auto-upload new items to Supabase silently
  const newItems = gcalParsed.filter(b => !b._exists);
  if (newItems.length > 0) {
    autoSyncToSupabase(newItems);
  } else {
    // No new items — hide sync button
    if (typeof updateSyncBadge === 'function') updateSyncBadge(0);
  }

  document.getElementById('sync-actions').style.display = newItems.length > 0 ? 'flex' : 'none';
}

function selectAllNew() {
  gcalParsed.forEach(function(b, i) {
    if (!b._exists) {
      b._selected = true;
      var cb = document.getElementById('sync-cb-' + i);
      if (cb) cb.checked = true;
    }
  });
}

function importSelected() {
  var toImport = gcalParsed.filter(function(b) { return b._selected && !b._exists; });
  if (!toImport.length) { showToast('沒有選取新的項目'); return; }
  var records = [];
  toImport.forEach(function(b) {
    var clean = Object.assign({}, b);
    delete clean._exists; delete clean._selected; delete clean._raw;
    clean.community = typeof getCurrentCommunity === 'function' ? getCurrentCommunity() : 'T5';
    db.bookings.push(clean);
    records.push(clean);
  });
  saveDB();
  renderAll();
  // Write to Supabase
  if (typeof sb !== 'undefined') {
    sb.upsertBookings(records).then(function() {
      showToast('✓ 已同步 ' + records.length + ' 筆到 Supabase');
    }).catch(function(e) {
      showToast('本地已儲存，Supabase 失敗：' + e.message);
    });
  } else {
    showToast('✓ 已匯入 ' + toImport.length + ' 筆預約');
  }
  gcalParsed.forEach(function(b) {
    b._exists = db.bookings.some(function(ex) { return ex.gcalId === b.gcalId; });
    b._selected = !b._exists;
  });
  var newCount = gcalParsed.filter(function(b) { return !b._exists; }).length;
  document.getElementById('gcal-preview-header').innerHTML = '已匯入完成，剩餘 <strong>' + newCount + '</strong> 筆未匯入';
  document.querySelectorAll('.sync-badge-new').forEach(function(el) { el.className = 'sync-badge-exists'; el.textContent = '已存在'; });
}



function updateCommunityFromCal() {
  // No-op: community drives calendar, not the other way around
}