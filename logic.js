// Pure logic: departments, Hebrew normalization, fuzzy matching, receipt parsing. No DOM.

export const DEPARTMENTS = [
  { id: 'produce', name: 'פירות וירקות', icon: '🥬', kw: ['פירות','ירקות','עגבני','מלפפון','בצל','תפוח','בננ','לימון','גזר','חסה','פלפל','תפוז','אבוקדו','שום','תפוד','בטטה','קישוא','חציל','פטרוזיל','כוסברה','נענע','אבטיח','ענבים','תות','אפרסק','נקטרינ','מנגו','עגבניות','שמיר','כרוב','ברוקולי','כרובית','דלעת','פטריות','תרד','סלק','צנון','קלמנטינ','אשכולית','רימון','תמר','קיווי','אגס'] },
  { id: 'dairy', name: 'מוצרי חלב וביצים', icon: '🥛', kw: ['חלב','ביצ','קוטג','גבינ','יוגורט','שמנת','חמאה','מילקי','מעדן','לבן','לבנה','שוקו','משקה חלב','מוצרלה','צהובה','פטה','בולגרית','דנונה','אקטיביה','גבינה','ריקוטה','קפיר','מרגרינה','שמנת חמוצה','תנובה','טרה','יטבתה','שטראוס'] },
  { id: 'deli', name: 'מעדנייה', icon: '🧀', kw: ['נקניק','סלמי','פסטרמה','חומוס','סלט','טחינה גולמית','זיתים','מעדני','הודו פרוס','סלמון מעושן','קבנוס','נקניקיות','כבד קצוץ','מטבוחה','חציל מטוגן','סביח','גבינה בולגרית','טבעוני','טופו','שניצל מוכן','קובה'] },
  { id: 'meat', name: 'בשר, עוף ודגים', icon: '🍗', kw: ['עוף','חזה','שניצל','בשר','טחון','סטייק','כנפיים','כבד','דג','סלמון','טונה טרי','נקניקיות עוף','פילה','שוק','ירכיים','אנטרקוט','קבב','המבורגר','לברק','דניס','אמנון','קציצות'] },
  { id: 'bakery', name: 'לחם ומאפים', icon: '🍞', kw: ['לחם','פיתה','פיתות','חלה','לחמניות','לחמנייה','באגט','בייגל','עוגה','עוגת','בורקס','קרואסון','טורטיה','לאפה','מאפה','מצות','טוסט','פריכיות','כיכר'] },
  { id: 'frozen', name: 'קפואים', icon: '🧊', kw: ['קפוא','גלידה','פיצה','ג׳חנון','גחנון','מלאווח','בצק עלים','שלגון','אפונה קפואה','פופקורן','צ׳יפס','נאגטס','תירס קפוא','ירקות קפואים','בורקס קפוא','פירה קפוא','קפואה'] },
  { id: 'pantry', name: 'מזווה', icon: '🥫', kw: ['טחינה','אורז','פסטה','ספגטי','קמח','סוכר','שמן','מלח','קפה','תה','דגנים','קורנפלקס','שימורים','טונה','תירס','רוטב','קטשופ','מיונז','חרדל','חומץ','עדשים','חומוס יבש','קוסקוס','פתיתים','אטריות','שוקולד','עוגיות','ביסקוויט','חטיף','במבה','ביסלי','דגנה','אגוזים','שקדים','צימוקים','ממרח','ריבה','דבש','נוטלה','אבקת','שמרים','אפייה','קקאו','גרנולה','שיבולת','קטניות','סילאן','פופקורן','קרקר','וופל','סוכריות','מסטיק','מרק','אינסטנט','הר ברכה','תבלין','פפריקה','כורכום','קינמון','קמח תופח'] },
  { id: 'drinks', name: 'משקאות', icon: '🥤', kw: ['מים','סודה','קולה','פפסי','מיץ','בירה','יין','משקה','ספרייט','פאנטה','נביעות','נס קפה','אנרגיה','תרכיז','מינרלים','וודקה','וויסקי','ערק','שוופס','תפוזינה'] },
  { id: 'cleaning', name: 'ניקיון', icon: '🧽', kw: ['ניקוי','ספריי','סבון כלים','כביסה','אקונומיקה','מרכך','שקיות','נייר טואלט','נייר סופג','מגבונים','אבקת כביסה','ג׳ל כביסה','סנו','פיירי','מטלית','ספוג','זבל','נייר אלומיניום','נייר אפייה','צלפון','חומר ניקוי','מנקה','מנקה רצפה','כלור','מסיר אבנית','מטהר אוויר','כפפות'] },
  { id: 'care', name: 'טיפוח והיגיינה', icon: '🧴', kw: ['שמפו','מרכך שיער','משחת שיניים','מברשת שיניים','דאודורנט','סבון גוף','סבון ידיים','תחבושות','טמפונים','קרם','גילוח','אקונומיקה אישית','משחה','מגבות נייר','צמר גפן','גזה','פלסטרים','תרופה','ויטמין','אקמול','נורופן','מי פה','חוט דנטלי','קוסמטיקה','לק','לחות','קרם הגנה','סכיני גילוח'] },
  { id: 'baby', name: 'תינוקות', icon: '🍼', kw: ['חיתולים','מטרנה','סימילאק','מגבונים לחים','מוצץ','בקבוק','דייסה לתינוק','אבקת תינוקות','פורמולה'] },
  { id: 'other', name: 'אחר', icon: '🛍️', kw: [] },
];
export const deptById = (id) => DEPARTMENTS.find(d => d.id === id) || DEPARTMENTS[DEPARTMENTS.length - 1];

// ---------- Normalization ----------
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '')            // niqqud / cantillation
    .replace(/[׳'’`´"״”“]/g, '')                 // geresh / quotes
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const STOP = new Set(['של', 'עם', 'את', 'או', 'גרם', 'גר', 'קג', 'מל', 'ליטר', 'יח', 'יחידות', 'מארז', 'חבילה', 'בטעם', 'ללא']);
function stem(t) {
  if (t.length >= 5 && (t.endsWith('ים') || t.endsWith('ות'))) return t.slice(0, -2);
  if (t.length >= 4 && (t.endsWith('ה') || t.endsWith('י'))) return t.slice(0, -1);
  return t;
}
export function tokens(s) {
  const out = [];
  for (const t of normalize(s).split(' ')) {
    if (!t || STOP.has(t) || /^[\d%.]+$/.test(t)) continue;
    const st = stem(t);
    if (!out.includes(st)) out.push(st);
  }
  return out;
}
export function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
export function tokenSim(a, b) {
  if (a === b) return 1;
  const min = Math.min(a.length, b.length), max = Math.max(a.length, b.length);
  if (min < 3) return 0;
  if (a.startsWith(b) || b.startsWith(a)) return min / max >= 0.5 ? 0.88 : 0.7;
  const sim = 1 - lev(a, b) / max;
  return sim >= 0.74 ? sim * 0.95 : 0;
}
/** How well does `query` (list item name) appear in `target` (receipt text)? 0..1 */
export function nameScore(query, target) {
  const q = tokens(query), t = tokens(target);
  if (!q.length || !t.length) return 0;
  let wsum = 0, ssum = 0, matchedTokens = 0;
  for (const qt of q) {
    const w = qt.length;
    let best = 0;
    for (const tt of t) best = Math.max(best, tokenSim(qt, tt));
    wsum += w; ssum += w * best;
    if (best > 0) matchedTokens++;
  }
  if (!matchedTokens) return 0;
  const extra = Math.max(0, t.length - q.length);
  return Math.max(0, ssum / wsum - 0.02 * Math.min(extra, 5));
}
export const MATCH_THRESHOLD = 0.5;

export function suggestDept(name) {
  const n = normalize(name);
  if (!n) return 'other';
  let best = null, bestLen = 0;
  for (const d of DEPARTMENTS) {
    for (const k of d.kw) {
      const kn = normalize(k);
      if (!kn) continue;
      // keyword is a prefix of a word or whole phrase contained
      const hit = n.split(' ').some(w => w.startsWith(kn) || (kn.length >= 4 && w.includes(kn))) || (kn.includes(' ') && n.includes(kn));
      if (hit && kn.length > bestLen) { best = d.id; bestLen = kn.length; }
    }
  }
  return best || 'other';
}

// ---------- Text list parsing (WhatsApp lists) ----------
export function parseItemLine(line) {
  let s = String(line).replace(/^[\s\-–•*·\d]*[.)]\s+/, '').replace(/^[\s\-–•*·]+/, '').trim();
  if (!s) return null;
  let qty = 1;
  let m;
  if ((m = s.match(/\s*[x×*]\s*(\d+)\s*$/i)) || (m = s.match(/^\s*(\d+)\s*[x×*]\s*/i) )) {
    qty = parseInt(m[1], 10); s = s.replace(m[0], ' ');
  } else if ((m = s.match(/\s+[-–—:]\s*(\d+)\s*$/))) {
    qty = parseInt(m[1], 10); s = s.replace(m[0], '');
  }
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return { name: s, qty: Math.max(1, Math.min(qty || 1, 999)) };
}
export function parseListText(text) {
  return String(text || '').split(/\r?\n/).map(parseItemLine).filter(Boolean);
}

// ---------- Receipt parsing ----------
const num = (s) => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : null; };
const TOTAL_RE = /(סה["״']?כ|סהכ|סך הכל|לתשלום|total)/i;
const META_RE = /^\s*(חנות|סניף|store|תאריך|date)\s*[:：]\s*(.+)$/i;

/** Returns {store, date, total, lines:[{name, qty, price, barcode, discount}]} */
export function parseReceipt(input) {
  const out = { store: '', date: '', total: null, lines: [] };
  const text = String(input ?? '').trim();
  if (!text) return out;
  if (text[0] === '{' || text[0] === '[') {
    try {
      const j = JSON.parse(text);
      const arr = Array.isArray(j) ? j : (j.lines || j.items || []);
      if (!Array.isArray(j)) { out.store = j.store || ''; out.date = j.date || ''; out.total = j.total != null ? num(j.total) : null; }
      for (const l of arr) {
        if (!l || !l.name) continue;
        const price = l.price != null ? num(l.price) : null;
        out.lines.push({ name: String(l.name), qty: l.qty != null ? (num(l.qty) || 1) : 1, price, barcode: l.barcode ? String(l.barcode) : '', discount: !!l.discount || (price != null && price < 0) });
      }
      return out;
    } catch (e) { /* fall through to text */ }
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m = line.match(META_RE);
    if (m) {
      const k = m[1].toLowerCase();
      if (k === 'חנות' || k === 'סניף' || k === 'store') out.store = m[2].trim(); else out.date = m[2].trim();
      continue;
    }
    if (TOTAL_RE.test(line)) {
      const nums = line.match(/-?\d+(?:[.,]\d{1,2})?/g);
      if (nums) out.total = num(nums[nums.length - 1]);
      continue;
    }
    out.lines.push(parseReceiptLine(line));
  }
  return out;
}
export function parseReceiptLine(line) {
  let name = line, qty = 1, price = null, barcode = '';
  if (/[|\t]/.test(line)) {
    const parts = line.split(/\s*[|\t]\s*/).map(p => p.trim()).filter(p => p !== '');
    name = parts[0] || '';
    const rest = parts.slice(1);
    const bc = rest.find(p => /^\d{8,14}$/.test(p));
    if (bc) { barcode = bc; rest.splice(rest.indexOf(bc), 1); }
    const nums = rest.map(p => p.replace(/[^\d.,-]/g, '')).filter(Boolean);
    if (nums.length >= 2) { qty = num(nums[0]) || 1; price = num(nums[1]); }
    else if (nums.length === 1) price = num(nums[0]);
  } else {
    let s = line;
    const bm = s.match(/\b\d{8,14}\b/);
    if (bm) { barcode = bm[0]; s = s.replace(bm[0], ' '); }
    let q = s.match(/(\d+(?:\.\d+)?)\s*[x×*](?!\w)/i) || s.match(/(?:^|\s)[x×*]\s*(\d+(?:\.\d+)?)/i);
    if (q) { qty = num(q[1]) || 1; s = s.replace(q[0], ' '); }
    const nums = [...s.matchAll(/(?<![\d%.,])-?\d+(?:[.,]\d{1,2})?(?![\d%]|\s*(?:גרם|גר|מל|ליטר|ל|ק"ג|קג|kg|g|ml))/gi)];
    if (nums.length) {
      const last = nums[nums.length - 1];
      price = num(last[0]);
      s = s.slice(0, last.index) + ' ' + s.slice(last.index + last[0].length);
    }
    name = s.replace(/[₪]|ש"ח|שח/g, ' ');
  }
  name = name.replace(/\s+/g, ' ').trim();
  const discount = /הנחה|מבצע|קופון|זיכוי/.test(name) || (price != null && price < 0);
  return { name, qty, price, barcode, discount };
}

// ---------- Receipt comparison ----------
/**
 * snapshot: [{id,name,qty,cart}] ; lines from parseReceipt ; opts.manual {lineIndex: itemId}
 * opts.barcodes {code:{name,listName}}
 */
export function compareReceipt(snapshot, receipt, opts = {}) {
  const manual = opts.manual || {};
  const barcodes = opts.barcodes || {};
  const lines = receipt.lines.map((l, i) => ({ ...l, idx: i }));
  const usedItems = new Set(), usedLines = new Set();
  const matched = [];
  const byId = new Map(snapshot.map(s => [s.id, s]));

  for (const [li, iid] of Object.entries(manual)) {
    const item = byId.get(iid), line = lines[+li];
    if (item && line && !usedItems.has(iid) && !usedLines.has(+li)) {
      usedItems.add(iid); usedLines.add(+li); matched.push({ item, line, score: 1, manual: true });
    }
  }
  const pairs = [];
  for (const item of snapshot) {
    if (usedItems.has(item.id)) continue;
    for (const line of lines) {
      if (usedLines.has(line.idx) || line.discount) continue;
      let sc = nameScore(item.name, line.name);
      const bm = line.barcode && barcodes[line.barcode];
      if (bm) {
        for (const alias of [bm.listName, bm.name]) if (alias) sc = Math.max(sc, nameScore(item.name, alias));
        if (bm.listName && normalize(bm.listName) === normalize(item.name)) sc = Math.max(sc, 1);
      }
      if (sc >= MATCH_THRESHOLD) pairs.push({ item, line, score: sc });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  for (const p of pairs) {
    if (usedItems.has(p.item.id) || usedLines.has(p.line.idx)) continue;
    usedItems.add(p.item.id); usedLines.add(p.line.idx); matched.push(p);
  }
  const missing = snapshot.filter(s => !usedItems.has(s.id));
  const extra = lines.filter(l => !usedLines.has(l.idx) && !l.discount);
  const discounts = lines.filter(l => l.discount);
  for (const m of matched) m.qtyStatus = m.line.qty < m.item.qty ? 'less' : (m.line.qty > m.item.qty ? 'more' : 'ok');
  const sum = (arr) => Math.round(arr.reduce((a, l) => a + (l.price || 0), 0) * 100) / 100;
  const linesTotal = sum(lines);
  return {
    matched, missing,
    missingInCart: missing.filter(m => m.cart),
    missingNotInCart: missing.filter(m => !m.cart),
    extra, discounts,
    totals: {
      receipt: receipt.total != null ? receipt.total : linesTotal,
      linesTotal,
      matched: sum(matched.map(m => m.line)),
      extra: sum(extra),
      discounts: sum(discounts),
    },
  };
}

export const SEED_LIST_TEXT = [
  'פירות וירקות', 'טחינה הר ברכה', 'ביצים', 'חלב', 'נקניק פרוס דק דק', 'קוטג׳ ×5', 'מילקי טופ', 'דגנה בר', 'ספריי ניקוי כללי', 'עוגיות חיוכים',
].join('\n');
export const SEED_DEPT = { 'פירות וירקות': 'produce', 'נקניק פרוס דק דק': 'deli', 'דגנה בר': 'pantry', 'עוגיות חיוכים': 'pantry', 'טחינה הר ברכה': 'pantry', 'מילקי טופ': 'dairy' };
export function seedItems(addedBy = 'יעלי') {
  return parseListText(SEED_LIST_TEXT).map((it, i) => ({
    id: 'seed-' + (i + 1), name: it.name, qty: it.qty, dept: SEED_DEPT[it.name] || suggestDept(it.name),
    addedBy, addedAt: Date.parse('2026-11-21T14:58:00+02:00') + i, inCart: false, note: '',
  }));
}
export const RECEIPT_EXAMPLE = `חנות: רמי לוי
תאריך: 2026-11-21
חלב תנובה 3% | 1 | 6.90
ביצים L 12 יח | 1 | 14.50
קוטג 5% | 5 | 35.00
נקניק הודו פרוס | 1 | 18.90
במבה אסם 80 גרם | 2 | 9.80
סה"כ 85.10`;
