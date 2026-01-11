
import { UserRole } from '../types';

export type Permission = 
  | 'MANAGE_TEAM'       // Invite/Remove members
  | 'MANAGE_SETTINGS'   // Change company name, AI settings
  | 'VIEW_AUDIT_LOGS'   // See history
  | 'DELETE_CLIENT'     // Delete clients
  | 'EDIT_CLIENT'       // Edit sensitive client info
  | 'DELETE_TRANSACTION'// Delete financial records
  | 'EDIT_TRANSACTION'  // Modify past transactions
  | 'CREATE_CLIENT'     // Register new people
  | 'PROCESS_PAYMENT'   // Regular daily usage
  | 'MANAGE_BANKS';     // Create/Edit bank accounts

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'MANAGE_TEAM', 'MANAGE_SETTINGS', 'VIEW_AUDIT_LOGS', 
    'DELETE_CLIENT', 'EDIT_CLIENT', 'DELETE_TRANSACTION', 
    'EDIT_TRANSACTION', 'CREATE_CLIENT', 'PROCESS_PAYMENT', 'MANAGE_BANKS'
  ],
  admin: [
    'MANAGE_TEAM', 'VIEW_AUDIT_LOGS', 
    'EDIT_CLIENT', 'CREATE_CLIENT', 'PROCESS_PAYMENT', 'MANAGE_BANKS',
    'EDIT_TRANSACTION' // Admins can edit but NOT delete transactions/clients by default for safety
  ],
  member: [
    'CREATE_CLIENT', 'PROCESS_PAYMENT' 
    // Members are strictly operational: Can lend and collect, nothing else.
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
  switch(role) {
    case 'owner': return 'Propietario (Acceso Total)';
    case 'admin': return 'Administrador';
    case 'member': return 'Operador / Cobrador';
    default: return 'Usuario';
  }
};
