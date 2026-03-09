import React, { createContext, useContext, useState, useEffect } from 'react';

// Roles: 'SUPER_ADMIN', 'ADMIN', 'VOLUNTEER', 'UNAUTHORIZED'
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Check local storage for existing session
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('campaign_user');
        if (savedUser) {
            return JSON.parse(savedUser);
        }
        return null; // null means not logged in
    });

    // Mock Database of users with roles. Real app would fetch this from DB.
    // Assuming 'admin@campaign.com' is a SUPER_ADMIN.
    const [mockUsersDb, setMockUsersDb] = useState(() => {
        const savedDb = localStorage.getItem('campaign_users_db');
        if (savedDb) {
            return JSON.parse(savedDb);
        }
        return [
            { id: 'u1', email: 'admin@campaign.com', name: '슈퍼관리자', role: 'SUPER_ADMIN' },
            { id: 'u2', email: 'user1@campaign.com', name: '김민준', role: 'VOLUNTEER' },
            { id: 'u3', email: 'user2@campaign.com', name: '이서윤', role: 'VOLUNTEER' },
            { id: 'v_pending', email: 'new@campaign.com', name: '신규봉사자', role: 'UNAUTHORIZED' }
        ];
    });

    useEffect(() => {
        if (user) {
            localStorage.setItem('campaign_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('campaign_user');
        }
    }, [user]);

    useEffect(() => {
        localStorage.setItem('campaign_users_db', JSON.stringify(mockUsersDb));
    }, [mockUsersDb]);

    const mockGoogleLogin = (email, name) => {
        // Find existing user in DB
        let dbUser = mockUsersDb.find(u => u.email === email);

        if (!dbUser) {
            // New user, register as UNAUTHORIZED
            dbUser = {
                id: `u_${Date.now()}`,
                email,
                name,
                role: 'UNAUTHORIZED'
            };
            setMockUsersDb(prev => [...prev, dbUser]);
        }

        setUser(dbUser);
    };

    const logout = () => {
        setUser(null);
    };

    // Admin function: Update user role
    const updateUserRole = (userId, newRole) => {
        setMockUsersDb(prev => prev.map(u =>
            u.id === userId ? { ...u, role: newRole } : u
        ));

        // If updating the currently logged in user, update session as well
        if (user && user.id === userId) {
            setUser(prev => ({ ...prev, role: newRole }));
        }
    };

    // Admin function: Get all users
    const getAllUsers = () => {
        return mockUsersDb;
    };

    const value = {
        user,
        mockGoogleLogin,
        logout,
        isAuthenticated: !!user,
        role: user?.role || null,
        updateUserRole,
        getAllUsers
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
