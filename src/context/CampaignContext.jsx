import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';

const CampaignContext = createContext();

export const CampaignProvider = ({ children }) => {
    const [contacts, setContacts] = useState([]);
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // Initial setup: Supabase doesn't need client-side seeding usually, 
    // but we can keep it for the first-time setup if needed.
    // However, we'll use our migration script instead.

    // Real-time listener for Volunteers
    useEffect(() => {
        if (!user) {
            setContacts([]);
            return;
        }

        // Admins don't get a global real-time listener anymore to save performance
        if (user.role === 'ADMIN' || user.role === 'DEVELOPER') {
            setLoading(false); 
            return;
        }

        // Volunteers only fetch their assigned contacts
        const fetchMyContacts = async () => {
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('assigned_to', user.id);
            
            if (error) {
                console.error("Error fetching volunteer contacts:", error);
            } else {
                setContacts(data || []);
            }
            setLoading(false);
        };

        fetchMyContacts();

        // Subscribe to changes
        const channel = supabase
            .channel('public:contacts')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'contacts',
                filter: `assigned_to=eq.${user.id}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setContacts(prev => [...prev, payload.new]);
                } else if (payload.eventType === 'UPDATE') {
                    setContacts(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
                } else if (payload.eventType === 'DELETE') {
                    setContacts(prev => prev.filter(c => c.id === payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Admin Paginated Fetching
    const fetchContactsPaginated = async ({ page = 1, pageSize = 50, filters = {}, search = '' }) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return { data: [], total: 0 };
        
        try {
            let query = supabase
                .from('contacts')
                .select('*', { count: 'exact' });

            // Filters
            if (filters.status && filters.status !== 'ALL') {
                query = query.eq('status', filters.status);
            }
            if (filters.region && filters.region !== 'ALL') {
                query = query.eq('region', filters.region);
            }

            // Search
            if (search) {
                const searchStr = `%${search}%`;
                query = query.or(`name.ilike.${searchStr},phone.ilike.${searchStr},job_title.ilike.${searchStr}`);
            }

            // Pagination
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            
            const { data, count, error } = await query
                .order('name', { ascending: true })
                .range(from, to);

            if (error) throw error;

            // Map field names to match frontend expectation (camelCase vs snake_case)
            const mappedData = data.map(c => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                region: c.region,
                jobTitle: c.job_title,
                memberType: c.member_type,
                status: c.status,
                surveyResult: c.survey_result,
                notes: c.notes,
                assignedTo: c.assigned_to
            }));

            return { data: mappedData, total: count || 0 };
        } catch (error) {
            console.error("Pagination fetch failed:", error);
            return { data: [], total: 0 };
        }
    };

    // Admin action: Assign a batch of unassigned contacts to a volunteer
    const assignQuota = async (volunteerId, count) => {
        if (user?.role !== 'ADMIN' && user?.role !== 'DEVELOPER') return;

        setLoading(true);
        try {
            // 1. Get IDs of unassigned contacts
            const { data: unassigned, error: fetchError } = await supabase
                .from('contacts')
                .select('id')
                .is('assigned_to', null)
                .limit(count);
            
            if (fetchError) throw fetchError;
            if (!unassigned || unassigned.length === 0) {
                alert('할당할 수 있는 미배정 연락처가 없습니다.');
                return;
            }

            const ids = unassigned.map(c => c.id);

            // 2. Update them
            const { error: updateError } = await supabase
                .from('contacts')
                .update({ assigned_to: volunteerId })
                .in('id', ids);

            if (updateError) throw updateError;
            
            alert(`${ids.length}명의 연락처를 할당했습니다.`);
        } catch (error) {
            console.error('Failed to assign quota:', error);
            alert('할당 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // Admin action: Reassign specific contacts to a volunteer
    const reassignContacts = async (contactIds, volunteerId) => {
        if (user?.role !== 'ADMIN' && user?.role !== 'DEVELOPER') return;
        const actualVolunteerId = (volunteerId === 'UNASSIGNED' || !volunteerId) ? null : volunteerId;

        try {
            const { error } = await supabase
                .from('contacts')
                .update({ assigned_to: actualVolunteerId })
                .in('id', contactIds);
            
            if (error) throw error;
        } catch (error) {
            console.error('Failed to reassign contacts:', error);
        }
    };

    // Volunteer action: Record call result
    const recordCall = async (contactId, result, notes = '') => {
        try {
            const { error } = await supabase
                .from('contacts')
                .update({
                    status: 'CALLED',
                    survey_result: result,
                    notes: notes
                })
                .eq('id', contactId);
            
            if (error) throw error;
        } catch (error) {
            console.error('Failed to sync call record:', error);
        }
    };

    // Admin action: Add a new contact
    const addContact = async (contactData) => {
        if (user?.role !== 'ADMIN' && user?.role !== 'DEVELOPER') return;

        try {
            const newId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const { error } = await supabase
                .from('contacts')
                .insert([{
                    id: newId,
                    name: contactData.name,
                    phone: contactData.phone,
                    region: contactData.region,
                    job_title: contactData.jobTitle,
                    member_type: contactData.memberType,
                    status: 'UNASSIGNED',
                    notes: contactData.notes || '',
                    assigned_to: null
                }]);
            
            if (error) throw error;
        } catch (error) {
            console.error('Failed to add contact:', error);
        }
    };

    // Admin & Volunteer action: Update an existing contact
    const updateContact = async (contactId, updatedData) => {
        try {
            // Map camelCase to snake_case if applicable
            const payload = {};
            if (updatedData.name !== undefined) payload.name = updatedData.name;
            if (updatedData.phone !== undefined) payload.phone = updatedData.phone;
            if (updatedData.status !== undefined) payload.status = updatedData.status;
            if (updatedData.notes !== undefined) payload.notes = updatedData.notes;
            if (updatedData.assignedTo !== undefined) payload.assigned_to = updatedData.assignedTo;
            if (updatedData.jobTitle !== undefined) payload.job_title = updatedData.jobTitle;
            if (updatedData.surveyResult !== undefined) payload.survey_result = updatedData.surveyResult;

            const { error } = await supabase
                .from('contacts')
                .update(payload)
                .eq('id', contactId);
            
            if (error) throw error;
        } catch (error) {
            console.error('Failed to update contact:', error);
        }
    };

    // Admin action: Delete a contact
    const deleteContact = async (contactId) => {
        if (user?.role !== 'ADMIN' && user?.role !== 'DEVELOPER') return;
        try {
            const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', contactId);
            
            if (error) throw error;
        } catch (error) {
            console.error('Failed to delete contact:', error);
        }
    };

    // Admin action: Fetch contacts for a specific volunteer (one-time fetch)
    const fetchVolunteerContacts = async (volunteerId) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return [];
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('assigned_to', volunteerId);
            
            if (error) throw error;
            return data.map(c => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                region: c.region,
                jobTitle: c.job_title,
                status: c.status,
                surveyResult: c.survey_result,
                notes: c.notes,
                assignedTo: c.assigned_to
            }));
        } catch (error) {
            console.error('Failed to fetch volunteer contacts:', error);
            return [];
        }
    };

    const getVolunteerStats = (volunteerId) => {
        // Since we are using Supabase, we can calculate this from local state if loaded
        // or just return 0s if not.
        const vContacts = contacts.filter(c => c.assigned_to === volunteerId || c.assignedTo === volunteerId);
        if (vContacts.length > 0) {
            const assigned = vContacts;
            const completedContacts = assigned.filter(c => c.status === 'CALLED');
            return {
                total: assigned.length,
                completed: completedContacts.length,
                remaining: assigned.length - completedContacts.length,
                progress: assigned.length === 0 ? 0 : Math.round((completedContacts.length / assigned.length) * 100)
            };
        }
        return { total: 0, completed: 0, remaining: 0, progress: 0 };
    };

    const fetchAllVolunteerStats = async (volunteerIds) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return {};
        
        try {
            // In SQL we can do this with a single efficient query
            const { data, error } = await supabase
                .from('contacts')
                .select('assigned_to, status')
                .in('assigned_to', volunteerIds);

            if (error) throw error;

            const statsMap = {};
            volunteerIds.forEach(vid => {
                const assigned = data.filter(c => c.assigned_to === vid);
                const completed = assigned.filter(c => c.status === 'CALLED').length;
                const total = assigned.length;
                statsMap[vid] = {
                    total,
                    completed,
                    remaining: total - completed,
                    progress: total === 0 ? 0 : Math.round((completed / total) * 100)
                };
            });
            
            return statsMap;
        } catch (error) {
            console.error("Failed to fetch all volunteer stats:", error);
            return {};
        }
    };

    const getCampaignStats = async () => {
        try {
            // Use Supabase for aggregation
            const { count: total } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
            const { count: completed } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('status', 'CALLED');
            const { count: unassigned } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).is('assigned_to', null);

            return { total: total || 0, completed: completed || 0, unassigned: unassigned || 0, surveyCount: completed || 0, results: {} };
        } catch (e) {
            console.error("Stats fetch failed", e);
            return { total: 0, completed: 0, unassigned: 0, surveyCount: 0, results: {}, error: e.message };
        }
    };

    const resetDatabase = async () => {
        if (user?.role !== 'DEVELOPER') return;
        alert('이 기능은 Supabase 환경에서 마이그레이션 스크립트를 통해 지원됩니다.');
    };

    const value = {
        contacts,
        assignQuota,
        reassignContacts,
        recordCall,
        addContact,
        updateContact,
        deleteContact,
        fetchContactsPaginated,
        fetchVolunteerContacts,
        getVolunteerStats,
        fetchAllVolunteerStats,
        getCampaignStats,
        resetDatabase,
        loading
    };

    return (
        <CampaignContext.Provider value={value}>
            {children}
        </CampaignContext.Provider>
    );
};

export const useCampaign = () => useContext(CampaignContext);
