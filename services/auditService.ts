import { supabase } from '../lib/supabaseClient';
import { AppLog } from '../types';
import { generateId } from '../utils/format';

const LOG_TABLE_NAME = 'audit_logs';

/**
 * Persists an audit log to Supabase.
 * Falls back to console if DB fails or isn't configured.
 */
export const persistAuditLog = async (log: AppLog, orgId?: string) => {
    try {
        // 1. Console Fallback (Always log to console for debugging)
        const color = log.level === 'ERROR' ? '#ef4444' : log.level === 'WARNING' ? '#f59e0b' : '#3b82f6';
        console.log(`%c[${log.action}] ${log.message}`, `color: ${color}; font-weight: bold`);

        if (!orgId) return;

        // 2. Prepare DB Payload
        // Map AppLog to DB columns. Assuming a generic audit_logs table structure.
        const payload = {
            id: log.id,
            organization_id: orgId,
            created_at: log.timestamp,
            level: log.level,
            message: log.message,
            actor: log.actor,
            action: log.action,
            entity: log.entity,
            details: log.details
        };

        // 3. Fire and Forget (don't await confirmation to avoid UI blocking)
        supabase.from(LOG_TABLE_NAME).insert(payload).then(({ error }) => {
            if (error) {
                // Silent fail on DB log to avoid infinite loops if DB is down
                console.warn('Failed to persist audit log:', error.message);
            }
        });

    } catch (err) {
        console.error('Audit Service Error:', err);
    }
};

/**
 * Creates a standard log object and persists it.
 */
export const createLog = (
    userEmail: string | undefined,
    action: AppLog['action'],
    entity: AppLog['entity'],
    message: string,
    details?: string,
    level: AppLog['level'] = 'INFO',
    orgId?: string
) => {
    const now = new Date();
    const log: AppLog = {
        id: generateId(),
        timestamp: now.toISOString(),
        displayTime: now.toLocaleTimeString('es-CO'),
        level,
        message,
        actor: userEmail || 'Sistema',
        action,
        entity,
        details
    };

    persistAuditLog(log, orgId);
    return log;
};
