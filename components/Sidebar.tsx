
import React from 'react';
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
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, currentView, onChangeView, companyName, userRole }) => {
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

  // Base classes
  // Mobile: absolute/fixed, full height, z-30 (above content backdrop)
  // Desktop: relative, normal flow
  const containerClasses = `
    bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col shadow-2xl z-30
    fixed md:relative inset-y-0 left-0
    ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20'}
  `;

  return (
    <div className={containerClasses}>
        {/* HEADER / ORG SELECTOR */}
        <div className="p-4 flex flex-col border-b border-slate-700 shrink-0 relative">
          <div className="flex items-center justify-between h-12">
             {isOpen ? (
                <div 
                  className="flex items-center gap-2 cursor-pointer overflow-hidden flex-1 group"
                  onClick={() => setShowOrgMenu(!showOrgMenu)}
                >
                   <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shrink-0 shadow-lg shadow-blue-900/50">
                      {initials}
                   </div>
                   <div className="flex flex-col overflow-hidden">
                      <h1 className="text-sm font-bold text-white tracking-tight truncate group-hover:text-blue-200 transition-colors" title={displayName}>
                         {displayName}
                      </h1>
                      <div className="flex items-center text-[10px] text-slate-500">
                         <span className="truncate">Cambiar Empresa</span>
                         <ChevronDown size={10} className="ml-1"/>
                      </div>
                   </div>
                </div>
             ) : (
               <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white mx-auto cursor-pointer" onClick={() => setIsOpen(true)}>
                  {initials}
               </div>
             )}
             
             {/* Collapse Button (Only Desktop) or Close (Mobile) */}
             <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-slate-800 rounded ml-1 text-slate-400">
               {isOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
             </button>
          </div>

          {/* DROPDOWN MENU FOR ORGS */}
          {isOpen && showOrgMenu && (
             <div className="absolute top-full left-2 w-60 bg-slate-800 rounded-xl shadow-xl border border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-2 text-xs font-bold text-slate-500 uppercase">Tus Organizaciones</div>
                <div className="max-h-60 overflow-y-auto">
                   {organizations.map(org => (
                      <button
                         key={org.id}
                         onClick={() => { switchOrganization(org.id); setShowOrgMenu(false); }}
                         className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-700 transition-colors
                            ${currentOrg?.id === org.id ? 'bg-slate-700/50 text-white font-bold' : 'text-slate-400'}
                         `}
                      >
                         <Building2 size={14}/> {org.name}
                      </button>
                   ))}
                </div>
                
                {/* RESTRICTED CREATION BUTTON */}
                {!ownsOrganization ? (
                   <button
                      onClick={handleCreateOrg}
                      className="w-full text-left px-3 py-3 text-sm flex items-center gap-2 text-blue-400 hover:bg-slate-700 hover:text-blue-300 transition-colors border-t border-slate-700 font-bold"
                   >
                      <Plus size={14}/> Nueva Organización
                   </button>
                ) : (
                   <div className="px-3 py-2 text-[10px] text-slate-500 border-t border-slate-700 text-center italic">
                      Plan actual limita a 1 org.
                   </div>
                )}
             </div>
          )}
        </div>

        <div className="flex-1 py-4 px-2 space-y-2 overflow-y-auto">
           <button 
             onClick={() => onChangeView('CLIENTS_LIST')}
             className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${currentView === 'CLIENTS_LIST' || currentView === 'SINGLE_CLIENT' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
           >
              <Folder size={20} />
              {isOpen && <span className="font-semibold text-sm">Cartera</span>}
           </button>

           {/* Access to Banks is generally open, but restricted in specific actions inside */}
           <button 
             onClick={() => onChangeView('BANKS')}
             className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${currentView === 'BANKS' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
           >
              <Landmark size={20} />
              {isOpen && <span className="font-semibold text-sm">Tesorería</span>}
           </button>

           <div className="w-full h-px bg-slate-700 my-2 opacity-50"></div>

           <button 
              onClick={() => onChangeView('SETTINGS')}
              className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${currentView === 'SETTINGS' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
            >
              <Settings size={20} />
              {isOpen && <span className="font-semibold text-sm">Configuración</span>}
          </button>
        </div>
        
        {isOpen && (
          <div className="p-4 text-xs text-slate-600 text-center border-t border-slate-800 hidden md:block">
             <div className="flex justify-center items-center gap-1 mb-1 opacity-50">
               <Keyboard size={12}/> <span className="font-mono">F1: Nuevo Cliente</span>
             </div>
             <div className="mt-2 text-green-500 font-bold flex items-center justify-center gap-1">
                 <Wifi size={10}/> CONECTADO
             </div>
             {userRole && (
                 <div className="mt-1 text-slate-500 uppercase font-bold text-[9px] border border-slate-700 rounded px-1 inline-block">
                     {userRole}
                 </div>
             )}
          </div>
        )}
      </div>
  );
};
