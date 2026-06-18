// Primitivo de input con label, icono izquierdo y mensaje de error.
// forwardRef permite foco programático desde el componente padre.
import React from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, leftIcon, error, className, id, ...rest }, ref) => {
    // Genera un id accesible si no se provee uno.
    const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-fg"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              // Base
              'w-full bg-surface text-fg placeholder:text-muted',
              'border border-fg/15 rounded-2xl p-3 outline-none',
              'transition-all duration-150',
              // Focus: ring con color primary
              'focus:ring-4 focus:ring-primary/20 focus:border-primary',
              // Error
              error && 'border-danger focus:ring-danger/20 focus:border-danger',
              // Icono izquierdo → padding extra
              leftIcon && 'pl-10',
              className,
            )}
            {...rest}
          />
        </div>

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
