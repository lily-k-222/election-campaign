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
            const contactsRef = collection(db, 'contacts');
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
            const contactsRef = collection(db, 'contacts');
            let q = query(contactsRef);

            // 1. Total Count (using optimized getCountFromServer)
            // Note: Filtered counts in Firestore are still billable per index, 
            // but significantly cheaper than fetching docs.
            let countQuery = query(contactsRef);
            if (filters.status && filters.status !== 'ALL') {
                countQuery = query(countQuery, where('status', '==', filters.status));
            }
            if (filters.region && filters.region !== 'ALL') {
                countQuery = query(countQuery, where('region', '==', filters.region));
            }
            
            const totalSnap = await getCountFromServer(countQuery);
            const total = totalSnap.data().count;

            // 2. Data Fetching with sorting and paging
            // Note: True offset/startAfter is better for performance, 
            // but simple limit is okay for small datasets if we sort consistently.
            // For now, sorting by name.
            let dataQuery = query(contactsRef, orderBy('name'), limit(1000)); // Fetch a reasonable chunk for local filter/paging

            if (filters.status && filters.status !== 'ALL') {
                dataQuery = query(dataQuery, where('status', '==', filters.status));
            }
            if (filters.region && filters.region !== 'ALL') {
                dataQuery = query(dataQuery, where('region', '==', filters.region));
            }

            const snapshot = await getDocs(dataQuery);
            let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 3. Search (Local for now due to Firestore wildcard constraints)
            if (search) {
                const queryStr = search.toLowerCase();
                results = results.filter(c => 
                    (c.name && c.name.toLowerCase().includes(queryStr)) || 
                    (c.phone && c.phone.includes(queryStr)) ||
                    (c.jobTitle && c.jobTitle.toLowerCase().includes(queryStr))
                );
            }

            const filteredTotal = search ? results.length : total;
            const paginatedData = results.slice((page - 1) * pageSize, page * pageSize);

            return { data: paginatedData, total: filteredTotal };
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

    // Admin action: Fetch contacts for a specific volunteer (one-time fetch)
    const fetchVolunteerContacts = async (volunteerId) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return [];
        try {
            const q = query(collection(db, 'contacts'), where('assignedTo', '==', volunteerId));
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Failed to fetch volunteer contacts:', error);
            return [];
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

    const resetDatabase = async () => {
        if (user?.role !== 'DEVELOPER') return;
        
        if (!window.confirm("⚠️ 위험: 데이터베이스의 모든 연락처를 삭제하고 contacts.json 데이터로 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
            return;
        }

        setLoading(true);
        try {
            console.log("Starting full database reset...");
            
            // 1. Wipe everything (in chunks of 400)
            const contactsRef = collection(db, 'contacts');
            let hasMore = true;
            let totalDeleted = 0;
            while (hasMore) {
                const snap = await getDocs(query(contactsRef, limit(400)));
                if (snap.empty) {
                    hasMore = false;
                    break;
                }
                const batch = writeBatch(db);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                totalDeleted += snap.size;
                console.log(`Deleted ${totalDeleted} contacts...`);
                // Increase delay to 1 second to be very safe with rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 2. Re-seed from contacts.json
            const dataToSeed = contactsData; 
            for (let i = 0; i < dataToSeed.length; i += 400) {
                const chunk = dataToSeed.slice(i, i + 400);
                const batch = writeBatch(db);
                chunk.forEach(c => {
                    batch.set(doc(db, 'contacts', c.id), {
                        ...c,
                        status: c.status || 'UNASSIGNED',
                        assignedTo: c.assignedTo || null
                    });
                });
                await batch.commit();
                console.log(`Seeded ${Math.min(i + 400, dataToSeed.length)}/${dataToSeed.length}...`);
                // Increase delay to 1 second to be very safe with rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            alert(`성공적으로 데이터베이스를 초기화하고 ${dataToSeed.length}개의 연락처를 등록했습니다.`);
            window.location.reload(); 
        } catch (error) {
            console.error('Failed to reset database:', error);
            alert('초기화 중 오류가 발생했습니다: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getVolunteerStats = (volunteerId) => {
        // If we already have the contacts in state (for the volunteer themselves)
        if (contacts.length > 0 && user?.id === volunteerId) {
            const assigned = contacts.filter(c => c.assignedTo === volunteerId);
            const completedContacts = assigned.filter(c => c.status === 'CALLED');
            return {
                total: assigned.length,
                completed: completedContacts.length,
                remaining: assigned.length - completedContacts.length,
                progress: assigned.length === 0 ? 0 : Math.round((completedContacts.length / assigned.length) * 100)
            };
        }
        
        // Otherwise, use the pre-calculated stats from AdminDashboard (or return 0s)
        // Note: For a proper implementation, this should be reactive, but since
        // Admins now fetch stats manually, we return the cached value if exist.
        // For the VolunteerDashboard specifically, we'll fetch docs if not loaded.
        return { total: 0, completed: 0, remaining: 0, progress: 0 };
    };

    const fetchAllVolunteerStats = async (volunteerIds) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return {};
        
        try {
            const statsMap = {};
            const contactsRef = collection(db, 'contacts');
            
            // To save quota, we process them sequentially with a small delay
            for (const vid of volunteerIds) {
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
                // Small sleep to stay under rate limit
                await new Promise(r => setTimeout(r, 100));
            }
            
            return statsMap;
        } catch (error) {
            console.error("Failed to fetch all volunteer stats:", error);
            return {};
        }
    };

    const getCampaignStats = async () => {
        try {
            const contactsRef = collection(db, 'contacts');
            
            // Critical optimization: Use simple counts with catch to handle quota
            const totalSnap = await getCountFromServer(contactsRef).catch(() => null);
            if (!totalSnap) throw new Error("Quota Exceeded");
            const total = totalSnap.data().count;

            const completedSnap = await getCountFromServer(query(contactsRef, where('status', '==', 'CALLED'))).catch(() => ({ data: () => ({ count: 0 }) }));
            const completed = (completedSnap.data && completedSnap.data()) ? completedSnap.data().count : 0;

            const unassignedSnap = await getCountFromServer(query(contactsRef, where('assignedTo', '==', null))).catch(() => ({ data: () => ({ count: 0 }) }));
            const unassigned = (unassignedSnap.data && unassignedSnap.data()) ? unassignedSnap.data().count : 0;

            return { total, completed, unassigned, surveyCount: completed, results: {} };
        } catch (e) {
            console.error("Stats fetch failed", e);
            return { total: 0, completed: 0, unassigned: 0, surveyCount: 0, results: {}, error: e.message };
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
