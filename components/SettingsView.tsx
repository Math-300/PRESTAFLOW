
import React, { useState, useEffect } from 'react';
import { Settings, Save, Zap, Megaphone, Check, Bot, Terminal, Copy, Trash2, CreditCard, Shield, Activity, User, Filter, Search } from 'lucide-react';
import { AppSettings, AppLog } from '../types';
import { UserManagement } from './settings/UserManagement';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_SYSTEM_PROMPT = `Eres "LuchoBot", el Asistente de Gestión Financiera y Cartera.
Tu objetivo es gestionar la recuperación de cartera y asistir a los clientes con sus pagos.
Tu tono es: **Profesional, Firme, Respetuoso y Conciso**.
Nunca eres grosero, nunca amenazas y nunca usas jerga criminal o agresiva.

# CRITICAL RULES
1. **Verificación de Identidad:** Confirma que hablas con el titular.
2. **Cero Alucinaciones:** NUNCA inventes un saldo. Si no tienes el dato, di: "Permíteme consultar tu estado".
3. **Límites:** NO puedes perdonar deuda. NO autorizas nuevos créditos.
4. **Respuestas:** Máximo 40 palabras.
`;

interface SettingsViewProps {
   settings: AppSettings;
   onUpdateSettings: (newSettings: AppSettings) => void;
   systemLogs: AppLog[];
   onClearLogs: () => void;
   onAddNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
   settings,
   onUpdateSettings,
   systemLogs,
   onClearLogs,
   onAddNotification
}) => {
   const { userRole, can, loadMembers } = useOrganization();
   const [tempBusinessName, setTempBusinessName] = useState(settings.companyName);
   const [activeTab, setActiveTab] = useState<'GENERAL' | 'TEAM' | 'VIEW' | 'AUDIT'>('GENERAL');

   // Filtering for logs
   const [logFilter, setLogFilter] = useState('');

   // Sync internal state if props change from outside
   useEffect(() => {
      setTempBusinessName(settings.companyName);
   }, [settings.companyName]);

   const handleSaveName = () => {
      onUpdateSettings({ ...settings, companyName: tempBusinessName });
   };

   const copyLogs = () => {
      const text = systemLogs.map(l => `[${l.timestamp}] [${l.level}] ${l.message} ${l.details || ''}`).join('\n');
      navigator.clipboard.writeText(text);
      onAddNotification("Logs copiados al portapapeles", "info");
   };

   const filteredLogs = systemLogs.filter(l =>
      l.message.toLowerCase().includes(logFilter.toLowerCase()) ||
      l.actor.toLowerCase().includes(logFilter.toLowerCase()) ||
      l.entity.toLowerCase().includes(logFilter.toLowerCase())
   );

   const canManageTeam = can('manage_team');
   const canViewAudit = can('view_audit_logs');
   const canManageSettings = can('manage_settings');

   const updateUIConfig = (updates: any) => {
      const currentConfig = settings.uiConfig || {
         privacyMode: false,
         dashboardCards: { portfolio: true, profit: true, activeClients: true, quickPay: true },
         visibleColumns: ['card', 'name', 'profit', 'balance', 'dates', 'status']
      };

      onUpdateSettings({
         ...settings,
         uiConfig: {
            ...currentConfig,
            ...updates
         }
      });
   };

   // Helper component for debounced input
   const DebouncedInput: React.FC<{
      label: string;
      value: string;
      onChange: (value: string) => void;
      placeholder?: string;
      type?: string;
      helperText?: string;
   }> = ({ label, value, onChange, placeholder, type = 'text', helperText }) => {
      const [inputValue, setInputValue] = useState(value);

      useEffect(() => {
         setInputValue(value);
      }, [value]);

      useEffect(() => {
         const handler = setTimeout(() => {
            if (inputValue !== value) {
               onChange(inputValue);
            }
         }, 500); // 500ms debounce

         return () => {
            clearTimeout(handler);
         };
      }, [inputValue, onChange, value]);

      return (
         <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
            <input
               type={type}
               className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
               placeholder={placeholder}
               value={inputValue}
               onChange={e => setInputValue(e.target.value)}
            />
            {helperText && <p className="text-xs text-slate-400 mt-1">{helperText}</p>}
         </div>
      );
   };

   // Helper component for debounced textarea
   const DebouncedTextArea: React.FC<{
      label?: string;
      value: string;
      onChange: (value: string) => void;
      placeholder?: string;
      helperText?: string;
   }> = ({ label, value, onChange, placeholder, helperText }) => {
      const [textareaValue, setTextareaValue] = useState(value);

      useEffect(() => {
         setTextareaValue(value);
      }, [value]);

      useEffect(() => {
         const handler = setTimeout(() => {
            if (textareaValue !== value) {
               onChange(textareaValue);
            }
         }, 500); // 500ms debounce

         return () => {
            clearTimeout(handler);
         };
      }, [textareaValue, onChange, value]);

      return (
         <div>
            {label && <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>}
            <textarea
               className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm min-h-[150px]"
               placeholder={placeholder}
               value={textareaValue}
               onChange={e => setTextareaValue(e.target.value)}
            />
            {helperText && <p className="text-xs text-slate-400 mt-1">{helperText}</p>}
         </div>
      );
   };

   return (
      <div className="w-full max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto h-full px-4 sm:px-6">
         <div className="mb-4 md:mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
            <div>
               <h2 className="text-xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Configuración</h2>
               <p className="text-slate-500 text-[10px] md:text-sm">Infraestructura de {settings.companyName}</p>
            </div>
         </div>

         {/* Tabs - Scrollable on mobile */}
         <div className="flex overflow-x-auto flex-nowrap gap-4 md:gap-6 mb-6 border-b border-slate-200 no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            <button
               onClick={() => setActiveTab('GENERAL')}
               className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'GENERAL' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
               General & Sistema
            </button>

            {canManageTeam && (
               <button
                  onClick={() => setActiveTab('TEAM')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'TEAM' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
               >
                  Usuarios y Equipo
               </button>
            )}

            {canManageSettings && (
               <button
                  onClick={() => setActiveTab('VIEW')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'VIEW' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
               >
                  Vista y Tablero
               </button>
            )}

            {canViewAudit && (
               <button
                  onClick={() => setActiveTab('AUDIT')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'AUDIT' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
               >
                  Auditoría y Logs
               </button>
            )}
         </div>

         <div className="flex-1 space-y-6 pb-12 overflow-y-auto px-4 md:px-6 scrollbar-thin">

            {/* TEAM TAB */}
            {activeTab === 'TEAM' && canManageTeam && (
               <div className="animate-in fade-in slide-in-from-left-4">
                  <UserManagement />
               </div>
            )}

            {/* GENERAL TAB */}
            {activeTab === 'GENERAL' && (
               <div className="lg:grid lg:grid-cols-12 lg:gap-8 animate-in fade-in slide-in-from-right-4">

                  {/* Left Column: Core Settings */}
                  <div className="lg:col-span-8 space-y-8">

                     {/* GENERAL SETTINGS */}
                     <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
                           <div className="bg-slate-100 p-2 rounded-lg"><Settings size={18} className="text-slate-700" /></div>
                           <h3 className="font-bold text-base md:text-lg text-slate-800">Datos del Negocio</h3>
                        </div>

                        {canManageSettings ? (
                           <div className="grid gap-4">
                              <div>
                                 <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-1">Nombre Comercial</label>
                                 <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                       type="text"
                                       className="flex-1 border border-slate-300 bg-white text-slate-900 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                                       value={tempBusinessName}
                                       onChange={e => setTempBusinessName(e.target.value)}
                                       placeholder="Escribe el nombre de tu empresa..."
                                    />
                                    <button
                                       onClick={handleSaveName}
                                       className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
                                    >
                                       <Save size={18} /> <span>Guardar</span>
                                    </button>
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-sm font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                                       <CreditCard size={14} /> Límite de Tarjetas Físicas
                                    </label>
                                    <p className="text-xs text-slate-400 mb-2">Máximo número de tarjetas en ruta para reciclaje.</p>
                                    <input
                                       type="number"
                                       className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                                       placeholder="500"
                                       value={settings.maxCardLimit || 500}
                                       onChange={e => onUpdateSettings({ ...settings, maxCardLimit: parseInt(e.target.value) || 500 })}
                                    />
                                 </div>
                              </div>
                           </div>
                        ) : (
                           <div className="p-4 bg-slate-50 rounded-lg text-center text-slate-500 text-sm">
                              No tienes permisos para modificar la configuración del negocio. Contacta al propietario.
                           </div>
                        )}
                     </div>

                     {/* AUTOMATION SETTINGS (Admin Only) */}
                     {canManageSettings && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                           <div className="absolute top-0 right-0 p-4 opacity-5"><Zap size={100} /></div>
                           <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4 relative z-10">
                              <div className="bg-red-100 p-2 rounded-lg"><Megaphone size={20} className="text-red-600" /></div>
                              <div>
                                 <h3 className="font-bold text-lg text-slate-800">Automatización</h3>
                                 <p className="text-xs text-slate-500">Integración con n8n / Webhooks para cobranza</p>
                              </div>
                           </div>
                           <div className="relative z-10">
                              <label className="block text-sm font-bold text-slate-500 uppercase mb-1">Webhook URL</label>
                              <div className="flex gap-2">
                                 <input
                                    type="text"
                                    className="flex-1 border border-slate-300 bg-white text-slate-900 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                    placeholder="https://..."
                                    value={settings.n8nWebhookUrl || ''}
                                    onChange={e => onUpdateSettings({ ...settings, n8nWebhookUrl: e.target.value })}
                                 />
                              </div>
                           </div>
                        </div>
                     )}

                     {/* AI SETTINGS (Admin Only) */}
                     {canManageSettings && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                           <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
                              <div className="bg-blue-100 p-2 rounded-lg"><Bot size={20} className="text-blue-600" /></div>
                              <div>
                                 <h3 className="font-bold text-lg text-slate-800">Agente de Cobranza (IA)</h3>
                                 <p className="text-xs text-slate-500">Configura a "LuchoBot" para asistir en la gestión.</p>
                              </div>
                           </div>

                           <div className="flex items-center gap-3 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                              <input
                                 type="checkbox"
                                 id="useOpenAI"
                                 className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 transition-all"
                                 checked={settings.useOpenAI}
                                 onChange={e => onUpdateSettings({ ...settings, useOpenAI: e.target.checked })}
                              />
                              <label htmlFor="useOpenAI" className="font-bold text-slate-700 cursor-pointer select-none">Habilitar IA con Acciones (Beta)</label>
                           </div>

                           {settings.useOpenAI && (
                              <div className="animate-in fade-in slide-in-from-top-2 space-y-5">
                                 <div>
                                    <DebouncedInput
                                       label="Nombre del Asistente"
                                       value={settings.aiAgentName || 'LuchoBot'}
                                       onChange={(val) => onUpdateSettings({ ...settings, aiAgentName: val })}
                                       placeholder="Ej: LuchoBot"
                                    />
                                 </div>

                                 <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Proveedor de IA</label>
                                    <select
                                       className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm appearance-none"
                                       value={settings.aiProvider || 'GEMINI'}
                                       onChange={e => onUpdateSettings({ ...settings, aiProvider: e.target.value as any })}
                                    >
                                       <option value="GEMINI">Google Gemini 1.5 (Recomendado)</option>
                                       <option value="SUPABASE">Supabase AI</option>
                                       <option value="OPENAI">OpenAI (GPT-4)</option>
                                    </select>
                                 </div>

                                 <div>
                                    <DebouncedInput
                                       label="API Key (Google AI Studio)"
                                       value={settings.aiApiKey || settings.apiKey || ''}
                                       onChange={(val) => onUpdateSettings({ ...settings, aiApiKey: val, apiKey: val })}
                                       placeholder="AIzaSy..."
                                       type="password"
                                       helperText="Tu llave se guarda encriptada y segura. Nunca la compartas."
                                    />
                                 </div>

                                 <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase flex justify-between">
                                       <span>Prompt de Sistema (Identidad)</span>
                                       <span className="text-blue-600 cursor-pointer hover:underline" onClick={() => onUpdateSettings({ ...settings, aiSystemPrompt: DEFAULT_SYSTEM_PROMPT })}>Restaurar Prompt "LuchoBot"</span>
                                    </label>
                                    <DebouncedTextArea
                                       value={settings.aiSystemPrompt || ''}
                                       onChange={(val) => onUpdateSettings({ ...settings, aiSystemPrompt: val })}
                                       placeholder="Eres un asistente experto..."
                                       helperText="Este texto define la personalidad, reglas y límites de negociación de tu agente."
                                    />
                                 </div>
                              </div>
                           )}
                        </div>
                     )}
                  </div>

                  {/* Right Column: Info & Stats */}
                  <div className="lg:col-span-4 mt-8 lg:mt-0 space-y-6">

                     {/* PROFILE SETTINGS */}
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                           <User size={16} className="text-blue-500" /> Mi Perfil
                        </h4>
                        <div className="space-y-4">
                           <DebouncedInput
                              label="Nombre para Mostrar"
                              value={useAuth().user?.user_metadata?.full_name || ''}
                              onChange={async (val) => {
                                 const { error } = await useAuth().updateProfile({ full_name: val });
                                 if (!error) {
                                    onAddNotification("Nombre de perfil actualizado", "success");
                                    loadMembers();
                                 } else {
                                    onAddNotification("Error al actualizar perfil", "error");
                                 }
                              }}
                              placeholder="Tu nombre..."
                              helperText="Cómo te verán los demás miembros del equipo."
                           />
                           <div className="pt-2 border-t border-slate-100 uppercase">
                              <span className="text-[10px] font-bold text-slate-400">Rol Actual</span>
                              <div className="text-xs font-bold text-slate-700 mt-1 capitalize">{userRole}</div>
                           </div>
                        </div>
                     </div>

                     <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={80} /></div>
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                           <Shield size={16} className="text-emerald-400" /> Estado del Sistema
                        </h4>
                        <div className="space-y-4 relative z-10">
                           <div className="flex justify-between items-center border-b border-white/10 pb-3">
                              <span className="text-xs text-slate-400">Estado</span>
                              <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div> Operativo
                              </span>
                           </div>
                           <div className="flex justify-between items-center border-b border-white/10 pb-3">
                              <span className="text-xs text-slate-400">Proveedor de IA</span>
                              <span className="text-xs font-bold text-blue-400">{settings.aiProvider || 'No Configurado'}</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-400">Webhook n8n</span>
                              <span className={`text-[10px] font-mono ${settings.n8nWebhookUrl ? 'text-emerald-400' : 'text-slate-500'}`}>
                                 {settings.n8nWebhookUrl ? 'CONECTADO' : 'DESACTIVADO'}
                              </span>
                           </div>
                        </div>
                     </div>

                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                           <Filter size={16} className="text-blue-500" /> Atajos Rápidos
                        </h4>
                        <div className="space-y-2">
                           <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between group hover:bg-slate-100 transition-colors cursor-default">
                              <span className="text-xs text-slate-600 font-medium">Nuevo Cliente</span>
                              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400 shadow-sm">F1</kbd>
                           </div>
                           <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between group hover:bg-slate-100 transition-colors cursor-default">
                              <span className="text-xs text-slate-600 font-medium">Cambiar de Vista</span>
                              <div className="flex gap-1.5 align-middle">
                                 <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400">Tab</kbd>
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden group">
                        <div className="absolute -bottom-4 -right-4 bg-white/10 p-6 rounded-full group-hover:scale-110 transition-transform duration-500">
                           <Megaphone size={48} className="rotate-12" />
                        </div>
                        <h4 className="text-base font-bold mb-2 relative z-10">¿Necesitas ayuda?</h4>
                        <p className="text-xs text-blue-100 mb-4 relative z-10 leading-relaxed">Configura flujos avanzados de automatización consultando nuestra documentación técnica.</p>
                        <button className="bg-white text-blue-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors relative z-10 shadow-md">
                           Ver Documentación
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {/* AUDIT LOG TAB */}
            {activeTab === 'VIEW' && canManageSettings && (
               <div className="max-w-4xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* PRIVACY SECTION */}
                     <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="bg-slate-100 p-2.5 rounded-xl text-slate-600">
                              <Shield size={22} />
                           </div>
                           <div>
                              <h3 className="text-lg font-bold text-slate-900">Privacidad</h3>
                              <p className="text-xs text-slate-500">Controla la visibilidad de datos sensibles</p>
                           </div>
                        </div>

                        <div className="space-y-4">
                           <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 group hover:border-blue-200 transition-all">
                              <div className="flex items-center gap-3">
                                 <div className={`p-2 rounded-lg transition-colors ${settings.uiConfig?.privacyMode ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                                    <Bot size={18} />
                                 </div>
                                 <div>
                                    <div className="text-sm font-bold text-slate-800">Modo Privacidad</div>
                                    <div className="text-[10px] text-slate-500">Oculta saldos y ganancias con un desenfoque</div>
                                 </div>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                 <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.uiConfig?.privacyMode || false}
                                    onChange={e => updateUIConfig({ privacyMode: e.target.checked })}
                                 />
                                 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              </label>
                           </div>
                        </div>
                     </div>

                     {/* DASHBOARD CARDS SECTION */}
                     <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                              <Activity size={22} />
                           </div>
                           <div>
                              <h3 className="text-lg font-bold text-slate-900">Tablero</h3>
                              <p className="text-xs text-slate-500">Selecciona qué tarjetas mostrar en el inicio</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                           {[
                              { id: 'portfolio', label: 'Capital en la Calle', icon: <CreditCard size={14} /> },
                              { id: 'profit', label: 'Ganancia Estimada', icon: <Zap size={14} /> },
                              { id: 'quickPay', label: 'Cobro Rápido', icon: <Activity size={14} /> },
                              { id: 'activeClients', label: 'Clientes Activos', icon: <User size={14} /> }
                           ].map(card => (
                              <label key={card.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer">
                                 <div className="flex items-center gap-3">
                                    <div className="text-slate-400">{card.icon}</div>
                                    <span className="text-sm font-bold text-slate-700">{card.label}</span>
                                 </div>
                                 <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    checked={settings.uiConfig?.dashboardCards ? (settings.uiConfig.dashboardCards as any)[card.id] !== false : true}
                                    onChange={e => {
                                       const currentCards = settings.uiConfig?.dashboardCards || { portfolio: true, profit: true, activeClients: true, quickPay: true };
                                       updateUIConfig({
                                          dashboardCards: {
                                             ...currentCards,
                                             [card.id]: e.target.checked
                                          }
                                       });
                                    }}
                                 />
                              </label>
                           ))}
                        </div>
                     </div>

                     {/* COLUMN DEFAULTS SECTION */}
                     <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
                              <Filter size={22} />
                           </div>
                           <div>
                              <h3 className="text-lg font-bold text-slate-900">Columnas Predeterminadas</h3>
                              <p className="text-xs text-slate-500">Configura la vista inicial de la lista de clientes para todo el equipo</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                           {[
                              { id: 'card', label: 'ID/Cód' },
                              { id: 'name', label: 'Nombre' },
                              { id: 'guarantor', label: 'Fiador' },
                              { id: 'contact', label: 'Contacto' },
                              { id: 'last_activity', label: 'Actividad' },
                              { id: 'profit', label: 'Ganancia' },
                              { id: 'balance', label: 'Saldo/Deuda' },
                              { id: 'limit', label: 'Cupo' },
                              { id: 'dates', label: 'Fechas' },
                              { id: 'status', label: 'Estado' }
                           ].map(col => (
                              <label key={col.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${(settings.uiConfig?.visibleColumns || ['card', 'name', 'profit', 'balance', 'dates', 'status']).includes(col.id) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                                 <span className={`text-[11px] font-bold ${(settings.uiConfig?.visibleColumns || ['card', 'name', 'profit', 'balance', 'dates', 'status']).includes(col.id) ? 'text-emerald-700' : 'text-slate-600'}`}>{col.label}</span>
                                 <input
                                    type="checkbox"
                                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                    checked={(settings.uiConfig?.visibleColumns || ['card', 'name', 'profit', 'balance', 'dates', 'status']).includes(col.id)}
                                    onChange={e => {
                                       const currentCols = settings.uiConfig?.visibleColumns || ['card', 'name', 'profit', 'balance', 'dates', 'status'];
                                       let nextCols;
                                       if (e.target.checked) {
                                          nextCols = [...currentCols, col.id];
                                       } else {
                                          nextCols = currentCols.filter(i => i !== col.id);
                                       }
                                       // Deduplicate
                                       nextCols = Array.from(new Set(nextCols));
                                       updateUIConfig({ visibleColumns: nextCols });
                                    }}
                                 />
                              </label>
                           ))}
                        </div>
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                           <Shield size={16} className="text-amber-600 shrink-0 mt-0.5" />
                           <p className="text-[10px] text-amber-700 leading-normal">
                              **Nota:** Estos cambios afectan la configuración visual global. Cada usuario puede seguir ocultando columnas temporalmente desde la lista de clientes, pero esta será la configuración que aparecerá al recargar la página.
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'AUDIT' && canViewAudit && (
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[600px] animate-in fade-in slide-in-from-right-4 overflow-hidden">
                  {/* Header and Filter */}
                  <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white shrink-0">
                     <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-3 rounded-xl shadow-lg shadow-slate-200 text-white">
                           <Activity size={24} className="text-emerald-400" />
                        </div>
                        <div>
                           <h3 className="font-bold text-xl text-slate-800">Historial de Movimientos</h3>
                           <p className="text-sm text-slate-500">Registro detallado de acciones y seguridad.</p>
                        </div>
                     </div>

                     <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                        <div className="relative flex-1 sm:w-64">
                           <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                           <input
                              type="text"
                              placeholder="Buscar por usuario, acción..."
                              className="w-full pl-10 pr-4 py-2 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
                              value={logFilter}
                              onChange={e => setLogFilter(e.target.value)}
                           />
                        </div>
                        <div className="h-6 w-px bg-slate-200 mx-1"></div>
                        <button
                           onClick={copyLogs}
                           className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                           title="Copiar Logs"
                        >
                           <Copy size={18} />
                        </button>
                        <button
                           onClick={onClearLogs}
                           className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                           title="Limpiar Logs"
                        >
                           <Trash2 size={18} />
                        </button>
                     </div>
                  </div>

                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-blue-50/50 border-b border-blue-100 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 select-none">
                     <div className="col-span-2">Fecha</div>
                     <div className="col-span-2">Actor</div>
                     <div className="col-span-2 text-center">Acción</div>
                     <div className="col-span-2">Entidad</div>
                     <div className="col-span-4">Detalle</div>
                  </div>

                  {/* List */}
                  <div className="flex-1 overflow-y-auto bg-white scrollbar-thin">
                     {filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 py-20">
                           <Terminal size={48} className="opacity-10" />
                           <p className="text-sm font-medium">Sin registros recientes</p>
                        </div>
                     ) : (
                        <div className="divide-y divide-slate-50">
                           {filteredLogs.map((log) => {
                              const dateObj = new Date(log.timestamp);
                              const dateStr = dateObj.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
                              const timeStr = dateObj.toLocaleTimeString('es-CO', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });

                              // Determine styles
                              let badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
                              if (log.action === 'CREATE') badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100";
                              if (log.action === 'UPDATE') badgeClass = "bg-blue-50 text-blue-700 border-blue-200 shadow-sm shadow-blue-100";
                              if (log.action === 'DELETE') badgeClass = "bg-red-50 text-red-700 border-red-200 shadow-sm shadow-red-100";
                              if (log.action === 'LOGIN') badgeClass = "bg-violet-50 text-violet-700 border-violet-200 shadow-sm shadow-violet-100";
                              if (log.action === 'SYSTEM') badgeClass = "bg-amber-50 text-amber-700 border-amber-200 shadow-sm shadow-amber-100";

                              const isError = log.level === 'ERROR';

                              return (
                                 <div key={log.id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors group items-start border-l-4 border-l-transparent hover:border-l-blue-500">
                                    {/* DATE */}
                                    <div className="col-span-2 flex flex-col justify-center">
                                       <span className="font-bold text-slate-700 text-xs font-mono">{timeStr}</span>
                                       <span className="text-[10px] text-slate-400 mt-0.5">{dateStr}</span>
                                    </div>

                                    {/* ACTOR */}
                                    <div className="col-span-2 flex items-center gap-3 overflow-hidden">
                                       <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                          {log.actor.substring(0, 2).toUpperCase()}
                                       </div>
                                       <div className="flex flex-col overflow-hidden">
                                          <span className="text-xs font-bold text-slate-700 truncate" title={log.actor}>
                                             {log.actor.split('@')[0]}
                                          </span>
                                          <span className="text-[9px] text-slate-400 truncate hidden xl:block">
                                             {log.actor}
                                          </span>
                                       </div>
                                    </div>

                                    {/* ACTION */}
                                    <div className="col-span-2 flex justify-center">
                                       <span className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-[10px] font-bold tracking-wide border w-24 text-center select-none uppercase ${badgeClass}`}>
                                          {log.action}
                                       </span>
                                    </div>

                                    {/* ENTITY */}
                                    <div className="col-span-2 flex items-center">
                                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                          {log.entity}
                                       </span>
                                    </div>

                                    {/* DETAILS */}
                                    <div className="col-span-4 text-xs leading-relaxed">
                                       <p className={`font-semibold mb-1 ${isError ? 'text-red-600' : 'text-slate-800'}`}>
                                          {log.message}
                                       </p>
                                       {log.details && (
                                          <div className="font-mono text-[10px] text-slate-500 bg-slate-100 p-2 rounded border border-slate-200 break-all shadow-inner">
                                             {log.details}
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     )}
                  </div>

                  <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400 flex justify-between items-center">
                     <span>Mostrando últimos {filteredLogs.length} registros</span>
                     <span className="flex items-center gap-1 font-semibold text-slate-500"><Shield size={10} className="text-emerald-500" /> Auditoría Segura Activa</span>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
};
