import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SEGURIDAD: NO inyectar API keys en el bundle del cliente. Las claves de IA
// viven en `settings` (por organización) y se usan server-side vía Edge Function.
// Las únicas variables expuestas al cliente son las VITE_SUPABASE_* (anon key,
// pública por diseño y protegida por RLS).
export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
