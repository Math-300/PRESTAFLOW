
import React from 'react';
import { motion } from 'framer-motion';
import { Menu, Folder, Landmark, Settings, Keyboard, Wifi, Building2, Plus, ChevronDown, ChevronLeft } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface SidebarProps {
   isOpen: boolean;
   setIsOpen: (val: boolean) => void;
   currentView: string;
   onChangeView: (view: any) => void;
   companyName?: string;
   userRole?: UserRole | null;
   hideMoney?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, currentView, onChangeView, companyName, userRole, hideMoney }) => {
   const { organizations, currentOrg, switchOrganization, createOrganization } = useOrganization();
   const { user } = useAuth();
   const [showOrgMenu, setShowOrgMenu] = React.useState(false);

   // Fallback name if empty
   const displayName = currentOrg?.name || companyName || 'PrestaFlow';
   const initials = displayName.substring(0, 2).toUpperCase();

   // Check if user already owns an organization
   const ownsOrganization = organizations.some(o => o.owner_id === user?.id);

   const handleCreateOrg = async () => {
      const name = prompt("Nombre de la nueva organización:");
      if (name) {
         const result = await createOrganization(name);
         if (result.success) {
            setShowOrgMenu(false);
         } else {
            alert("Error: " + result.error);
         }
      }
   };

   // Base classes — glass effect on the sidebar chrome
   // Mobile: absolute/fixed, full height, z-30 (above content backdrop)
   // Desktop: relative, normal flow
   const containerClasses = `
    glass-effect text-slate-300 transition-all duration-300 flex flex-col z-30
    fixed md:relative inset-y-0 left-0
    border-r border-white/10 dark:border-slate-700/50
    ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20'}
  `;

   const navItems = [
      {
         key: 'CLIENTS_LIST',
         altKey: 'SINGLE_CLIENT',
         icon: <Folder size={20} />,
         label: 'Cartera',
         show: true,
      },
      {
         key: 'BANKS',
         altKey: null,
         icon: <Landmark size={20} />,
         label: 'Tesorería',
         show: !hideMoney,
      },
   ];

   return (
      <div className={containerClasses}>
         {/* HEADER / ORG SELECTOR */}
         <div className="p-4 flex flex-col border-b border-white/10 dark:border-slate-700/40 shrink-0 relative md:pt-4" style={{ paddingTop: 'calc(1rem + var(--safe-area-top))' }}>
            <div className="flex items-center justify-between h-12">
               {isOpen ? (
                  <div
                     className="flex items-center gap-3 cursor-pointer overflow-hidden flex-1 group"
                     onClick={() => setShowOrgMenu(!showOrgMenu)}
                  >
                     <div className="shrink-0">
                        <img src="/logo-dark.png" alt="PrestaFlow Logo" className="h-8 w-auto object-contain transition-transform group-hover:scale-105" />
                     </div>
                     <div className="flex flex-col overflow-hidden">
                        <h1 className="text-xs font-bold text-white/90 tracking-tight truncate group-hover:text-white transition-colors uppercase" title={displayName}>
                           {displayName}
                        </h1>
                        <div className="flex items-center text-[9px] text-white/40 uppercase font-bold tracking-wider">
                           <span>Cambiar</span>
                           <ChevronDown size={8} className="ml-1" />
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="cursor-pointer mx-auto group" onClick={() => setIsOpen(true)}>
                     <img src="/icon-light.png" alt="P" className="w-8 h-8 object-contain transition-transform group-hover:scale-110" />
                  </div>
               )}

               {/* Collapse Button (Only Desktop) or Close (Mobile) */}
               <button onClick={() => setIsOpen(!isOpen)} className="p-1.5 hover:bg-white/10 rounded-lg ml-1 text-white/50 hover:text-white/80 transition-colors mt-1">
                  {isOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
               </button>
            </div>

            {/* DROPDOWN MENU FOR ORGS */}
            {isOpen && showOrgMenu && (
               <div className="absolute top-full left-2 w-60 bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-pop border border-white/10 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-2 text-xs font-bold text-white/40 uppercase">Tus Organizaciones</div>
                  <div className="max-h-60 overflow-y-auto">
                     {organizations.map(org => (
                        <button
                           key={org.id}
                           onClick={() => { switchOrganization(org.id); setShowOrgMenu(false); }}
                           className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/10 transition-colors
                            ${currentOrg?.id === org.id ? 'bg-white/10 text-white font-bold' : 'text-white/60'}
                         `}
                        >
                           <Building2 size={14} /> {org.name}
                        </button>
                     ))}
                  </div>

                  {/* RESTRICTED CREATION BUTTON */}
                  {!ownsOrganization ? (
                     <button
                        onClick={handleCreateOrg}
                        className="w-full text-left px-3 py-3 text-sm flex items-center gap-2 text-primary hover:bg-white/10 transition-colors border-t border-white/10 font-bold"
                     >
                        <Plus size={14} /> Nueva Organización
                     </button>
                  ) : (
                     <div className="px-3 py-2 text-[10px] text-white/30 border-t border-white/10 text-center italic">
                        Plan actual limita a 1 org.
                     </div>
                  )}
               </div>
            )}
         </div>

         <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
            {navItems.map(item => {
               if (!item.show) return null;
               const isActive = currentView === item.key || currentView === item.altKey;
               return (
                  <motion.button
                     key={item.key}
                     onClick={() => onChangeView(item.key)}
                     whileHover={{ scale: 1.02 }}
                     whileTap={{ scale: 0.97 }}
                     transition={{ duration: 0.15 }}
                     className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${
                        isActive
                           ? 'bg-primary/80 text-white shadow-soft'
                           : 'hover:bg-white/10 text-white/50 hover:text-white/80'
                     }`}
                  >
                     {item.icon}
                     {isOpen && <span className="font-semibold text-sm">{item.label}</span>}
                  </motion.button>
               );
            })}

            <div className="w-full h-px bg-white/10 my-2"></div>

            <motion.button
               onClick={() => onChangeView('SETTINGS')}
               whileHover={{ scale: 1.02 }}
               whileTap={{ scale: 0.97 }}
               transition={{ duration: 0.15 }}
               className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${
                  currentView === 'SETTINGS'
                     ? 'bg-primary/80 text-white shadow-soft'
                     : 'hover:bg-white/10 text-white/50 hover:text-white/80'
               }`}
            >
               <Settings size={20} />
               {isOpen && <span className="font-semibold text-sm">Configuración</span>}
            </motion.button>
         </div>

         {isOpen && (
            <div className="p-4 text-xs text-white/30 text-center border-t border-white/10 hidden md:block">
               <div className="flex justify-center items-center gap-1 mb-1 opacity-50">
                  <Keyboard size={12} /> <span className="font-mono">F1: Nuevo Cliente</span>
               </div>
               <div className="mt-2 text-success font-bold flex items-center justify-center gap-1">
                  <Wifi size={10} /> CONECTADO
               </div>
               {userRole && (
                  <div className="mt-1 text-white/30 uppercase font-bold text-[9px] border border-white/10 rounded px-1 inline-block">
                     {userRole}
                  </div>
               )}
            </div>
         )}
      </div>
   );
};
