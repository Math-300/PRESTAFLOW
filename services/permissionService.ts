import { supabase } from '../lib/supabaseClient';

export interface MemberPermission {
    slug: string;
    name: string;
    description: string;
    is_enabled: boolean;
}

/**
 * Fetches all permissions for a specific member, including their current state (enabled/disabled).
 */
export const fetchMemberPermissions = async (memberId: string): Promise<MemberPermission[]> => {
    try {
        const { data: memberPerms, error: permError } = await supabase
            .from('member_permissions')
            .select('permission_slug, is_enabled')
            .eq('member_id', memberId);

        if (permError) throw permError;

        return memberPerms?.map(p => ({
            slug: p.permission_slug,
            is_enabled: p.is_enabled,
            name: '', // Displayed via definitions in UI
            description: ''
        })) || [];
    } catch (error) {
        console.error('Error fetching member permissions:', error);
        return [];
    }
};

/**
 * Interface for fetching DEFINITIONS (constant list)
 */
export interface PermissionDefinition {
    slug: string;
    name: string;
    description: string;
}

export const fetchPermissionDefinitions = async (): Promise<PermissionDefinition[]> => {
    try {
        const { data, error } = await supabase
            .from('permissions_definition')
            .select('slug, name, description')
            .order('name');
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching definitions:', error);
        return [];
    }
};

/**
 * Updates a specific permission for a member.
 */
export const updateMemberPermission = async (
    memberId: string,
    permissionSlug: string,
    isEnabled: boolean
): Promise<{ success: boolean; error?: any }> => {
    try {
        const { error } = await supabase
            .from('member_permissions')
            .upsert({
                member_id: memberId,
                permission_slug: permissionSlug,
                is_enabled: isEnabled
            }, { onConflict: 'member_id, permission_slug' });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error updating member permission:', error);
        return { success: false, error };
    }
};

/**
 * Checks if a member has a specific permission enabled.
 */
export const hasPermission = (permissions: MemberPermission[] | null, slug: string): boolean => {
    if (!permissions) return false;
    const perm = permissions.find(p => p.slug === slug);
    return perm ? perm.is_enabled : true; // Default to true if not explicitly disabled
};
