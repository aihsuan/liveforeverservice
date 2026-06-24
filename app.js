// ── Constants & State ──
const DATA_KEY = 'T5_bookings_v1';
const WEEKDAYS = ['日','一','二','三','四','五','六'];

let db = { bookings: [], lastUpdated: null };
let viewDay = new Date().toISOString().split('T')[0];
let viewMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };

// ── DB ──
function initDB() {
  // Supabase handles loading — initSupabase() called after scripts load
  db = { bookings: [], lastUpdated: new Date().toISOString() };
}

function saveDB() {
  // Legacy localStorage backup (non-blocking)
  try { localStorage.setItem(DATA_KEY, JSON.stringify(db)); } catch(e) {}
}

// ── Helpers ──
function genId() {
  return 'b' + Date.now().toString(36) + Math.random().toString(36).substr(2,4);
}

function parseRoom(room) {
  const m = (room || '').match(/^(\d+)([A-Z]?)$/i);
  if (m) return { floor: m[1], unit: m[2].toUpperCase() || '' };
  return { floor: '', unit: '' };
}

function formatDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth()+1}/${dt.getDate()} (${WEEKDAYS[dt.getDay()]})`;
}

function formatMoney(n) { return n > 0 ? `$${n.toLocaleString()}` : '免費'; }

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

function getMonthBookings(ym) {
  return db.bookings.filter(b => b.date.startsWith(ym));
}

// ── Clock ──
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
}
setInterval(updateClock, 60000);
updateClock();

// ── Tab switching ──
function switchTab(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.currentTarget.classList.add('active');

  if (name === 'overview') renderOverview();
  if (name === 'today') renderToday();
  if (name === 'monthly') renderMonthly();
  if (name === 'bookings') renderBookingList();
  if (name === 'residents') renderAllResidents();
  if (name === 'report') renderReport();
  if (name === 'analytics') renderAnalytics();
}

// ── TODAY ──
function goToday() { viewDay = new Date().toISOString().split('T')[0]; renderToday(); }
function shiftDay(d) {
  // Parse date parts directly to avoid timezone issues
  const parts = viewDay.split('-');
  const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  dt.setDate(dt.getDate() + d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  viewDay = y + '-' + m + '-' + day;
  renderToday();
}

function renderToday() {
  const dt = new Date(viewDay + 'T00:00:00');
  const isToday = viewDay === new Date().toISOString().split('T')[0];
  const isFuture = viewDay > new Date().toISOString().split('T')[0];

  document.getElementById('today-heading').textContent =
    `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日 (${WEEKDAYS[dt.getDay()]})`;
  document.getElementById('today-subheading').textContent =
    isToday ? '今天' : isFuture ? '未來' : '';

  const list = db.bookings
    .filter(b => b.date === viewDay)
    .sort((a, b) => a.time > b.time ? 1 : -1);

  document.getElementById('today-count').textContent = list.length;
  document.getElementById('today-persons').textContent = list.reduce((s,b) => s + (b.persons||0), 0);
  document.getElementById('today-amount').textContent = '$' + list.reduce((s,b) => s + (b.amount||0), 0).toLocaleString();

  // Always show a time axis from 09:00 to 21:00, bookings placed on it
  const HOURS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
  const nowTime = isToday ? `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}` : null;

  // Group bookings by hour slot
  const byHour = {};
  list.forEach(b => {
    const hour = b.time.substring(0,2) + ':00';
    if (!byHour[hour]) byHour[hour] = [];
    byHour[hour].push(b);
  });

  let html = '<div style="position:relative">';

  HOURS.forEach(hour => {
    const bookings = byHour[hour] || [];
    const isPast = nowTime && hour < nowTime;
    const isCurrent = nowTime && nowTime >= hour && nowTime < (String(parseInt(hour)+1).padStart(2,'0') + ':00');

    html += `<div style="display:flex;gap:0;min-height:52px;${isPast ? 'opacity:0.5' : ''}">
      <div style="flex-shrink:0;width:46px;text-align:right;font-size:11px;color:var(--text3);padding-top:6px;font-variant-numeric:tabular-nums;padding-right:10px;">
        ${hour}
      </div>
      <div style="flex:1;border-left:1.5px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'};padding:4px 0 4px 12px;position:relative;">
        ${isCurrent ? `<div style="position:absolute;left:-5px;top:6px;width:8px;height:8px;border-radius:50%;background:var(--accent)"></div>` : ''}
        ${bookings.length === 0
          ? `<div style="height:44px;display:flex;align-items:center;"><span style="font-size:12px;color:var(--border-strong)">—</span></div>`
          : bookings.map(b => `
            <div style="background:var(--surface);border:0.5px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                <span class="room-badge${b.source==='gcal'?' gcal':''}" style="font-size:12px">${b.room === '?' ? (b.community || 'T5') : b.room}</span>
                <span style="font-size:13px;font-weight:500;color:var(--text)">${b.service}</span>
                <span style="font-size:11px;color:var(--text3)">${b.time}</span>
                ${b.source==='gcal' ? '<span class="source-tag">Google Calendar</span>' : ''}
              </div>
              <div style="display:flex;gap:10px;font-size:12px;color:var(--text3);flex-wrap:wrap;">
                <span>👥 ${b.persons} 人</span>
                <span style="color:${b.amount>0?'var(--green-800)':'var(--text3)'};font-weight:${b.amount>0?600:400}">💰 ${formatMoney(b.amount)}</span>
                <span class="category-tag">${b.category}</span>
                ${b.staff ? `<span>👤 ${b.staff}</span>` : ''}
              </div>
              ${b.note ? `<div style="margin-top:4px;font-size:11px;color:var(--text3)">📝 ${b.note}</div>` : ''}
            </div>`).join('')
        }
      </div>
    </div>`;
  });

  html += '</div>';
  document.getElementById('today-timeline').innerHTML = html;
}

// ── MONTHLY ──
function goCurrentMonth() {
  const now = new Date();
  viewMonth = { year: now.getFullYear(), month: now.getMonth() };
  renderMonthly();
}
function shiftMonth(d) {
  let { year, month } = viewMonth;
  month += d;
  if (month < 0) { month = 11; year--; }
  if (month > 11) { month = 0; year++; }
  viewMonth = { year, month };
  renderMonthly();
}

function renderMonthly() {
  const { year, month } = viewMonth;
  const ym = `${year}-${String(month+1).padStart(2,'0')}`;
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();

  document.getElementById('month-heading').textContent = `${year}年${month+1}月`;
  document.getElementById('month-subheading').textContent = isCurrent ? '本月' : '';

  const list = db.bookings.filter(b => b.date.startsWith(ym));
  const totalAmt = list.reduce((s,b) => s + (b.amount||0), 0);

  document.getElementById('month-count').textContent = list.length;
  document.getElementById('month-amount').textContent = totalAmt.toLocaleString();
  document.getElementById('month-rooms').textContent = new Set(list.map(b=>b.room)).size;
  document.getElementById('month-persons').textContent = list.reduce((s,b) => s+(b.persons||0), 0);

  renderMonthCalendar(year, month, list);
  renderMonthServices(list);

  const sorted = [...list].sort((a,b) => (a.date+a.time) > (b.date+b.time) ? 1 : -1);
  document.getElementById('month-list-label').textContent = `當月所有紀錄（${sorted.length} 筆）`;
  document.getElementById('month-list').innerHTML = sorted.length
    ? sorted.map(b => bookingCard(b)).join('')
    : '<div class="empty"><div class="empty-icon">📋</div><p>這個月沒有預約紀錄</p></div>';
}

function renderMonthCalendar(year, month, list) {
  const byDay = {};
  list.forEach(b => {
    const day = parseInt(b.date.split('-')[2]);
    if (!byDay[day]) byDay[day] = { count: 0, paid: false, gcal: false };
    byDay[day].count++;
    if (b.amount > 0) byDay[day].paid = true;
    if (b.source === 'gcal') byDay[day].gcal = true;
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  let html = '<div class="cal-grid">';
  ['日','一','二','三','四','五','六'].forEach(d => {
    html += `<div class="cal-header">${d}</div>`;
  });
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day other-month"><span>${daysInPrev - firstDay + 1 + i}</span></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const ev = byDay[d];
    const cls = ['cal-day', isToday ? 'today-cell' : '', ev ? 'has-events' : ''].filter(Boolean).join(' ');
    html += `<div class="${cls}" onclick="jumpToDay('${dateStr}')">
      <span>${d}</span>
      ${ev ? `<div class="cal-dots">${Array(Math.min(ev.count,4)).fill(0).map((_, i) =>
        `<div class="cal-dot${ev.gcal && i === 0 ? ' gcal' : ev.paid ? ' paid' : ''}"></div>`
      ).join('')}</div>` : ''}
    </div>`;
  }
  const remaining = (7 - (firstDay + daysInMonth) % 7) % 7;
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="cal-day other-month"><span>${d}</span></div>`;
  }
  html += '</div>';
  html += '<div style="margin-top:8px;font-size:11px;color:var(--text3);display:flex;gap:12px;">' +
    '<span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);opacity:0.7;vertical-align:middle;margin-right:3px"></span>免費</span>' +
    '<span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green-600);vertical-align:middle;margin-right:3px"></span>有消費</span>' +
    '<span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#4285f4;vertical-align:middle;margin-right:3px"></span>Google Calendar</span>' +
    '</div>';
  document.getElementById('month-calendar').innerHTML = html;
}

function renderMonthServices(list) {
  const svcCount = {};
  list.forEach(b => {
    if (!svcCount[b.service]) svcCount[b.service] = { count: 0, amount: 0 };
    svcCount[b.service].count++;
    svcCount[b.service].amount += b.amount || 0;
  });
  const svcs = Object.entries(svcCount).sort((a,b) => b[1].count - a[1].count);
  const maxCount = svcs.length ? svcs[0][1].count : 1;
  document.getElementById('month-services').innerHTML = svcs.length
    ? svcs.map(([name, d]) => `
      <div class="pref-row">
        <div>
          <div class="pref-name">${name}</div>
          ${d.amount > 0 ? `<div style="font-size:11px;color:var(--green-800);font-weight:500">$${d.amount.toLocaleString()}</div>` : ''}
        </div>
        <span style="display:flex;align-items:center;gap:8px;">
          <span style="width:${Math.round(d.count/maxCount*70)}px;height:4px;background:var(--accent);border-radius:2px;display:inline-block;opacity:0.7"></span>
          <span class="pref-count">${d.count} 次</span>
        </span>
      </div>`).join('')
    : '<p style="color:var(--text3);font-size:13px;">尚無資料</p>';
}

function jumpToDay(dateStr) {
  viewDay = dateStr;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-today').classList.add('active');
  document.querySelectorAll('.nav-tab')[1].classList.add('active');
  renderToday();
}

// ── OVERVIEW ──
function renderOverview() {
  const ym = getCurrentMonth();
  const month = getMonthBookings(ym);
  const revenue = month.reduce((s,b) => s + (b.amount||0), 0);
  const avg = month.length > 0 ? Math.round(revenue / month.length) : 0;

  document.getElementById('stat-total').textContent = month.length;
  document.getElementById('stat-month').textContent = ym.replace('-', '年') + '月';
  document.getElementById('stat-revenue').textContent = revenue.toLocaleString();
  document.getElementById('stat-rooms').textContent = new Set(month.map(b => b.room)).size;
  document.getElementById('stat-avg').textContent = avg.toLocaleString();

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months.push({ label: `${d.getMonth()+1}月`, amt: getMonthBookings(key).reduce((s,b) => s+(b.amount||0), 0) });
  }
  const maxAmt = Math.max(...months.map(m => m.amt), 1);
  document.getElementById('monthly-chart').innerHTML = months.map(m => {
    const h = Math.max(Math.round((m.amt/maxAmt)*70), m.amt > 0 ? 4 : 2);
    return `<div class="month-bar-wrap"><div class="month-bar" style="height:${h}px" title="${m.label} $${m.amt}"></div></div>`;
  }).join('');
  document.getElementById('monthly-labels').innerHTML = months.map(m =>
    `<span style="flex:1;text-align:center;font-size:10px;color:var(--text3)">${m.label}</span>`
  ).join('');

  const svcCount = {};
  db.bookings.forEach(b => { svcCount[b.service] = (svcCount[b.service]||0) + 1; });
  const topSvcs = Object.entries(svcCount).sort((a,b) => b[1]-a[1]).slice(0,5);
  const maxC = topSvcs.length ? topSvcs[0][1] : 1;
  document.getElementById('top-services').innerHTML = topSvcs.length
    ? topSvcs.map(([name, count]) => `
      <div class="pref-row">
        <span class="pref-name">${name}</span>
        <span style="display:flex;align-items:center;gap:8px;">
          <span style="width:${Math.round(count/maxC*60)}px;height:4px;background:var(--accent);border-radius:2px;display:inline-block;opacity:0.7"></span>
          <span class="pref-count">${count} 次</span>
        </span>
      </div>`).join('')
    : '<p style="color:var(--text3);font-size:13px;">尚無資料</p>';

  const recent = [...db.bookings].sort((a,b) => (b.date+b.time) > (a.date+a.time) ? 1 : -1).slice(0,4);
  document.getElementById('recent-bookings').innerHTML = recent.length
    ? recent.map(b => miniBookingCard(b)).join('')
    : '<p style="color:var(--text3);font-size:13px;">尚無預約紀錄</p>';

  renderTrendChart();
}

function miniBookingCard(b) {
  return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:0.5px solid var(--border);">
    <span class="room-badge${b.source==='gcal'?' gcal':''}" style="font-size:12px;padding:2px 8px">${b.room === '?' ? (b.community || 'T5') : b.room}</span>
    <span style="flex:1;font-size:13px;color:var(--text)">${b.service}</span>
    <span style="font-size:12px;color:${b.amount>0?'var(--green-800)':'var(--text3)'};font-weight:${b.amount>0?600:400}">${formatMoney(b.amount)}</span>
    <span style="font-size:11px;color:var(--text3);white-space:nowrap">${formatDate(b.date)}</span>
  </div>`;
}

// ── BOOKING LIST ──
function renderBookingList() {
  const kw = (document.getElementById('search-keyword').value||'').toLowerCase();
  const cat = document.getElementById('filter-category').value;
  const start = document.getElementById('filter-start').value;
  const end = document.getElementById('filter-end').value;

  let list = [...db.bookings].sort((a,b) => (b.date+b.time) > (a.date+a.time) ? 1 : -1);
  if (kw) list = list.filter(b =>
    b.room.toLowerCase().includes(kw) ||
    b.service.toLowerCase().includes(kw) ||
    (b.note||'').toLowerCase().includes(kw)
  );
  if (cat) list = list.filter(b => b.category === cat);
  if (start) list = list.filter(b => b.date >= start);
  if (end) list = list.filter(b => b.date <= end);

  document.getElementById('booking-count-label').textContent = `共 ${list.length} 筆紀錄`;
  document.getElementById('booking-list').innerHTML = list.length
    ? list.map(b => bookingCard(b)).join('')
    : '<div class="empty"><div class="empty-icon">📋</div><p>沒有符合條件的紀錄</p></div>';
}

function bookingCard(b) {
  const dt = new Date(b.date + 'T00:00:00');
  return `<div class="booking-item" id="bk-${b.id}">
    <div class="booking-date-col">
      <div class="booking-month">${dt.getMonth()+1}月</div>
      <div class="booking-day">${dt.getDate()}</div>
      <div class="booking-weekday">${WEEKDAYS[dt.getDay()]}</div>
    </div>
    <div class="booking-body">
      <div class="booking-header">
        <span class="room-badge${b.source==='gcal'?' gcal':''}">${b.room === '?' ? (b.community || 'T5') : b.room}</span>
        <span class="service-name">${b.service}</span>
        ${b.source === 'gcal' ? '<span class="source-tag">Google Calendar</span>' : ''}
      </div>
      <div class="booking-meta">
        <span>🕐 ${b.time}</span>
        <span>👥 ${b.persons} 人</span>
        <span class="${b.amount>0?'booking-amount':''}">💰 ${formatMoney(b.amount)}</span>
        <span class="category-tag">${b.category}</span>
        ${b.staff ? `<span>👤 ${b.staff}</span>` : ''}
      </div>
      ${b.note ? `<div style="margin-top:6px;font-size:12px;color:var(--text3)">📝 ${b.note}</div>` : ''}
    </div>
    <button class="btn btn-danger btn-sm" onclick="deleteBooking('${b.id}')" style="flex-shrink:0;padding:4px 8px;font-size:12px">✕</button>
  </div>`;
}

function clearFilters() {
  document.getElementById('search-keyword').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-start').value = '';
  document.getElementById('filter-end').value = '';
  renderBookingList();
}

function deleteBooking(id) {
  if (!confirm('確定要刪除這筆紀錄？')) return;
  db.bookings = db.bookings.filter(b => b.id !== id);
  saveDB();
  renderBookingList();
  deleteBookingFromSupabase(id);
  showToast('已刪除');
}

// ── RESIDENT ──
function searchResident() {
  const q = document.getElementById('resident-search').value.trim().toUpperCase();
  if (!q) { renderAllResidents(); return; }
  const bookings = db.bookings
    .filter(b => b.room.includes(q))
    .sort((a,b) => (b.date+b.time) > (a.date+a.time) ? 1 : -1);
  renderResidentProfile(q, bookings);
}

function renderResidentProfile(room, bookings) {
  const el = document.getElementById('resident-result');
  document.getElementById('all-residents').innerHTML = '';
  if (!bookings.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🏠</div><p>找不到 ${room} 的紀錄</p></div>`;
    return;
  }
  const totalAmt = bookings.reduce((s,b) => s+(b.amount||0), 0);
  const avgAmt = Math.round(totalAmt / bookings.length);
  const freeCount = bookings.filter(b => b.amount === 0).length;
  const svcCount = {};
  bookings.forEach(b => svcCount[b.service] = (svcCount[b.service]||0)+1);
  const favSvc = Object.entries(svcCount).sort((a,b) => b[1]-a[1])[0];

  el.innerHTML = `<div class="card">
    <div class="resident-header">
      <div class="resident-avatar">${room}</div>
      <div>
        <div style="font-size:18px;font-weight:600;color:var(--text)">${room}</div>
        <div style="font-size:13px;color:var(--text3)">首次: ${formatDate(bookings[bookings.length-1].date)} ｜ 最近: ${formatDate(bookings[0].date)}</div>
      </div>
    </div>
    <div class="resident-stats">
      <div class="r-stat"><div class="r-stat-val">${bookings.length}</div><div class="r-stat-lab">總次數</div></div>
      <div class="r-stat"><div class="r-stat-val">$${totalAmt.toLocaleString()}</div><div class="r-stat-lab">累計消費</div></div>
      <div class="r-stat"><div class="r-stat-val">$${avgAmt.toLocaleString()}</div><div class="r-stat-lab">平均每次</div></div>
    </div>
    ${favSvc ? `<div style="font-size:13px;color:var(--text2);margin-bottom:12px;">
      ⭐ 最愛：<strong>${favSvc[0]}</strong>（${favSvc[1]} 次）
      ${freeCount > 0 ? `　☕ 免費次數：${freeCount} 次` : ''}
    </div>` : ''}
    <div class="section-title">歷史記錄</div>
    ${bookings.map(b => miniBookingCard(b)).join('')}
  </div>`;
}

function renderAllResidents() {
  const el = document.getElementById('all-residents');
  document.getElementById('resident-result').innerHTML = '';
  const roomMap = {};
  db.bookings.forEach(b => {
    if (!roomMap[b.room]) roomMap[b.room] = { count: 0, amount: 0, lastDate: '' };
    roomMap[b.room].count++;
    roomMap[b.room].amount += b.amount||0;
    if (b.date > roomMap[b.room].lastDate) roomMap[b.room].lastDate = b.date;
  });
  const rooms = Object.entries(roomMap).sort((a,b) => b[1].count - a[1].count);
  if (!rooms.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🏠</div><p>尚無住戶資料</p></div>';
    return;
  }
  el.innerHTML = `<div class="section-title">所有住戶（${rooms.length} 戶）</div>` +
    rooms.map(([room, d]) => `
      <div class="booking-item" onclick="selectResident('${room}')" style="cursor:pointer">
        <div class="resident-avatar" style="width:40px;height:40px;font-size:14px;border-radius:10px;flex-shrink:0">${room}</div>
        <div class="booking-body">
          <div style="font-size:14px;font-weight:500;color:var(--text)">${room}</div>
          <div class="booking-meta">
            <span>📅 ${d.count} 次</span>
            <span>💰 $${d.amount.toLocaleString()}</span>
            <span>最近：${formatDate(d.lastDate)}</span>
          </div>
        </div>
        <span style="color:var(--text3);font-size:18px;align-self:center">›</span>
      </div>`).join('');
}

function selectResident(room) {
  document.getElementById('resident-search').value = room;
  searchResident();
}

// ── ADD BOOKING ──
function addBooking() {
  const date = document.getElementById('f-date').value;
  const room = document.getElementById('f-room').value.trim().toUpperCase();
  const service = document.getElementById('f-service').value.trim();
  if (!date || !room || !service) { showToast('請填寫日期、房號和服務項目'); return; }
  const { floor, unit } = parseRoom(room);
  db.bookings.push({
    id: genId(),
    date,
    time: document.getElementById('f-time').value,
    community: document.getElementById('f-community').value || 'T5',
    room, floor, unit,
    persons: parseInt(document.getElementById('f-persons').value)||1,
    service,
    category: document.getElementById('f-category').value,
    amount: parseInt(document.getElementById('f-amount').value)||0,
    note: document.getElementById('f-note').value.trim(),
    staff: document.getElementById('f-staff').value.trim(),
    source: 'manual',
  });
  saveDB();
  showToast(`✓ 已新增 ${room} 的 ${service}`);
  resetForm();
}

function resetForm() {
  // f-date removed (add booking tab removed)
  document.getElementById('f-time').value = '10:00';
  document.getElementById('f-room').value = '';
  document.getElementById('f-persons').value = '2';
  document.getElementById('f-service').value = '';
  document.getElementById('f-amount').value = '0';
  document.getElementById('f-note').value = '';
}

// ── EXPORT / IMPORT ──
function exportJSON() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'data.json';
  a.click();
  showToast('已匯出 data.json');
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.bookings && Array.isArray(data.bookings)) {
        db = data; saveDB(); renderAll();
        showToast(`已匯入 ${data.bookings.length} 筆資料`);
      } else { showToast('格式不正確'); }
    } catch { showToast('解析失敗，請確認檔案格式'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── TREND CHART ──
let trendMode = 'day';

function setTrendMode(mode) {
  trendMode = mode;
  ['day','week','month'].forEach(m => {
    const btn = document.getElementById('trend-btn-' + m);
    if (!btn) return;
    btn.style.background = m === mode ? 'var(--accent)' : '';
    btn.style.color = m === mode ? 'white' : '';
    btn.style.borderColor = m === mode ? 'var(--accent)' : '';
  });
  renderTrendChart();
}

function renderTrendChart() {
  const el = document.getElementById('trend-chart');
  if (!el) return;

  const now = new Date();
  let labels = [], personsData = [], countData = [];

  if (trendMode === 'day') {
    // Last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const day = (d.getMonth()+1) + '/' + d.getDate();
      const bks = db.bookings.filter(b => b.date === key);
      labels.push(day);
      personsData.push(bks.reduce((s,b) => s+(b.persons||0), 0));
      countData.push(bks.length);
    }
  } else if (trendMode === 'week') {
    // Last 12 weeks
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startKey = start.getFullYear() + '-' + String(start.getMonth()+1).padStart(2,'0') + '-' + String(start.getDate()).padStart(2,'0');
      const endKey = end.getFullYear() + '-' + String(end.getMonth()+1).padStart(2,'0') + '-' + String(end.getDate()).padStart(2,'0');
      const bks = db.bookings.filter(b => b.date >= startKey && b.date <= endKey);
      labels.push((start.getMonth()+1) + '/' + start.getDate());
      personsData.push(bks.reduce((s,b) => s+(b.persons||0), 0));
      countData.push(bks.length);
    }
  } else {
    // Last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      const bks = db.bookings.filter(b => b.date.startsWith(ym));
      labels.push((d.getMonth()+1) + '月');
      personsData.push(bks.reduce((s,b) => s+(b.persons||0), 0));
      countData.push(bks.length);
    }
  }

  const maxP = Math.max(...personsData, 1);
  const maxC = Math.max(...countData, 1);
  const chartH = 100;
  const n = labels.length;

  // SVG line chart
  const w = 600, h = chartH + 30;
  const padL = 32, padR = 8, padT = 10, padB = 24;
  const chartW = w - padL - padR;
  const chartHH = h - padT - padB;

  const xPos = i => padL + (i / (n - 1)) * chartW;
  const yPosP = v => padT + chartHH - (v / maxP) * chartHH;
  const yPosC = v => padT + chartHH - (v / maxC) * chartHH;

  const personPath = personsData.map((v, i) => (i === 0 ? 'M' : 'L') + xPos(i).toFixed(1) + ',' + yPosP(v).toFixed(1)).join(' ');
  const countPath = countData.map((v, i) => (i === 0 ? 'M' : 'L') + xPos(i).toFixed(1) + ',' + yPosC(v).toFixed(1)).join(' ');

  // Show every Nth label to avoid crowding
  const labelStep = n <= 12 ? 1 : n <= 20 ? 2 : 5;

  const labelEls = labels.map((lbl, i) => {
    if (i % labelStep !== 0 && i !== n - 1) return '';
    return `<text x="${xPos(i).toFixed(1)}" y="${h - 4}" text-anchor="middle" font-size="9" fill="var(--text3)">${lbl}</text>`;
  }).join('');

  const dotEls = personsData.map((v, i) => v > 0
    ? `<circle cx="${xPos(i).toFixed(1)}" cy="${yPosP(v).toFixed(1)}" r="2.5" fill="var(--accent)" opacity="0.8"/>`
    : '').join('');

  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;overflow:visible">
    <!-- Grid lines -->
    ${[0.25, 0.5, 0.75, 1].map(t => {
      const y = (padT + chartHH - t * chartHH).toFixed(1);
      const val = Math.round(maxP * t);
      return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>
               <text x="${padL - 4}" y="${y}" text-anchor="end" font-size="9" fill="var(--text3)" dominant-baseline="middle">${val}</text>`;
    }).join('')}
    <!-- Count line (blue, dashed) -->
    <path d="${countPath}" fill="none" stroke="#4285f4" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.7"/>
    <!-- Persons line (green) -->
    <path d="${personPath}" fill="none" stroke="var(--accent)" stroke-width="2" opacity="0.9"/>
    ${dotEls}
    ${labelEls}
  </svg>`;
}

// ── INIT ──
function renderAll() {
  renderOverview();
  renderToday();
  renderMonthly();
  renderBookingList();
  renderAllResidents();
}

// ── MONTHLY REPORT ──
function initReportSelectors() {
  const yearSel = document.getElementById('report-year');
  const monthSel = document.getElementById('report-month');
  if (!yearSel || yearSel.options.length > 0) return;
  const now = new Date();
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y + '年';
    yearSel.appendChild(opt);
  }
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m + '月';
    monthSel.appendChild(opt);
  }
  yearSel.value = now.getFullYear();
  monthSel.value = now.getMonth() + 1;
}

function renderReport() {
  initReportSelectors();
  const year = parseInt(document.getElementById('report-year').value);
  const month = parseInt(document.getElementById('report-month').value);
  const ym = year + '-' + String(month).padStart(2, '0');

  document.getElementById('report-heading').textContent = year + '年' + month + '月 工作月報';

  const bookings = db.bookings.filter(b => b.date.startsWith(ym));

  // Totals by category
  const reception = bookings.filter(b => b.category === '住戶接待');
  const venue = bookings.filter(b => b.category === '包場');
  const activity = bookings.filter(b => b.category === '分享活動' || b.category === '節氣活動' || b.category === '森活聚落');
  const meal = bookings.filter(b => b.category === '餐飲消費');

  const sumPersons = arr => arr.reduce((s, b) => s + (b.persons || 0), 0);
  const totalPersons = sumPersons(bookings);

  // Stats cards
  document.getElementById('report-stats').innerHTML = [
    { label: '接待人次', value: sumPersons(reception), color: 'accent' },
    { label: '包場人次', value: sumPersons(venue), color: '' },
    { label: '活動人次', value: sumPersons(activity), color: '' },
    { label: '餐飲消費人次', value: sumPersons(meal), color: '' },
  ].map(s => `
    <div class="stat-card ${s.color}">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-sub">人次</div>
    </div>`).join('');

  // Daily table
  const byDate = {};
  bookings.forEach(b => {
    if (!byDate[b.date]) byDate[b.date] = { reception: [], venue: [], activity: [], meal: [], notes: [] };
    const d = byDate[b.date];
    if (b.category === '住戶接待') d.reception.push(b.room + '-' + b.persons + 'P');
    else if (b.category === '包場') d.venue.push(b.room + '-' + b.persons + 'P');
    else if (b.category === '分享活動' || b.category === '節氣活動') d.activity.push(b.service + (b.persons ? '-' + b.persons + 'P' : ''));
    else if (b.category === '餐飲消費') d.meal.push(b.room + '-' + b.persons + 'P');
    if (b.note) d.notes.push(b.note);
  });

  const thStyle = 'background:#3a6b1a;color:white;padding:8px 10px;font-size:12px;font-weight:500;text-align:left;';
  const tdStyle = 'padding:7px 10px;font-size:12px;border-bottom:0.5px solid var(--border);vertical-align:top;color:var(--text);';
  const tdGrayStyle = tdStyle + 'color:var(--text3);';

  let tableHtml = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="${thStyle}width:90px">工作日期</th>
      <th style="${thStyle}">接待</th>
      <th style="${thStyle}">包場</th>
      <th style="${thStyle}">活動</th>
      <th style="${thStyle}">餐飲消費</th>
      <th style="${thStyle}">備註</th>
    </tr></thead><tbody>`;

  const dates = Object.keys(byDate).sort();
  dates.forEach(date => {
    const d = byDate[date];
    const dt = new Date(date + 'T00:00:00');
    const label = (dt.getMonth()+1) + '/' + dt.getDate() + '(' + ['日','一','二','三','四','五','六'][dt.getDay()] + ')';
    tableHtml += `<tr>
      <td style="${tdStyle}font-weight:500">${label}</td>
      <td style="${tdStyle}">${d.reception.join('<br>') || '<span style="color:var(--border-strong)">—</span>'}</td>
      <td style="${tdStyle}">${d.venue.join('<br>') || '<span style="color:var(--border-strong)">—</span>'}</td>
      <td style="${tdStyle}">${d.activity.join('<br>') || '<span style="color:var(--border-strong)">—</span>'}</td>
      <td style="${tdStyle}">${d.meal.join('<br>') || '<span style="color:var(--border-strong)">—</span>'}</td>
      <td style="${tdGrayStyle}">${d.notes.join(' ') || ''}</td>
    </tr>`;
  });

  tableHtml += `<tr style="background:var(--accent-light)">
    <td style="${tdStyle}font-weight:600">本月總計</td>
    <td style="${tdStyle}font-weight:600">${sumPersons(reception)}P</td>
    <td style="${tdStyle}font-weight:600">${sumPersons(venue)}P</td>
    <td style="${tdStyle}font-weight:600">${sumPersons(activity)}P</td>
    <td style="${tdStyle}font-weight:600">${sumPersons(meal)}P</td>
    <td style="${tdStyle}"></td>
  </tr></tbody></table></div>`;

  document.getElementById('report-daily-table').innerHTML = tableHtml;

  // Activity section
  const actBookings = activity;
  document.getElementById('report-activity-summary').textContent =
    month + ' 月份舉辦了 ' + actBookings.length + ' 場節氣與分享活動，總計 ' + sumPersons(actBookings) + ' 人次參與。';

  let actHtml = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="${thStyle}">活動</th>
      <th style="${thStyle}width:80px">日期</th>
      <th style="${thStyle}width:120px">參與房號</th>
      <th style="${thStyle}width:60px">人數</th>
      <th style="${thStyle}">備註</th>
    </tr></thead><tbody>`;

  actBookings.sort((a,b) => a.date > b.date ? 1 : -1).forEach(b => {
    const dt = new Date(b.date + 'T00:00:00');
    const label = (dt.getMonth()+1) + '/' + dt.getDate() + '(' + ['日','一','二','三','四','五','六'][dt.getDay()] + ')';
    actHtml += `<tr>
      <td style="${tdStyle}">${b.service}</td>
      <td style="${tdStyle}">${label}</td>
      <td style="${tdStyle};font-size:11px">${b.note || b.room}</td>
      <td style="${tdStyle}font-weight:500">${b.persons}P</td>
      <td style="${tdGrayStyle}"></td>
    </tr>`;
  });

  actHtml += `<tr style="background:var(--accent-light)">
    <td style="${tdStyle}font-weight:600" colspan="3">本月總計</td>
    <td style="${tdStyle}font-weight:600">${sumPersons(actBookings)}P</td>
    <td style="${tdStyle}"></td>
  </tr></tbody></table></div>`;

  document.getElementById('report-activity-table').innerHTML = actBookings.length ? actHtml :
    '<p style="color:var(--text3);font-size:13px;">本月無活動紀錄</p>';

  // Meal section
  const mealBookings = meal;
  const totalMealAmount = mealBookings.reduce((s,b) => s + (b.amount||0), 0);
  document.getElementById('report-meal-summary').textContent =
    month + ' 月份餐飲消費共 ' + mealBookings.length + ' 筆，總金額 $' + totalMealAmount.toLocaleString() + ' 元。';

  let mealHtml = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="${thStyle}width:80px">日期</th>
      <th style="${thStyle}width:60px">房號</th>
      <th style="${thStyle}width:60px">人數</th>
      <th style="${thStyle}">餐點明細</th>
      <th style="${thStyle}width:80px">金額</th>
    </tr></thead><tbody>`;

  mealBookings.sort((a,b) => a.date > b.date ? 1 : -1).forEach(b => {
    const dt = new Date(b.date + 'T00:00:00');
    const label = (dt.getMonth()+1) + '/' + dt.getDate() + '(' + ['日','一','二','三','四','五','六'][dt.getDay()] + ')';
    mealHtml += `<tr>
      <td style="${tdStyle}">${label}</td>
      <td style="${tdStyle}font-weight:500">${b.room}</td>
      <td style="${tdStyle}">${b.persons}P</td>
      <td style="${tdStyle};font-size:12px">${b.note || b.service}</td>
      <td style="${tdStyle}">${b.amount > 0 ? '$' + b.amount.toLocaleString() : '免費'}</td>
    </tr>`;
  });

  mealHtml += `<tr style="background:var(--accent-light)">
    <td style="${tdStyle}font-weight:600" colspan="3">本月總計</td>
    <td style="${tdStyle}"></td>
    <td style="${tdStyle}font-weight:600">$${totalMealAmount.toLocaleString()}</td>
  </tr></tbody></table></div>`;

  document.getElementById('report-meal-table').innerHTML = mealBookings.length ? mealHtml :
    '<p style="color:var(--text3);font-size:13px;">本月無餐飲消費紀錄</p>';

  // Render photo grid
  const photoKey = year + '-' + String(month).padStart(2, '0');
  renderPhotoGrid(photoKey);

  // Pre-fill summary textarea if empty
  const summaryTA = document.getElementById('report-summary-text');
  if (summaryTA && !summaryTA.value) {
    summaryTA.value = year + ' 年 ' + month + ' 月份，總服務人次為 ' + sumP(bookings) + '，其中接待 ' + sumP(reception) + ' 人次、包場 ' + sumP(venue) + ' 人次、活動 ' + sumP(activity) + ' 人次、餐飲消費 ' + sumP(meal) + ' 人次。';
  }

  // Refresh analytics if tab is active
  const analyticsTab = document.getElementById('tab-analytics');
  if (analyticsTab && analyticsTab.classList.contains('active')) renderAnalytics();
}

async function exportReport() {
  const year = parseInt(document.getElementById('report-year').value);
  const month = parseInt(document.getElementById('report-month').value);
  const ym = year + '-' + String(month).padStart(2, '0');
  const notes = document.getElementById('report-notes').value;

  const bookings = db.bookings.filter(b => b.date.startsWith(ym));
  const reception = bookings.filter(b => b.category === '住戶接待');
  const venue = bookings.filter(b => b.category === '包場');
  const activity = bookings.filter(b => b.category === '分享活動' || b.category === '節氣活動' || b.category === '森活聚落');
  const meal = bookings.filter(b => b.category === '餐飲消費');
  const sumP = arr => arr.reduce((s,b) => s+(b.persons||0), 0);

  // Use docx via CDN loaded dynamically
  showToast('產生中...');

  try {
    // Build report data as structured HTML then trigger print-to-PDF friendly download
    // Since we can't use Node docx in browser, generate a well-formatted HTML and let user print/save
    const photoKey = year + '-' + String(month).padStart(2, '0');
  const photos = reportPhotos[photoKey] || [];
  const summaryText = document.getElementById('report-summary-text')?.value || '';
  const mealText = document.getElementById('report-meal-text')?.value || '';
  const html = buildReportHTML(year, month, bookings, reception, venue, activity, meal, sumP, notes, photos, summaryText, mealText);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = year + '年' + month + '月_陸府森山工作月報.html';
    a.click();
    showToast('✓ 已下載月報（用瀏覽器開啟後可列印/存 PDF）');
  } catch(e) {
    showToast('匯出失敗：' + e.message);
  }
}

// ── Report edit mode & photos ──
let reportEditMode = false;
let reportPhotos = JSON.parse(localStorage.getItem('T5_report_photos') || '{}');

function toggleReportEdit() {
  reportEditMode = !reportEditMode;
  const btn = document.getElementById('btn-report-edit');
  btn.textContent = reportEditMode ? '✅ 完成編輯' : '✏️ 編輯模式';
  btn.className = reportEditMode ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';

  const summaryEdit = document.getElementById('report-summary-edit');
  const mealEdit = document.getElementById('report-meal-edit');
  if (summaryEdit) summaryEdit.style.display = reportEditMode ? 'block' : 'none';
  if (mealEdit) mealEdit.style.display = reportEditMode ? 'block' : 'none';

  // Enable/disable contenteditable on table cells
  document.querySelectorAll('#tab-report td[data-editable]').forEach(td => {
    td.contentEditable = reportEditMode ? 'true' : 'false';
    td.style.outline = reportEditMode ? '1.5px dashed var(--accent)' : '';
    td.style.cursor = reportEditMode ? 'text' : '';
  });

  if (!reportEditMode) showToast('已儲存編輯內容');
}

function handlePhotoUpload(event) {
  const files = Array.from(event.target.files);
  const year = document.getElementById('report-year').value;
  const month = document.getElementById('report-month').value;
  const key = year + '-' + month;

  if (!reportPhotos[key]) reportPhotos[key] = [];

  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      reportPhotos[key].push({ src: e.target.result, name: file.name, caption: '' });
      loaded++;
      if (loaded === files.length) {
        try { localStorage.setItem('T5_report_photos', JSON.stringify(reportPhotos)); } catch(e) {}
        renderPhotoGrid(key);
        showToast('已上傳 ' + files.length + ' 張圖片');
      }
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function renderPhotoGrid(key) {
  const grid = document.getElementById('photo-grid');
  if (!grid) return;
  const photos = reportPhotos[key] || [];

  if (!photos.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text3);font-size:13px;border:1.5px dashed var(--border-strong);border-radius:10px;">點擊「上傳圖片」加入活動花絮照片</div>';
    return;
  }

  grid.innerHTML = photos.map((p, i) => `
    <div style="position:relative;border-radius:10px;overflow:hidden;border:0.5px solid var(--border);">
      <img src="${p.src}" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;">
      <div style="padding:6px 8px;background:var(--surface);">
        <input type="text" value="${p.caption || ''}" placeholder="圖片說明..."
          style="width:100%;font-size:11px;border:none;background:transparent;color:var(--text2);padding:0;"
          onchange="updatePhotoCaption('${key}', ${i}, this.value)">
      </div>
      <button onclick="removePhoto('${key}', ${i})"
        style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.5);color:white;border:none;border-radius:50%;width:22px;height:22px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>
    </div>`).join('');
}

function updatePhotoCaption(key, idx, caption) {
  if (reportPhotos[key] && reportPhotos[key][idx]) {
    reportPhotos[key][idx].caption = caption;
    try { localStorage.setItem('T5_report_photos', JSON.stringify(reportPhotos)); } catch(e) {}
  }
}

function removePhoto(key, idx) {
  if (!reportPhotos[key]) return;
  reportPhotos[key].splice(idx, 1);
  try { localStorage.setItem('T5_report_photos', JSON.stringify(reportPhotos)); } catch(e) {}
  renderPhotoGrid(key);
}


function buildReportHTML(year, month, bookings, reception, venue, activity, meal, sumP, notes, photos, summaryText, mealText) {
  photos = photos || [];
  const byDate = {};
  bookings.forEach(b => {
    if (!byDate[b.date]) byDate[b.date] = { reception: [], venue: [], activity: [], meal: [], notes: [] };
    const d = byDate[b.date];
    if (b.category === '住戶接待') d.reception.push(b.room + '-' + b.persons + 'P');
    else if (b.category === '包場') d.venue.push(b.room + '-' + b.persons + 'P');
    else if (b.category === '分享活動' || b.category === '節氣活動') d.activity.push(b.service + (b.persons ? '-' + b.persons + 'P' : ''));
    else if (b.category === '餐飲消費') d.meal.push(b.room + '-' + b.persons + 'P');
    if (b.note) d.notes.push(b.note);
  });

  const WEEKDAYS = ['日','一','二','三','四','五','六'];
  const fmtDate = date => {
    const dt = new Date(date + 'T00:00:00');
    return (dt.getMonth()+1) + '/' + dt.getDate() + '(' + WEEKDAYS[dt.getDay()] + ')';
  };

  const totalMealAmount = meal.reduce((s,b) => s+(b.amount||0), 0);

  const thStyle = 'background:#3a6b1a;color:white;padding:8px 10px;font-size:12px;font-weight:600;text-align:left;border:1px solid #2d5514;';
  const tdStyle = 'padding:7px 10px;font-size:12px;border:1px solid #ddd;vertical-align:top;';
  const totalRowStyle = 'background:#e8f4d8;font-weight:600;';

  // Daily table rows
  const dates = Object.keys(byDate).sort();
  const dailyRows = dates.map(date => {
    const d = byDate[date];
    return `<tr>
      <td style="${tdStyle}font-weight:600">${fmtDate(date)}</td>
      <td style="${tdStyle}">${d.reception.join('<br>') || '—'}</td>
      <td style="${tdStyle}">${d.venue.join('<br>') || '—'}</td>
      <td style="${tdStyle}">${d.activity.join('<br>') || '—'}</td>
      <td style="${tdStyle}">${d.meal.join('<br>') || '—'}</td>
      <td style="${tdStyle}color:#666">${d.notes.join(' ') || ''}</td>
    </tr>`;
  }).join('');

  // Activity rows
  const actRows = activity.sort((a,b) => a.date > b.date ? 1 : -1).map(b => `<tr>
    <td style="${tdStyle}">${b.service}</td>
    <td style="${tdStyle}">${fmtDate(b.date)}</td>
    <td style="${tdStyle}font-size:11px">${b.note || b.room}</td>
    <td style="${tdStyle}font-weight:600">${b.persons}P</td>
    <td style="${tdStyle}"></td>
  </tr>`).join('');

  // Meal rows
  const mealRows = meal.sort((a,b) => a.date > b.date ? 1 : -1).map(b => `<tr>
    <td style="${tdStyle}">${fmtDate(b.date)}</td>
    <td style="${tdStyle}font-weight:600">${b.room}</td>
    <td style="${tdStyle}">${b.persons}P</td>
    <td style="${tdStyle}font-size:11px">${b.note || b.service}</td>
    <td style="${tdStyle}">${b.amount > 0 ? '$' + b.amount.toLocaleString() : '免費'}</td>
  </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>陸府森山 工作月報 ${year}年${month}月</title>
<style>
  @page { size: A4; margin: 2cm 2.5cm; }
  * { box-sizing: border-box; }
  body { font-family: 'Microsoft JhengHei', 'PingFang TC', Arial, sans-serif; font-size: 13px; color: #222; line-height: 1.6; background: white; max-width: 900px; margin: 0 auto; padding: 40px 20px; }
  .report-header { text-align: center; margin-bottom: 32px; border-bottom: 3px solid #3a6b1a; padding-bottom: 16px; }
  .report-header h1 { font-size: 20px; font-weight: 700; color: #1f4e0a; margin: 0 0 4px; }
  .report-header p { font-size: 12px; color: #666; margin: 0; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 15px; font-weight: 700; color: #1f4e0a; border-left: 4px solid #7ab648; padding-left: 10px; margin-bottom: 10px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .summary-card { background: #f0f9e8; border: 1px solid #c0de90; border-radius: 8px; padding: 12px; text-align: center; }
  .summary-card .num { font-size: 24px; font-weight: 700; color: #1f4e0a; }
  .summary-card .lbl { font-size: 11px; color: #5a8030; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .sub-note { font-size: 12px; color: #666; margin-bottom: 10px; }
  .notes-box { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 12px; min-height: 60px; font-size: 12px; color: #444; white-space: pre-wrap; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>

<div class="report-header">
  <h1>陸府森山 | 工作月報 | ${year}年${month}月</h1>
  <p>服務頻率：每週四日（週四至週日）・每日服務時間 09:00~18:00</p>
</div>

<div class="section">
  <div class="section-title">一、工作摘要</div>
  <div class="summary-grid">
    <div class="summary-card"><div class="num">${sumP(reception)}</div><div class="lbl">接待人次</div></div>
    <div class="summary-card"><div class="num">${sumP(venue)}</div><div class="lbl">包場人次</div></div>
    <div class="summary-card"><div class="num">${sumP(activity)}</div><div class="lbl">活動人次</div></div>
    <div class="summary-card"><div class="num">${sumP(meal)}</div><div class="lbl">餐飲消費人次</div></div>
  </div>
  <p class="sub-note">${year} 年 ${month} 月份，總服務人次為 <strong>${sumP(bookings)}</strong>，其中接待 ${sumP(reception)} 人次、包場 ${sumP(venue)} 人次、活動 ${sumP(activity)} 人次、餐飲消費 ${sumP(meal)} 人次。</p>
  <table>
    <thead><tr>
      <th style="${thStyle}width:90px">工作日期</th>
      <th style="${thStyle}">接待</th>
      <th style="${thStyle}">包場</th>
      <th style="${thStyle}">活動</th>
      <th style="${thStyle}">餐飲消費</th>
      <th style="${thStyle}">備註</th>
    </tr></thead>
    <tbody>
      ${dailyRows}
      <tr style="${totalRowStyle}">
        <td style="${tdStyle}">本月總計</td>
        <td style="${tdStyle}">${sumP(reception)}P</td>
        <td style="${tdStyle}">${sumP(venue)}P</td>
        <td style="${tdStyle}">${sumP(activity)}P</td>
        <td style="${tdStyle}">${sumP(meal)}P</td>
        <td style="${tdStyle}"></td>
      </tr>
    </tbody>
  </table>
</div>

<div class="section">
  <div class="section-title">二、活動執行</div>
  <p class="sub-note">${year} 年 ${month} 月份舉辦了 ${activity.length} 場節氣與分享活動，總計 ${sumP(activity)} 人次參與。</p>
  ${activity.length ? `<table>
    <thead><tr>
      <th style="${thStyle}">活動名稱</th>
      <th style="${thStyle}width:80px">日期</th>
      <th style="${thStyle}">參與房號</th>
      <th style="${thStyle}width:60px">人數</th>
      <th style="${thStyle}">備註</th>
    </tr></thead>
    <tbody>
      ${actRows}
      <tr style="${totalRowStyle}">
        <td style="${tdStyle}" colspan="3">本月總計</td>
        <td style="${tdStyle}">${sumP(activity)}P</td>
        <td style="${tdStyle}"></td>
      </tr>
    </tbody>
  </table>` : '<p style="color:#999;font-size:12px">本月無活動紀錄</p>'}

${photos.length ? `<div style="margin-top:20px;">
  <div style="font-size:13px;font-weight:600;color:#1f4e0a;margin-bottom:10px;">活動花絮</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
    ${photos.map(p => `<div style="border-radius:8px;overflow:hidden;border:1px solid #ddd;">
      <img src="${p.src}" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;">
      ${p.caption ? `<div style="padding:5px 8px;font-size:11px;color:#666;background:#fafafa;">${p.caption}</div>` : ''}
    </div>`).join('')}
  </div>
</div>` : ''}
</div>

<div class="section">
  <div class="section-title">三、廚房餐飲</div>
  <p class="sub-note">${year} 年 ${month} 月份餐飲消費共 ${meal.length} 筆，總金額 <strong>$${totalMealAmount.toLocaleString()}</strong> 元。</p>
  ${meal.length ? `<table>
    <thead><tr>
      <th style="${thStyle}width:80px">日期</th>
      <th style="${thStyle}width:60px">房號</th>
      <th style="${thStyle}width:60px">人數</th>
      <th style="${thStyle}">餐點明細</th>
      <th style="${thStyle}width:80px">金額</th>
    </tr></thead>
    <tbody>
      ${mealRows}
      <tr style="${totalRowStyle}">
        <td style="${tdStyle}" colspan="3">本月總計</td>
        <td style="${tdStyle}"></td>
        <td style="${tdStyle}">$${totalMealAmount.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>` : '<p style="color:#999;font-size:12px">本月無餐飲消費紀錄</p>'}
</div>

${notes ? `<div class="section">
  <div class="section-title">備註 / 其他說明</div>
  <div class="notes-box">${notes}</div>
</div>` : ''}

<div style="text-align:right;font-size:11px;color:#999;margin-top:32px;border-top:1px solid #eee;padding-top:12px;">
  陸府森山生機廚房接待 ・ 製作日期：${new Date().toLocaleDateString('zh-TW')}
</div>

<div class="no-print" style="margin-top:24px;padding:16px;background:#f0f9e8;border-radius:8px;text-align:center;">
  <p style="font-size:13px;color:#3a6b1a;margin-bottom:10px;">💡 用瀏覽器開啟後，按 <strong>Ctrl+P</strong>（Mac: Cmd+P）→ 另存為 PDF</p>
</div>

</body>
</html>`;
}

// f-date removed (add booking tab removed)

// Init analytics date range to current month
(function() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';
  const startEl = document.getElementById('analytics-start');
  const endEl = document.getElementById('analytics-end');
  if (startEl) startEl.value = monthStart;
  if (endEl) endEl.value = today;
})();

initDB();
// initGoogleAuth handles: check token → show login or load Supabase
setTimeout(() => { initGoogleAuth(); }, 300);

// ── ANALYTICS ──
function setAnalyticsRange(range) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  let start, end = today;
  if (range === 'today') { start = today; }
  else if (range === 'week') { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); start = d.toISOString().split('T')[0]; }
  else if (range === 'month') { start = today.substring(0, 7) + '-01'; }
  else if (range === '3month') { const d = new Date(now); d.setMonth(d.getMonth() - 2); start = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-01'; }
  document.getElementById('analytics-start').value = start;
  document.getElementById('analytics-end').value = end;
  renderAnalytics();
}

// Expand multi-room bookings (room='多戶', note='7B*1 7A*2...') into individual room records
function expandBookings(list) {
  const expanded = [];
  list.forEach(b => {
    if (b.room === '多戶' && b.note) {
      const roomLines = b.note.split(/\s+/).filter(l => /^\d+[A-Za-z]\*\d+$/i.test(l));
      if (roomLines.length > 0) {
        roomLines.forEach(line => {
          const m = line.match(/^(\d+[A-Za-z])\*(\d+)$/i);
          if (m) {
            expanded.push({ ...b, room: m[1].toUpperCase(), persons: parseInt(m[2]), _expanded: true });
          }
        });
        return;
      }
    }
    expanded.push(b);
  });
  return expanded;
}

function renderAnalytics() {
  const start = document.getElementById('analytics-start').value;
  const end = document.getElementById('analytics-end').value;
  if (!start || !end) return;

  const rawList = db.bookings.filter(b => b.date >= start && b.date <= end);
  const list = expandBookings(rawList); // expand 多戶 into individual rooms

  const totalPersons = list.reduce((s,b) => s+(b.persons||0), 0);
  const totalAmount = rawList.reduce((s,b) => s+(b.amount||0), 0);
  // Unique rooms excluding 多戶
  const uniqueRooms = new Set(list.filter(b => b.room !== '多戶').map(b => b.room)).size;

  // Days in range that are Thu–Sun (weekday 0=Sun, 4=Thu, 5=Fri, 6=Sat)
  let workDays = 0;
  let cur = new Date(start + 'T00:00:00');
  const endDt = new Date(end + 'T00:00:00');
  while (cur <= endDt) {
    const dow = cur.getDay();
    if (dow === 0 || dow === 4 || dow === 5 || dow === 6) workDays++;
    cur.setDate(cur.getDate() + 1);
  }
  const avgPersonsPerWorkDay = workDays > 0 ? (totalPersons / workDays).toFixed(1) : '—';

  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  document.getElementById('analytics-range-label').textContent = `共 ${days} 天・${rawList.length} 筆預約`;

  // Stats (5 cards)
  document.getElementById('analytics-stats').innerHTML = [
    { label: '預約筆數', value: rawList.length, sub: '筆', accent: true },
    { label: '服務人次', value: totalPersons, sub: '人次' },
    { label: '四至日均人數', value: avgPersonsPerWorkDay, sub: `人／日（${workDays}個工作日）` },
    { label: '消費總額', value: '$' + totalAmount.toLocaleString(), sub: '元' },
    { label: '服務住戶', value: uniqueRooms, sub: '戶（不含多戶）' },
  ].map(s => `<div class="stat-card ${s.accent ? 'accent' : ''}">
    <div class="stat-label">${s.label}</div>
    <div class="stat-value">${s.value}</div>
    <div class="stat-sub">${s.sub}</div>
  </div>`).join('');

  renderTimeChart(rawList);
  renderWeekdayChart(rawList);
  renderCategoryChart(rawList);
  renderDailyChart(rawList, start, end);
  renderTopResidents(list); // use expanded list
}

function barChart(data, maxVal, colorFn, labelFn, valueFn) {
  return data.map(item => {
    const pct = maxVal > 0 ? Math.max(Math.round((valueFn(item) / maxVal) * 100), valueFn(item) > 0 ? 1 : 0) : 0;
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <div style="flex-shrink:0;width:32px;font-size:12px;color:var(--text3);text-align:right">${labelFn(item)}</div>
      <div style="flex:1;background:var(--surface2);border-radius:4px;height:20px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${colorFn(item)};border-radius:4px;min-width:${pct>0?2:0}px"></div>
      </div>
      <div style="flex-shrink:0;width:60px;font-size:12px;color:var(--text2);text-align:right">${valueFn(item)} 筆</div>
    </div>`;
  }).join('');
}

function renderTimeChart(list) {
  const hours = Array.from({length: 24}, (_,i) => ({ hour: i, count: 0 }));
  list.forEach(b => {
    const h = parseInt((b.time || '00:00').split(':')[0]);
    if (h >= 0 && h < 24) hours[h].count++;
  });
  const active = hours.filter(h => h.hour >= 8 && h.hour <= 21);
  const max = Math.max(...active.map(h => h.count), 1);
  const peak = active.reduce((a,b) => b.count > a.count ? b : a, active[0]);
  document.getElementById('analytics-time-chart').innerHTML =
    active.map(h => {
      const pct = Math.round((h.count / max) * 100);
      const isPeak = h.count === peak.count && h.count > 0;
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="flex-shrink:0;width:36px;font-size:11px;color:var(--text3);text-align:right">${String(h.hour).padStart(2,'0')}:00</div>
        <div style="flex:1;background:var(--surface2);border-radius:3px;height:16px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${isPeak ? '#e8a020' : 'var(--accent)'};border-radius:3px;opacity:0.85;min-width:${h.count>0?2:0}px"></div>
        </div>
        <div style="flex-shrink:0;width:24px;font-size:11px;color:var(--text3);text-align:right">${h.count||''}</div>
      </div>`;
    }).join('') +
    (peak.count > 0 ? `<div style="margin-top:6px;font-size:11px;color:var(--text3)">橘色為尖峰時段：${String(peak.hour).padStart(2,'0')}:00（${peak.count} 筆）</div>` : '');
}

function renderWeekdayChart(list) {
  const days = ['日','一','二','三','四','五','六'].map((d,i) => ({ label: d, idx: i, count: 0, amount: 0 }));
  list.forEach(b => {
    const dt = new Date(b.date + 'T00:00:00');
    days[dt.getDay()].count++;
    days[dt.getDay()].amount += b.amount || 0;
  });
  const max = Math.max(...days.map(d => d.count), 1);
  const peak = days.reduce((a,b) => b.count > a.count ? b : a, days[0]);
  document.getElementById('analytics-weekday-chart').innerHTML =
    days.map(d => {
      const pct = Math.round((d.count / max) * 100);
      const isPeak = d.count === peak.count && d.count > 0;
      const isWorkDay = [0,4,5,6].includes(d.idx);
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="flex-shrink:0;width:16px;font-size:12px;color:${isWorkDay ? 'var(--text)' : 'var(--text3)'};text-align:right;font-weight:${isWorkDay?500:400}">${d.label}</div>
        <div style="flex:1;background:var(--surface2);border-radius:4px;height:20px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${isPeak ? '#e8a020' : isWorkDay ? 'var(--accent)' : 'var(--border-strong)'};border-radius:4px;opacity:0.85;min-width:${d.count>0?2:0}px"></div>
        </div>
        <div style="flex-shrink:0;width:40px;font-size:12px;color:var(--text2);text-align:right">${d.count} 筆</div>
        <div style="flex-shrink:0;width:60px;font-size:12px;color:var(--text3);text-align:right">${d.amount > 0 ? '$'+d.amount.toLocaleString() : ''}</div>
      </div>`;
    }).join('') +
    '<div style="margin-top:4px;font-size:11px;color:var(--text3)">粗體為工作日（週四至週日）</div>';
}

function renderCategoryChart(list) {
  const CAT_COLORS = { '住戶接待':'#7ab648','包場':'#4285f4','分享活動':'#34a853','節氣活動':'#fbbc04','餐飲消費':'#ea4335','森活聚落':'#9b59b6','其他':'#9e9e9e' };
  const cats = {};
  list.forEach(b => {
    const c = b.category || '其他';
    if (!cats[c]) cats[c] = { count: 0, persons: 0, amount: 0 };
    cats[c].count++;
    cats[c].persons += b.persons || 0;
    cats[c].amount += b.amount || 0;
  });
  const sorted = Object.entries(cats).sort((a,b) => b[1].count - a[1].count);
  const total = sorted.reduce((s,[,v]) => s + v.count, 0);
  if (!sorted.length) { document.getElementById('analytics-category-chart').innerHTML = '<p style="color:var(--text3);font-size:13px;">無資料</p>'; return; }
  document.getElementById('analytics-category-chart').innerHTML = sorted.map(([cat, d]) => {
    const pct = Math.round((d.count / total) * 100);
    const color = CAT_COLORS[cat] || '#9e9e9e';
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <div style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${color}"></div>
      <div style="flex-shrink:0;width:70px;font-size:13px;color:var(--text2)">${cat}</div>
      <div style="flex:1;background:var(--surface2);border-radius:4px;height:22px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;opacity:0.8;display:flex;align-items:center;padding-left:8px;min-width:${pct>0?2:0}px">
          ${pct > 8 ? `<span style="font-size:11px;color:white;font-weight:500">${pct}%</span>` : ''}
        </div>
      </div>
      <div style="flex-shrink:0;width:40px;font-size:12px;color:var(--text2);text-align:right">${d.count} 筆</div>
      <div style="flex-shrink:0;width:50px;font-size:12px;color:var(--text3);text-align:right">${d.persons}人</div>
      <div style="flex-shrink:0;width:70px;font-size:12px;color:${d.amount>0?'var(--green-800)':'var(--text3)'};text-align:right">${d.amount>0?'$'+d.amount.toLocaleString():''}</div>
    </div>`;
  }).join('');
}

function renderDailyChart(list, start, end) {
  const dayMap = {};
  let cur = new Date(start + 'T00:00:00');
  const endDt = new Date(end + 'T00:00:00');
  while (cur <= endDt) { dayMap[cur.toISOString().split('T')[0]] = 0; cur.setDate(cur.getDate() + 1); }
  list.forEach(b => { if (dayMap[b.date] !== undefined) dayMap[b.date]++; });
  const days = Object.entries(dayMap);
  if (days.length > 60) {
    document.getElementById('analytics-daily-chart').innerHTML = '<p style="color:var(--text3);font-size:12px;">區間超過 60 天，請縮小範圍查看每日詳情</p>';
    return;
  }
  const max = Math.max(...days.map(([,v]) => v), 1);
  const chartH = 80;
  const bars = days.map(([date, count]) => {
    const h = Math.round((count / max) * chartH);
    const dt = new Date(date + 'T00:00:00');
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    const label = (dt.getMonth()+1) + '/' + dt.getDate();
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
      ${count > 0 ? `<div style="font-size:9px;color:var(--text3);margin-bottom:2px">${count}</div>` : '<div style="height:13px"></div>'}
      <div style="width:100%;max-width:20px;height:${h}px;background:${isWeekend ? '#e8a020' : 'var(--accent)'};border-radius:3px 3px 0 0;opacity:0.8;min-height:${count>0?2:0}px"></div>
      <div style="font-size:9px;color:var(--text3);margin-top:3px;white-space:nowrap;transform:rotate(-45deg);transform-origin:top left;height:20px;overflow:hidden">${label}</div>
    </div>`;
  }).join('');
  document.getElementById('analytics-daily-chart').innerHTML =
    `<div style="display:flex;align-items:flex-end;gap:2px;height:${chartH+40}px;padding-bottom:24px;">${bars}</div>
     <div style="font-size:11px;color:var(--text3);margin-top:4px;">橘色為週末</div>`;
}

function renderTopResidents(list) {
  // list is already expanded (多戶 split into individual rooms)
  const roomMap = {};
  list.filter(b => b.room !== '多戶').forEach(b => {
    if (!roomMap[b.room]) roomMap[b.room] = { count: 0, persons: 0, amount: 0 };
    roomMap[b.room].count++;
    roomMap[b.room].persons += b.persons || 0;
    roomMap[b.room].amount += b.amount || 0;
  });
  const top = Object.entries(roomMap).sort((a,b) => b[1].count - a[1].count).slice(0, 10);
  const max = top.length ? top[0][1].count : 1;
  document.getElementById('analytics-top-residents').innerHTML = top.length
    ? `<div style="display:flex;font-size:11px;color:var(--text3);margin-bottom:6px;padding-left:70px;gap:10px;">
        <span style="flex:1"></span>
        <span style="width:40px;text-align:right">次數</span>
        <span style="width:50px;text-align:right">人次</span>
        <span style="width:50px;text-align:right">均人數</span>
        <span style="width:70px;text-align:right">消費</span>
      </div>` +
      top.map(([room, d], i) => {
        const pct = Math.round((d.count / max) * 100);
        const avgPersons = (d.persons / d.count).toFixed(1);
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <div style="flex-shrink:0;width:20px;font-size:11px;color:var(--text3);text-align:right">${i+1}</div>
          <span class="room-badge" style="font-size:12px;flex-shrink:0;min-width:36px;text-align:center">${room}</span>
          <div style="flex:1;background:var(--surface2);border-radius:4px;height:20px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:4px;opacity:0.8"></div>
          </div>
          <div style="flex-shrink:0;width:40px;font-size:12px;color:var(--text2);text-align:right">${d.count} 次</div>
          <div style="flex-shrink:0;width:50px;font-size:12px;color:var(--text3);text-align:right">${d.persons} 人</div>
          <div style="flex-shrink:0;width:50px;font-size:12px;color:var(--accent-dark);text-align:right;font-weight:500">均 ${avgPersons} 人</div>
          <div style="flex-shrink:0;width:70px;font-size:12px;color:${d.amount>0?'var(--green-800)':'var(--text3)'};text-align:right">${d.amount>0?'$'+d.amount.toLocaleString():''}</div>
        </div>`;
      }).join('')
    : '<p style="color:var(--text3);font-size:13px;">無資料</p>';
}