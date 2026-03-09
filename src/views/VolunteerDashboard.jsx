import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { CallInterface } from './CallInterface';

export const VolunteerDashboard = () => {
    const { getVolunteerStats, contacts } = useCampaign();
    const { user: currentUser } = useAuth();
    const [activeCallContact, setActiveCallContact] = useState(null);

    const stats = getVolunteerStats(currentUser.id);
    const myContacts = contacts.filter(c => c.assignedTo === currentUser.id);

    if (activeCallContact) {
        return (
            <CallInterface
                contact={activeCallContact}
                onClose={() => setActiveCallContact(null)}
            />
        );
    }

    return (
        <div className="animate-fade-in flex flex-col gap-6">
            <Card className="flex flex-col gap-4">
                <div>
                    <h2 className="text-2xl font-bold">환영합니다, {currentUser.name}님!</h2>
                    <p className="text-muted">오늘도 힘찬 캠페인 활동 부탁드립니다.</p>
                </div>

                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">나의 진행 상황</span>
                        <span className="font-bold text-primary">{stats.completed} / {stats.total} 명 ({stats.progress}%)</span>
                    </div>
                    <div className="progress-container">
                        <div className="progress-bar" style={{ width: `${stats.progress}%` }}></div>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-semibold mb-4">할당된 연락처 목록</h3>
                {myContacts.length === 0 ? (
                    <div className="text-center p-8 text-muted bg-gray-50 rounded-lg">
                        현재 할당된 연락처가 없습니다. 관리자의 배정을 기다려주세요.
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {myContacts.map(contact => (
                            <div
                                key={contact.id}
                                className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors bg-white shadow-sm"
                            >
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-lg">{contact.name}</span>
                                        {contact.status === 'CALLED' ? (
                                            <Badge variant="success">완료</Badge>
                                        ) : (
                                            <Badge variant="warning">대기 중</Badge>
                                        )}
                                    </div>
                                    <div className="text-sm text-muted">
                                        {contact.region} | {contact.gender} | {contact.ageGroup}
                                    </div>
                                </div>
                                <Button
                                    disabled={contact.status === 'CALLED'}
                                    onClick={() => setActiveCallContact(contact)}
                                >
                                    {contact.status === 'CALLED' ? '전화 완료' : '전화 걸기'}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};
