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
            // Fetch only top 500 to prevent quota limit errors during demo
            // In a real app, this would use pagination or specific filters
            q = query(collection(db, 'contacts'), limit(500));
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
        const completed = contacts.filter(c => c.status === 'CALLED').length;

        // Tally results
        const results = {
            STRONG_SUPPORT: 0,
            LEAN_SUPPORT: 0,
            UNDECIDED: 0,
            NO_RESPONSE: 0,
            SUPPORT_CHA: 0,
            SUPPORT_KANG: 0
        };
        contacts.filter(c => c.status === 'CALLED').forEach(c => {
            if (results[c.surveyResult] !== undefined) {
                results[c.surveyResult]++;
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
