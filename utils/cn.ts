// Helper de composición de clases: combina clsx (condicionales) +
// tailwind-merge (deduplicación inteligente de clases Tailwind).
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
