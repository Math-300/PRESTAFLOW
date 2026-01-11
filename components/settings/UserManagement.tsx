
import React, { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { Users, UserPlus, Shield, Trash2, Mail, CheckCircle, AlertTriangle, Loader2, X, Clock, Copy, Link as LinkIcon, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchMemberPermissions, updateMemberPermission, MemberPermission, fetchPermissionDefinitions, PermissionDefinition } from '../../services/permissionService';
import { hasPermission, Permission } from '../../utils/permissions';

export const UserManagement: React.FC = () => {
    const { currentOrg, members, invitations, loadMembers, inviteMember, revokeInvitation, updateMemberRole, removeMember, userRole } = useOrganization();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<'MEMBERS' | 'INVITES'>('MEMBERS');
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Invite Form
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('member');
    const [inviteResult, setInviteResult] = useState<{ status: 'ADDED' | 'INVITED', token?: string, email?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Permissions Management
    const [editingPermissionsMemberId, setEditingPermissionsMemberId] = useState<string | null>(null);
    const [permissionDefinitions, setPermissionDefinitions] = useState<PermissionDefinition[]>([]);
    const [memberPermissions, setMemberPermissions] = useState<MemberPermission[]>([]);
    const [isPermsLoading, setIsPermsLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        const init = async () => {
            if (!currentOrg) return;
            setIsDataLoading(true);
            await loadMembers();
            if (mounted) setIsDataLoading(false);
        };
        init();
        return () => { mounted = false; };
    }, [currentOrg]);

    const canManage = userRole === 'owner' || userRole === 'admin';
    const isOwner = userRole === 'owner';

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsActionLoading(true);
        setError(null);
        setInviteResult(null);

        const result = await inviteMember(newUserEmail, newUserRole);

        if (result.success) {
            setInviteResult({ status: result.status!, token: result.token, email: newUserEmail });
            // If added directly, clear form. If invited (link needed), keep modal open.
            if (result.status === 'ADDED') {
                setNewUserEmail('');
                setTimeout(() => setShowAddModal(false), 2000);
            } else if (result.status === 'INVITED') {
                // AUTO SWITCH TAB TO SEE THE INVITATION
                setActiveTab('INVITES');
            }
        } else {
            setError(result.error || "Error al agregar usuario.");
        }
        setIsActionLoading(false);
    };

    const copyInviteLink = (token: string, emailForLink?: string) => {
        let link = `${window.location.origin}?invite=${token}`;
        if (emailForLink) link += `&email=${encodeURIComponent(emailForLink)}`;
        navigator.clipboard.writeText(link);
        alert("Enlace copiado al portapapeles. Envíalo al usuario.");
    };

    const handleRemove = async (memberId: string) => {
        if (window.confirm("¿Seguro que deseas eliminar a este miembro del equipo?")) {
            setIsActionLoading(true);
            const res = await removeMember(memberId);
            if (!res.success) setError(res.error || "Error al eliminar miembro.");
            setIsActionLoading(false);
        }
    };

    const handleRevoke = async (inviteId: string) => {
        if (window.confirm("¿Cancelar esta invitación?")) {
            setIsActionLoading(true);
            const res = await revokeInvitation(inviteId);
            if (!res.success) setError(res.error || "Error al cancelar invitación.");
            setIsActionLoading(false);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: string) => {
        setIsActionLoading(true);
        const res = await updateMemberRole(memberId, newRole as UserRole);
        if (!res.success) setError(res.error || "Error al cambiar rol.");
        setIsActionLoading(false);
    };

    const handleEditPermissions = async (memberId: string) => {
        if (editingPermissionsMemberId === memberId) {
            setEditingPermissionsMemberId(null);
            return;
        }

        setEditingPermissionsMemberId(memberId);
        setIsPermsLoading(true);

        // Parallel fetch for speed
        const [perms, defs] = await Promise.all([
            fetchMemberPermissions(memberId),
            permissionDefinitions.length === 0 ? fetchPermissionDefinitions() : Promise.resolve(permissionDefinitions)
        ]);

        setMemberPermissions(perms);
        if (permissionDefinitions.length === 0) {
            setPermissionDefinitions(defs);
        }
        setIsPermsLoading(false);
    };

    const handleTogglePermission = async (permSlug: string, isEnabled: boolean) => {
        if (!editingPermissionsMemberId) return;

        // Optimistic update
        const existing = memberPermissions.find(p => p.slug === permSlug);
        if (existing) {
            setMemberPermissions(prev => prev.map(p => p.slug === permSlug ? { ...p, is_enabled: isEnabled } : p));
        } else {
            setMemberPermissions(prev => [...prev, { slug: permSlug, is_enabled: isEnabled, name: '', description: '' }]);
        }

        const { success } = await updateMemberPermission(editingPermissionsMemberId, permSlug, isEnabled);
        if (!success) {
            setError("No se pudo actualizar el permiso.");
            // Revert on failure
            const perms = await fetchMemberPermissions(editingPermissionsMemberId);
            setMemberPermissions(perms);
        }
    };

    const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Users size={20} className="text-blue-600" /> Gestión de Equipo
                    </h3>
                    <p className="text-sm text-slate-500">Administra quién tiene acceso a {currentOrg?.name}</p>
                </div>

                {canManage && (
                    <button
                        onClick={() => { setShowAddModal(true); setInviteResult(null); setError(null); }}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <UserPlus size={16} /> Agregar Miembro
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 bg-white">
                <button
                    onClick={() => setActiveTab('MEMBERS')}
                    className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'MEMBERS' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
                >
                    Miembros <span className="bg-slate-100 px-1.5 rounded text-xs ml-1">{members.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab('INVITES')}
                    className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'INVITES' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
                >
                    Invitaciones <span className={`px-1.5 rounded text-xs ml-1 ${invitations.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100'}`}>{invitations.length}</span>
                </button>
            </div>

            {/* CONTENT */}
            <div className="divide-y divide-slate-100 min-h-[200px]">

                {/* MEMBERS LIST */}
                {activeTab === 'MEMBERS' && (
                    <>
                        {isDataLoading ? (
                            <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center">
                                <Loader2 className="animate-spin mb-2 text-blue-500" size={24} />
                                Cargando equipo...
                            </div>
                        ) : members.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center">
                                <Users size={32} className="opacity-20 mb-2" />
                                No se encontraron miembros en este equipo.
                            </div>
                        ) : (
                            members.map(member => {
                                const isMe = member.user_id === user?.id;
                                const isMemberOwner = member.role === 'owner';
                                const canEditThisUser = canManage && !isMe && (!isMemberOwner || isOwner) && member.role !== 'owner';

                                return (
                                    <React.Fragment key={member.id}>
                                        <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors animate-in fade-in">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2
                                        ${member.role === 'owner' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                        member.role === 'admin' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                                    `}>
                                                    {getInitials(member.profile?.email || 'User')}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                        {member.profile?.full_name || member.profile?.email || 'Usuario Desconocido'}
                                                        {isMe && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 rounded">Tú</span>}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Shield size={10} className={
                                                            member.role === 'owner' ? 'text-amber-500' :
                                                                member.role === 'admin' ? 'text-blue-500' : 'text-slate-400'
                                                        } />
                                                        <span className="text-xs text-slate-500 capitalize">{member.role}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {canEditThisUser && (
                                                    <button
                                                        onClick={() => handleEditPermissions(member.id)}
                                                        className={`p-1.5 rounded transition-colors flex items-center gap-1 text-[10px] font-bold uppercase
                                                ${editingPermissionsMemberId === member.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}
                                            `}
                                                        title="Gestionar Permisos"
                                                    >
                                                        <Lock size={12} /> {editingPermissionsMemberId === member.id ? 'Cerrar' : 'Permisos'}
                                                    </button>
                                                )}

                                                {canEditThisUser ? (
                                                    <>
                                                        <select
                                                            value={member.role}
                                                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                                            className="text-xs bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500 font-medium text-slate-600"
                                                        >
                                                            <option value="admin">Admin</option>
                                                            <option value="member">Miembro</option>
                                                        </select>
                                                        <button
                                                            onClick={() => handleRemove(member.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                            title="Eliminar usuario"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-300 px-2 select-none">
                                                        {isMemberOwner ? 'Propietario' : isMe ? 'Acceso Actual' : 'Solo lectura'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* PERMISSIONS PANEL */}
                                        {editingPermissionsMemberId === member.id && (
                                            <div className="bg-slate-50 border-y border-slate-100 p-4 animate-in slide-in-from-top-2 duration-200">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                                                        <Shield size={12} className="text-blue-500" /> Permisos Granulares de {member.profile?.email.split('@')[0]}
                                                    </h4>
                                                    {isPermsLoading && <Loader2 size={14} className="animate-spin text-blue-500" />}
                                                </div>

                                                {isPermsLoading ? (
                                                    <div className="py-8 text-center text-slate-400 text-xs">Cargando permisos...</div>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                        {permissionDefinitions.map(def => {
                                                            const override = memberPermissions.find(p => p.slug === def.slug);
                                                            const basePermission = def.slug as Permission;
                                                            const isEnabled = override ? override.is_enabled : hasPermission(member.role, basePermission);
                                                            const isModified = !!override;

                                                            return (
                                                                <div key={def.slug} className={`bg-white p-3 rounded-lg border flex items-center justify-between shadow-sm transition-colors ${isModified ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'}`}>
                                                                    <div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <div className="text-xs font-bold text-slate-700">{def.name}</div>
                                                                            {!isModified && (
                                                                                <span className="text-[8px] bg-slate-100 text-slate-400 px-1 rounded uppercase">Por Defecto</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{def.description}</div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleTogglePermission(def.slug, !isEnabled)}
                                                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none 
                                                                    ${isEnabled ? 'bg-emerald-500' : 'bg-slate-200'}
                                                                `}
                                                                    >
                                                                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                                                    ${isEnabled ? 'translate-x-4' : 'translate-x-0'}
                                                                `} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </>
                )}

                {/* INVITATIONS LIST */}
                {activeTab === 'INVITES' && (
                    <>
                        {invitations.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center">
                                <Mail size={32} className="opacity-20 mb-2" />
                                No hay invitaciones pendientes.
                            </div>
                        ) : (
                            invitations.map(invite => (
                                <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors animate-in fade-in">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 border-2 border-orange-200 flex items-center justify-center">
                                            <Clock size={18} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">{invite.invited_email}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded uppercase font-bold">{invite.role}</span>
                                                <span className="text-xs text-orange-500">Pendiente de registro</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => copyInviteLink(invite.token, invite.invited_email)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                            title="Copiar enlace"
                                        >
                                            <Copy size={14} /> Copiar Link
                                        </button>
                                        <button
                                            onClick={() => handleRevoke(invite.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Cancelar invitación"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </>
                )}

            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><UserPlus size={18} /> Agregar / Invitar</h3>
                            <button onClick={() => setShowAddModal(false)}><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* RESULT STATE: ADDED DIRECTLY */}
                            {inviteResult?.status === 'ADDED' && (
                                <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-center animate-in zoom-in">
                                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <CheckCircle size={24} />
                                    </div>
                                    <h4 className="font-bold text-green-800">¡Usuario Agregado!</h4>
                                    <p className="text-xs text-green-700 mt-1">El usuario ya existía en la plataforma y ha sido añadido al equipo correctamente.</p>
                                </div>
                            )}

                            {/* RESULT STATE: INVITATION LINK */}
                            {inviteResult?.status === 'INVITED' && inviteResult.token && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 animate-in zoom-in">
                                    <h4 className="font-bold text-blue-800 text-sm flex items-center gap-2 mb-2">
                                        <LinkIcon size={16} /> Enlace de Invitación
                                    </h4>
                                    <p className="text-xs text-blue-700 mb-3">
                                        El usuario no está registrado. Envíale este enlace para que se una:
                                    </p>
                                    <div className="flex gap-2">
                                        <code className="flex-1 bg-white border border-blue-200 p-2 rounded text-xs font-mono text-slate-600 truncate">
                                            {window.location.origin}?invite={inviteResult.token}
                                        </code>
                                        <button
                                            onClick={() => copyInviteLink(inviteResult.token!, inviteResult.email)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors"
                                        >
                                            <Copy size={16} />
                                        </button>
                                    </div>
                                    <div className="mt-4 text-center">
                                        <button onClick={() => setShowAddModal(false)} className="text-xs text-blue-600 font-bold hover:underline">Cerrar</button>
                                    </div>
                                </div>
                            )}

                            {/* FORM STATE */}
                            {!inviteResult && (
                                <form onSubmit={handleInvite} className="space-y-4">
                                    {error && (
                                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs flex items-start gap-2">
                                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                            {error}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                            <input
                                                type="email"
                                                required
                                                autoFocus
                                                className="w-full pl-9 p-2 border border-slate-300 rounded bg-slate-50 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="usuario@email.com"
                                                value={newUserEmail}
                                                onChange={e => setNewUserEmail(e.target.value)}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">Si no existe, se generará un enlace de invitación.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rol Asignado</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setNewUserRole('admin')}
                                                className={`p-2 rounded border text-sm font-bold transition-colors ${newUserRole === 'admin' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-500'}`}
                                            >
                                                Admin
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewUserRole('member')}
                                                className={`p-2 rounded border text-sm font-bold transition-colors ${newUserRole === 'member' ? 'bg-slate-100 border-slate-400 text-slate-800' : 'border-slate-200 text-slate-500'}`}
                                            >
                                                Miembro
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isActionLoading}
                                        className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isActionLoading ? <Loader2 size={16} className="animate-spin" /> : 'Continuar'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
