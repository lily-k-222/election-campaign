import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, setDoc, deleteDoc, getDocs, query, where, limit } from 'firebase/firestore';
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
            const snap = await getDocs(contactsRef);
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

    // Listen to contacts in real-time
    useEffect(() => {
        if (!user) {
            setContacts([]);
            return;
        }

        let q;
        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
            // Fetch only top 50 to prevent quota limit errors during demo
            // In a real app, this would use pagination or specific filters
            q = query(collection(db, 'contacts'), limit(50));
        } else {
            // Volunteers only fetch their assigned contacts
            q = query(collection(db, 'contacts'), where('assignedTo', '==', user.id));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const contactsList = [];
            snapshot.forEach((doc) => {
                contactsList.push({ id: doc.id, ...doc.data() });
            });
            setContacts(contactsList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Admin action: Assign a batch of unassigned contacts to a volunteer
    const assignQuota = async (volunteerId, count) => {
        if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') return;

        try {
            const unassigned = contacts.filter(c => !c.assignedTo).slice(0, count);
            const batch = writeBatch(db);
            
            unassigned.forEach(c => {
                const contactRef = doc(db, 'contacts', c.id);
                batch.update(contactRef, { assignedTo: volunteerId });
            });
            
            await batch.commit();
        } catch (error) {
            console.error('Failed to assign quota:', error);
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
        if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') return;

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
        if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') return;
        try {
            await deleteDoc(doc(db, 'contacts', contactId));
        } catch (error) {
            console.error('Failed to delete contact:', error);
        }
    };

    // Admin action: Reset DB with 30 Test Contacts
    const resetTestData = async () => {
        if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') return;
        
        const confirmReset = window.confirm("경고: 현재 DB의 '모든 실제 연락처'가 영구 삭제되고 30개의 임시 테스트 데이터로 교체됩니다. 계속하시겠습니까?");
        if (!confirmReset) return;

        try {
            setLoading(true);
            const contactsRef = collection(db, 'contacts');
            const snap = await getDocs(contactsRef);
            
            // Delete existing
            const deleteBatch = writeBatch(db);
            snap.docs.forEach(docSnap => {
                deleteBatch.delete(docSnap.ref);
            });
            await deleteBatch.commit();

            // Add 30 dummy
            const addBatch = writeBatch(db);
            for (let i = 1; i <= 30; i++) {
                const newId = `test_c_${Date.now()}_${i}`;
                const docRef = doc(db, 'contacts', newId);
                addBatch.set(docRef, {
                    id: newId,
                    name: `테스트당원 ${i}`,
                    age: `${20 + (i % 5)*10}대`,
                    memberType: i % 2 === 0 ? '권리당원' : '일반당원',
                    region: `테스트동 ${i}구`,
                    phone: `010-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
                    status: 'UNASSIGNED',
                    surveyResult: null,
                    notes: '테스트용 데이터입니다.',
                    assignedTo: null
                });
            }
            await addBatch.commit();
            alert('기존 데이터를 모두 삭제하고 30개의 테스트 연락처를 생성했습니다.');
            window.location.reload();
        } catch (error) {
            console.error('Failed to reset test data:', error);
            alert('테스트 데이터 생성 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const getVolunteerStats = (volunteerId) => {
        const assigned = contacts.filter(c => c.assignedTo === volunteerId);
        const completed = assigned.filter(c => c.status === 'CALLED');
        return {
            total: assigned.length,
            completed: completed.length,
            remaining: assigned.length - completed.length,
            progress: assigned.length === 0 ? 0 : Math.round((completed.length / assigned.length) * 100)
        };
    };

    const getCampaignStats = () => {
        const total = contacts.length;
        const completed = contacts.filter(c => c.status === 'CALLED' || c.supportLevel || c.notes).length;

        // Tally results
        const results = {
            '강하게 지지': 0,
            '약하게 지지': 0,
            '관심없음': 0,
            '지지하지 않음': 0,
            '다른후보 지지': 0
        };
        contacts.filter(c => c.status === 'CALLED' || c.supportLevel || c.notes).forEach(c => {
            const level = c.supportLevel || '관심없음';
            if (results[level] !== undefined) {
                results[level]++;
            } else {
                results['관심없음']++; // default bucket
            }
        });

        return { total, completed, results };
    };

    const value = {
        contacts,
        assignQuota,
        recordCall,
        addContact,
        updateContact,
        deleteContact,
        resetTestData,
        getVolunteerStats,
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
