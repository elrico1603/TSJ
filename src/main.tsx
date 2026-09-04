import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BUILD_ID, BUILD_TIMESTAMP, HAS_FORM_DATA_FIX, CURRENT_VERSION_STRING } from './version';

console.log('[TSHUB BUILD]', {
  version: CURRENT_VERSION_STRING,
  buildId: BUILD_ID,
  buildTimestamp: BUILD_TIMESTAMP,
  hasFormDataFix: HAS_FORM_DATA_FIX
});

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered successfully with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

