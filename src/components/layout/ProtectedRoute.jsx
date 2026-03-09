import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute = ({ allowedRoles = [] }) => {
    const { isAuthenticated, role } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // Role check
    // If allowedRoles is empty, just ensuring the user is logged in is enough
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        // User is logged in but doesn't have required role
        // For unauthorized volunteers, we might want to show a specific message or dashboard
        if (role === 'UNAUTHORIZED') {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-fade-in">
                    <div className="mb-4 text-orange-500">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">권한 승인 대기 중</h2>
                    <p className="text-muted mb-6">등록 관리자의 승인이 필요합니다. 승인 후 다시 로그인해주세요.</p>
                </div>
            );
        }

        // Redirect somewhere safe if they try to access a page they shouldn't (like volunteer trying to access admin)
        return <Navigate to={role.includes('ADMIN') ? "/admin" : "/volunteer"} replace />;
    }

    return <Outlet />;
};
