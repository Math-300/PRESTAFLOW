import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { Organization, OrganizationMember, OrganizationInvitation, UserRole } from '../types';
import { fetchMemberPermissions, MemberPermission } from '../services/permissionService';
import { getErrorMessage } from '../utils/format';
import { hasPermission, Permission } from '../utils/permissions';

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
  userRole: UserRole | null;
  permissions: MemberPermission[] | null;
  isLoading: boolean;
  can: (permissionSlug: string) => boolean;
  createOrganization: (name: string) => Promise<{ success: boolean; error?: string }>;
  switchOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;

  // Member Management
  loadMembers: () => Promise<void>;
  inviteMember: (email: string, role: UserRole) => Promise<{ success: boolean; status?: 'ADDED' | 'INVITED'; token?: string; error?: string }>;
  revokeInvitation: (invitationId: string) => Promise<{ success: boolean; error?: string }>;
  updateMemberRole: (memberId: string, newRole: UserRole) => Promise<{ success: boolean; error?: string }>;
  removeMember: (memberId: string) => Promise<{ success: boolean; error?: string }>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<MemberPermission[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Check for Pending Invitations on Login (Enhanced Security with Token)
  const checkAndClaimInvitations = async () => {
    if (!user || !user.email) return;

    try {
      const inviteToken = localStorage.getItem('prestaFlow_inviteToken');

      let query = supabase.from('organization_invitations').select('*');

      if (inviteToken) {
        query = query.eq('token', inviteToken);
      } else {
        // Fallback to email only if no token, but token is preferred
        query = query.eq('invited_email', user.email.toLowerCase());
      }

      const { data: pendingInvites } = await query;

      if (pendingInvites && pendingInvites.length > 0) {
        let claimed = false;
        for (const invite of pendingInvites) {
          // Security: Ensure email matches if not using token, or even if using token as extra check
          if (invite.invited_email.toLowerCase() !== user.email.toLowerCase()) {
            console.warn("Email mismatch for invitation", { invite: invite.invited_email, user: user.email });
            continue;
          }

          // Idempotency check
          const { data: existingMember } = await supabase
            .from('organization_members')
            .select('id')
            .eq('organization_id', invite.organization_id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!existingMember) {
            const { error: insertError } = await supabase.from('organization_members').insert({
              organization_id: invite.organization_id,
              user_id: user.id,
              role: invite.role
            });

            if (!insertError) {
              await supabase.from('organization_invitations').delete().eq('id', invite.id);
              claimed = true;
            }
          } else {
            await supabase.from('organization_invitations').delete().eq('id', invite.id);
            claimed = true;
          }
        }

        if (claimed) {
          localStorage.removeItem('prestaFlow_inviteToken');
          await fetchOrganizations();
        }
      }
    } catch (error) {
      console.error("Error claiming invitations:", error);
    }
  };

  /* 
    Ref to track the last user ID we fetched for.
    This prevents the "flicker" where the loading screen appears on every minor auth update.
  */
  const lastFetchedUserId = React.useRef<string | null>(null);

  const fetchOrganizations = async (forceLoading = false) => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setIsLoading(false);
      lastFetchedUserId.current = null;
      return;
    }

    // If we've already fetched for this user, treat this as a background refresh
    // unless explicitly forced (e.g. manual refresh button)
    const isBackgroundRefresh = !forceLoading && lastFetchedUserId.current === user.id && organizations.length > 0;

    try {
      if (!isBackgroundRefresh) {
        setIsLoading(true);
      }

      lastFetchedUserId.current = user.id;

      // PRODUCTION QUERY: Fetch organizations via ownership OR membership

      // 1. Get IDs from memberships
      const { data: memberships, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      const memberOrgIds = memberships?.map(m => m.organization_id) || [];

      // 2. Get IDs from ownership (legacy check, usually covered by members if owner is also a member)
      const { data: owned, error: ownerError } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user.id);

      if (ownerError) throw ownerError;

      const ownedOrgIds = owned?.map(o => o.id) || [];

      // 3. Combine unique IDs
      const allOrgIds = Array.from(new Set([...memberOrgIds, ...ownedOrgIds]));

      if (allOrgIds.length === 0) {
        setOrganizations([]);
        setCurrentOrg(null);
        // Only turn off loading if we turned it on
        if (!isBackgroundRefresh) setIsLoading(false);
        return;
      }

      // 4. Fetch actual organization details
      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', allOrgIds)
        .order('created_at', { ascending: false });

      if (orgError) throw orgError;

      setOrganizations(orgs || []);

      // Logic to preserve selection or select default
      if (!currentOrg) {
        const storedOrgId = localStorage.getItem('prestaFlow_currentOrgId');
        const foundStored = orgs?.find(o => o.id === storedOrgId);

        if (foundStored) {
          setCurrentOrg(foundStored);
        } else if (orgs && orgs.length > 0) {
          setCurrentOrg(orgs[0]);
          localStorage.setItem('prestaFlow_currentOrgId', orgs[0].id);
        }
      }

    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      // Always ensure loading is false at the end, even if it was a background refresh 
      // (safety net, though isBackgroundRefresh avoids the set(true))
      if (!isBackgroundRefresh) {
        setIsLoading(false);
      }
    }
  };

  // Load User Role when Current Org Changes
  useEffect(() => {
    const fetchRole = async () => {
      if (!currentOrg || !user) {
        setUserRole(null);
        setPermissions(null);
        return;
      }

      // Optimistic check: If owner_id matches user
      if (currentOrg.owner_id === user.id) {
        setUserRole('owner');
        // Owners get all permissions by default, but let's fetch anyway to be strict
        const { data: member } = await supabase
          .from('organization_members')
          .select('id')
          .eq('organization_id', currentOrg.id)
          .eq('user_id', user.id)
          .single();

        if (member) {
          const perms = await fetchMemberPermissions(member.id);
          setPermissions(perms);
        } else {
          setPermissions(null);
        }
        return;
      }

      const { data } = await supabase
        .from('organization_members')
        .select('id, role')
        .eq('organization_id', currentOrg.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setUserRole(data.role as UserRole);
        const perms = await fetchMemberPermissions(data.id);
        setPermissions(perms);
      } else {
        setUserRole(null);
        setPermissions(null);
      }
    };
    fetchRole();
  }, [currentOrg, user]);

  useEffect(() => {
    fetchOrganizations();
    checkAndClaimInvitations();
  }, [user]);

  const switchOrganization = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem('prestaFlow_currentOrgId', org.id);
      setMembers([]);
      setPermissions(null); // Reset permissions while loading
    }
  };

  const can = (permissionSlug: string): boolean => {
    if (!userRole) return false; // No role, no permissions

    // 1. Get base permission from role
    const basePermission = permissionSlug as Permission;
    const hasBaseAccess = hasPermission(userRole, basePermission);

    // 2. Check for granular override
    if (!permissions) return hasBaseAccess;
    const override = permissions.find(p => p.slug === permissionSlug);

    // If override exists, it takes precedence
    if (override) {
      return override.is_enabled;
    }

    // Otherwise use role default
    return hasBaseAccess;
  };

  // ------------------------------------------------------------------
  // MEMBER MANAGEMENT
  // ------------------------------------------------------------------

  const loadMembers = async () => {
    if (!currentOrg) return;

    try {
      const [membersResponse, invitationsResponse] = await Promise.all([
        supabase.from('organization_members').select('*').eq('organization_id', currentOrg.id),
        supabase.from('organization_invitations').select('*').eq('organization_id', currentOrg.id)
      ]);

      const invitationsData = invitationsResponse.data || [];

      if (membersResponse.error) throw membersResponse.error;

      const membersData = membersResponse.data || [];

      if (membersData.length === 0) {
        setMembers([]);
        return;
      }

      const userIds = membersData.map((m: any) => m.user_id);
      let profilesMap = new Map();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url')
          .in('id', userIds);

        if (profilesData) {
          profilesMap = new Map(profilesData.map((p: any) => [p.id, p]));
        }
      }

      const mappedMembers = membersData.map((m: any) => {
        const profile = profilesMap.get(m.user_id);
        return {
          ...m,
          profile: profile || { email: 'Usuario Desconocido', id: m.user_id }
        };
      });

      // 3. IDENTIFY & CLEANUP "ZOMBIE" INVITATIONS
      // (Emails that are now members but still have active invitation rows)
      const memberEmails = new Set(mappedMembers.map(m => m.profile?.email?.toLowerCase()).filter(Boolean));
      const zombieInvites = invitationsData.filter(inv => memberEmails.has(inv.invited_email.toLowerCase()));

      if (zombieInvites.length > 0) {
        console.log(`[Pure Logic] Cleaning up ${zombieInvites.length} zombie invitations...`);
        const { error: cleanupError } = await supabase
          .from('organization_invitations')
          .delete()
          .in('id', zombieInvites.map(i => i.id));

        if (cleanupError) console.error("Error cleaning up zombie invites:", cleanupError);
      }

      setMembers(mappedMembers);
      // Filter out zombies from local state for immediate response
      setInvitations(invitationsData.filter(inv => !memberEmails.has(inv.invited_email.toLowerCase())));

    } catch (e) {
      console.error("Error loading members/invitations:", e);
    }
  };

  const inviteMember = async (email: string, role: UserRole): Promise<{ success: boolean; status?: 'ADDED' | 'INVITED'; token?: string; error?: string }> => {
    if (!currentOrg || !user) return { success: false, error: "No hay organización activa o usuario." };

    const normalizedEmail = email.toLowerCase().trim();

    try {
      // 1. Check if user exists in profiles
      let userProfile = null;
      const { data } = await supabase.from('profiles').select('id').eq('email', normalizedEmail).maybeSingle();
      userProfile = data;

      if (userProfile) {
        // 1.1 Add directly if exists
        const exists = members.find(m => m.user_id === userProfile.id);
        if (exists) return { success: false, error: "El usuario ya es miembro del equipo." };

        const { error: insertError } = await supabase.from('organization_members').insert({
          organization_id: currentOrg.id, user_id: userProfile.id, role: role
        });
        if (insertError) throw insertError;

        // Cleanup: Delete any pending invitation for this email now that they are added
        await supabase.from('organization_invitations').delete().eq('organization_id', currentOrg.id).eq('invited_email', normalizedEmail);

        await loadMembers();
        return { success: true, status: 'ADDED' };
      } else {
        // 1.2 Create invitation token if not exists
        const existingInvite = invitations.find(i => i.invited_email === normalizedEmail);
        if (existingInvite) return { success: false, error: "Ya existe una invitación pendiente." };

        // Generate simple token
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7);

        const { error: inviteError } = await supabase.from('organization_invitations').insert({
          organization_id: currentOrg.id, invited_email: normalizedEmail, invited_by_user_id: user.id,
          role: role, token: token, status: 'pending', created_at: new Date().toISOString(), expires_at: expirationDate.toISOString()
        });

        if (inviteError) throw inviteError;
        await loadMembers();
        return { success: true, status: 'INVITED', token };
      }
    } catch (e: any) {
      return { success: false, error: getErrorMessage(e) };
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase.from('organization_invitations').delete().eq('id', invitationId);
      if (error) throw error;
      setInvitations(prev => prev.filter(i => i.id !== invitationId));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: getErrorMessage(e) };
    }
  };

  const updateMemberRole = async (memberId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase.from('organization_members').update({ role: newRole }).eq('id', memberId);
      if (error) throw error;
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: getErrorMessage(e) };
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase.from('organization_members').delete().eq('id', memberId);
      if (error) throw error;
      setMembers(prev => prev.filter(m => m.id !== memberId));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: getErrorMessage(e) };
    }
  };

  // ------------------------------------------------------------------
  // ORGANIZATION MANAGEMENT
  // ------------------------------------------------------------------

  const createOrganization = async (name: string) => {
    if (!user) return { success: false, error: 'No hay usuario autenticado.' };

    // Check if user already owns an org (Plan limit enforcement)
    const existingOwnOrg = organizations.find(o => o.owner_id === user.id);
    if (existingOwnOrg) {
      return { success: false, error: `Plan Gratuito: Ya eres dueño de "${existingOwnOrg.name}".Solo puedes crear una organización.` };
    }

    try {
      const newOrgPayload = { name: name.trim(), owner_id: user.id };
      const { data: newOrg, error: createError } = await supabase.from('organizations').insert([newOrgPayload]).select().single();

      if (createError) throw createError;
      if (!newOrg) throw new Error("La organización se creó pero no se devolvieron datos.");

      // Setup initial member as owner
      await supabase.from('organization_members').insert([{ organization_id: newOrg.id, user_id: user.id, role: 'owner' }]);
      // Setup initial settings
      await supabase.from('settings').insert([{ organization_id: newOrg.id, companyName: name, defaultInterestRate: 10, useOpenAI: false }]);

      await fetchOrganizations();
      switchOrganization(newOrg.id);
      return { success: true };

    } catch (error: any) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  return (
    <OrganizationContext.Provider value={{
      organizations, currentOrg, members, invitations, userRole, permissions, isLoading,
      can, createOrganization, switchOrganization, refreshOrganizations: () => fetchOrganizations(true),
      loadMembers, inviteMember, revokeInvitation, updateMemberRole, removeMember
    }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
