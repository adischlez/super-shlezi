// Storage layer with two backends sharing one interface:
//   createLocalBackend(familyCode)         -> localStorage only
//   createFirebaseBackend(config, code)    -> Firestore (real-time), anonymous auth
// Interface: { kind, start(onData, onStatus), setItem, delItem, setTrip, delTrip, setBarcode, delBarcode, stop() }
// onData receives {items?, trips?, barcodes?}: each a map id -> object (the full collection).

const COLLS = ['items', 'trips', 'barcodes'];
const FB_VERSION = '10.14.1';
const FB_BASE = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
const clean = (o) => JSON.parse(JSON.stringify(o));

export function localKey(code) { return 'ss:data:' + code; }
export function readLocal(code) {
  try {
    const d = JSON.parse(localStorage.getItem(localKey(code)) || '{}');
    return { items: d.items || {}, trips: d.trips || {}, barcodes: d.barcodes || {} };
  } catch { return { items: {}, trips: {}, barcodes: {} }; }
}

export function createLocalBackend(code) {
  let data = readLocal(code), onData = () => {};
  const persist = () => { try { localStorage.setItem(localKey(code), JSON.stringify(data)); } catch (e) { console.warn(e); } };
  const emit = (c) => onData({ [c]: { ...data[c] } });
  const put = (c, id, obj) => { data[c][id] = clean(obj); persist(); emit(c); };
  const del = (c, id) => { delete data[c][id]; persist(); emit(c); };
  const onStorage = (e) => { if (e.key === localKey(code)) { data = readLocal(code); COLLS.forEach(emit); } };
  return {
    kind: 'local',
    async start(cb, onStatus) {
      onData = cb; onStatus && onStatus({ state: 'local' });
      window.addEventListener('storage', onStorage);
      cb({ items: { ...data.items }, trips: { ...data.trips }, barcodes: { ...data.barcodes } });
    },
    setItem: (o) => put('items', o.id, o), delItem: (id) => del('items', id),
    setTrip: (o) => put('trips', o.id, o), delTrip: (id) => del('trips', id),
    setBarcode: (o) => put('barcodes', o.code, o), delBarcode: (c) => del('barcodes', c),
    stop() { window.removeEventListener('storage', onStorage); },
  };
}

export async function createFirebaseBackend(config, code) {
  const [{ initializeApp, getApps, deleteApp }, authMod, fs] = await Promise.all([
    import(FB_BASE + 'firebase-app.js'),
    import(FB_BASE + 'firebase-auth.js'),
    import(FB_BASE + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(config, 'ss-' + Date.now());
  const auth = authMod.getAuth(app);
  await authMod.signInAnonymously(auth);
  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch (e) { db = fs.getFirestore(app); }
  const col = (c) => fs.collection(db, 'families', code, c);
  const ref = (c, id) => fs.doc(db, 'families', code, c, id);
  const unsubs = [];
  const wrap = (p) => p.catch(e => { console.error(e); window.dispatchEvent(new CustomEvent('ss-error', { detail: e })); });
  return {
    kind: 'firebase',
    async start(cb, onStatus) {
      await Promise.all(COLLS.map((c) => new Promise((resolve, reject) => {
        let first = true;
        unsubs.push(fs.onSnapshot(col(c), { includeMetadataChanges: true }, (snap) => {
          const m = {};
          snap.forEach(d => { m[d.id] = d.data(); });
          cb({ [c]: m });
          onStatus && onStatus({ state: snap.metadata.fromCache && !snap.metadata.hasPendingWrites ? 'cache' : 'online' });
          if (first) { first = false; resolve(); }
        }, (err) => { onStatus && onStatus({ state: 'error', error: err }); if (first) reject(err); }));
      })));
    },
    setItem: (o) => wrap(fs.setDoc(ref('items', o.id), clean(o))),
    delItem: (id) => wrap(fs.deleteDoc(ref('items', id))),
    setTrip: (o) => wrap(fs.setDoc(ref('trips', o.id), clean(o))),
    delTrip: (id) => wrap(fs.deleteDoc(ref('trips', id))),
    setBarcode: (o) => wrap(fs.setDoc(ref('barcodes', o.code), clean(o))),
    delBarcode: (c) => wrap(fs.deleteDoc(ref('barcodes', c))),
    stop() { unsubs.forEach(u => u()); try { deleteApp(app); } catch {} },
  };
}

/** Pull apiKey/authDomain/projectId/... out of pasted JSON or a JS snippet. */
export function parseFirebaseConfig(text) {
  const cfg = {};
  const re = /["']?(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId|measurementId)["']?\s*:\s*["']([^"']+)["']/g;
  let m; while ((m = re.exec(text || ''))) cfg[m[1]] = m[2];
  return cfg.apiKey && cfg.projectId && cfg.appId ? cfg : null;
}
