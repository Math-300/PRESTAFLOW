import React, { useEffect, useState } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { getReceiptSignedUrl } from '../../utils/receipts';

interface ReceiptImageProps {
  /** Valor almacenado en transaction.receiptUrl (path nuevo o URL antigua). */
  stored?: string | null;
  alt?: string;
  className?: string;
}

/**
 * Muestra un recibo desde el bucket privado resolviendo una signed URL temporal.
 * Maneja estados de carga y error sin exponer URLs públicas permanentes.
 */
export const ReceiptImage: React.FC<ReceiptImageProps> = ({ stored, alt = 'Soporte', className }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    getReceiptSignedUrl(stored)
      .then((u) => {
        if (!active) return;
        if (u) { setUrl(u); setStatus('ready'); }
        else { setStatus('error'); }
      })
      .catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, [stored]);

  if (status === 'loading') {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className || ''}`}>
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (status === 'error' || !url) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className || ''}`}>
        <ImageIcon className="w-5 h-5" />
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} />;
};
