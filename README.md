# 🛒 סופר שלזי / Super Shlezi

**עברית למטה · English below**

---

## עברית

אפליקציית ווב משפחתית (PWA) לרשימת קניות משותפת, בעברית ומימין לשמאל. נפתחת מהטלפון כמו אפליקציה רגילה (אייקון במסך הבית), עובדת גם בלי אינטרנט, ופועלת באייפון (Safari) ובאנדרואיד (Chrome).

### מה היא יודעת לעשות
- **רשימה משותפת** מחולקת למחלקות בסופר (פירות וירקות, מוצרי חלב וביצים, מעדנייה, מזווה, ניקיון ועוד), עם כמות, מי הוסיף, עריכה ומחיקה (עם "בטל"), והצעה אוטומטית של מחלקה.
- **"📷 רשימה מתמונה"**: מצלמים דף כתוב בכתב יד (או בוחרים מהגלריה). Gemini מפענח את המוצרים, ואז אפשר לערוך ולאשר לפני ההוספה. שורות מחוקות מדולגות. אם הזיהוי נכשל, אפשר לייבא כטקסט או לשלוח את התמונה לקבוצת הוואטסאפ ״סופר שלזי״.
- **"בעגלה"**: סימון כל מוצר בזמן הקנייה, עם פס התקדמות.
- **סריקת ברקוד** במצלמה (BarcodeDetector, ובדפדפנים בלי תמיכה – ספריית html5-qrcode). סריקה מסמנת מוצר מתאים בעגלה או מוסיפה אותו. הקשר ברקוד↔מוצר נשמר, ושם המוצר נשלף מ-Open Food Facts כשאפשר. אפשר גם להקליד ברקוד ידנית.
- **קניות**: "התחלת קנייה" שומרת תצלום של הרשימה שנכנסנו איתה לסופר. בסיום קנייה מדביקים את שורות החשבונית ומקבלים השוואה: **נקנו / חסרים / עודפים בחשבונית**, עם סכומים והתאמה מטושטשת בעברית (שמות שונים, יחיד/רבים, כמויות). אפשר לשייך ידנית שורה לפריט.
- **היסטוריית קניות**.
- **סנכרון משפחתי** בזמן אמת דרך Firebase Firestore, או מצב מקומי (localStorage) עד שמגדירים Firebase.

### פורמט ייבוא החשבונית
שורה לכל מוצר: `שם | כמות | מחיר` (המחיר הוא סה״כ לשורה):
```
חנות: רמי לוי
תאריך: 2026-11-21
חלב תנובה 3% | 1 | 6.90
קוטג 5% | 5 | 35.00
סה"כ 85.10
```
אפשר גם בצורה חופשית ("קוטג 5% ×5 35.00"), או JSON:
```json
{"store":"רמי לוי","date":"2026-11-21","total":85.1,
 "lines":[{"name":"קוטג 5%","qty":5,"price":35,"barcode":"7290000000001"}]}
```
שורת הנחה: מחיר שלילי או המילה "הנחה".


### ייבוא מתמונה (Gemini)
הפענוח נעשה ב-Firebase AI Logic עם Gemini Developer API (תוכנית Spark, בחינם). כדי להפעיל את פענוח כתב היד (פעם אחת): קבלו את התנאים ב-https://console.cloud.google.com/terms/generative-language-api?project=super-shlezi ואז בקונסול של Firebase, AI Services → AI Logic → Get started, בחרו Gemini Developer API (האפשרות החינמית). אחרי זה האפליקציה כבר יודעת לקרוא תמונות, בלי עדכון נוסף. אם קריאת התמונה נכשלת, אפשר לייבא כטקסט או לשלוח את התמונה לקבוצת הוואטסאפ ״סופר שלזי״. יש הגבלה של 10 סריקות ביום לכל טלפון (המפתח של האפליקציה פומבי; App Check לא הופעל כדי לא לשבור את השימוש באייפון כ-PWA).

### סנכרון משפחתי
האפליקציה כבר מחוברת לפרויקט Firebase **super-shlezi** (תוכנית Spark, בחינם). כל מי שפותח את https://adischlez.github.io/super-shlezi/ מצטרף אוטומטית למשפחת שלזי (קוד `shlezi-family`) ורואה את אותה רשימה בזמן אמת. אין צורך להדביק הגדרות בטלפון. כדי לפתוח רשימה נפרדת: הגדרות → משפחה חדשה, או הצטרפות בקוד.

ההוראות הבאות נשמרות למקרה שצריך להקים פרויקט מחדש או לפרוס מחדש את הכללים (`npx firebase-tools deploy --only firestore --project super-shlezi` מתוך הריפו).

### הפעלת סנכרון משפחתי (Firebase) – חד פעמי, כ-10 דקות
1. היכנסו ל-[console.firebase.google.com](https://console.firebase.google.com) → **Add project** (אפשר בלי Google Analytics).
2. **Build → Firestore Database → Create database**. בחרו מיקום (למשל `europe-west1`) ו-**Production mode**.
3. לשונית **Rules**: מחקו את התוכן, הדביקו את הקובץ [`firestore.rules`](firestore.rules) ולחצו **Publish**.
4. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save**.
5. **Project settings (גלגל שיניים) → Your apps → `</>` Web** → תנו שם (למשל "super-shlezi"), **Register app** (בלי Hosting). יוצג אובייקט `firebaseConfig`.
6. באפליקציה: **הגדרות → סנכרון משפחתי** → הדביקו את ה-`firebaseConfig` → **שמירה וחיבור**. הרשימה וההיסטוריה שבטלפון יועברו לענן.
   - לחלופין, מלאו את `config.js` בקוד (`window.FIREBASE_CONFIG = {...}`) ועשו commit.
7. **הגדרות → שיתוף קישור הצטרפות**, ושלחו את הקישור לשאר המשפחה (בוואטסאפ). הקישור כולל את קוד המשפחה ואת הגדרות Firebase, ומי שפותח אותו מצטרף אוטומטית. כדי להוסיף לבית את האפליקציה: Safari → שיתוף → "הוסף למסך הבית"; Chrome → תפריט → "התקנת אפליקציה".

הערות: הגדרות Firebase לווב אינן סוד (האבטחה נעשית דרך הכללים). קוד המשפחה הוא מחרוזת אקראית ארוכה, ומי שאין לו אותו לא יכול לגשת לנתונים. הכללים אינם מאפשרים לרשום את כל המשפחות.

### פיתוח
אתר סטטי בלבד, בלי build. להרצה מקומית: `python3 -m http.server 8080` ופתיחת `http://localhost:8080`. בדיקות לוגיקה: `node --test tests/logic.test.mjs`. הפריסה: GitHub Pages מה-branch `main`. בכל שינוי בקבצי הליבה כדאי להעלות את `VERSION` ב-`sw.js`.

---

## English

A family PWA for a shared shopping list: Hebrew/RTL, mobile-first, installable, offline-capable, works on iPhone Safari and Android Chrome.

**Features**: shared list grouped by supermarket department (quantity, who added, edit/delete with undo, auto department suggestion) · **photo of a handwritten list** ("📷 רשימה מתמונה"): Gemini reads items (handwritten or typed, including several gallery screenshots at once) for review before adding (crossed-out lines are skipped; identical names are merged). If AI is unavailable, import as text or send the photo to the family WhatsApp group · per-item "in cart" with progress · camera barcode scanning (BarcodeDetector, html5-qrcode fallback, manual entry, learned barcode→item mapping, Open Food Facts name lookup) · shopping trips (start a trip to snapshot the list; paste/enter receipt lines; fuzzy Hebrew matching into *matched / missing / extra on receipt* with totals; manual line assignment) · trip history · real-time family sync via Firebase Firestore with a localStorage fallback.

**Receipt format**: one line per product `name | qty | price` (price = line total), optional `store:` / `date:` / `total` lines, or free text (`קוטג 5% ×5 35.00`), or JSON `{"store","date","total","lines":[{"name","qty","price","barcode"}]}`. Negative price or the word "הנחה" marks a discount line.



### Photo import (Gemini)
The list-from-photo feature uses [Firebase AI Logic](https://firebase.google.com/docs/ai-logic/analyze-images) with the **Gemini Developer API** (Spark / free tier; no Vertex AI). The app tries `gemini-2.5-flash`, then `gemini-3.8-flash` / `gemini-4-hydrogen`. **Setup still needed (one-time, Adi):** the Gemini Developer API terms have not been accepted yet, so photo parsing cannot reach Gemini until this is done. Open and accept:

1. https://console.cloud.google.com/terms/generative-language-api?project=super-shlezi
2. Then in the Firebase console go to [AI Services → AI Logic](https://console.firebase.google.com/project/super-shlezi/ailogic/), click **Get started**, choose **Gemini Developer API** (the free Spark-plan option — not Vertex AI). This provisions the project so the already-deployed app can call Gemini. No app update is required afterwards.

Until then, the button still appears and falls back to text import (or sending the photo to the family WhatsApp group).

**Abuse limits:** the Firebase web API key is public. App Check (reCAPTCHA) was not enabled, so a standalone iPhone PWA wouldn't be blocked by a missing/unverified reCAPTCHA site key. Protection is anonymous auth + a client cap of 10 photo scans per phone per day. App Check can be added later from the [Firebase console](https://console.firebase.google.com/project/super-shlezi/appcheck) if desired.

### Family sync
The live app is already connected to Firebase project **super-shlezi** (Spark / free tier). Anyone who opens https://adischlez.github.io/super-shlezi/ automatically joins the Schlesinger family (`shlezi-family`) and sees the shared list in real time. No per-phone setup. Use Settings → New family (or join by code) for a separate list.

The steps below are kept in case the project needs to be recreated, or to redeploy rules: `npx firebase-tools deploy --only firestore --project super-shlezi`.

### Enabling family sync (Firebase), one-time, ~10 minutes
1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (Analytics not needed).
2. **Build → Firestore Database → Create database** (pick a region, *Production mode*).
3. **Rules** tab → replace everything with [`firestore.rules`](firestore.rules) → **Publish**.
4. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save**.
5. **Project settings → Your apps → Web (`</>`)** → register an app (skip Hosting) → copy the `firebaseConfig` object.
6. In the app: **Settings → Family sync** → paste the config → **Save & connect**. Existing local data is migrated to the cloud (same IDs, so nothing duplicates). Or fill `config.js` (`window.FIREBASE_CONFIG = {...}`) and commit.
7. **Settings → Share join link** and send it to the family. The link contains the family code and the Firebase web config; opening it joins the family automatically. Add to home screen: Safari → Share → *Add to Home Screen*; Chrome → menu → *Install app*.

Notes: Firebase web config is not a secret; security comes from the rules plus the long random family code (12 chars), and the rules forbid listing families. Until Firebase is configured the app runs in **local mode** (a small banner says so) and data stays on that phone.

### Development
Static site, no build step: `python3 -m http.server 8080`. Logic tests: `node --test tests/logic.test.mjs`. Deployed from `main` via GitHub Pages. Bump `VERSION` in `sw.js` when you change core files.

### Data model (Firestore)
`families/{code}/items/{id}` · `families/{code}/trips/{id}` · `families/{code}/barcodes/{ean}`
