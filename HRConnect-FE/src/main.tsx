import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';

// After a new deploy the hashed chunks of the previous build are gone, so an open tab fails to load
// the next lazy page ("Failed to fetch dynamically imported module"). Reload once to get the new
// index.html; the timestamp guard stops a reload loop if the chunk is really missing.
const RELOAD_KEY = 'hrconnect:chunk-reload-at';
window.addEventListener('vite:preloadError', (event) => {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
  } catch {
    // sessionStorage unavailable: fall through and reload once
  }
  if (Date.now() - last < 10_000) return;
  event.preventDefault();
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // ignore
  }
  window.location.reload();
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
