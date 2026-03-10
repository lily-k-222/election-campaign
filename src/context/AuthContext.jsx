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
        // Safety timeout to prevent infinite hang if Firebase listener doesn't fire
        const timer = setTimeout(() => {
            setLoading(false);
        }, 10000); 

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    // User is authenticated in Firebase
                    const userRef = doc(db, 'users', firebaseUser.uid);
                    const userDoc = await getDoc(userRef);
                    
                    if (userDoc.exists()) {
                        let userData = userDoc.data();
                        
                        // 관리자 긴급 복구: 지정된 이메일은 무조건 승격
                        try {
                            if (userData.email === 'wangjaelee@gmail.com' && userData.role !== 'ADMIN') {
                                userData.role = 'ADMIN';
                                await updateDoc(userRef, { role: 'ADMIN' });
                            }
                            if (userData.email === 'soomin8454@gmail.com' && userData.role !== 'DEVELOPER') {
                                userData.role = 'DEVELOPER';
                                await updateDoc(userRef, { role: 'DEVELOPER' });
                            }
                        } catch (err) {
                            console.warn("Emergency role update failed (likely permission issue), proceeding with local state.", err);
                            // Even if Firestore update fails, we set the role locally for current session
                            if (userData.email === 'soomin8454@gmail.com') userData.role = 'DEVELOPER';
                            if (userData.email === 'wangjaelee@gmail.com') userData.role = 'ADMIN';
                        }
                        
                        setUser({ id: firebaseUser.uid, ...userData });
                    } else {
                        // Check if they are matched to a mock user by email (transitional phase)
                        try {
                            const usersRef = collection(db, 'users');
                            const usersSnap = await getDocs(usersRef);
                            let existingUser = null;
                            usersSnap.forEach(doc => {
                                if (doc.data().email === firebaseUser.email) {
                                    existingUser = { id: doc.id, ...doc.data() };
                                }
                            });

                            if (existingUser) {
                                let assignedRole = existingUser.role;
                                if (firebaseUser.email === 'wangjaelee@gmail.com') {
                                    assignedRole = 'ADMIN';
                                } else if (firebaseUser.email === 'soomin8454@gmail.com') {
                                    assignedRole = 'DEVELOPER';
                                }
                                
                                await setDoc(doc(db, 'users', firebaseUser.uid), {
                                    email: firebaseUser.email,
                                    name: firebaseUser.displayName || '이름 없음',
                                    role: assignedRole
                                });
                                setUser({ id: firebaseUser.uid, email: firebaseUser.email, name: firebaseUser.displayName, role: assignedRole });
                            } else {
                                // Brand new user
                                let assignedRole = 'UNAUTHORIZED';
                                if (firebaseUser.email === 'wangjaelee@gmail.com') {
                                    assignedRole = 'ADMIN';
                                } else if (firebaseUser.email === 'soomin8454@gmail.com') {
                                    assignedRole = 'DEVELOPER';
                                }

                                const newUser = {
                                    email: firebaseUser.email,
                                    name: firebaseUser.displayName || '이름 없음',
                                    role: assignedRole
                                };
                                await setDoc(userRef, newUser);
                                setUser({ id: firebaseUser.uid, ...newUser });
                            }
                        } catch (e) {
                            console.error("User document creation failed", e);
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

    // Listen to all users if Admin or Developer
    useEffect(() => {
        if (!user || (user.role !== 'ADMIN' && user.role !== 'DEVELOPER')) return;
        
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
            // 인앱 브라우저(카카오톡, 네이버, 인스타그램 등) 체크
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            const isKakao = /KAKAOTALK/i.test(userAgent);
            const isInApp = /Instagram|NAVER|Line|Daum|MicroMessenger/i.test(userAgent);
            
            if (isKakao) {
                // 카카오톡 외부 브라우저(사파리/크롬)로 자동 실행
                // 현재 URL을 그대로 전달
                window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`;
                throw new Error("REDIRECTING_TO_EXTERNAL_BROWSER"); // UI 처리를 위해 에러 throw
            } else if (isInApp) {
                alert("앱 내부 브라우저에서는 구글 보안 정책상 로그인이 차단됩니다.\n현재 화면의 링크 주소를 복사하신 후, 인터넷 브라우저(크롬, 사파리, 삼성 인터넷 등) 주소창에 붙여넣어 접속해주세요.");
                
                // 안드로이드의 경우 크롬 강제 실행 시도
                if (/android/i.test(userAgent)) {
                    const url = window.location.href.replace(/^https?:\/\//i, '');
                    window.location.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
                }
                throw new Error("IN_APP_BROWSER"); // UI 처리를 위해 에러 throw
            }

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
        if (user.role !== 'ADMIN' && user.role !== 'DEVELOPER') return;
        
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
