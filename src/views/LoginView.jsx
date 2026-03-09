import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';

export const LoginView = () => {
    const { mockGoogleLogin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // For mock login, allow custom email input
    const [mockEmail, setMockEmail] = useState('');
    const [mockName, setMockName] = useState('');

    const from = location.state?.from?.pathname || '/';

    const handleMockLogin = (e) => {
        e.preventDefault();
        if (!mockEmail || !mockName) return;

        mockGoogleLogin(mockEmail, mockName);

        // After login, let ProtectedRoute or App routing take over based on role
        if (from !== '/') {
            navigate(from, { replace: true });
        } else {
            // Default redirect will happen based on logic in App.jsx or here
            // It'll redirect to appropriate dashboard based on role
            // We'll let App.jsx handle the root '/' redirect
            navigate('/', { replace: true });
        }
    };

    // Pre-filled mock users for easy testing
    const testAccounts = [
        { email: 'admin@campaign.com', name: '슈퍼관리자', role: 'SUPER_ADMIN' },
        { email: 'user1@campaign.com', name: '김민준', role: 'VOLUNTEER' },
        { email: 'new@campaign.com', name: '신규봉사자', role: 'UNAUTHORIZED' }
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-transparent animate-fade-in">
            <div className="glass-panel p-8 w-full max-w-md rounded-xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-blue-500 to-indigo-600"></div>

                <h2 className="text-3xl font-bold mb-6 text-center gradient-text">캠페인 콜 매니저</h2>
                <p className="text-center text-muted mb-8">안전한 데이터 관리를 위해 로그인해주세요.</p>

                <form onSubmit={handleMockLogin} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-foreground/80 font-medium">이메일</label>
                        <input
                            type="email"
                            className="p-3 border rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="example@gmail.com"
                            value={mockEmail}
                            onChange={(e) => setMockEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-foreground/80 font-medium">이름</label>
                        <input
                            type="text"
                            className="p-3 border rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="홍길동"
                            value={mockName}
                            onChange={(e) => setMockName(e.target.value)}
                            required
                        />
                    </div>

                    <Button type="submit" variant="primary" className="w-full mt-4 flex items-center justify-center gap-2 py-3 text-lg">
                        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" width="20" height="20">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Mock 구글 로그인
                    </Button>
                </form>

                <div className="mt-8 border-t pt-6 bg-secondary/30 -mx-8 px-8 -mb-8 pb-8 rounded-b-xl">
                    <p className="text-sm font-semibold text-muted mb-3">테스트 계정 선택 (시뮬레이션용):</p>
                    <div className="flex flex-col gap-2">
                        {testAccounts.map((acc, i) => (
                            <button
                                key={i}
                                onClick={() => { setMockEmail(acc.email); setMockName(acc.name); }}
                                className="text-left text-sm p-2 rounded hover:bg-background border border-transparent hover:border-border transition-colors flex justify-between items-center"
                            >
                                <span><span className="font-medium">{acc.name}</span> <span className="text-xs text-muted">({acc.email})</span></span>
                                <span className={`text-[10px] px-2 py-1 rounded-full ${acc.role.includes('ADMIN') ? 'bg-indigo-100 text-indigo-700' :
                                    acc.role === 'VOLUNTEER' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                    {acc.role}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
