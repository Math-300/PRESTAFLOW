
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

// PWA deshabilitada: el service worker causaba recargas dobles y no era la causa
// del problema real (era la BD de Supabase). Limpiamos cualquier SW y caché previos
// para que ningún usuario quede con un worker viejo recargando la página.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => regs.forEach(reg => reg.unregister()))
    .catch(() => {});
  if (window.caches) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
  }
}
