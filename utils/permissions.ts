
import { UserRole } from '../types';

export type Permission =
  | 'view_clients'
  | 'edit_clients'
  | 'delete_clients'
  | 'create_clients'
  | 'create_transactions'
  | 'delete_transactions'
  | 'manage_banks'
  | 'manage_team'
  | 'manage_settings'
  | 'view_audit_logs';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'view_clients', 'edit_clients', 'delete_clients', 'create_clients',
    'create_transactions', 'delete_transactions', 'manage_banks',
    'manage_team', 'manage_settings', 'view_audit_logs'
  ],
  admin: [
    'view_clients', 'edit_clients', 'create_clients',
    'create_transactions', 'manage_banks',
    'manage_team', 'view_audit_logs'
    // Admins can see and edit but NOT delete clients/transactions by default
  ],
  member: [
    'view_clients', 'create_clients', 'create_transactions'
    // Members are strictly operational
  ]
};

/**
 * Check if a role has a specific permission
 */
export const hasPermission = (role: UserRole | null | undefined, permission: Permission): boolean => {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
};

/**
 * Get a human readable label for the role
 */
export const getRoleLabel = (role: UserRole) => {
  switch (role) {
    case 'owner': return 'Propietario (Acceso Total)';
    case 'admin': return 'Administrador';
    case 'member': return 'Operador / Cobrador';
    default: return 'Usuario';
  }
};
