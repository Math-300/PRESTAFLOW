// Primitivo reutilizable de botón. Variantes semánticas + tamaños + estado de carga.
// Consume los tokens de diseño (no hardcodea slate/white).
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  children,
  className,
  disabled,
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:   'bg-primary text-white hover:opacity-90 active:opacity-80',
    secondary: 'bg-surface text-fg border border-fg/10 hover:bg-surface-2 active:bg-surface-2',
    danger:    'bg-danger text-white hover:opacity-90 active:opacity-80',
    ghost:     'bg-transparent text-fg hover:bg-fg/5 active:bg-fg/10',
  };

  const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'h-8  px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-5 text-base',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={isDisabled}
      {...rest}
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
    </button>
  );
};
