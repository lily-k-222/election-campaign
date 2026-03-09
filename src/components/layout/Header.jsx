import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button';
import { useAuth } from '../../context/AuthContext';

export const Header = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="flex justify-between items-center mb-8 p-4 glass-panel animate-fade-in">
            <h1 className="text-2xl font-bold gradient-text m-0 cursor-pointer" onClick={() => navigate('/')}>
                캠페인 콜 매니저
            </h1>

            {isAuthenticated && user && (
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <span className="font-semibold">{user.name}</span>
                        <span className="text-xs text-muted flex items-center gap-1">
                            {user.role === 'SUPER_ADMIN' ? '슈퍼 관리자' :
                                user.role === 'ADMIN' ? '관리자' :
                                    user.role === 'VOLUNTEER' ? '자원봉사자' : '승인 대기중'}
                        </span>
                    </div>
                    <Button variant="outline" onClick={handleLogout} className="text-sm py-1.5 px-3">
                        로그아웃
                    </Button>
                </div>
            )}
        </header>
    );
};
