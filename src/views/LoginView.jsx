import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginView = () => {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [errorMsg, setErrorMsg] = useState('');

    const from = location.state?.from?.pathname || '/';

    useEffect(() => {
        if (isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, navigate, from]);

    const handleLogin = async () => {
        setErrorMsg('');
        try {
            await login();
        } catch (error) {
            console.error('Failed to login with Supabase', error);
            setErrorMsg(error.message || '로그인 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-transparent animate-fade-in">
            <div className="glass-panel p-8 w-full max-w-md rounded-[24px] shadow-sm border border-slate-100 relative overflow-hidden bg-white">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e3a8a] to-blue-400"></div>

                <h2 className="text-3xl font-black mb-6 text-center text-[#1e3a8a] tracking-tight">보이스커넥트</h2>
                <p className="text-center text-slate-500 font-bold mb-8">캠페인 참여를 위해 구글 계정으로 로그인해주세요.</p>

                {errorMsg && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-xl text-center">
                        {errorMsg}
                    </div>
                )}

                <div className="flex justify-center mb-8">
                    <button 
                        onClick={handleLogin}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-extrabold py-3.5 px-4 rounded-xl shadow-sm transition-all active:scale-[0.98]"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google 계정으로 로그인
                    </button>
                </div>

                <div className="flex items-center gap-4 mb-4">
                    <div className="h-px bg-slate-100 flex-1"></div>
                    <span className="text-[12px] font-bold text-slate-400">자원봉사자 & 관리자 전용</span>
                    <div className="h-px bg-slate-100 flex-1"></div>
                </div>
            </div>
        </div>
    );
};
