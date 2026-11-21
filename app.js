import { DEPARTMENTS, deptById, suggestDept, parseListText, parseReceipt, compareReceipt, nameScore, normalize, seedItems, RECEIPT_EXAMPLE } from './logic.js';
import { createLocalBackend, createFirebaseBackend, parseFirebaseConfig, readLocal, localKey } from './store.js';

// ---------------- helpers ----------------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const money = (n) => (n == null || isNaN(n)) ? '—' : '₪' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
const fmtDate = (t) => new Date(t).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (t) => new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
function randomCode(n = 12) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const a = new Uint32Array(n); crypto.getRandomValues(a);
  return Array.from(a, x => abc[x % abc.length]).join('');
}

// ---------------- prefs & state ----------------
const PREFS_KEY = 'ss:prefs';
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; } };
const savePrefs = () => localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
let prefs = loadPrefs();
const state = {
  view: 'list', tripId: null,
  items: {}, trips: {}, barcodes: {},
  sync: { state: 'local' }, backend: null, kind: 'local', ready: false,
  collapsed: {},
};
const fbConfig = () => prefs.fbConfig || window.FIREBASE_CONFIG || null;
const userName = () => prefs.name || 'אורח';

// ---------------- UI primitives ----------------
let toastTimer;
function toast(msg, actionLabel, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (actionLabel ? `<button>${esc(actionLabel)}</button>` : '');
  t.hidden = false;
  if (actionLabel) t.querySelector('button').onclick = () => { action(); t.hidden = true; };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, actionLabel ? 6000 : 2400);
}
function sheet(html, mount) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  const parent = $('#overlay');
  parent.appendChild(wrap);
  const close = () => { wrap.remove(); api.onclose && api.onclose(); };
  const api = { el: wrap.querySelector('.sheet'), close, onclose: null };
  wrap.querySelector('.sheet-backdrop').onclick = close;
  wrap.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  mount && mount(api);
  return api;
}
const deptOptions = (sel) => DEPARTMENTS.map(d => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${d.icon} ${esc(d.name)}</option>`).join('');

// ---------------- backend wiring ----------------
async function startBackend() {
  if (state.backend) { try { state.backend.stop(); } catch {} }
  state.items = {}; state.trips = {}; state.barcodes = {}; state.ready = false;
  const code = prefs.familyCode;
  const cfg = fbConfig();
  let backend;
  if (cfg) {
    try {
      backend = await Promise.race([
        createFirebaseBackend(cfg, code),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000)),
      ]);
    } catch (e) {
      console.error('Firebase init failed', e);
      state.sync = { state: 'error', error: e };
      backend = null;
    }
  }
  if (!backend) backend = createLocalBackend(code);
  state.backend = backend; state.kind = backend.kind;
  if (backend.kind === 'local' && !cfg) state.sync = { state: 'local' };
  const onData = (part) => {
    for (const k of Object.keys(part)) state[k] = part[k];
    state.ready = true; renderData();
  };
  const onStatus = (s) => { if (backend.kind === 'firebase' || s.state !== 'local') state.sync = s; else if (!cfg) state.sync = s; updateChrome(); };
  await backend.start(onData, onStatus);
  await maybeSeedAndMigrate(backend);
  updateChrome();
}
async function maybeSeedAndMigrate(backend) {
  const code = prefs.familyCode;
  if (backend.kind === 'firebase' && !localStorage.getItem('ss:migrated:' + code)) {
    const local = readLocal(code);
    for (const it of Object.values(local.items)) backend.setItem(it);
    for (const t of Object.values(local.trips)) backend.setTrip(t);
    for (const b of Object.values(local.barcodes)) backend.setBarcode(b);
    localStorage.setItem('ss:migrated:' + code, '1');
  }
  // Seed Yaeli's list only when the family list is still empty. Deterministic
  // ids (seed-1..N) mean a second write cannot create duplicates.
  if (!Object.keys(state.items).length && !localStorage.getItem('ss:seeded:' + code)) {
    localStorage.setItem('ss:seeded:' + code, '1');
    for (const it of seedItems()) backend.setItem(it);
  } else {
    localStorage.setItem('ss:seeded:' + code, '1');
  }
}
window.addEventListener('ss-error', (e) => { state.sync = { state: 'error', error: e.detail }; updateChrome(); });

function updateChrome() {
  const b = $('#banner'), dot = $('#syncDot');
  const s = state.sync;
  b.className = 'banner';
  if (state.kind === 'firebase' && s.state === 'error') {
    const denied = s.error && /permission/i.test(String(s.error.code || s.error.message));
    b.innerHTML = denied ? '⚠️ אין הרשאה ל-Firestore. בדקו שהעתקתם את כללי האבטחה (firestore.rules) ושהתחברות אנונימית פעילה. <button data-go="settings">הגדרות</button>' : '⚠️ בעיית סנכרון: ' + esc(s.error?.message || '') + ' <button data-go="settings">הגדרות</button>';
    b.classList.add('err'); b.hidden = false; dot.textContent = '⚠️';
  } else if (state.kind === 'local') {
    const err = s.state === 'error';
    b.innerHTML = err ? '⚠️ החיבור ל-Firebase נכשל, האפליקציה עובדת במצב מקומי. <button data-go="settings">הגדרות</button>' : '📴 מצב מקומי: הנתונים נשמרים רק בטלפון הזה. <button data-go="settings">הפעלת סנכרון משפחתי</button>';
    if (err) b.classList.add('err');
    b.hidden = false; dot.textContent = '📴';
  } else {
    b.hidden = true; dot.textContent = s.state === 'cache' ? '🟡' : '☁️';
  }
  dot.title = state.kind === 'firebase' ? 'מסונכרן עם המשפחה' : 'מצב מקומי';
}
$('#banner').addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });
$('#syncDot').addEventListener('click', () => go('settings'));

// ---------------- data ops ----------------
const itemsArr = () => Object.values(state.items);
function addItem({ name, qty = 1, dept, inCart = false }) {
  name = name.trim(); if (!name) return null;
  const nn = normalize(name);
  const dup = itemsArr().find(i => normalize(i.name) === nn);
  if (dup) {
    const upd = { ...dup, qty: Math.min(999, (dup.qty || 1) + qty) };
    if (inCart) upd.inCart = true;
    state.backend.setItem(upd); state.items[dup.id] = upd;
    return { item: upd, merged: true };
  }
  const item = { id: uid(), name, qty, dept: dept || suggestDept(name), addedBy: userName(), addedAt: Date.now(), inCart, note: '' };
  state.items[item.id] = item; state.backend.setItem(item);
  return { item, merged: false };
}
function updateItem(id, patch) {
  const it = state.items[id]; if (!it) return;
  const upd = { ...it, ...patch };
  state.items[id] = upd; state.backend.setItem(upd); renderData();
}
function removeItem(id) {
  const it = state.items[id]; if (!it) return;
  delete state.items[id]; state.backend.delItem(id); renderData();
  toast('"' + it.name + '" נמחק', 'בטל', () => { state.items[id] = it; state.backend.setItem(it); renderData(); });
}
const activeTrip = () => Object.values(state.trips).filter(t => t.status === 'active').sort((a, b) => b.startedAt - a.startedAt)[0];
const sortedTrips = () => Object.values(state.trips).sort((a, b) => b.startedAt - a.startedAt);

function saveTrip(t) { state.trips[t.id] = t; state.backend.setTrip(t); }
function startTrip() {
  if (activeTrip()) return toast('כבר יש קנייה פעילה');
  const items = itemsArr();
  if (!items.length) return toast('הרשימה ריקה');
  const t = { id: uid(), status: 'active', startedAt: Date.now(), startedBy: userName(), receiptText: '', manual: {},
    snapshot: items.map(i => ({ id: i.id, name: i.name, qty: i.qty || 1, dept: i.dept, cart: false })) };
  items.forEach(i => { if (i.inCart) { const u = { ...i, inCart: false }; state.items[i.id] = u; state.backend.setItem(u); } });
  saveTrip(t); renderData(); toast('הקנייה התחילה. בהצלחה! 🛒');
}
function finishTrip() {
  const t = activeTrip(); if (!t) return;
  const inCart = itemsArr().filter(i => i.inCart);
  const snapIds = new Set(t.snapshot.map(s => s.id));
  sheet(`<h2>סיום קנייה</h2>
    <p>בעגלה ${inCart.length} פריטים מתוך ${t.snapshot.length} שברשימה.</p>
    <label class="kv"><span>להסיר מהרשימה את מה שנכנס לעגלה</span><input type="checkbox" id="rm" checked></label>
    <div class="actions"><button class="btn gray" data-close>חזרה</button><button class="btn" id="ok">סיום והשוואה לחשבונית</button></div>`, (s) => {
    $('#ok', s.el).onclick = () => {
      const rm = $('#rm', s.el).checked;
      const cartIds = new Set(inCart.map(i => i.id));
      const upd = { ...t, status: 'done', endedAt: Date.now(),
        snapshot: t.snapshot.map(x => ({ ...x, cart: cartIds.has(x.id) })),
        addedDuring: inCart.filter(i => !snapIds.has(i.id)).map(i => i.name) };
      saveTrip(upd);
      if (rm) inCart.forEach(i => { delete state.items[i.id]; state.backend.delItem(i.id); });
      s.close(); state.tripId = t.id; go('trip');
    };
  });
}

// ---------------- router & rendering ----------------
function go(view, tripId) {
  state.view = view; if (tripId !== undefined) state.tripId = tripId;
  render(); window.scrollTo(0, 0);
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.act === 'scan') return openScanner();
  if (b.dataset.view === 'trip') state.tripId = null;
  go(b.dataset.view);
});
function render() {
  document.querySelectorAll('#tabs button[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  ({ list: renderList, trip: renderTrip, history: renderHistory, settings: renderSettings }[state.view] || renderList)();
}
function renderData() { // data changed: refresh the active view without losing input focus
  if (state.view === 'list') updateList();
  else if (state.view === 'trip' || state.view === 'history') { if (!document.activeElement || !['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName)) render(); }
  else if (state.view === 'settings' && !document.activeElement?.matches?.('textarea,input')) render();
}

// ----- list view -----
function renderList() {
  $('#view').innerHTML = `
    <div class="progress card" id="progress"></div>
    <form class="add" id="addForm" autocomplete="off">
      <input id="addName" placeholder="מה להוסיף לרשימה?" enterkeyhint="done" aria-label="שם מוצר">
      <input id="addQty" type="number" inputmode="numeric" min="1" max="999" value="1" aria-label="כמות">
      <div class="full"><select id="addDept" aria-label="מחלקה">${deptOptions('other')}</select><button class="btn" type="submit">＋ הוסף</button></div>
    </form>
    <div id="tripbar" class="tripbar"></div>
    <div id="listBody"></div>
    <p class="muted" style="text-align:center"><button class="btn ghost small" id="importBtn">ייבוא רשימה מטקסט (למשל מוואטסאפ)</button></p>`;
  let deptTouched = false;
  const nameEl = $('#addName'), deptEl = $('#addDept');
  nameEl.addEventListener('input', () => { if (!deptTouched) deptEl.value = suggestDept(nameEl.value); });
  deptEl.addEventListener('change', () => { deptTouched = true; });
  $('#addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = addItem({ name: nameEl.value, qty: Math.max(1, parseInt($('#addQty').value, 10) || 1), dept: deptEl.value });
    if (!r) return;
    toast(r.merged ? `הכמות של "${r.item.name}" עודכנה ל-${r.item.qty}` : `"${r.item.name}" נוסף`);
    nameEl.value = ''; $('#addQty').value = 1; deptTouched = false; deptEl.value = 'other'; nameEl.focus(); updateList();
  });
  $('#importBtn').onclick = openImport;
  $('#listBody').addEventListener('click', onListClick);
  $('#listBody').addEventListener('change', (e) => {
    const li = e.target.closest('.item'); if (li && e.target.matches('input[type=checkbox]')) updateItem(li.dataset.id, { inCart: e.target.checked, cartBy: userName() });
  });
  updateList();
}
function onListClick(e) {
  const gh = e.target.closest('[data-toggle-group]');
  if (gh) { const k = gh.dataset.toggleGroup; state.collapsed[k] = !state.collapsed[k]; return updateList(); }
  const li = e.target.closest('.item'); if (!li) return;
  const id = li.dataset.id, it = state.items[id], act = e.target.closest('[data-act]')?.dataset.act;
  if (!it || !act) return;
  if (act === 'inc') updateItem(id, { qty: Math.min(999, (it.qty || 1) + 1) });
  else if (act === 'dec') updateItem(id, { qty: Math.max(1, (it.qty || 1) - 1) });
  else if (act === 'del') removeItem(id);
  else if (act === 'edit') editItem(id);
}
function updateList() {
  if (state.view !== 'list' || !$('#listBody')) return;
  const items = itemsArr();
  const total = items.length, inCart = items.filter(i => i.inCart).length;
  const trip = activeTrip();
  $('#progress').innerHTML = `<div class="row"><span>${trip ? '🛒 קנייה פעילה' : 'הרשימה'}</span><span>${inCart} מתוך ${total} בעגלה</span></div>
    <div class="bar"><i style="width:${total ? Math.round(inCart / total * 100) : 0}%"></i></div>`;
  $('#tripbar').innerHTML = trip
    ? `<button class="btn block" id="finishBtn">✔ סיום קנייה והשוואה לחשבונית</button><p class="muted" style="text-align:center;margin:6px 0 0">התחילה ב-${fmtTime(trip.startedAt)} · ${esc(trip.startedBy || '')}</p>`
    : (total ? `<button class="btn ghost block" id="startBtn">🛒 התחלת קנייה (שומר את הרשימה שנכנסנו איתה)</button>` : '');
  $('#startBtn')?.addEventListener('click', startTrip);
  $('#finishBtn')?.addEventListener('click', finishTrip);
  if (!total) { $('#listBody').innerHTML = `<div class="empty"><div class="big">🧺</div>הרשימה ריקה.<br>הוסיפו מוצר למעלה או סרקו ברקוד.</div>`; return; }
  const groups = DEPARTMENTS.map(d => ({ d, items: items.filter(i => (deptById(i.dept).id) === d.id).sort((a, b) => (a.inCart - b.inCart) || (a.addedAt - b.addedAt)) })).filter(g => g.items.length);
  $('#listBody').innerHTML = groups.map(({ d, items }) => {
    const c = items.filter(i => i.inCart).length, col = state.collapsed[d.id];
    return `<section class="group"><header data-toggle-group="${d.id}" role="button" tabindex="0"><span>${d.icon}</span><span>${esc(d.name)}</span><span class="cnt">${c}/${items.length} ${col ? '▾' : '▴'}</span></header>
      ${col ? '' : `<ul>${items.map(itemRow).join('')}</ul>`}</section>`;
  }).join('');
}
function itemRow(i) {
  const meta = [i.addedBy ? 'נוסף ע״י ' + esc(i.addedBy) : '', i.note ? esc(i.note) : '', i.inCart && i.cartBy ? 'בעגלה: ' + esc(i.cartBy) : ''].filter(Boolean).join(' · ');
  return `<li class="item ${i.inCart ? 'in-cart' : ''}" data-id="${esc(i.id)}">
    <label class="chk"><input type="checkbox" ${i.inCart ? 'checked' : ''} aria-label="בעגלה: ${esc(i.name)}"><span class="box">✓</span></label>
    <button class="item-main" data-act="edit"><span class="name">${esc(i.name)}</span><span class="meta">${meta}</span></button>
    <div class="qty"><button data-act="dec" aria-label="פחות">−</button><b>${i.qty || 1}</b><button data-act="inc" aria-label="יותר">＋</button></div>
    <button class="del" data-act="del" aria-label="מחיקה">🗑</button></li>`;
}
function editItem(id) {
  const it = state.items[id]; if (!it) return;
  sheet(`<h2>עריכת מוצר</h2>
    <div class="field"><label>שם</label><input id="eName" value="${esc(it.name)}"></div>
    <div class="row2"><div class="field"><label>כמות</label><input id="eQty" type="number" min="1" value="${it.qty || 1}"></div>
    <div class="field"><label>מחלקה</label><select id="eDept">${deptOptions(it.dept)}</select></div></div>
    <div class="field"><label>הערה</label><input id="eNote" value="${esc(it.note || '')}" placeholder="למשל: 3%, בלי גלוטן"></div>
    <div class="muted">נוסף ע״י ${esc(it.addedBy || '—')}${it.addedAt ? ' · ' + fmtDate(it.addedAt) + ' ' + fmtTime(it.addedAt) : ''}</div>
    <div class="actions"><button class="btn gray" data-close>ביטול</button><button class="btn" id="eSave">שמירה</button></div>`, (s) => {
    $('#eSave', s.el).onclick = () => {
      const name = $('#eName', s.el).value.trim(); if (!name) return;
      updateItem(id, { name, qty: Math.max(1, parseInt($('#eQty', s.el).value, 10) || 1), dept: $('#eDept', s.el).value, note: $('#eNote', s.el).value.trim() });
      s.close();
    };
  });
}
function openImport() {
  sheet(`<h2>ייבוא רשימה מטקסט</h2>
    <p class="muted">הדביקו רשימה, שורה לכל מוצר. כמות: "קוטג׳ ×5" או "קוטג׳ - 5". מוצרים שכבר ברשימה יתעדכנו ולא יוכפלו.</p>
    <textarea class="big" id="impText" placeholder="חלב&#10;ביצים ×2&#10;קוטג׳ - 5"></textarea>
    <div class="actions"><button class="btn gray" data-close>ביטול</button><button class="btn" id="impGo">ייבוא</button></div>`, (s) => {
    $('#impGo', s.el).onclick = () => {
      const parsed = parseListText($('#impText', s.el).value);
      parsed.forEach(p => addItem(p));
      toast(`יובאו ${parsed.length} שורות`); s.close(); renderData();
    };
  });
}

// ----- trip / receipt view -----
function pickTrip() {
  if (state.tripId && state.trips[state.tripId]) return state.trips[state.tripId];
  return activeTrip() || sortedTrips()[0] || null;
}
function renderTrip() {
  const t = pickTrip();
  if (!t) {
    $('#view').innerHTML = `<div class="empty"><div class="big">🧾</div>עוד לא הייתה קנייה.<br>התחילו קנייה מהרשימה, ובסיומה תוכלו להשוות לחשבונית.<br><br><button class="btn" id="goList">לרשימה</button></div>`;
    $('#goList').onclick = () => go('list'); return;
  }
  const isActive = t.status === 'active';
  $('#view').innerHTML = `
    <div class="card">
      <h2>🧾 קנייה מ-${fmtDate(t.startedAt)} ${fmtTime(t.startedAt)} ${isActive ? '<span class="pill act">פעילה</span>' : ''}</h2>
      <div class="muted">${t.snapshot.length} מוצרים ברשימה בכניסה לסופר · ${esc(t.startedBy || '')}</div>
      ${isActive ? `<div class="actions"><button class="btn" id="finishBtn">סיום קנייה</button></div>` : ''}
    </div>
    <div class="card">
      <h3>חשבונית</h3>
      <p class="muted" style="margin-top:0">הדביקו שורות מהחשבונית (טקסט או JSON), או הוסיפו שורות ידנית.</p>
      <textarea class="big" id="rText" placeholder="חלב תנובה | 1 | 6.90">${esc(t.receiptText || '')}</textarea>
      <div class="quickline"><input id="qName" placeholder="שם מוצר"><input id="qQty" type="number" min="1" value="1" aria-label="כמות"><input id="qPrice" type="number" step="0.01" inputmode="decimal" placeholder="מחיר"><button class="btn ghost small" id="qAdd">＋</button></div>
      <div class="actions"><button class="btn" id="cmpBtn">השוואה</button><button class="btn ghost" id="exBtn">דוגמה</button></div>
      <details><summary>פורמט ייבוא החשבונית</summary>
        <p class="muted">שורה לכל מוצר: <b>שם | כמות | מחיר</b> (מחיר = סה״כ לשורה). אפשר גם "קוטג 5% ×5 35.00". שורות <code>חנות:</code> <code>תאריך:</code> <code>סה"כ</code> נקראות כמטא. ברקוד (8-14 ספרות) נקרא אם מופיע בשורה. שורת הנחה = מחיר שלילי או המילה "הנחה". JSON:</p>
        <pre>{"store":"רמי לוי","date":"2026-11-21","total":85.1,
 "lines":[{"name":"קוטג 5%","qty":5,"price":35,"barcode":"729..."}]}</pre></details>
    </div>
    <div id="results"></div>
    <div class="card"><button class="btn danger block" id="delTrip">מחיקת הקנייה</button></div>`;
  $('#finishBtn')?.addEventListener('click', finishTrip);
  const ta = $('#rText');
  const persist = () => { if ((t.receiptText || '') !== ta.value) { t.receiptText = ta.value; saveTrip(t); } };
  $('#cmpBtn').onclick = () => { persist(); renderResults(t); $('#results').scrollIntoView({ behavior: 'smooth' }); };
  $('#exBtn').onclick = () => { ta.value = RECEIPT_EXAMPLE; persist(); renderResults(t); };
  ta.addEventListener('change', persist);
  $('#qAdd').onclick = () => {
    const n = $('#qName').value.trim(); if (!n) return;
    const q = $('#qQty').value || 1, p = $('#qPrice').value;
    ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + `${n} | ${q} | ${p || ''}`.replace(/ \| $/, '');
    $('#qName').value = ''; $('#qPrice').value = ''; $('#qQty').value = 1; persist(); renderResults(t);
  };
  $('#delTrip').onclick = () => {
    if (!confirm('למחוק את הקנייה הזו?')) return;
    delete state.trips[t.id]; state.backend.delTrip(t.id); state.tripId = null; go('history');
  };
  renderResults(t);
}
function renderResults(t) {
  const box = $('#results'); if (!box) return;
  if (!(t.receiptText || '').trim()) { box.innerHTML = ''; return; }
  const rc = parseReceipt(t.receiptText);
  if (!rc.lines.length) { box.innerHTML = `<div class="card muted">לא זוהו שורות בחשבונית.</div>`; return; }
  const res = compareReceipt(t.snapshot, rc, { manual: t.manual || {}, barcodes: state.barcodes });
  const tt = res.totals;
  const dur = (t.addedDuring || []);
  const row = (title, sub, price, tag, extra = '') => `<div class="cmp-row"><div class="t"><b>${title}${tag ? `<span class="tag">${tag}</span>` : ''}</b>${sub ? `<small>${sub}</small>` : ''}</div>${price != null ? `<span class="p">${money(price)}</span>` : ''}${extra}</div>`;
  const section = (cls, title, rows) => rows.length ? `<section class="cmp-section ${cls}"><h3>${title} (${rows.length})</h3>${rows.join('')}</section>` : '';
  box.innerHTML = `
    <div class="stats">
      <div class="stat ok"><b>${res.matched.length}</b><small>נקנו</small></div>
      <div class="stat bad"><b>${res.missing.length}</b><small>חסרים</small></div>
      <div class="stat warn"><b>${res.extra.length}</b><small>עודפים</small></div>
      <div class="stat"><b>${money(tt.receipt)}</b><small>סה״כ</small></div>
    </div>
    ${section('ok', '✅ נקנו (ברשימה ובחשבונית)', res.matched.map(m => row(esc(m.item.name) + (m.item.qty > 1 ? ' ×' + m.item.qty : ''), '↔ ' + esc(m.line.name) + (m.line.qty !== 1 || m.item.qty > 1 ? ' ×' + m.line.qty : ''), m.line.price, m.qtyStatus === 'less' ? `נקנו רק ${m.line.qty} מתוך ${m.item.qty}` : (m.qtyStatus === 'more' ? `נקנו ${m.line.qty} (ביקשנו ${m.item.qty})` : ''))))}
    ${section('warn', '⚠️ סומנו בעגלה אבל לא נמצאו בחשבונית', res.missingInCart.map(m => row(esc(m.name) + (m.qty > 1 ? ' ×' + m.qty : ''), 'אולי נרשם בשם אחר? אפשר לשייך שורה מהעודפים', null, '')))}
    ${section('bad', '❌ ברשימה ולא נקנו', res.missingNotInCart.map(m => row(esc(m.name) + (m.qty > 1 ? ' ×' + m.qty : ''), '', null, '')))}
    ${section('info', '➕ בחשבונית ולא ברשימה', res.extra.map(l => row(esc(l.name), l.qty !== 1 ? 'כמות ' + l.qty : '', l.price, dur.some(n => nameScore(n, l.name) >= 0.5) ? 'נוסף בזמן הקנייה' : '', res.missing.length ? `<button class="btn ghost small" data-assign="${l.idx}">שיוך</button>` : '')))}
    ${res.discounts.length ? section('info', '🏷️ הנחות', res.discounts.map(l => row(esc(l.name), '', l.price, ''))) : ''}
    <div class="card totals">
      <div><span>מוצרים מהרשימה</span><b>${money(tt.matched)}</b></div>
      <div><span>עודפים שלא ברשימה</span><b>${money(tt.extra)}</b></div>
      ${tt.discounts ? `<div><span>הנחות</span><b>${money(tt.discounts)}</b></div>` : ''}
      <div class="grand"><span>סה״כ חשבונית${rc.total != null ? '' : ' (חישוב משורות)'}</span><b>${money(tt.receipt)}</b></div>
      ${rc.store || rc.date ? `<div class="muted"><span>${esc(rc.store)}</span><span>${esc(rc.date)}</span></div>` : ''}
    </div>
    ${res.missing.length ? `<button class="btn ghost block" id="readdMissing">↩ החזרת ${res.missing.length} החסרים לרשימה</button>` : ''}`;
  box.querySelectorAll('[data-assign]').forEach(b => b.onclick = () => assignLine(t, +b.dataset.assign, res.missing, rc));
  $('#readdMissing')?.addEventListener('click', () => {
    let n = 0; res.missing.forEach(m => { if (!itemsArr().some(i => normalize(i.name) === normalize(m.name))) { addItem({ name: m.name, qty: m.qty, dept: m.dept }); n++; } });
    toast(n ? `${n} מוצרים הוחזרו לרשימה` : 'כל החסרים כבר ברשימה');
  });
}
function assignLine(t, idx, missing, rc) {
  sheet(`<h2>שיוך שורה מהחשבונית</h2><p class="muted">"${esc(rc.lines[idx].name)}" שייכת ל:</p>
    ${missing.map(m => `<button class="btn ghost block" style="margin-bottom:8px" data-id="${esc(m.id)}">${esc(m.name)}</button>`).join('')}
    <button class="btn gray block" data-close>ביטול</button>`, (s) => {
    s.el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
      t.manual = { ...(t.manual || {}), [idx]: b.dataset.id }; saveTrip(t); s.close(); renderResults(t);
    });
  });
}

// ----- history -----
function renderHistory() {
  const trips = sortedTrips();
  if (!trips.length) { $('#view').innerHTML = `<div class="empty"><div class="big">🕘</div>עדיין אין קניות בהיסטוריה.</div>`; return; }
  $('#view').innerHTML = trips.map(t => {
    let sum = '';
    if ((t.receiptText || '').trim()) {
      const rc = parseReceipt(t.receiptText), r = compareReceipt(t.snapshot, rc, { manual: t.manual || {}, barcodes: state.barcodes });
      sum = `נקנו ${r.matched.length}/${t.snapshot.length} · ${money(r.totals.receipt)}`;
    } else sum = t.status === 'active' ? 'בתהליך' : 'בלי חשבונית';
    const carted = t.snapshot.filter(s => s.cart).length;
    return `<div class="card"><button class="hist" data-trip="${esc(t.id)}"><div class="d"><b>${fmtDate(t.startedAt)} · ${fmtTime(t.startedAt)}</b><span class="muted">${t.snapshot.length} מוצרים${t.status === 'done' ? ' · ' + carted + ' בעגלה' : ''} · ${sum}</span></div>${t.status === 'active' ? '<span class="pill act">פעילה</span>' : '<span class="pill">‹</span>'}</button></div>`;
  }).join('');
  $('#view').querySelectorAll('[data-trip]').forEach(b => b.onclick = () => go('trip', b.dataset.trip));
}

// ----- settings -----
function shareLink() {
  const u = new URL(location.href); u.search = ''; u.hash = '';
  let h = 'join=' + encodeURIComponent(prefs.familyCode);
  const cfg = fbConfig();
  if (cfg) h += '&fb=' + btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
  return u.toString() + '#' + h;
}
function renderSettings() {
  const cfg = fbConfig();
  const bcs = Object.values(state.barcodes);
  const status = state.kind === 'firebase' ? (state.sync.state === 'error' ? '⚠️ שגיאה' : '☁️ מחובר (' + esc(cfg.projectId) + ')') : '📴 מצב מקומי';
  $('#view').innerHTML = `
    <div class="card"><h3>👤 השם שלי</h3>
      <div class="field"><input id="sName" value="${esc(prefs.name || '')}" placeholder="איך לקרוא לך? (יופיע ליד מוצרים שהוספת)"></div>
      <button class="btn small" id="sNameSave">שמירה</button></div>
    <div class="card"><h3>👨‍👩‍👧 המשפחה</h3>
      <div class="kv"><span>קוד משפחה</span><code class="code">${esc(prefs.familyCode)}</code></div>
      <p class="muted">כל מי שמשתמש באותו קוד (ובאותו חיבור Firebase) רואה את אותה רשימה.</p>
      <div class="actions"><button class="btn" id="shareBtn">שיתוף קישור הצטרפות</button><button class="btn ghost" id="joinBtn">הצטרפות בקוד</button></div>
      <div class="actions"><button class="btn ghost" id="newFamily">משפחה חדשה</button></div></div>
    <div class="card"><h3>☁️ סנכרון משפחתי (Firebase)</h3>
      <div class="kv"><span>מצב</span><b>${status}</b></div>
      ${state.sync.state === 'error' && state.sync.error ? `<p class="muted" style="color:var(--red)">${esc(state.sync.error.message || state.sync.error.code || '')}</p>` : ''}
      <div class="field"><label>הדביקו כאן את הגדרות Firebase (apiKey, projectId, appId...)</label>
      <textarea class="big" id="fbText" style="direction:ltr;min-height:100px" placeholder='{ "apiKey": "...", "authDomain": "...", "projectId": "...", "appId": "..." }'>${prefs.fbConfig ? esc(JSON.stringify(prefs.fbConfig, null, 2)) : ''}</textarea></div>
      <div class="actions"><button class="btn" id="fbSave">שמירה וחיבור</button>${prefs.fbConfig ? '<button class="btn danger" id="fbOff">ניתוק</button>' : ''}</div>
      <p class="muted">הוראות מלאות ב-README. הנתונים המקומיים יועברו לענן אוטומטית.</p></div>
    <div class="card"><h3>🔖 ברקודים שנלמדו (${bcs.length})</h3>
      ${bcs.length ? bcs.map(b => `<div class="kv"><span>${esc(b.name || b.listName)} <span class="muted" dir="ltr">${esc(b.code)}</span></span><button class="btn danger small" data-delbc="${esc(b.code)}">מחיקה</button></div>`).join('') : '<p class="muted">עוד לא נסרקו מוצרים.</p>'}</div>
    <div class="card"><h3>💾 נתונים</h3>
      <div class="actions"><button class="btn ghost" id="exportBtn">גיבוי JSON</button><button class="btn ghost" id="importBtn2">ייבוא רשימה מטקסט</button></div></div>
    <p class="muted" style="text-align:center">סופר שלזי · גרסה 1.0</p>`;
  $('#sNameSave').onclick = () => { prefs.name = $('#sName').value.trim(); savePrefs(); toast('נשמר'); };
  $('#shareBtn').onclick = async () => {
    const link = shareLink();
    try { if (navigator.share) { await navigator.share({ title: 'סופר שלזי', text: 'הצטרפו לרשימת הקניות שלנו', url: link }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(link); toast('הקישור הועתק'); } catch { prompt('העתיקו את הקישור:', link); }
  };
  $('#joinBtn').onclick = () => {
    sheet(`<h2>הצטרפות בקוד</h2><div class="field"><input id="jCode" dir="ltr" placeholder="קוד משפחה"></div>
      <div class="actions"><button class="btn gray" data-close>ביטול</button><button class="btn" id="jGo">הצטרפות</button></div>`, (s) => {
      $('#jGo', s.el).onclick = async () => { const c = $('#jCode', s.el).value.trim().toLowerCase(); if (c.length < 10) return toast('הקוד חייב להכיל לפחות 10 תווים'); s.close(); await joinFamily(c); };
    });
  };
  $('#newFamily').onclick = async () => { if (confirm('ליצור משפחה חדשה עם רשימה חדשה? (הנתונים הקיימים נשארים תחת הקוד הישן)')) { prefs.familyCode = randomCode(); prefs.customFamily = true; savePrefs(); await startBackend(); render(); toast('נוצרה משפחה חדשה'); } };
  $('#fbSave').onclick = async () => {
    const c = parseFirebaseConfig($('#fbText').value);
    if (!c) return toast('לא זוהו הגדרות תקינות (חסר apiKey / projectId / appId)');
    prefs.fbConfig = c; savePrefs(); toast('מתחבר…'); await startBackend(); render();
  };
  $('#fbOff')?.addEventListener('click', async () => { delete prefs.fbConfig; savePrefs(); await startBackend(); render(); });
  document.querySelectorAll('[data-delbc]').forEach(b => b.onclick = () => { delete state.barcodes[b.dataset.delbc]; state.backend.delBarcode(b.dataset.delbc); render(); });
  $('#exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify({ items: state.items, trips: state.trips, barcodes: state.barcodes }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'super-shlezi-backup.json'; a.click();
  };
  $('#importBtn2').onclick = openImport;
}
async function joinFamily(code, cfg) {
  prefs.familyCode = code; if (cfg) prefs.fbConfig = cfg;
  prefs.customFamily = code !== defaultFamily();
  localStorage.setItem('ss:seeded:' + code, '1'); // never seed a family we are joining
  savePrefs(); await startBackend(); go('list'); toast('הצטרפת למשפחה ✓');
}

// ---------------- barcode scanning ----------------
let scanSession = null;
async function openScanner() {
  if (scanSession) return;
  const ov = document.createElement('div');
  ov.className = 'scanner';
  ov.innerHTML = `<div class="cam"><video id="scanVideo" playsinline muted></video><div id="qr-reader" hidden></div><div class="frame"></div><div class="hint" id="scanHint">כוונו את המצלמה אל הברקוד</div></div>
    <div class="bottom"><form class="manual" id="manualForm"><input id="manualCode" inputmode="numeric" placeholder="או הקלידו ברקוד" aria-label="ברקוד"><button class="btn" type="submit">אישור</button><button class="btn gray" type="button" id="scanClose">סגירה</button></form></div>`;
  document.body.appendChild(ov);
  const sess = scanSession = { ov, stop: null, paused: false, last: '', lastAt: 0 };
  const close = async () => { try { await sess.stop?.(); } catch {} ov.remove(); scanSession = null; };
  $('#scanClose', ov).onclick = close;
  $('#manualForm', ov).onsubmit = (e) => { e.preventDefault(); const c = $('#manualCode', ov).value.replace(/\D/g, ''); if (c.length >= 6) { $('#manualCode', ov).value = ''; onCode(c); } };
  const onCode = async (code) => {
    const now = Date.now();
    if (sess.paused || (code === sess.last && now - sess.lastAt < 3000)) return;
    sess.last = code; sess.lastAt = now; sess.paused = true;
    navigator.vibrate?.(60);
    try { await handleBarcode(code); } finally { sess.paused = false; sess.lastAt = Date.now(); }
  };
  sess.onCode = onCode;
  try {
    if ('BarcodeDetector' in window) {
      let formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
      try { const sup = await BarcodeDetector.getSupportedFormats(); formats = formats.filter(f => sup.includes(f)); } catch {}
      const det = new BarcodeDetector({ formats });
      const video = $('#scanVideo', ov);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = stream; await video.play();
      let alive = true;
      sess.stop = () => { alive = false; stream.getTracks().forEach(t => t.stop()); };
      const loop = async () => {
        if (!alive) return;
        if (!sess.paused && video.readyState >= 2) { try { const r = await det.detect(video); if (r[0]?.rawValue) onCode(r[0].rawValue); } catch {} }
        setTimeout(loop, 180);
      };
      loop();
    } else {
      await loadScript('vendor/html5-qrcode.min.js');
      $('#scanVideo', ov).hidden = true; $('#qr-reader', ov).hidden = false;
      const F = Html5QrcodeSupportedFormats;
      const h = new Html5Qrcode('qr-reader', { formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128], verbose: false });
      await h.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 280, height: 140 } }, (txt) => onCode(txt), () => {});
      sess.stop = async () => { try { await h.stop(); h.clear(); } catch {} };
    }
  } catch (err) {
    console.warn('camera', err);
    $('#scanHint', ov).textContent = 'אין גישה למצלמה. אפשר להקליד ברקוד ידנית למטה.';
  }
}
function loadScript(src) {
  return new Promise((res, rej) => { if (window.Html5Qrcode) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function lookupOFF(code) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_he,brands,quantity`, { signal: ctl.signal });
    const j = await r.json();
    if (j.status !== 1 || !j.product) return null;
    const p = j.product; let name = (p.product_name_he || p.product_name || '').trim();
    const brand = (p.brands || '').split(',')[0].trim();
    if (name && brand && !normalize(name).includes(normalize(brand))) name += ' ' + brand;
    return name || null;
  } catch { return null; } finally { clearTimeout(to); }
}
function bestItemFor(name, preferOpen = true) {
  let best = null, bs = 0;
  for (const i of itemsArr()) {
    let sc = nameScore(i.name, name);
    if (preferOpen && i.inCart) sc -= 0.15;
    if (sc > bs) { bs = sc; best = i; }
  }
  return bs >= 0.45 ? best : null;
}
function markCart(item, how) {
  if (item.inCart) return toast(`"${item.name}" כבר בעגלה`);
  updateItem(item.id, { inCart: true, cartBy: userName() }); toast(`✓ "${item.name}" בעגלה`);
}
function handleBarcode(code) {
  return new Promise(async (resolve) => {
    const known = state.barcodes[code];
    if (known) {
      const nm = known.listName || known.name;
      const item = (known.itemId && state.items[known.itemId]) || bestItemFor(nm);
      if (item) { markCart(item); return resolve(); }
      return sheet(`<h2>${esc(known.name || nm)}</h2><p>המוצר הזה לא ברשימה כרגע.</p>
        <div class="actions"><button class="btn gray" data-close>התעלמות</button><button class="btn" id="addIt">הוספה לרשימה כבעגלה</button></div>`, (s) => {
        s.onclose = resolve;
        $('#addIt', s.el).onclick = () => { addItem({ name: known.listName || known.name, qty: 1, dept: known.dept, inCart: true }); toast('נוסף לעגלה ✓'); updateList(); s.close(); };
      });
    }
    toast('מחפש מוצר…');
    const found = await lookupOFF(code);
    const guess = found ? bestItemFor(found) : null;
    sheet(`<h2>ברקוד חדש</h2><p class="muted" dir="ltr" style="text-align:right">${esc(code)}</p>
      <div class="field"><label>שם המוצר ${found ? '(נמצא ב-Open Food Facts)' : '(לא נמצא, הקלידו שם)'}</label><input id="bName" value="${esc(found || '')}" placeholder="למשל: קוטג׳ תנובה 5%"></div>
      <div class="field"><label>מה זה ברשימה?</label><select id="bLink">
        <option value="">➕ מוצר חדש (הוספה לרשימה)</option>
        ${itemsArr().map(i => `<option value="${esc(i.id)}" ${guess && guess.id === i.id ? 'selected' : ''}>${esc(i.name)}${i.inCart ? ' ✓' : ''}</option>`).join('')}</select></div>
      <div class="actions"><button class="btn gray" data-close>ביטול</button><button class="btn" id="bSave">שמירה וסימון בעגלה</button></div>`, (s) => {
      s.onclose = resolve;
      $('#bSave', s.el).onclick = () => {
        const name = $('#bName', s.el).value.trim(); const linkId = $('#bLink', s.el).value;
        const link = linkId && state.items[linkId];
        if (!name && !link) return toast('הקלידו שם מוצר');
        const rec = { code, name: name || link.name, listName: link ? link.name : (name), itemId: link ? link.id : '', dept: link ? link.dept : suggestDept(name), by: userName(), at: Date.now() };
        state.barcodes[code] = rec; state.backend.setBarcode(rec);
        if (link) markCart(link); else { const r = addItem({ name, qty: 1, inCart: true }); toast(`"${name}" נוסף לעגלה ✓`); if (r) rec.itemId = r.item.id; }
        updateList(); s.close();
      };
    });
  });
}

// ---------------- boot ----------------
function askName() {
  return new Promise((resolve) => {
    sheet(`<h2>ברוכים הבאים לסופר שלזי 🛒</h2><p>איך לקרוא לך? (נציג את השם ליד מוצרים שהוספת)</p>
      <div class="field"><input id="nm" placeholder="שם" autofocus></div>
      <div class="actions"><button class="btn" id="nmOk">המשך</button></div>`, (s) => {
      const done = () => { prefs.name = $('#nm', s.el).value.trim() || 'אורח'; savePrefs(); s.onclose = null; s.close(); resolve(); };
      $('#nmOk', s.el).onclick = done; $('#nm', s.el).onkeydown = (e) => { if (e.key === 'Enter') done(); };
      s.onclose = () => { prefs.name = prefs.name || 'אורח'; savePrefs(); resolve(); };
    });
  });
}
async function handleJoinHash() {
  if (!location.hash.includes('join=')) return false;
  const p = new URLSearchParams(location.hash.slice(1));
  const code = (p.get('join') || '').toLowerCase();
  let cfg = null;
  try { if (p.get('fb')) cfg = JSON.parse(decodeURIComponent(escape(atob(p.get('fb'))))); } catch {}
  history.replaceState(null, '', location.pathname + location.search);
  if (code.length < 10) return false;
  if (code === prefs.familyCode) return false;
  localStorage.setItem('ss:seeded:' + code, '1');
  prefs.familyCode = code;
  prefs.customFamily = code !== defaultFamily();
  if (cfg && cfg.apiKey) prefs.fbConfig = cfg; savePrefs();
  return true;
}
function defaultFamily() { return window.DEFAULT_FAMILY_CODE || 'shlezi-family'; }
function adoptDefaultFamily() {
  if (prefs.customFamily) return;
  const dest = defaultFamily();
  const old = prefs.familyCode;
  if (old && old !== dest) {
    const from = readLocal(old), to = readLocal(dest);
    let changed = false;
    for (const col of ['items', 'trips', 'barcodes']) {
      for (const [id, obj] of Object.entries(from[col] || {})) {
        if (!to[col][id]) { to[col][id] = obj; changed = true; }
      }
    }
    if (changed) {
      try { localStorage.setItem(localKey(dest), JSON.stringify(to)); } catch {}
    }
  }
  prefs.familyCode = dest;
  savePrefs();
}
async function boot() {
  if (!prefs.customFamily) adoptDefaultFamily();
  else if (!prefs.familyCode) { prefs.familyCode = defaultFamily(); savePrefs(); }
  const joined = await handleJoinHash();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  await startBackend();
  go('list');
  if (joined) toast('הצטרפת למשפחה ✓');
  if (!prefs.name) await askName();
  window.__app = { state, addItem, parseReceipt, compareReceipt, handleBarcode, go }; // handy for tests/debugging
}
boot();
