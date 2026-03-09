import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ContactFormModal } from '../components/ContactFormModal';

export const AdminDashboard = () => {
    const {
        contacts,
        getCampaignStats,
        getVolunteerStats,
        assignQuota,
        addContact,
        updateContact,
        deleteContact
    } = useCampaign();

    const { getAllUsers, updateUserRole, user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('campaign'); // 'campaign' or 'users' or 'contacts'
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);

    const allUsers = getAllUsers();
    // Volunteers are users with VOLUNTEER role
    const volunteers = allUsers.filter(u => u.role === 'VOLUNTEER');
    // Unauthorized users waiting for approval
    const pendingUsers = allUsers.filter(u => u.role === 'UNAUTHORIZED');

    const stats = getCampaignStats();
    const progressPercent = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

    const [selectedVolunteer, setSelectedVolunteer] = useState(volunteers.length > 0 ? volunteers[0].id : '');
    const [assignCount, setAssignCount] = useState(10);

    const handleAssign = () => {
        if (!selectedVolunteer) {
            alert("할당할 자원봉사자를 먼저 선택해주세요.");
            return;
        }
        assignQuota(selectedVolunteer, assignCount);
        alert(`${assignCount}명의 당원이 할당되었습니다.`);
    };

    const handleRoleUpdate = (userId, name, newRole) => {
        if (window.confirm(`${name} 회원의 권한을 변경하시겠습니까?`)) {
            updateUserRole(userId, newRole);
        }
    };

    const unassignedCount = contacts.filter(c => !c.assignedTo).length;

    const handleAddClick = () => {
        setEditingContact(null);
        setIsContactModalOpen(true);
    };

    const handleEditClick = (contact) => {
        setEditingContact(contact);
        setIsContactModalOpen(true);
    };

    const handleContactSubmit = (formData) => {
        if (editingContact) {
            updateContact(editingContact.id, formData);
        } else {
            addContact(formData);
        }
    };

    return (
        <div className="animate-fade-in flex flex-col gap-6">
            {/* Tabs */}
            <div className="flex border-b border-border/50">
                <button
                    onClick={() => setActiveTab('campaign')}
                    className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'campaign' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}
                >
                    캠페인 현황
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-6 py-3 font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}
                >
                    사용자 관리
                    {pendingUsers.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingUsers.length}</span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('contacts')}
                    className={`px-6 py-3 font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'contacts' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}
                >
                    연락처 관리
                </button>
            </div>

            {activeTab === 'campaign' && (
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <h2 className="text-xl font-bold mb-4 text-primary">전체 캠페인 진행 상황</h2>
                            <div className="relative w-64 h-64 mx-auto mb-8 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    <circle
                                        cx="50" cy="50" r="42"
                                        stroke="currentColor" strokeWidth="10" fill="transparent"
                                        className="text-gray-100"
                                    />
                                    <circle
                                        cx="50" cy="50" r="42"
                                        stroke="currentColor" strokeWidth="10" fill="transparent"
                                        className="text-primary transition-all duration-1000 ease-out"
                                        strokeDasharray={`${2 * Math.PI * 42}`}
                                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - progressPercent / 100)}`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-base font-medium text-gray-500 mb-2">총 통화 완료</span>
                                    <span className="text-3xl font-bold text-gray-900 mb-1">{stats.completed}/{stats.total}</span>
                                    <span className="text-xl font-bold text-primary">{progressPercent}%</span>
                                </div>
                            </div>

                            <h3 className="font-semibold mb-3 text-sm text-muted">통화 결과 요약</h3>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                                    <span className="text-sm font-medium">1. 적극 지지</span>
                                    <Badge variant="info">{stats.results.STRONG_SUPPORT}</Badge>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                                    <span className="text-sm font-medium">2. 다소 지지</span>
                                    <Badge variant="success">{stats.results.LEAN_SUPPORT}</Badge>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                    <span className="text-sm font-medium">3. 잘 모름</span>
                                    <Badge variant="default">{stats.results.UNDECIDED}</Badge>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-100 rounded">
                                    <span className="text-sm font-medium">4. 무응답</span>
                                    <Badge variant="default">{stats.results.NO_RESPONSE}</Badge>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                                    <span className="text-sm font-medium">5. 차영수 지지</span>
                                    <Badge variant="warning">{stats.results.SUPPORT_CHA}</Badge>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                                    <span className="text-sm font-medium">6. 강진원 지지</span>
                                    <Badge variant="error">{stats.results.SUPPORT_KANG}</Badge>
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <h2 className="text-xl font-bold mb-4 text-accent">할당량 관리</h2>
                            <div className="p-4 bg-orange-50 rounded-lg mb-6 border border-orange-100">
                                <span className="text-sm font-medium text-orange-800">미할당 연락처: </span>
                                <span className="text-lg font-bold text-orange-900">{unassignedCount}명</span>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">자원봉사자 선택</label>
                                    <select
                                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={selectedVolunteer}
                                        onChange={(e) => setSelectedVolunteer(e.target.value)}
                                    >
                                        <option value="">-- 자원봉사자 선택 --</option>
                                        {volunteers.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">할당할 인원 수</label>
                                    <div className="flex gap-2">
                                        {[5, 10, 20].map(num => (
                                            <button
                                                key={num}
                                                onClick={() => setAssignCount(num)}
                                                className={`flex-1 py-1 rounded border text-sm transition-colors ${assignCount === num ? 'bg-primary text-white border-primary' : 'hover:bg-gray-50'}`}
                                            >
                                                {num}명
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <Button
                                    className="w-full mt-2"
                                    onClick={handleAssign}
                                    disabled={unassignedCount === 0 || unassignedCount < assignCount || !selectedVolunteer}
                                >
                                    할당 실행
                                </Button>
                            </div>
                        </Card>
                    </div>

                    <Card>
                        <h3 className="text-xl font-bold mb-4">자원봉사자별 현황</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 text-muted">
                                    <tr>
                                        <th className="p-3 rounded-tl-lg">이름</th>
                                        <th className="p-3">할당됨</th>
                                        <th className="p-3">완료</th>
                                        <th className="p-3">진행률</th>
                                        <th className="p-3 rounded-tr-lg text-right">상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {volunteers.length === 0 && (
                                        <tr><td colSpan="5" className="p-4 text-center text-muted">등록된 자원봉사자가 없습니다.</td></tr>
                                    )}
                                    {volunteers.map(v => {
                                        const vStats = getVolunteerStats(v.id);
                                        return (
                                            <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50/50">
                                                <td className="p-3 font-medium">{v.name}</td>
                                                <td className="p-3">{vStats.total}</td>
                                                <td className="p-3">{vStats.completed}</td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary" style={{ width: `${vStats.progress}%` }}></div>
                                                        </div>
                                                        <span className="text-xs">{vStats.progress}%</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    {vStats.total > 0 && vStats.progress === 100
                                                        ? <Badge variant="success">완료</Badge>
                                                        : vStats.total === 0
                                                            ? <Badge variant="default">대기</Badge>
                                                            : <Badge variant="info">진행 중</Badge>
                                                    }
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="flex flex-col gap-6">
                    <Card>
                        <h2 className="text-xl font-bold mb-4 text-accent">승인 대기중인 사용자</h2>
                        {pendingUsers.length === 0 ? (
                            <p className="text-muted p-4 bg-gray-50 rounded text-center">승인 대기중인 사용자가 없습니다.</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {pendingUsers.map(user => (
                                    <div key={user.id} className="flex items-center justify-between p-4 border border-orange-200 bg-orange-50 rounded-lg">
                                        <div>
                                            <div className="font-bold text-lg">{user.name}</div>
                                            <div className="text-sm text-muted">{user.email}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleRoleUpdate(user.id, user.name, 'REJECTED')}>거절</Button>
                                            <Button variant="primary" onClick={() => handleRoleUpdate(user.id, user.name, 'VOLUNTEER')}>자원봉사자 승인</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card>
                        <h2 className="text-xl font-bold mb-4">전체 사용자 목록</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 text-muted">
                                    <tr>
                                        <th className="p-3 rounded-tl-lg">이름</th>
                                        <th className="p-3">이메일</th>
                                        <th className="p-3">현재 권한</th>
                                        <th className="p-3 rounded-tr-lg text-right">권한 변경</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allUsers.filter(u => u.role !== 'UNAUTHORIZED' && u.role !== 'REJECTED').map(user => (
                                        <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50/50">
                                            <td className="p-3 font-medium">{user.name}</td>
                                            <td className="p-3 text-muted">{user.email}</td>
                                            <td className="p-3">
                                                <Badge variant={user.role === 'SUPER_ADMIN' ? 'error' : user.role === 'ADMIN' ? 'warning' : 'success'}>
                                                    {user.role}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-right">
                                                {user.id !== currentUser.id && (
                                                    <select
                                                        className="text-sm p-1 border rounded outline-none"
                                                        value={user.role}
                                                        onChange={(e) => handleRoleUpdate(user.id, user.name, e.target.value)}
                                                        disabled={currentUser.role !== 'SUPER_ADMIN' && user.role === 'SUPER_ADMIN'}
                                                    >
                                                        {currentUser.role === 'SUPER_ADMIN' && <option value="ADMIN">관리자</option>}
                                                        <option value="VOLUNTEER">자원봉사자</option>
                                                        <option value="UNAUTHORIZED">권한 제거</option>
                                                    </select>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'contacts' && (
                <div className="flex flex-col gap-6">
                    <Card>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-accent">연락처 및 명부 관리</h2>
                            <Button onClick={handleAddClick} variant="primary">
                                새 연락처 추가
                            </Button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 text-muted">
                                    <tr>
                                        <th className="p-3 rounded-tl-lg">이름</th>
                                        <th className="p-3">나이</th>
                                        <th className="p-3">당원구분</th>
                                        <th className="p-3">법정동</th>
                                        <th className="p-3">전화번호</th>
                                        <th className="p-3">담당자</th>
                                        <th className="p-3">상태</th>
                                        <th className="p-3">조사결과</th>
                                        <th className="p-3 rounded-tr-lg text-right">작업</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contacts.length === 0 ? (
                                        <tr><td colSpan="9" className="p-4 text-center text-muted">등록된 연락처가 없습니다.</td></tr>
                                    ) : (
                                        contacts.map(contact => {
                                            const assignedVolunteer = volunteers.find(v => v.id === contact.assignedTo);
                                            return (
                                                <tr key={contact.id} className="border-b last:border-0 hover:bg-gray-50/50">
                                                    <td className="p-3 font-medium">{contact.name}</td>
                                                    <td className="p-3 text-muted">{contact.age || '-'}</td>
                                                    <td className="p-3 text-muted">{contact.memberType || '-'}</td>
                                                    <td className="p-3 text-muted">{contact.region || '-'}</td>
                                                    <td className="p-3 font-mono text-muted">{contact.phone}</td>
                                                    <td className="p-3 text-muted">{assignedVolunteer ? assignedVolunteer.name : <span className="text-orange-500 text-xs">미할당</span>}</td>
                                                    <td className="p-3">
                                                        {contact.status === 'CALLED' ? (
                                                            <Badge variant="success">완료</Badge>
                                                        ) : contact.status === 'UNASSIGNED' ? (
                                                            <Badge variant="default">대기중</Badge>
                                                        ) : (
                                                            <Badge variant="info">진행중</Badge>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-muted text-xs">
                                                        {contact.surveyResult || '-'}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex gap-2 justify-end">
                                                            <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => handleEditClick(contact)}>수정</Button>
                                                            <Button variant="outline" className="px-2 py-1 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => {
                                                                if (window.confirm(`${contact.name} 연락처를 삭제하시겠습니까?`)) {
                                                                    deleteContact(contact.id);
                                                                }
                                                            }}>삭제</Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            <ContactFormModal
                isOpen={isContactModalOpen}
                onClose={() => setIsContactModalOpen(false)}
                onSubmit={handleContactSubmit}
                initialData={editingContact}
            />
        </div>
    );
};

