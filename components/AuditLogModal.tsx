import React, { useState, useMemo } from 'react';
import { X, Search, Filter, ChevronDown, ChevronRight, Activity, ShieldCheck, AlertTriangle, Info } from 'lucide-react';
import { AppLog } from '../types';

interface AuditLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    logs: AppLog[];
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose, logs }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEntity, setFilterEntity] = useState<string>('ALL');
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch =
                log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.actor.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesEntity = filterEntity === 'ALL' || log.entity === filterEntity;
            return matchesSearch && matchesEntity;
        });
    }, [logs, searchTerm, filterEntity]);

    if (!isOpen) return null;

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'ERROR': return 'text-red-600 bg-red-50 border-red-200';
            case 'WARNING': return 'text-amber-600 bg-amber-50 border-amber-200';
            case 'SUCCESS': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            default: return 'text-blue-600 bg-blue-50 border-blue-200';
        }
    };

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'ERROR': return <AlertTriangle size={14} />;
            case 'WARNING': return <AlertTriangle size={14} />;
            case 'SUCCESS': return <ShieldCheck size={14} />;
            default: return <Info size={14} />;
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                            <Activity size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Historial de Auditoría</h2>
                            <p className="text-xs text-slate-400">Registro inmutable de acciones del sistema</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex gap-3 items-center">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por usuario o acción..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                            className="pl-10 pr-8 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm appearance-none bg-white cursor-pointer"
                            value={filterEntity}
                            onChange={(e) => setFilterEntity(e.target.value)}
                        >
                            <option value="ALL">Todas las Entidades</option>
                            <option value="CLIENT">Clientes</option>
                            <option value="TRANSACTION">Transacciones</option>
                            <option value="BANK">Bancos</option>
                            <option value="SETTINGS">Configuración</option>
                            <option value="AUTH">Seguridad</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                    {filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <Activity size={40} className="mb-2 opacity-50" />
                            <p>No se encontraron registros</p>
                        </div>
                    ) : (
                        filteredLogs.map((log) => (
                            <div key={log.id} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden transition-all hover:shadow-md">
                                <div
                                    className="p-3 flex items-center gap-4 cursor-pointer hover:bg-slate-50"
                                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                >
                                    <div className="shrink-0 flex flex-col items-center min-w-[60px]">
                                        <span className="text-[10px] font-bold text-slate-400">{log.displayTime}</span>
                                    </div>

                                    <div className={`p-1.5 rounded-md border shrink-0 ${getLevelColor(log.level)}`}>
                                        {getLevelIcon(log.level)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-bold text-sm text-slate-800">{log.action}</span>
                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                                                {log.entity}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 truncate">{log.message}</p>
                                    </div>

                                    <div className="shrink-0 text-right hidden sm:block">
                                        <div className="text-xs font-semibold text-slate-700">{log.actor}</div>
                                    </div>

                                    <ChevronRight
                                        size={16}
                                        className={`text-slate-400 transition-transform duration-200 ${expandedLogId === log.id ? 'rotate-90' : ''}`}
                                    />
                                </div>

                                {/* Expanded Details */}
                                {expandedLogId === log.id && (
                                    <div className="bg-slate-50 border-t border-slate-100 p-4 animate-in slide-in-from-top-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <h4 className="font-bold text-slate-500 uppercase mb-2">Detalles Técnicos</h4>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between border-b border-slate-200 py-1">
                                                        <span className="text-slate-500">ID Evento:</span>
                                                        <span className="font-mono select-all text-slate-700">{log.id}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b border-slate-200 py-1">
                                                        <span className="text-slate-500">Timestamp:</span>
                                                        <span className="font-mono text-slate-700">{log.timestamp}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b border-slate-200 py-1">
                                                        <span className="text-slate-500">Actor:</span>
                                                        <span className="font-mono text-slate-700">{log.actor}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-500 uppercase mb-2">Metadata</h4>
                                                <pre className="bg-slate-100 p-2 rounded border border-slate-200 overflow-x-auto font-mono text-slate-600">
                                                    {log.details ? JSON.stringify(log.details, null, 2) : 'Sin detalles adicionales'}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="bg-slate-50 p-2 text-center text-[10px] text-slate-400 border-t border-slate-200">
                    Mostrando últimos 100 registros en tiempo real.
                </div>
            </div>
        </div>
    );
};
