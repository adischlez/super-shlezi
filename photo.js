// Handwritten shopping-list photo → structured items, via Firebase AI Logic
// (Gemini Developer API, GoogleAIBackend). Official pattern:
// https://firebase.google.com/docs/ai-logic/analyze-images
// https://firebase.google.com/docs/ai-logic/generate-structured-output

import { DEPARTMENTS, suggestDept } from './logic.js';

export const AI_MODELS = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-4-hydrogen', 'gemini-flash-latest'];
export const DAILY_LIMIT = 10;
const FB_VERSION = '13.4.0';
const FB_BASE = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
const DEPT_IDS = DEPARTMENTS.map(d => d.id);

export function quotaKey(now = new Date()) {
  // Calendar day in the family's zone (Asia/Jerusalem).
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return 'ss:ai-quota:' + parts;
}
export function quotaUsed() {
  try { return Math.max(0, parseInt(localStorage.getItem(quotaKey()) || '0', 10) || 0); } catch { return 0; }
}
export function remainQuota() { return Math.max(0, DAILY_LIMIT - quotaUsed()); }
function bumpQuota() {
  const k = quotaKey();
  try { localStorage.setItem(k, String(quotaUsed() + 1)); } catch {}
}

export function hebrewAiError(err, fallbackKind) {
  if (fallbackKind === 'quota') return { title: 'הגעתם למכסה היומית', body: `אפשר לצלם עד ${DAILY_LIMIT} רשימות ביום מכל טלפון (המפתח של האפליקציה פומבי, לכן יש הגבלה). אפשר לייבא את הרשימה כטקסט, או לשלוח את התמונה לקבוצת הוואטסאפ ״סופר שלזי״ והעוזר המשפחתי יתמלל אותה.` };
  const raw = String(err?.code || err?.message || err || '');
  const low = raw.toLowerCase();
  if (/quota|resource.?exhausted|429|rate.?limit|too many/i.test(low))
    return { title: 'השירות עמוס כרגע', body: 'נסו שוב בעוד כמה דקות, או ייבאו את הרשימה כטקסט. אפשר גם לשלוח את התמונה לקבוצת הוואטסאפ ״סופר שלזי״.' };
  if (/permission|denied|403|failed.?precondition|api.+not.+enabled|tos|terms of service|billing|config not found|genai config/i.test(low))
    return { title: 'קריאת התמונה עדיין לא זמינה', body: 'אפשר לייבא את הרשימה כטקסט בינתיים, או לשלוח את התמונה לקבוצת הוואטסאפ ״סופר שלזי״ והעוזר המשפחתי יתמלל אותה.' };
  if (/unauth|auth\//i.test(low))
    return { title: 'צריך חיבור משפחתי', body: 'התחברו לסנכרון המשפחתי בהגדרות, או ייבאו את הרשימה כטקסט.' };
  if (/network|offline|failed to fetch|timeout|abort/i.test(low))
    return { title: 'אין חיבור לרשת', body: 'בדקו את החיבור ונסו שוב. בינתיים אפשר לייבא כטקסט או לשלוח את התמונה לקבוצת הוואטסאפ.' };
  if (/no.?items|empty/i.test(low))
    return { title: 'לא זיהינו מוצרים', body: 'נסו לצלם שוב באור טוב יותר, או ייבאו את הרשימה כטקסט.' };
  return { title: 'לא הצלחנו לקרוא את התמונה', body: 'נסו לצלם שוב, או ייבאו כטקסט. אפשר גם לשלוח את התמונה לקבוצת הוואטסאפ ״סופר שלזי״ והעוזר יתמלל אותה.' };
}

/** Downscale and re-encode as JPEG so iPhone photos stay small enough for inline data. */
export async function downscaleImage(file, maxEdge = 1600, quality = 0.82) {
  if (!file) throw new Error('no-file');
  let bitmap = null;
  try { bitmap = await createImageBitmap(file); } catch {}
  const src = bitmap || await loadImage(file);
  const w0 = src.width, h0 = src.height;
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  if (bitmap && bitmap.close) try { bitmap.close(); } catch {}
  const blob = await new Promise((res) => canvas.toBlob(b => res(b || null), 'image/jpeg', quality));
  if (!blob) throw new Error('encode-failed');
  const out = new File([blob], 'list.jpg', { type: 'image/jpeg' });
  return { file: out, url: URL.createObjectURL(blob), width: w, height: h };
}
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
async function fileToGenerativePart(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = String(reader.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { type: 'inlineData', inlineData: { data: base64, mimeType: file.type || 'image/jpeg' } };
}

function deptEnum() {
  return DEPT_IDS;
}
function listSchema(Schema) {
  return Schema.object({
    properties: {
      items: Schema.array({
        items: Schema.object({
          properties: {
            name: Schema.string(),
            qty: Schema.number(),
            dept: Schema.enumString({ enum: deptEnum() }),
            unclear: Schema.boolean(),
            note: Schema.string(),
          },
          optionalProperties: ['note'],
        }),
      }),
    },
  });
}

export function buildPrompt() {
  const depts = DEPARTMENTS.map(d => `${d.id} = ${d.name}`).join('\n');
  return `אתה עוזר שמפענח רשימת קניות בעברית שנכתבה בכתב יד (או הודפסה) על דף או פתק.

החזר JSON בלבד לפי הסכמה. כל שורה ברשימה היא מוצר.
כללים:
- name: שם המוצר בעברית, בלי כמות ובלי מחיר. תקן שגיאות כתיב ברורות, אבל אל תמציא מוצרים.
- qty: הכמות (מספר). אם לא צוינה כמות, השתמש ב-1. "קוטג׳ ×5" או "5 קוטג׳" = qty 5, name "קוטג׳".
- dept: מחלקה מהרשימה למטה בלבד.
- אם שורה מחוקה / עם קו חוצה / מסומנת כקנויה — דלג עליה לגמרי.
- אם מילה לא ברורה: בכל זאת נחש מה הכי סביר, סמן unclear=true, וכתוב ב-note את מה שנראה בתמונה.
- התעלם מכותרות, תאריכים, ציורים, ומלל שאינו מוצר.
- אם אין בכלל רשימת קניות, החזר items ריק.

מחלקות:
${depts}`;
}

export function normalizeParsed(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);
  const out = [];
  for (const it of items) {
    const name = String(it?.name || '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    let qty = Number(it.qty);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    qty = Math.min(999, Math.round(qty));
    let dept = DEPT_IDS.includes(it.dept) ? it.dept : suggestDept(name);
    out.push({ name, qty, dept, unclear: !!it.unclear, note: String(it.note || '').trim(), selected: true });
  }
  return out;
}

let _mods, _app;
async function loadAi(config) {
  if (!config) throw new Error('no-config');
  if (!_mods) {
    _mods = await Promise.all([
      import(FB_BASE + 'firebase-app.js'),
      import(FB_BASE + 'firebase-auth.js'),
      import(FB_BASE + 'firebase-ai.js'),
    ]);
  }
  const [appMod, authMod, aiMod] = _mods;
  if (!_app) {
    _app = appMod.getApps().find(a => a.name === 'ss-ai') || appMod.initializeApp(config, 'ss-ai');
  }
  const auth = authMod.getAuth(_app);
  if (!auth.currentUser) await authMod.signInAnonymously(auth);
  return { app: _app, auth, aiMod };
}

/**
 * @returns {Promise<{items: object[], model: string, raw: string}>}
 */
export async function parseListFromImage(file, config, opts = {}) {
  if (remainQuota() <= 0 && !opts.ignoreQuota) {
    const e = new Error('quota'); e.code = 'quota'; throw e;
  }
  const { app, aiMod } = await loadAi(config);
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = aiMod;
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const imagePart = await fileToGenerativePart(file);
  const prompt = buildPrompt();
  const models = opts.models || AI_MODELS;
  let lastErr;
  for (const modelName of models) {
    try {
      const model = getGenerativeModel(ai, {
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: listSchema(Schema),
          temperature: 0.2,
        },
      });
      const result = await model.generateContent([prompt, imagePart]);
      const text = result.response.text();
      let parsed;
      try { parsed = JSON.parse(text); }
      catch { throw new Error('bad-json'); }
      const items = normalizeParsed(parsed);
      bumpQuota();
      return { items, model: modelName, raw: text };
    } catch (err) {
      lastErr = err;
      const msg = String(err?.code || err?.message || err);
      // Try the next model only when this one is missing / unsupported.
      if (/not found|not supported|404|unknown model|invalid.*model/i.test(msg)) continue;
      throw err;
    }
  }
  throw lastErr || new Error('no-model');
}
