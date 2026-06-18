
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';

import { DataProvider } from './contexts/DataContext';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <OrganizationProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </OrganizationProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// PWA: Service Worker Registration + auto-actualización
// Evita que los usuarios queden atascados con caché obsoleta tras un deploy:
// cuando hay una versión nueva del SW, se activa y la página se recarga una sola vez.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Solo auto-recarga en ACTUALIZACIONES (ya había un SW controlando), nunca en la
    // primera instalación, para no provocar un bucle de recargas en la primera visita.
    if (navigator.serviceWorker.controller) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Si ya hay un SW nuevo esperando, actívalo de inmediato.
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      // Detecta versiones nuevas y las activa en cuanto terminan de instalarse.
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(err => console.log('SW registration failed:', err));
  });
}
