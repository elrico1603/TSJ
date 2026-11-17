import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import { BUILD_ID, BUILD_TIMESTAMP, HAS_FORM_DATA_FIX, CURRENT_VERSION_STRING } from './version';

// The sandbox is available ONLY on an actual Netlify pull-request deploy
// preview. This route does not import the production App or Firebase client.
const hostname=window.location.hostname.toLowerCase();
const isDeployPreview=/^deploy-preview-[0-9]+--/.test(hostname) && hostname.endsWith('.netlify.app');
const isUserDemo=isDeployPreview && new URLSearchParams(window.location.search).get('demo')==='user-admin';
const App=lazy(()=>import('./App.tsx'));
const UserManagementDemo=lazy(()=>import('./components/UserManagementDemo'));

console.log('[TSHUB BUILD]', {
  version: CURRENT_VERSION_STRING,
  buildId: BUILD_ID,
  buildTimestamp: BUILD_TIMESTAMP,
  hasFormDataFix: HAS_FORM_DATA_FIX,
  isUserDemo
});

if (!isUserDemo && 'serviceWorker' in navigator) {
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
    <Suspense fallback={<div style={{padding:32,color:'#fff',background:'#111',minHeight:'100vh'}}>Loading TS Hub...</div>}>
      {isUserDemo ? <UserManagementDemo/> : <App/>}
    </Suspense>
  </StrictMode>,
);
