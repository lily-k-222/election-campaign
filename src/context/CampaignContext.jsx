import React, { createContext, useContext, useState } from 'react';
import contactsData from '../data/contacts.json';

const CampaignContext = createContext();

const mockContacts = contactsData;

export const CampaignProvider = ({ children }) => {
    const [contacts, setContacts] = useState(mockContacts);

    // Admin action: Assign a batch of unassigned contacts to a volunteer
    const assignQuota = async (volunteerId, count) => {
        // Optimistic UI update
        setContacts(prev => {
            let assignedCount = 0;
            return prev.map(contact => {
                if (!contact.assignedTo && assignedCount < count) {
                    assignedCount++;
                    return { ...contact, assignedTo: volunteerId };
                }
                return contact;
            });
        });

        // Sync with backend mock API
        try {
            await fetch('/api/assign-quota', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ volunteerId, count })
            });
        } catch (error) {
            console.error('Failed to sync quota assignment:', error);
        }
    };

    // Volunteer action: Record call result
    const recordCall = async (contactId, result, notes = '') => {
        // Optimistic UI update
        setContacts(prev =>
            prev.map(contact =>
                contact.id === contactId
                    ? { ...contact, status: 'CALLED', surveyResult: result, notes }
                    : contact
            )
        );

        // Sync with backend mock API
        try {
            await fetch('/api/record-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactId, result, notes })
            });
        } catch (error) {
            console.error('Failed to sync call record:', error);
        }
    };

    // Admin action: Add a new contact
    const addContact = (contactData) => {
        setContacts(prev => [
            ...prev,
            {
                ...contactData,
                id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                status: 'UNASSIGNED',
                surveyResult: null,
                notes: contactData.notes || '',
                assignedTo: null
            }
        ]);
    };

    // Admin action: Update an existing contact
    const updateContact = (contactId, updatedData) => {
        setContacts(prev =>
            prev.map(contact =>
                contact.id === contactId
                    ? { ...contact, ...updatedData }
                    : contact
            )
        );
    };

    // Admin action: Delete a contact
    const deleteContact = (contactId) => {
        setContacts(prev => prev.filter(contact => contact.id !== contactId));
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
        getCampaignStats
    };

    return (
        <CampaignContext.Provider value={value}>
            {children}
        </CampaignContext.Provider>
    );
};

export const useCampaign = () => useContext(CampaignContext);
