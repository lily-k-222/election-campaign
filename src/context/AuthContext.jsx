import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, updateDoc } from 'firebase/firestore';

// Roles: 'SUPER_ADMIN', 'ADMIN', 'VOLUNTEER', 'UNAUTHORIZED'
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Initial setup: ensure mock users exist in Firestore for backward compatibility/testing
    useEffect(() => {
        const initializeMockUsers = async () => {
            const initialUsers = [
                { id: 'u1', email: 'admin@campaign.com', name: '슈퍼관리자', role: 'SUPER_ADMIN' },
                { id: 'u4', email: 'wangjaelee@gmail.com', name: '이왕재', role: 'ADMIN' },
            ];
            
            for (const u of initialUsers) {
                const userRef = doc(db, 'users', u.id);
                const docSnap = await getDoc(userRef);
                if (!docSnap.exists()) {
                    await setDoc(userRef, u);
                }
            }
        };
        initializeMockUsers();
    }, []);

    // Listen to Auth State
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // User is authenticated in Firebase
                const userRef = doc(db, 'users', firebaseUser.uid);
                const userDoc = await getDoc(userRef);
                
                if (userDoc.exists()) {
                    setUser({ id: firebaseUser.uid, ...userDoc.data() });
                } else {
                    // Check if they are matched to a mock user by email (transitional phase)
                    const usersRef = collection(db, 'users');
                    const usersSnap = await getDocs(usersRef);
                    let existingUser = null;
                    usersSnap.forEach(doc => {
                        if (doc.data().email === firebaseUser.email) {
                            existingUser = { id: doc.id, ...doc.data() };
                        }
                    });

                    if (existingUser) {
                        // Migrate them to their actual UID by cloning the document and deleting old one
                        // For simplicity in this demo, just map UID to data
                        await setDoc(doc(db, 'users', firebaseUser.uid), {
                            email: firebaseUser.email,
                            name: firebaseUser.displayName || '이름 없음',
                            role: existingUser.role
                        });
                        setUser({ id: firebaseUser.uid, email: firebaseUser.email, name: firebaseUser.displayName, role: existingUser.role });
                    } else {
                        // Brand new user
                        const newUser = {
                            email: firebaseUser.email,
                            name: firebaseUser.displayName || '이름 없음',
                            role: 'UNAUTHORIZED' // Require admin approval
                        };
                        await setDoc(userRef, newUser);
                        setUser({ id: firebaseUser.uid, ...newUser });
                    }
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Listen to all users if Admin
    useEffect(() => {
        if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) return;
        
        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            const usersList = [];
            snapshot.forEach((doc) => {
                usersList.push({ id: doc.id, ...doc.data() });
            });
            setAllUsers(usersList);
        });

        return () => unsubscribe();
    }, [user?.role]);

    // Keep the current user object totally in sync (e.g. if an admin changes my role)
    useEffect(() => {
        if (!user) return;
        const unsubscribe = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
            if (docSnap.exists() && docSnap.data().role !== user.role) {
                setUser(prev => ({ ...prev, role: docSnap.data().role }));
            }
        });
        return () => unsubscribe();
    }, [user?.id]);


    const login = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Login failed", error);
            throw error; // Let the UI handle it so it doesn't redirect
        }
    };

    const logout = async () => {
        await signOut(auth);
    };

    // Admin function: Update user role
    const updateUserRole = async (userId, newRole) => {
        if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') return;
        
        try {
            await updateDoc(doc(db, 'users', userId), { role: newRole });
        } catch (error) {
            console.error("Failed to update role", error);
        }
    };

    // Admin function: Get all users
    const getAllUsers = () => {
        return allUsers;
    };

    const value = {
        user,
        login,
        logout,
        isAuthenticated: !!user,
        role: user?.role || null,
        updateUserRole,
        getAllUsers,
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
