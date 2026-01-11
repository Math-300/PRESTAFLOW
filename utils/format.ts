
// Currency and Number Formatters
export const formatNumberWithDots = (value: string | number) => {
  if (value === '' || value === undefined || value === null) return '';
  const numStr = value.toString().replace(/\D/g, '');
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const parseCurrency = (value: string) => {
  if (!value) return 0;
  // Security: Ensure we only parse safe number strings
  const cleaned = value.toString().replace(/\./g, '');
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

export const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
};

export const getErrorMessage = (error: any): string => {
  if (!error) return 'Ocurrió un error inesperado.';
  
  // Clean string errors
  if (typeof error === 'string') return error;

  // Handle Supabase/Postgres specific errors securely
  // We explicitly check for known codes to give user-friendly messages
  // preventing raw SQL dumps in the UI.
  if (error?.code) {
      switch(error.code) {
          case '23505': return 'Este registro ya existe (Duplicado).';
          case '23503': return 'Operación denegada: El registro está vinculado a otros datos.';
          case '42501': return 'Permiso denegado: No tienes autorización para esta acción.';
          case 'PGRST116': return 'No se encontraron resultados válidos.';
      }
  }

  if (error instanceof Error) return error.message;
  
  if (error?.message) return error.message;
  if (error?.error_description) return error.error_description;
  
  // Fallback for complex objects: Don't show JSON to user
  return 'Error de sistema. Contacte a soporte si persiste.';
};

// ID Generators and Date Helpers
export const generateId = () => {
    // Cryptographically strong random values if available, else fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substr(2, 9);
};

export const getToday = () => new Date().toISOString().split('T')[0];
