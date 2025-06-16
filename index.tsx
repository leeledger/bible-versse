
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- KakaoTalk in-app browser detection and redirection code start ---
const kakaoPattern = /KAKAOTALK/i.test(navigator.userAgent);
if (kakaoPattern) {
  // IMPORTANT:
  // 1. Replace 'YOUR_APP_SCHEME_OR_DOMAIN_HERE' with your actual app scheme or domain to open externally.
  // 2. This intent URL is specific to Android.
  //    For iOS, you'll need to use Universal Links or a custom URL scheme.
  // 3. To force open in an external browser like Chrome on Android, you can add package=com.android.chrome.
  //    Example: 'intent://YOUR_APP_SCHEME_OR_DOMAIN_HERE#Intent;scheme=http;package=com.android.chrome;end';
  //    If using a custom app scheme: 'yourappsCUSTOMscheme://yourpath'
  window.location.href = 'intent://YOUR_APP_SCHEME_OR_DOMAIN_HERE#Intent;scheme=http;end';
}
// --- KakaoTalk in-app browser detection and redirection code end ---

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
    