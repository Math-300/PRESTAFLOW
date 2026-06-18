// Primitivo de modal accesible. Unifica el patrón de overlay repetido en ~10 sitios.
// Cierra al hacer clic en el overlay, al pulsar Escape y bloquea el scroll del body.
import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
}

const sizes: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}) => {
  // Cierre por tecla Escape.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  // Bloqueo de scroll del body y listener de teclado.
  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    /* Overlay: cierra al clic */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Panel: stopPropagation para no cerrar al clic interno */}
      <div
        className={cn(
          'bg-surface rounded-2xl shadow-pop w-full flex flex-col',
          'max-h-[90vh] overflow-hidden',
          sizes[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title !== undefined) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-fg/8 shrink-0">
            <h2 id="modal-title" className="text-lg font-bold text-fg">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-fg/5 transition-colors"
              aria-label="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Contenido */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {children}
        </div>

        {/* Footer opcional */}
        {footer && (
          <div className="px-5 py-4 border-t border-fg/8 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
