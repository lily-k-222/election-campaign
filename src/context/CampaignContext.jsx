import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';

const CampaignContext = createContext();

// Helper to map snake_case from Postgres to camelCase for Frontend
const mapContact = (c) => {
    if (!c) return null;
    return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        region: c.region,
        age: c.age || '',
        jobTitle: c.job_title || '',
        memberType: c.member_type || '',
        status: c.status || 'UNASSIGNED',
        supportLevel: c.support_level || null,
        surveyResult: c.survey_result || null,
        notes: c.notes || '',
        assignedTo: c.assigned_to,
        callGuide: c.call_guide || ''
    };
};

// Helper to map camelCase from Frontend to snake_case for Postgres
const unmapContact = (data) => {
    const mapped = {};
    if (data.name !== undefined) mapped.name = data.name;
    if (data.phone !== undefined) mapped.phone = data.phone;
    if (data.region !== undefined) mapped.region = data.region;
    if (data.age !== undefined) mapped.age = data.age;
    if (data.jobTitle !== undefined) mapped.job_title = data.jobTitle;
    if (data.memberType !== undefined) mapped.member_type = data.memberType;
    if (data.status !== undefined) mapped.status = data.status;
    if (data.supportLevel !== undefined) mapped.support_level = data.supportLevel;
    if (data.surveyResult !== undefined) mapped.survey_result = data.surveyResult;
    if (data.notes !== undefined) mapped.notes = data.notes;
    if (data.assignedTo !== undefined) mapped.assigned_to = data.assignedTo === 'UNASSIGNED' ? null : data.assignedTo;
    if (data.callGuide !== undefined) mapped.call_guide = data.callGuide;
    return mapped;
};

export const CampaignProvider = ({ children }) => {
    const [contacts, setContacts] = useState([]);
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // Real-time listener for Volunteers
    useEffect(() => {
        if (!user) {
            setContacts([]);
            return;
        }

        // Volunteers only fetch their assigned contacts
        const fetchMyContacts = async () => {
            // Everyone can have assigned contacts to call
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('assigned_to', user.id);
            
            if (error) {
                console.error("Error fetching volunteer contacts:", error);
            } else {
                setContacts((data || []).map(mapContact));
            }
            setLoading(false);
        };

        fetchMyContacts();

        // Subscribe to changes for assigned contacts (for everyone)
        const channel = supabase
                .channel(`public:contacts:${user.id}`)
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'contacts',
                    filter: `assigned_to=eq.${user.id}`
                }, (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setContacts(prev => [...prev, mapContact(payload.new)]);
                    } else if (payload.eventType === 'UPDATE') {
                        setContacts(prev => prev.map(c => c.id === payload.new.id ? mapContact(payload.new) : c));
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
            if (filters.volunteerId && filters.volunteerId !== 'ALL') {
                if (filters.volunteerId === 'UNASSIGNED') {
                    query = query.is('assigned_to', null);
                } else {
                    query = query.eq('assigned_to', filters.volunteerId);
                }
            }

            // Search
            if (search) {
                const searchStr = `%${search}%`;
                query = query.or(`name.ilike.${searchStr},phone.ilike.${searchStr},job_title.ilike.${searchStr},member_type.ilike.${searchStr}`);
            }

            // Pagination
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            
            const { data, count, error } = await query
                .order('name', { ascending: true })
                .range(from, to);

            if (error) throw error;

            return { data: (data || []).map(mapContact), total: count || 0 };
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
        if (user?.role !== 'ADMIN' && user?.role !== 'DEVELOPER') return { success: false, error: 'Unauthorized' };
        const actualVolunteerId = (volunteerId === 'UNASSIGNED' || !volunteerId) ? null : volunteerId;

        try {
            const { error } = await supabase
                .from('contacts')
                .update({ assigned_to: actualVolunteerId })
                .in('id', contactIds);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Failed to reassign contacts:', error);
            return { success: false, error };
        }
    };

    // Action: Record call result
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
            return { success: true };
        } catch (error) {
            console.error('Failed to sync call record:', error);
            return { success: false, error };
        }
    };

    // Admin action: Add a new contact
    const addContact = async (contactData) => {
        if (user?.role !== 'ADMIN' && user?.role !== 'DEVELOPER') return { success: false, error: 'Unauthorized' };

        try {
            const newId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const payload = unmapContact(contactData);
            payload.id = newId;
            payload.status = 'UNASSIGNED';

            const { error } = await supabase
                .from('contacts')
                .insert([payload]);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Failed to add contact:', error);
            return { success: false, error };
        }
    };

    // Admin & Volunteer action: Update an existing contact
    const updateContact = async (contactId, updatedData) => {
        try {
            const payload = unmapContact(updatedData);

            const { error } = await supabase
                .from('contacts')
                .update(payload)
                .eq('id', contactId);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Failed to update contact:', error);
            return { success: false, error };
        }
    };

    // Admin action: Delete a contact
    const deleteContact = async (contactId) => {
        if (user?.role !== 'ADMIN' && user?.role !== 'DEVELOPER') return { success: false, error: 'Unauthorized' };
        try {
            const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', contactId);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Failed to delete contact:', error);
            return { success: false, error };
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
            return (data || []).map(mapContact);
        } catch (error) {
            console.error('Failed to fetch volunteer contacts:', error);
            return [];
        }
    };

    const getVolunteerStats = (volunteerId) => {
        const vContacts = contacts.filter(c => c.assignedTo === volunteerId);
        if (vContacts.length > 0) {
            const completedContacts = vContacts.filter(c => c.status === 'CALLED');
            return {
                total: vContacts.length,
                completed: completedContacts.length,
                remaining: vContacts.length - completedContacts.length,
                progress: vContacts.length === 0 ? 0 : Math.round((completedContacts.length / vContacts.length) * 100)
            };
        }
        return { total: 0, completed: 0, remaining: 0, progress: 0 };
    };

    const fetchAllVolunteerStats = async (volunteerIds) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return {};
        
        try {
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
