import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SEGURIDAD: NO inyectar API keys en el bundle del cliente. Las claves de IA
// viven en `settings` (por organización) y se usan server-side vía Edge Function.
// Las únicas variables expuestas al cliente son las VITE_SUPABASE_* (anon key,
// pública por diseño y protegida por RLS).
export default defineConfig(({ mode }) => {
    const isProd = mode === 'production';
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
      },
      // En producción elimina console.* y debugger para no filtrar datos al navegador.
      esbuild: isProd ? { drop: ['console', 'debugger'] } : {},
      build: {
        rollupOptions: {
          output: {
            // Separa recharts (pesado) en su propio chunk para carga independiente.
            manualChunks: {
              recharts: ['recharts'],
            },
          },
        },
      },
    };
});
