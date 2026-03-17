import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';

// Roles: 'DEVELOPER', 'ADMIN', 'VOLUNTEER', 'UNAUTHORIZED'
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Initial Auth State and Listener (Supabase Auth)
    useEffect(() => {
        let isInit = true;
        console.log("AuthV3: Initialization starting...");

        const checkInitialSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    console.log("AuthV3: Initial session found:", session.user.email);
                    await handleUserSession(session.user);
                } else {
                    console.log("AuthV3: No initial session found.");
                }
            } catch (err) {
                console.error("AuthV3: Initial session check failed:", err);
            } finally {
                if (isInit) {
                    console.log("AuthV3: Releasing initial loading state.");
                    setLoading(false);
                }
            }
        };

        checkInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("AuthV3 Event:", event, session?.user?.email);
            
            if (session?.user) {
                await handleUserSession(session.user);
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setAllUsers([]);
                setLoading(false);
            }
            
            if (isInit && event === 'INITIAL_SESSION') {
                isInit = false;
                if (!session) {
                    console.log("AuthV3: Initial session event with no user.");
                    setLoading(false);
                }
            }
        });

        const safetyTimer = setTimeout(() => {
            if (loading) {
                console.warn("AuthV3: Safety timeout reached. Releasing loading.");
                setLoading(false);
            }
        }, 12000); // 12s safety margin

        return () => {
            subscription.unsubscribe();
            clearTimeout(safetyTimer);
            isInit = false;
        };
    }, []);

    const handleUserSession = async (authUser) => {
        try {
            // 1. Check if user exists in our 'users' table by their Supabase Auth ID
            const { data: userData, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle();

            if (userData) {
                setUser({ ...userData });
                setLoading(false);
                return;
            }

            // 2. If not found by ID, try finding them by EMAIL (Migration Case)
            // Use ilike for case-insensitive matching
            const { data: existingByEmail } = await supabase
                .from('users')
                .select('*')
                .ilike('email', authUser.email)
                .maybeSingle();

            if (existingByEmail) {
                const oldId = existingByEmail.id;
                console.log(`Migration: Linking existing user ${authUser.email} (${oldId}) to new Supabase ID (${authUser.id})`);
                
                // 1. Update the user ID in the users table
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ id: authUser.id })
                    .eq('email', authUser.email);

                if (!updateError) {
                    console.log(`Migration: User ID updated. Now syncing contacts assigned to ${oldId}`);
                    // 2. Sync contacts assigned to the old ID
                    const { error: contactSyncError } = await supabase
                        .from('contacts')
                        .update({ assigned_to: authUser.id })
                        .eq('assigned_to', oldId);
                    
                    if (contactSyncError) {
                        console.error("Migration: Contact sync failed:", contactSyncError);
                    } else {
                        console.log("Migration: Contact sync successful.");
                    }
                    
                    setUser({ ...existingByEmail, id: authUser.id });
                } else {
                    console.error("Migration ID link failed:", updateError);
                    // Fallback to local user even if update fails
                    setUser({ ...existingByEmail });
                }
            } else {
                // 3. Brand New User Creation
                let assignedRole = 'UNAUTHORIZED';
                if (authUser.email === 'wangjaelee@gmail.com') {
                    assignedRole = 'ADMIN';
                } else if (authUser.email === 'soomin8454@gmail.com') {
                    assignedRole = 'DEVELOPER';
                }

                const newUser = {
                    id: authUser.id,
                    email: authUser.email.toLowerCase(),
                    name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
                    role: assignedRole
                };

                const { error: insErr } = await supabase
                    .from('users')
                    .insert([newUser]);

                if (!insErr) {
                    setUser(newUser);
                } else {
                    // If it's a conflict, try to fetch it one last time
                    if (insErr.code === '23505') {
                        const { data: retryData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
                        if (retryData) setUser(retryData);
                    }
                    console.error("Supabase user creation failed", insErr);
                }
            }
        } catch (err) {
            console.error("User session handling error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase.from('users').select('*');
            if (!error) setAllUsers(data || []);
        } catch (e) {
            console.error("fetchUsers error", e);
        }
    };

    const getAllUsers = () => allUsers;

    // Sync all users for Admins
    useEffect(() => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) {
            setAllUsers([]);
            return;
        }

        fetchUsers();

        const channel = supabase
            .channel('public:users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setAllUsers(prev => [...prev, payload.new]);
                } else if (payload.eventType === 'UPDATE') {
                    setAllUsers(prev => prev.map(u => u.id === payload.new.id ? payload.new : u));
                    if (payload.new.id === user.id) {
                        setUser(prev => ({ ...prev, role: payload.new.role }));
                    }
                } else if (payload.eventType === 'DELETE') {
                    setAllUsers(prev => prev.filter(u => u.id === payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, user?.role]);

    const login = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error("Supabase Login failed", error);
            throw error;
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    const updateUserName = async (userId, newName) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return;
        try {
            const { error } = await supabase.from('users').update({ name: newName }).eq('id', userId);
            if (error) return { success: false, error };
            return { success: true };
        } catch (error) {
            return { success: false, error };
        }
    };

    const updateUserRole = async (userId, newRole) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return { success: false, error: 'Unauthorized' };
        try {
            const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
            if (error) return { success: false, error };
            return { success: true };
        } catch (error) {
            return { success: false, error };
        }
    };

    const addUserManually = async (email, name, role = 'VOLUNTEER') => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return { success: false, error: 'Unauthorized' };
        try {
            const normalizedEmail = email.toLowerCase().trim();
            const { data: existing } = await supabase.from('users').select('*').ilike('email', normalizedEmail).maybeSingle();
            
            if (existing) {
                if (existing.role === 'REJECTED' || existing.role === 'UNAUTHORIZED') {
                    await supabase.from('users').update({ role, name }).eq('id', existing.id);
                    return { success: true };
                }
                return { success: false, error: '이미 사용 중인 이메일입니다.' };
            }

            await supabase.from('users').insert([{
                id: `pending:${Date.now()}`,
                email: normalizedEmail,
                name,
                role
            }]);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const value = {
        user,
        users: allUsers, // Export reactively
        login,
        logout,
        isAuthenticated: !!user,
        role: user?.role || null,
        updateUserRole,
        updateUserName,
        addUserManually,
        getAllUsers,
        fetchUsers,
        loading
    };

    if (loading) {
        return <div className="h-screen w-full flex items-center justify-center bg-[#e8edf2] font-sans font-bold text-slate-500">인증 정보 확인 중...</div>;
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
