
import React, { useState } from 'react';
import { Edit2 } from 'lucide-react';
import { formatNumberWithDots } from '../../utils/format';

interface EditableFieldProps {
  label: string;
  value: string;
  icon?: any;
  onSave?: (newVal: string) => void;
  type?: 'text' | 'date' | 'number' | 'tel';
  className?: string;
  readOnly?: boolean;
  placeholder?: string;
  isCurrency?: boolean;
}

export const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  icon: Icon,
  onSave,
  type = 'text',
  className = '',
  readOnly = false,
  placeholder = '-',
  isCurrency = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleBlur = () => {
    setIsEditing(false);
    if (tempValue !== value && onSave) {
      onSave(tempValue);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCurrency) {
      setTempValue(formatNumberWithDots(e.target.value));
    } else {
      setTempValue(e.target.value);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    if (e.key === 'Escape') {
      setTempValue(value);
      setIsEditing(false);
    }
  };

  const inputBaseClasses = "w-full bg-white border-b-2 border-blue-500 px-1 py-2 text-base md:text-sm text-slate-800 outline-none transition-all";

  if (readOnly) {
    return (
      <div className={`flex flex-col group ${className}`}>
        <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
          {Icon && <Icon size={10} />} {label}
        </span>
        <div className="text-base md:text-sm font-bold text-slate-700 px-1 py-2 md:py-0.5 min-h-[48px] md:min-h-[24px] flex items-center">
          {isCurrency && value ? `$ ${formatNumberWithDots(value)}` : (value || <span className="text-slate-300 font-normal italic">{placeholder}</span>)}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col group ${className}`}>
      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
        {Icon && <Icon size={10} />} {label}
      </span>
      {isEditing ? (
        <div className="relative">
          {isCurrency && <span className="absolute left-0 top-0.5 text-slate-400 font-bold text-xs">$</span>}
          <input
            autoFocus
            type={isCurrency ? 'text' : type}
            inputMode={isCurrency || type === 'number' ? 'decimal' : type === 'tel' ? 'tel' : 'text'}
            value={tempValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`${inputBaseClasses} ${isCurrency ? 'pl-3' : ''}`}
          />
        </div>
      ) : (
        <div
          onClick={() => {
            setTempValue(isCurrency ? formatNumberWithDots(value) : value);
            setIsEditing(true);
          }}
          className="text-base md:text-sm font-bold text-slate-700 cursor-pointer hover:bg-slate-100 hover:text-blue-700 px-1 -ml-1 py-2 md:py-0.5 rounded transition-colors flex items-center gap-2 min-h-[48px] md:min-h-[24px]"
          title="Clic para editar"
        >
          <span className="truncate">
            {isCurrency && value ? `$ ${formatNumberWithDots(value)}` : (value || <span className="text-slate-300 font-normal italic">{placeholder}</span>)}
          </span>
          <Edit2 size={12} className="opacity-40 md:opacity-0 group-hover:opacity-40 text-blue-400" />
        </div>
      )}
    </div>
  );
};
