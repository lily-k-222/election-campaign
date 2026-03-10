import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Megaphone, User, LogOut } from 'lucide-react';

export const Header = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="flex justify-between items-center px-6 py-4 bg-white border-b border-gray-300 shadow-sm z-10">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                <Megaphone size={32} className="text-slate-600 fill-slate-200 stroke-2" />
                <div className="flex flex-col">
                    <h1 className="text-[22px] font-extrabold text-[#1e3a8a] leading-tight tracking-tight">보이스커넥트</h1>
                    <span className="text-[13px] font-bold text-gray-500 leading-tight mt-0.5">보이스 커뮤니케이션</span>
                </div>
            </div>

            {isAuthenticated && user && (
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-[#f0f2f5] rounded-full pr-4 pl-1.5 py-1 gap-2 border border-gray-200">
                        <div className="bg-slate-400 w-8 h-8 rounded-full flex items-center justify-center text-white">
                            <User size={18} />
                        </div>
                        <div className="flex flex-col leading-tight mr-1">
                            <span className="text-sm font-bold text-gray-800">{user.name}</span>
                            <span className="text-[11px] text-gray-500 font-medium tracking-tight">
                                {user.role === 'SUPER_ADMIN' ? '슈퍼 관리자' :
                                    user.role === 'DEVELOPER' ? '개발자' :
                                        user.role === 'ADMIN' ? '관리자' :
                                            user.role === 'VOLUNTEER' ? '자원봉사자' : '승인 대기중'}
                            </span>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleLogout} 
                        className="flex items-center gap-2 px-4 py-2 bg-[#f0f2f5] hover:bg-gray-200 border border-gray-300 rounded-lg text-sm font-bold transition-colors text-gray-700"
                    >
                        로그아웃 <LogOut size={16} />
                    </button>
                </div>
            )}
        </header>
    );
};
