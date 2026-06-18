// Primitivo de tarjeta. Dos variantes: solid (superficie limpia) y glass (translúcida).
// Nota: glass solo para chrome fijo; no usarla en listas que scrollean (jank de blur).
import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'solid' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddings: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
};

export const Card: React.FC<CardProps> = ({
  variant = 'solid',
  padding = 'md',
  children,
  className,
  ...rest
}) => {
  const base = 'rounded-2xl';

  const variants: Record<NonNullable<CardProps['variant']>, string> = {
    solid: 'bg-surface shadow-card border border-fg/5',
    // Glassmorphism: backdrop-blur + fondo translúcido + borde translúcido.
    glass: 'bg-surface/70 backdrop-blur-md border border-fg/10 shadow-card',
  };

  return (
    <div
      className={cn(base, variants[variant], paddings[padding], className)}
      {...rest}
    >
      {children}
    </div>
  );
};
