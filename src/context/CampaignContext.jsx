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

    // Real-time listener for current user's assignments (Managers/Assignees)
    useEffect(() => {
        if (!user) {
            setContacts([]);
            return;
        }

        // Fetch contacts assigned to the current user
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
                if (filters.status === 'UNASSIGNED') {
                    query = query.eq('status', 'UNASSIGNED').is('assigned_to', null);
                } else if (filters.status === 'ASSIGNED') {
                    query = query.neq('status', 'CALLED').not('assigned_to', 'is', null);
                } else {
                    query = query.eq('status', filters.status);
                }
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
            if (filters.supportLevel && filters.supportLevel !== 'ALL') {
                query = query.eq('support_level', filters.supportLevel);
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
                .update({ 
                    assigned_to: volunteerId,
                    status: 'ASSIGNED' 
                })
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
                .update({ 
                    assigned_to: actualVolunteerId,
                    status: actualVolunteerId ? 'ASSIGNED' : 'UNASSIGNED'
                })
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
        // Optimistic update
        setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: 'CALLED', surveyResult: result, notes: notes } : c));
        
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
            // Revert on error? Or just leave it as is if real-time will eventually sync
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
        // Optimistic update
        setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...updatedData } : c));

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
                progress: vContacts.length === 0 ? 0 : ((completedContacts.length / vContacts.length) * 100).toFixed(2)
            };
        }
        return { total: 0, completed: 0, remaining: 0, progress: 0 };
    };

    const fetchAllVolunteerStats = async (volunteerIds) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return {};
        if (!volunteerIds || volunteerIds.length === 0) return {};
        
        try {
            // OPTIMIZATION: Instead of 2*N queries, fetch all assigned contacts once
            // and aggregate in memory. For 7-10k contacts, this is vastly faster (hundreds of ms vs 20s).
            const { data, error } = await supabase
                .from('contacts')
                .select('assigned_to, status')
                .not('assigned_to', 'is', null)
                .in('assigned_to', volunteerIds);
            
            if (error) throw error;

            const statsMap = {};
            // Initialize for all requested IDs
            volunteerIds.forEach(vid => {
                statsMap[vid] = { total: 0, completed: 0, remaining: 0, progress: 0 };
            });

            // Aggregate
            (data || []).forEach(contact => {
                const vid = contact.assigned_to;
                if (statsMap[vid]) {
                    statsMap[vid].total++;
                    if (contact.status === 'CALLED') {
                        statsMap[vid].completed++;
                    }
                }
            });

            // Final calculation
            volunteerIds.forEach(vid => {
                const s = statsMap[vid];
                s.remaining = s.total - s.completed;
                s.progress = s.total === 0 ? 0 : ((s.completed / s.total) * 100).toFixed(0);
            });

            return statsMap;
        } catch (error) {
            console.error("Failed to fetch all volunteer stats:", error);
            return {};
        }
    };

    const getCampaignStats = async () => {
        try {
            // OPTIMIZATION: Fetch relevant columns and aggregate in JS to avoid 8+ network calls
            const { data, error } = await supabase
                .from('contacts')
                .select('status, support_level, assigned_to');
            
            if (error) throw error;

            const total = data.length;
            let completed = 0;
            let unassigned = 0;
            const results = {
                '강하게 지지': 0,
                '약하게 지지': 0,
                '관심없음': 0,
                '지지하지 않음': 0,
                '다른후보 지지': 0
            };

            data.forEach(c => {
                if (c.status === 'CALLED') completed++;
                if (!c.assigned_to) unassigned++;
                if (c.support_level && results[c.support_level] !== undefined) {
                    results[c.support_level]++;
                }
            });

            return { 
                total, 
                completed, 
                unassigned, 
                surveyCount: Object.values(results).reduce((a, b) => a + b, 0), 
                results 
            };
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
