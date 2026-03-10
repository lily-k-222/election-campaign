import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, setDoc, deleteDoc, getDocs, query, where, limit, getCountFromServer } from 'firebase/firestore';
import contactsData from '../data/contacts.json';
import { useAuth } from './AuthContext';

const CampaignContext = createContext();

export const CampaignProvider = ({ children }) => {
    const [contacts, setContacts] = useState([]);
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // Initial setup: Seed mock data to Firestore if it's empty
    useEffect(() => {
        const seedData = async () => {
            const q = query(contactsRef, limit(1));
            const snap = await getDocs(q);
            if (snap.empty) {
                const chunkSize = 450;
                for (let i = 0; i < contactsData.length; i += chunkSize) {
                    const chunk = contactsData.slice(i, i + chunkSize);
                    const batch = writeBatch(db);
                    chunk.forEach(c => {
                        const docRef = doc(db, 'contacts', c.id);
                        batch.set(docRef, {
                            ...c,
                            status: c.status || 'UNASSIGNED',
                            surveyResult: c.surveyResult || null,
                            notes: c.notes || '',
                            assignedTo: c.assignedTo || null
                        });
                    });
                    await batch.commit();
                }
            }
        };
        seedData();
    }, []);

    // Real-time listener only for Volunteers (limited scope)
    useEffect(() => {
        if (!user) {
            setContacts([]);
            return;
        }

        // Admins don't get a global real-time listener anymore to save quota
        if (user.role === 'ADMIN' || user.role === 'DEVELOPER') {
            setLoading(false); 
            return;
        }

        // Volunteers only fetch their assigned contacts (Real-time is okay here as scope is small)
        const q = query(collection(db, 'contacts'), where('assignedTo', '==', user.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const contactsList = [];
            snapshot.forEach((doc) => {
                contactsList.push({ id: doc.id, ...doc.data() });
            });
            setContacts(contactsList);
            setLoading(false);
        }, (error) => {
            console.error("Volunteer snapshot error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Admin Paginated Fetching
    const fetchContactsPaginated = async ({ page = 1, pageSize = 50, filters = {}, search = '' }) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return { data: [], total: 0 };
        
        try {
            let q = query(collection(db, 'contacts'));

            // Apply filters (simple equality for now to avoid complex index requirements)
            if (filters.status && filters.status !== 'ALL') {
                q = query(q, where('status', '==', filters.status));
            }
            if (filters.region && filters.region !== 'ALL') {
                q = query(q, where('region', '==', filters.region));
            }
            if (filters.memberType && filters.memberType !== 'ALL') {
                q = query(q, where('memberType', '==', filters.memberType));
            }

            // Note: Search is tricky in Firestore. For now, we'll fetch a larger set and filter locally 
            // OR if search is used, we only fetch a limited number.
            // TRUE server-side search needs Algolia/Elastic or a custom backend.
            // To save quota, we'll implement a basic "starts with" or similar if possible, 
            // but for name/phone it's better to use specific queries.
            
            const snapshot = await getDocs(q);
            let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Local filtering for search (necessary due to Firestore limitations)
            if (search) {
                const queryStr = search.toLowerCase();
                results = results.filter(c => 
                    c.name.toLowerCase().includes(queryStr) || 
                    (c.phone && c.phone.includes(queryStr))
                );
            }

            const total = results.length;
            const paginatedData = results.slice((page - 1) * pageSize, page * pageSize);

            // Update main contacts state only for the visible context if needed, 
            // but for Admin Dashboard it's better to return the data directly
            return { data: paginatedData, total };
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
            // Fetch only unassigned contacts from Firestore to save quota
            const q = query(collection(db, 'contacts'), where('assignedTo', '==', null), limit(count));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                alert('할당할 수 있는 미배정 연락처가 없습니다.');
                setLoading(false);
                return;
            }

            const batch = writeBatch(db);
            snapshot.docs.forEach(docSnap => {
                batch.update(doc(db, 'contacts', docSnap.id), { assignedTo: volunteerId });
            });
            
            await batch.commit();
            alert(`${snapshot.size}명의 연락처를 할당했습니다.`);
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

        try {
            const batch = writeBatch(db);
            const actualVolunteerId = (volunteerId === 'UNASSIGNED' || !volunteerId) ? null : volunteerId;
            contactIds.forEach(id => {
                const contactRef = doc(db, 'contacts', id);
                batch.update(contactRef, { assignedTo: actualVolunteerId });
            });
            await batch.commit();
        } catch (error) {
            console.error('Failed to reassign contacts:', error);
        }
    };

    // Volunteer action: Record call result
    const recordCall = async (contactId, result, notes = '') => {
        try {
            const contactRef = doc(db, 'contacts', contactId);
            await updateDoc(contactRef, {
                status: 'CALLED',
                surveyResult: result,
                notes: notes
            });
        } catch (error) {
            console.error('Failed to sync call record:', error);
        }
    };

    // Admin action: Add a new contact
    const addContact = async (contactData) => {
        if (user?.role !== 'ADMIN' && user?.role !== 'DEVELOPER') return;

        try {
            const newId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            await setDoc(doc(db, 'contacts', newId), {
                ...contactData,
                status: 'UNASSIGNED',
                surveyResult: null,
                notes: contactData.notes || '',
                assignedTo: null
            });
        } catch (error) {
            console.error('Failed to add contact:', error);
        }
    };

    // Admin & Volunteer action: Update an existing contact
    const updateContact = async (contactId, updatedData) => {
        try {
            await updateDoc(doc(db, 'contacts', contactId), updatedData);
        } catch (error) {
            console.error('Failed to update contact:', error);
        }
    };

    // Admin action: Delete a contact
    const deleteContact = async (contactId) => {
        if (user?.role !== 'ADMIN' && user?.role !== 'DEVELOPER') return;
        try {
            await deleteDoc(doc(db, 'contacts', contactId));
        } catch (error) {
            console.error('Failed to delete contact:', error);
        }
    };


    const importBulkContacts = async (contactsArray) => {
        if (user?.role !== 'DEVELOPER') return;
        setLoading(true);
        try {
            for (let i = 0; i < contactsArray.length; i += 400) {
                const chunk = contactsArray.slice(i, i + 400);
                const batch = writeBatch(db);
                chunk.forEach(c => {
                    const docRef = doc(db, 'contacts', c.id);
                    batch.set(docRef, { ...c });
                });
                await batch.commit();
            }
            alert(`성공적으로 ${contactsArray.length}명의 연락처를 통합 업로드했습니다.`);
        } catch (error) {
            console.error('Failed to import bulk contacts:', error);
            alert('데이터 업로드 중 오류가 발생했습니다. 권한을 확인해주세요.');
        } finally {
            setLoading(false);
        }
    };

    const getVolunteerStatsLocal = (volunteerId) => {
        const assigned = contacts.filter(c => c.assignedTo === volunteerId);
        const completedContacts = assigned.filter(c => c.status === 'CALLED' || c.supportLevel);
        return {
            total: assigned.length,
            completed: completedContacts.length,
            remaining: assigned.length - completedContacts.length,
            progress: assigned.length === 0 ? 0 : Math.round((completedContacts.length / assigned.length) * 100)
        };
    };

    const fetchAllVolunteerStats = async (volunteerIds) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return {};
        
        try {
            const statsMap = {};
            const contactsRef = collection(db, 'contacts');
            
            await Promise.all(volunteerIds.map(async (vid) => {
                const totalSnap = await getCountFromServer(query(contactsRef, where('assignedTo', '==', vid)));
                const completedSnap = await getCountFromServer(query(contactsRef, where('assignedTo', '==', vid), where('status', '==', 'CALLED')));
                
                const total = totalSnap.data().count;
                const completed = completedSnap.data().count;
                
                statsMap[vid] = {
                    total,
                    completed,
                    remaining: total - completed,
                    progress: total === 0 ? 0 : Math.round((completed / total) * 100)
                };
            }));
            
            return statsMap;
        } catch (error) {
            console.error("Failed to fetch all volunteer stats:", error);
            return {};
        }
    };

    const getCampaignStats = async () => {
        try {
            const contactsRef = collection(db, 'contacts');
            
            // 1. Total Count
            const totalSnap = await getCountFromServer(contactsRef);
            const total = totalSnap.data().count;

            // 2. Completed (CALLED or has supportLevel)
            // Note: For complex OR logic we'd need separate counts or a 'isCompleted' flag field
            // But since 'CALLED' status is the primary indicator:
            const completedSnap = await getCountFromServer(query(contactsRef, where('status', '==', 'CALLED')));
            const completed = completedSnap.data().count;

            // 3. Unassigned
            const unassignedSnap = await getCountFromServer(query(contactsRef, where('assignedTo', '==', null)));
            const unassigned = unassignedSnap.data().count;

            // 4. Survey Results (Support Levels)
            const levels = ['강하게 지지', '약하게 지지', '관심없음', '지지하지 않음', '다른후보 지지'];
            const results = {};
            let surveyCount = 0;

            await Promise.all(levels.map(async (level) => {
                const snap = await getCountFromServer(query(contactsRef, where('supportLevel', '==', level)));
                results[level] = snap.data().count;
                surveyCount += results[level];
            }));

            return { total, completed, unassigned, surveyCount, results };
        } catch (e) {
            console.error("Stats fetch failed", e);
            // Fallback for safety
            return { total: 0, completed: 0, unassigned: 0, surveyCount: 0, results: {} };
        }
    };

    const value = {
        contacts,
        assignQuota,
        reassignContacts,
        recordCall,
        addContact,
        updateContact,
        deleteContact,
        importBulkContacts,
        fetchContactsPaginated,
        getVolunteerStats: user?.role === 'VOLUNTEER' ? getVolunteerStatsLocal : () => ({ total: 0, completed: 0, remaining: 0, progress: 0 }),
        fetchAllVolunteerStats,
        getCampaignStats,
        loading
    };

    return (
        <CampaignContext.Provider value={value}>
            {children}
        </CampaignContext.Provider>
    );
};

export const useCampaign = () => useContext(CampaignContext);
