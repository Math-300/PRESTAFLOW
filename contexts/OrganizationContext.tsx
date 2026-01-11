
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { Organization, OrganizationMember, OrganizationInvitation, UserRole } from '../types';
import { getErrorMessage } from '../utils/format';

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
  userRole: UserRole | null;
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(true);

  // 1. Check for Pending Invitations on Login
  const checkAndClaimInvitations = async () => {
      if (!user || !user.email) return;

      try {
          const { data: pendingInvites } = await supabase
              .from('organization_invitations')
              .select('*')
              .eq('invited_email', user.email);

          if (pendingInvites && pendingInvites.length > 0) {
              let claimed = false;
              for (const invite of pendingInvites) {
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
                 await fetchOrganizations();
              }
          }
      } catch (error) {
          console.error("Error claiming invitations:", error);
      }
  };

  const fetchOrganizations = async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
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
          setIsLoading(false);
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

      const storedOrgId = localStorage.getItem('prestaFlow_currentOrgId');
      const foundStored = orgs?.find(o => o.id === storedOrgId);

      if (foundStored) {
        setCurrentOrg(foundStored);
      } else if (orgs && orgs.length > 0) {
        setCurrentOrg(orgs[0]);
        localStorage.setItem('prestaFlow_currentOrgId', orgs[0].id);
      } else {
        setCurrentOrg(null);
      }

    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load User Role when Current Org Changes
  useEffect(() => {
    const fetchRole = async () => {
        if (!currentOrg || !user) {
            setUserRole(null);
            return;
        }

        // Optimistic check: If owner_id matches user
        if (currentOrg.owner_id === user.id) {
            setUserRole('owner');
            return;
        }

        const { data } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', currentOrg.id)
            .eq('user_id', user.id)
            .maybeSingle();
            
        if (data) setUserRole(data.role as UserRole);
        else setUserRole(null);
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
    }
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

          if (!invitationsResponse.error) {
             setInvitations(invitationsResponse.data || []);
          }

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

          const mappedMembers = membersData.map((m: any) => ({
             ...m,
             profile: profilesMap.get(m.user_id) || { email: 'Usuario', id: m.user_id } 
          }));
          
          setMembers(mappedMembers);

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
      } catch(e: any) {
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
        return { success: false, error: `Plan Gratuito: Ya eres dueño de "${existingOwnOrg.name}". Solo puedes crear una organización.` };
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
      organizations, currentOrg, members, invitations, userRole, isLoading,
      createOrganization, switchOrganization, refreshOrganizations: fetchOrganizations,
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
