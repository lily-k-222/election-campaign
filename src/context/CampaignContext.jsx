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
        if (user.role === 'ADMIN') {
            // Fetch all contacts (warning: for large DBs, use server-side pagination)
            q = query(collection(db, 'contacts'));
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
        if (user?.role !== 'ADMIN') return;

        try {
            const unassigned = contacts.filter(c => !c.assignedTo || c.assignedTo === 'UNASSIGNED').slice(0, count);
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

    // Admin action: Reassign specific contacts to a volunteer
    const reassignContacts = async (contactIds, volunteerId) => {
        if (user?.role !== 'ADMIN') return;

        try {
            const batch = writeBatch(db);
            const actualVolunteerId = volunteerId === 'UNASSIGNED' ? null : volunteerId;
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
        if (user?.role !== 'ADMIN') return;

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
        if (user?.role !== 'ADMIN') return;
        try {
            await deleteDoc(doc(db, 'contacts', contactId));
        } catch (error) {
            console.error('Failed to delete contact:', error);
        }
    };


    const importBulkContacts = async (contactsArray) => {
        if (user?.role !== 'ADMIN') return;
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

    const getVolunteerStats = (volunteerId) => {
        const assigned = contacts.filter(c => c.assignedTo === volunteerId);
        const completedContacts = assigned.filter(c => c.status === 'CALLED' || c.supportLevel);
        return {
            total: assigned.length,
            completed: completedContacts.length,
            remaining: assigned.length - completedContacts.length,
            progress: assigned.length === 0 ? 0 : Math.round((completedContacts.length / assigned.length) * 100)
        };
    };

    const getCampaignStats = () => {
        const total = contacts.length;
        const isCompleted = (c) => c.status === 'CALLED' || c.supportLevel;
        const completed = contacts.filter(isCompleted).length;

        // Tally results
        const results = {
            '강하게 지지': 0,
            '약하게 지지': 0,
            '관심없음': 0,
            '지지하지 않음': 0,
            '다른후보 지지': 0
        };
        let surveyCount = 0;
        contacts.filter(isCompleted).forEach(c => {
            const level = c.supportLevel;
            if (level && results[level] !== undefined) {
                results[level]++;
                surveyCount++;
            }
        });

        return { total, completed, surveyCount, results };
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
