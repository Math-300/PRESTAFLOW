// Primitivo de pestañas controlado (estilo underline).
// Extraído del patrón de SettingsView.tsx:176-211, genericizado con tokens.
// Componente controlado: el padre gestiona activeKey y onChange.
import React from 'react';
import { cn } from '../../utils/cn';

interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeKey, onChange }) => {
  return (
    <div
      role="tablist"
      className="flex overflow-x-auto flex-nowrap gap-4 border-b border-fg/10 no-scrollbar"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex items-center gap-1.5 pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
