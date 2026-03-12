import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { supabase } from '../supabase';

// Roles: 'DEVELOPER', 'ADMIN', 'VOLUNTEER', 'UNAUTHORIZED'
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Initial setup: No longer needed for mock users as we moved to Supabase

    // Listen to Auth State
    useEffect(() => {
        // Safety timeout to prevent infinite hang if Firebase listener doesn't fire
        const timer = setTimeout(() => {
            setLoading(false);
        }, 10000); 

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    // Check user in Supabase
                    const { data: userData, error: fetchError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', firebaseUser.uid)
                        .single();
                    
                    if (fetchError && fetchError.code !== 'PGRST116') {
                        console.error("Supabase fetch user error:", fetchError);
                    }

                    if (userData) {
                        let currentRole = userData.role;
                        
                        // Emergency Role Recovery (Implicit)
                        if ((firebaseUser.email === 'wangjaelee@gmail.com' || firebaseUser.email === 'soomin8454@gmail.com') && 
                            (!currentRole || currentRole === 'UNAUTHORIZED')) {
                            const newRole = firebaseUser.email === 'wangjaelee@gmail.com' ? 'ADMIN' : 'DEVELOPER';
                            const { error: updErr } = await supabase
                                .from('users')
                                .update({ role: newRole })
                                .eq('id', firebaseUser.uid);
                            
                            if (!updErr) {
                                currentRole = newRole;
                            }
                        }
                        
                        setUser({ id: firebaseUser.uid, ...userData, role: currentRole });
                    } else {
                        // Check if user was pre-added by email (Admin Manual Addition)
                        const { data: preRegistered } = await supabase
                            .from('users')
                            .select('*')
                            .eq('email', firebaseUser.email)
                            .single();

                        if (preRegistered) {
                            // Link pre-registered user with their actual Firebase UID
                            const { error: linkErr } = await supabase
                                .from('users')
                                .update({ id: firebaseUser.uid })
                                .eq('email', firebaseUser.email);
                            
                            if (!linkErr) {
                                setUser({ id: firebaseUser.uid, ...preRegistered });
                                return;
                            }
                        }

                        // Create new user in Supabase
                        let assignedRole = 'UNAUTHORIZED';
                        if (firebaseUser.email === 'wangjaelee@gmail.com') {
                            assignedRole = 'ADMIN';
                        } else if (firebaseUser.email === 'soomin8454@gmail.com') {
                            assignedRole = 'DEVELOPER';
                        }

                        const newUser = {
                            id: firebaseUser.uid,
                            email: firebaseUser.email,
                            name: firebaseUser.displayName || '이름 없음',
                            role: assignedRole
                        };

                        const { error: insErr } = await supabase
                            .from('users')
                            .insert([newUser]);

                        if (!insErr) {
                            setUser(newUser);
                        } else {
                            console.error("Supabase user creation failed", insErr);
                        }
                    }
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error("Auth state listener error:", error);
            } finally {
                setLoading(false);
                clearTimeout(timer);
            }
        });

        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    const fetchUsers = async () => {
        const { data, error } = await supabase.from('users').select('*');
        if (!error) setAllUsers(data || []);
    };

    // Sync all users and handle real-time updates (Supabase)
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
                    // If current logged in user's role changed, update their local state
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
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            const isKakao = /KAKAOTALK/i.test(userAgent);
            const isInApp = /Instagram|NAVER|Line|Daum|MicroMessenger/i.test(userAgent);
            
            if (isKakao) {
                window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`;
                throw new Error("REDIRECTING_TO_EXTERNAL_BROWSER");
            } else if (isInApp) {
                alert("앱 내부 브라우저에서는 구글 보안 정책상 로그인이 차단됩니다.\n현재 화면의 링크 주소를 복사하신 후, 인터넷 브라우저(크롬, 사파리, 삼성 인터넷 등) 주소창에 붙여넣어 접속해주세요.");
                if (/android/i.test(userAgent)) {
                    const url = window.location.href.replace(/^https?:\/\//i, '');
                    window.location.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
                }
                throw new Error("IN_APP_BROWSER");
            }

            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    };

    const logout = async () => {
        await signOut(auth);
    };

    const updateUserName = async (userId, newName) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return;
        
        try {
            const { error } = await supabase
                .from('users')
                .update({ name: newName })
                .eq('id', userId);
            
            if (error) {
                console.error("Supabase name update error:", error);
                return { success: false, error };
            }
            return { success: true };
        } catch (error) {
            console.error("Failed to update name", error);
            return { success: false, error };
        }
    };

    const updateUserRole = async (userId, newRole) => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return { success: false, error: 'Unauthorized' };
        
        try {
            const { error } = await supabase
                .from('users')
                .update({ role: newRole })
                .eq('id', userId);
            
            if (error) {
                console.error("Supabase update error:", error);
                return { success: false, error };
            }
            return { success: true };
        } catch (error) {
            console.error("Failed to update role", error);
            return { success: false, error };
        }
    };

    const addUserManually = async (email, name, role = 'VOLUNTEER') => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return { success: false, error: 'Unauthorized' };
        
        try {
            // Check if user already exists
            const { data: existing } = await supabase.from('users').select('*').eq('email', email).single();
            
            if (existing) {
                // If user is rejected or pending, allow reactivation
                if (existing.role === 'REJECTED' || existing.role === 'UNAUTHORIZED') {
                    const { error } = await supabase
                        .from('users')
                        .update({ role, name })
                        .eq('email', email);
                    
                    if (error) throw error;
                    return { success: true };
                }
                return { success: false, error: '이미 사용 중인 이메일입니다.' };
            }

            const { error } = await supabase.from('users').insert([{
                id: `pending:${Date.now()}`, // Temporary ID
                email,
                name,
                role
            }]);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error("Manual user addition failed:", error);
            return { success: false, error };
        }
    };

    const getAllUsers = () => allUsers;

    const value = {
        user,
        login,
        logout,
        isAuthenticated: !!user,
        role: user?.role || null,
        updateUserRole,
        updateUserName,
        addUserManually,
        allUsers,
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
