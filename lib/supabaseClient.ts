
import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURACIÓN DE SUPABASE
// ------------------------------------------------------------------
// Se recomienda configurar estas variables en un archivo .env
// VITE_SUPABASE_URL=tu_url_de_supabase
// VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
// ------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Exportamos flag para que la App sepa si puede iniciar
export const isConfigured = !!supabaseUrl && !!supabaseKey && supabaseKey.startsWith('eyJ');

if (!isConfigured) {
    console.error('🔴 ERROR DE CONFIGURACIÓN: No se encontraron las credenciales de Supabase o son inválidas.');
    console.warn('Por favor, configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env');
} else {
    console.log('✅ Supabase Client: Inicializado correctamente');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'prestaflow-auth-token'
  }
});
