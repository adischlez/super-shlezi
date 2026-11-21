// Baked-in Firebase config: every phone that opens the live app
// (https://adischlez.github.io/super-shlezi/) connects to the same project.
// This web config is public by design; access is enforced by Auth + Firestore rules.
// DEFAULT_FAMILY_CODE is the Schlesinger family. Opening the plain URL joins it.
// To use a different family, use הגדרות → משפחה חדשה / הצטרפות בקוד.

window.DEFAULT_FAMILY_CODE = 'shlezi-family';

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBkK7x1KwCHpToAIDGkkr8uNIsnlqNg-h0",
  authDomain: "super-shlezi.firebaseapp.com",
  projectId: "super-shlezi",
  storageBucket: "super-shlezi.firebasestorage.app",
  messagingSenderId: "712874947859",
  appId: "1:712874947859:web:a6e673a261ee31671b16e6"
};
