// Contexto centralizado de tema (claro / oscuro).
// Lee el estado inicial desde el DOM (el script anti-FOUC en index.html ya
// aplicó la clase .dark si correspondía) y persiste la preferencia en
// localStorage con la misma clave que usaba App.tsx.
import React, { createContext, useCallback, useContext, useState } from 'react';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Inicializa leyendo el DOM — el script anti-FOUC ya puso .dark si aplica.
  const [isDark, setIsDark] = useState<boolean>(
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false
  );

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      try {
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem('prestaFlow_theme', next ? 'dark' : 'light');
      } catch (e) { /* noop */ }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  }
  return ctx;
}
