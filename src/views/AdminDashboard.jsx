import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { ContactFormModal } from '../components/ContactFormModal';
import { ContactDetailModal } from '../components/ContactDetailModal';
import { DialogModal } from '../components/DialogModal';
import { Search, SlidersHorizontal, User as UserIcon, BarChart2, ClipboardList } from 'lucide-react';

export const AdminDashboard = () => {
    const {
        contacts,
        getCampaignStats,
        getVolunteerStats,
        assignQuota,
        addContact,
        updateContact,
        deleteContact,
        reassignContacts,
        resetTestData,
        importBulkContacts
    } = useCampaign();

    const { getAllUsers, updateUserRole, user: currentUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('campaign'); // 'campaign' or 'users' or 'contacts'
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [viewingContact, setViewingContact] = useState(null);
    
    // Bulk Selection State
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [bulkAssignVolunteer, setBulkAssignVolunteer] = useState('');
    
    // Pagination state for completed contacts list
    const [completedPage, setCompletedPage] = useState(1);
    const itemsPerPage = 10;
    
    // Custom Modal State
    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null });

    const showDialog = (type, title, message, onConfirm = null) => {
        setDialogConfig({ isOpen: true, type, title, message, onConfirm });
    };
    
    const closeDialog = () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
    };

    const allUsers = getAllUsers();
    // Volunteers are users with VOLUNTEER role
    const volunteers = allUsers.filter(u => u.role === 'VOLUNTEER');
    // Unauthorized users waiting for approval
    const pendingUsers = allUsers.filter(u => u.role === 'UNAUTHORIZED');

    // Pre-calculate volunteer stats and sort
    const volunteersWithStats = volunteers.map(v => ({
        ...v,
        stats: getVolunteerStats(v.id)
    })).sort((a, b) => b.stats.completed - a.stats.completed);

    const stats = getCampaignStats();
    const progressPercent = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

    const [selectedVolunteer, setSelectedVolunteer] = useState('');
    const [assignCount, setAssignCount] = useState(5);

    const handleAssign = () => {
        if (!selectedVolunteer) {
            showDialog('alert', '안내', '할당할 자원봉사자를 먼저 선택해주세요.');
            return;
        }
        assignQuota(selectedVolunteer, assignCount);
        showDialog('alert', '할당 완료', `${assignCount}명의 무작위 당원 연락처가 할당되었습니다.`);
        setSelectedVolunteer(''); // Reset
    };

    const handleRoleUpdate = (userId, name, newRole) => {
        showDialog('confirm', '권한 변경', `${name} 회원의 권한을 변경하시겠습니까?`, () => {
            updateUserRole(userId, newRole);
        });
    };

    const unassignedCount = contacts.filter(c => !c.assignedTo || c.assignedTo === 'UNASSIGNED').length;

    const handleAddClick = () => {
        setEditingContact(null);
        setIsContactModalOpen(true);
    };

    const handleEditClick = (contact) => {
        setViewingContact(contact);
        setIsDetailModalOpen(true);
    };

    const handleContactSubmit = (formData) => {
        if (editingContact) {
            updateContact(editingContact.id, formData);
        } else {
            addContact(formData);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedContacts(contacts.map(c => c.id));
        } else {
            setSelectedContacts([]);
        }
    };

    const handleSelectContact = (contactId) => {
        setSelectedContacts(prev => 
            prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
        );
    };

    const handleBulkReassign = () => {
        if (!bulkAssignVolunteer) {
            showDialog('alert', '안내', '할당할 자원봉사자를 선택해주세요.');
            return;
        }
        showDialog('confirm', '일괄 할당', `선택한 ${selectedContacts.length}명의 연락처를 지정한 자원봉사자에게 할당하시겠습니까?`, async () => {
            await reassignContacts(selectedContacts, bulkAssignVolunteer);
            setSelectedContacts([]);
            setBulkAssignVolunteer('');
            showDialog('alert', '할당 완료', '연락처가 성공적으로 일괄 할당되었습니다.');
        });
    };

    return (
        <div className="flex flex-col w-full h-full font-sans">
            {/* Modern Tab Bar matching the screenshot */}
            <div className="bg-[#e2e8f0] w-full px-8 pt-3 flex items-end border-b border-gray-300">
                <button
                    onClick={() => setActiveTab('campaign')}
                    className={`px-6 py-2.5 font-bold rounded-t-lg transition-colors border-x border-t z-10 -mb-px text-[15px] ${
                        activeTab === 'campaign' 
                        ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]' 
                        : 'bg-transparent text-gray-600 border-transparent hover:text-gray-800'
                    }`}
                >
                    캠페인 현황
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-6 py-2.5 font-bold rounded-t-lg transition-colors border-x border-t z-10 -mb-px text-[15px] flex items-center gap-2 ${
                        activeTab === 'users' 
                        ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]' 
                        : 'bg-transparent text-gray-600 border-transparent hover:text-gray-800'
                    }`}
                >
                    사용자 관리
                    {pendingUsers.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingUsers.length}</span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('contacts')}
                    className={`px-6 py-2.5 font-bold rounded-t-lg transition-colors border-x border-t z-10 -mb-px text-[15px] ${
                        activeTab === 'contacts' 
                        ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]' 
                        : 'bg-transparent text-gray-600 border-transparent hover:text-gray-800'
                    }`}
                >
                    연락처 관리
                </button>
                <div className="flex-1"></div>
                <button
                    onClick={() => navigate('/volunteer')}
                    className="px-6 py-2.5 font-bold rounded-t-lg transition-colors border-x border-t z-10 -mb-px text-[15px] bg-blue-50 text-[#1e3a8a] border-blue-200 hover:bg-blue-100 flex items-center gap-2"
                >
                    자원봉사자 화면 열람 
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </button>
            </div>

            {/* Campaign Dashboard Content */}
            {activeTab === 'campaign' && (
                <div className="px-8 py-6 text-gray-900 bg-[#e8edf2] flex-1 w-full flex flex-col items-center">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full max-w-[1100px]">
                        
                        {/* Card 1: 전체 캠페인 진행 상황 */}
                        <div 
                            onClick={() => {
                                setActiveTab('completed');
                                setCompletedPage(1);
                            }}
                            className="bg-white rounded-[24px] shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100 p-7 flex flex-col cursor-pointer hover:bg-slate-50 relative"
                        >
                            <div className="absolute top-4 right-4 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 opacity-80">
                                명단 보기 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                            </div>
                            <h2 className="text-[20px] font-extrabold mb-4 text-slate-800 tracking-tight">전체 캠페인 진행 상황</h2>
                            <div className="relative w-64 h-64 mx-auto mt-2 mb-4 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    <circle
                                        cx="50" cy="50" r="38"
                                        stroke="#e2e8f0" strokeWidth="14" fill="transparent"
                                    />
                                    <circle
                                        cx="50" cy="50" r="38"
                                        stroke="#1e3a8a" strokeWidth="14" fill="transparent"
                                        className="transition-all duration-1000 ease-out"
                                        strokeDasharray={`${2 * Math.PI * 38}`}
                                        strokeDashoffset={`${2 * Math.PI * 38 * (1 - progressPercent / 100)}`}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                                    <span className="text-[13px] font-bold text-gray-600 mb-1">총 통화 완료</span>
                                    <span className="text-4xl font-black text-gray-800 tracking-tighter mb-1 mt-1">{stats.completed}<span className="text-2xl text-gray-500">/{stats.total}</span></span>
                                    <span className="text-sm font-bold text-green-700 bg-green-100/80 px-2 py-0.5 rounded-md mt-1 flex items-center gap-1 shadow-sm border border-green-200">
                                        {progressPercent}% <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: 통화 결과 요약 */}
                        <div className="bg-white rounded-[24px] shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100 p-7 flex flex-col">
                            <h2 className="text-[20px] font-extrabold mb-5 text-slate-800 flex items-center gap-2 tracking-tight">
                                <BarChart2 size={20} className="text-gray-600" />
                                통화 결과 요약
                            </h2>
                            <div className="flex-1 flex flex-col justify-between py-1">
                                {[
                                    { label: '1. 강하게 지지', value: stats.results['강하게 지지'] || 0, color: '#1e3a8a' },
                                    { label: '2. 약하게 지지', value: stats.results['약하게 지지'] || 0, color: '#3b82f6' },
                                    { label: '3. 관심없음',   value: stats.results['관심없음'] || 0, color: '#93c5fd' },
                                    { label: '4. 지지하지 않음', value: stats.results['지지하지 않음'] || 0, color: '#94a3b8' },
                                    { label: '5. 다른후보 지지', value: stats.results['다른후보 지지'] || 0, color: '#475569' }
                                ].map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-4 relative py-1">
                                        <span className="text-[14px] font-semibold text-gray-800 w-28 flex-shrink-0 tracking-tight">{item.label}</span>
                                        <div className="flex-1 h-4 bg-gray-100/50 rounded-full overflow-hidden relative border border-gray-200/40">
                                            <div className="absolute top-0 left-0 h-full rounded-r-full" 
                                                style={{
                                                    width: item.value === 0 ? '0%' : `${Math.min(100, (item.value / Math.max(1, stats.completed)) * 100)}%`,
                                                    background: `linear-gradient(90deg, ${item.color} 0%, rgba(220,230,240,0.4) 100%)`,
                                                }}>
                                            </div>
                                        </div>
                                        <span className="text-[14px] font-bold text-gray-800 w-8 text-right">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Legend */}
                            <div className="flex justify-center items-center gap-3 mt-5 pt-4 border-t border-gray-100 flex-wrap">
                                {[
                                    { label: '강하게 지지', color: '#1e3a8a' },
                                    { label: '약하게 지지', color: '#3b82f6' },
                                    { label: '관심없음', color: '#93c5fd' },
                                    { label: '지지하지 않음', color: '#94a3b8' },
                                    { label: '다른후보 지지', color: '#475569' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }}></div>
                                        <span className="text-[11px] font-bold text-gray-500">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Card 3: 할당량 관리 */}
                        <div className="bg-white rounded-[24px] shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100 p-7 flex flex-col justify-between">
                            <h2 className="text-[20px] font-extrabold mb-5 text-slate-800 flex items-center gap-2 tracking-tight">
                                <ClipboardList size={22} className="text-gray-600" />
                                할당량 관리
                            </h2>
                            
                            <div className="flex flex-col md:flex-row gap-8 flex-1">
                                {/* Left side */}
                                <div className="flex-1 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[14px] font-bold text-gray-800 block mb-2 tracking-tight">미할당 연락처:</span>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-400 text-white pb-0.5">
                                                <UserIcon size={18} fill="currentColor" />
                                            </div>
                                            <span className="text-[28px] font-black text-gray-800 tracking-tighter">{unassignedCount}명</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-8">
                                        <span className="text-[13px] font-bold text-gray-800 block mb-2 tracking-tight">할당할 인원 수</span>
                                        <div className="flex bg-gray-50 rounded-full p-1 border border-gray-300 shadow-inner">
                                            {[5, 10, 20].map(num => (
                                                <button
                                                    key={num}
                                                    onClick={() => setAssignCount(num)}
                                                    className={`flex-1 py-1.5 rounded-full text-[13px] font-extrabold transition-colors ${assignCount === num ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                                >
                                                    {num}명
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Vertical Divider */}
                                <div className="hidden md:block w-px bg-gray-100 my-2"></div>
                                
                                {/* Right side */}
                                <div className="flex-1 flex flex-col justify-between pt-1">
                                    <div>
                                        <span className="text-[14px] font-bold text-gray-800 block mb-2 tracking-tight">자원봉사자 선택</span>
                                        
                                        <div className="relative mb-3">
                                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <select
                                                className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] outline-none text-[14px] font-bold text-gray-700 appearance-none shadow-sm"
                                                value={selectedVolunteer}
                                                onChange={(e) => setSelectedVolunteer(e.target.value)}
                                            >
                                                <option value="" disabled hidden>Q 이름 검색</option>
                                                {volunteers.map(v => (
                                                    <option key={v.id} value={v.id}>{v.name}</option>
                                                ))}
                                            </select>
                                            <SlidersHorizontal size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                        </div>
                                        
                                        {selectedVolunteer && (
                                            <div className="inline-flex items-center px-4 py-1.5 bg-[#e8edf2] rounded-md text-[14px] font-extrabold text-gray-800 w-auto">
                                                {volunteers.find(v => v.id === selectedVolunteer)?.name}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <button
                                        className="w-full mt-6 py-2.5 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-lg font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed Active:scale-[0.98] text-[15px] tracking-tight"
                                        onClick={handleAssign}
                                        disabled={unassignedCount === 0 || !selectedVolunteer}
                                    >
                                        <div className="w-5 h-5 bg-white border border-[#1e3a8a] text-[#1e3a8a] rounded-full flex items-center justify-center pb-0.5">
                                            <UserIcon size={12} fill="currentColor" strokeWidth={1} /> 
                                        </div>
                                        할당 실행
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Card 4: 자원봉사자별 현황 */}
                        <div 
                            onClick={() => setActiveTab('volunteers')}
                            className="bg-white rounded-[24px] shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100 p-7 flex flex-col cursor-pointer hover:bg-slate-50 relative"
                        >
                            <div className="absolute top-4 right-4 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 opacity-80">
                                명단 보기 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                            </div>
                            <h2 className="text-[20px] font-extrabold mb-5 text-slate-800 tracking-tight">자원봉사자별 현황 (TOP 3)</h2>
                            <div className="overflow-x-auto flex-1 border border-gray-200 rounded-lg selection-table">
                                <table className="w-full text-left whitespace-nowrap">
                                    <thead className="bg-[#f0f4f8] text-gray-800 border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 pl-4 w-[30%] text-[14px] font-bold">이름</th>
                                            <th className="p-3 w-[15%] text-[14px] font-bold">할당됨</th>
                                            <th className="p-3 w-[15%] text-[14px] font-bold">완료</th>
                                            <th className="p-3 w-[25%] text-[14px] font-bold">진행률</th>
                                            <th className="p-3 pr-4 text-center w-[15%] text-[14px] font-bold">상태</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[14px]">
                                        {volunteersWithStats.length === 0 && (
                                            <tr><td colSpan="5" className="p-6 text-center text-gray-500 font-medium">등록된 자원봉사자가 없습니다.</td></tr>
                                        )}
                                        {volunteersWithStats.slice(0, 3).map(v => {
                                            const vStats = v.stats;
                                            const isDone = vStats.total > 0 && vStats.progress === 100;
                                            const isPending = vStats.total === 0;
                                            return (
                                                <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="p-3 pl-4 font-extrabold text-gray-800 flex items-center gap-2">
                                                        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                                                        <UserIcon size={14} className="text-gray-600 fill-gray-500 mt-1" />
                                                        </div>
                                                        {v.name}
                                                    </td>
                                                    <td className="p-3 font-semibold text-gray-800">{vStats.total}</td>
                                                    <td className="p-3 font-semibold text-gray-800">{vStats.completed}</td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[13px] font-bold text-gray-700 w-7">{vStats.progress}%</span>
                                                            <div className="flex-1 h-[6px] bg-gray-200 rounded-full overflow-hidden mr-2">
                                                                <div className="h-full bg-[#1e3a8a] rounded-full" style={{ width: `${Math.max(10, vStats.progress)}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 pr-4 text-center">
                                                        <div className="flex flex-col items-center gap-1.5 justify-center">
                                                            <div className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[12px] font-black tracking-tight leading-tight w-full max-w-[56px]
                                                                ${isDone ? 'bg-[#e2e8f0] text-[#475569] border border-[#cbd5e1]' : 
                                                                isPending ? 'bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0]' : 
                                                                'bg-[#e2e8f0] text-[#475569] border border-[#cbd5e1]'}`}>
                                                                {isDone ? '완료' : isPending ? '대기' : '진행 증'}
                                                            </div>
                                                            <button 
                                                                onClick={() => navigate('/volunteer', { state: { volunteerId: v.id } })}
                                                                className="text-[11px] font-bold text-[#1e3a8a] bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors w-full max-w-[56px]"
                                                            >
                                                                화면 보기
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-center mt-auto mb-2 pt-10 text-[13px] text-gray-600 font-semibold tracking-tight">
                        Copyright © 2022 UMS, Inc., All rights reserved.
                    </div>
                </div>
            )}

            {/* Other Tabs Content Maintained but Wrapped Properly */}
            {(activeTab === 'users' || activeTab === 'contacts' || activeTab === 'completed' || activeTab === 'volunteers') && (
                <div className="px-8 py-6 text-gray-900 bg-[#e8edf2] flex-1 w-full flex flex-col items-center overflow-y-auto">
                    <div className="w-full max-w-[1100px] flex flex-col gap-6">
                        
                        {activeTab === 'completed' && (() => {
                            const isCompleted = (c) => c.status === 'CALLED' || c.supportLevel || (c.notes && c.notes !== '테스트용 데이터입니다.');
                            const completedContacts = contacts.filter(isCompleted);
                            const totalPages = Math.ceil(completedContacts.length / itemsPerPage) || 1;
                            const startIndex = (completedPage - 1) * itemsPerPage;
                            const currentContacts = completedContacts.slice(startIndex, startIndex + itemsPerPage);

                            return (
                                <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-7 flex flex-col">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-[20px] font-extrabold text-slate-800 flex items-center gap-2 border-l-4 border-[#1e3a8a] pl-3 tracking-tight">
                                            통화 완료자 명단 ({completedContacts.length}명)
                                        </h2>
                                        <div className="flex bg-gray-100 rounded-lg p-1 items-center gap-2">
                                            <button 
                                                onClick={() => setCompletedPage(p => Math.max(1, p - 1))}
                                                disabled={completedPage === 1}
                                                className="px-3 py-1.5 rounded-md text-sm font-bold bg-white shadow-sm disabled:opacity-50 disabled:shadow-none hover:bg-gray-50 flex items-center gap-1"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg> 이전
                                            </button>
                                            <span className="text-sm font-bold text-gray-600 px-2">{completedPage} / {totalPages}</span>
                                            <button 
                                                onClick={() => setCompletedPage(p => Math.min(totalPages, p + 1))}
                                                disabled={completedPage === totalPages}
                                                className="px-3 py-1.5 rounded-md text-sm font-bold bg-white shadow-sm disabled:opacity-50 disabled:shadow-none hover:bg-gray-50 flex items-center gap-1"
                                            >
                                                다음 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-[#f8fafc] text-gray-600 font-bold border-b border-gray-100">
                                                <tr>
                                                    <th className="p-4 pl-5">이름</th>
                                                    <th className="p-4">나이</th>
                                                    <th className="p-4">당원구분</th>
                                                    <th className="p-4">지역</th>
                                                    <th className="p-4">전화번호</th>
                                                    <th className="p-4">성향</th>
                                                    <th className="p-4">담당자</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentContacts.length === 0 ? (
                                                    <tr><td colSpan="7" className="p-6 text-center text-gray-500 font-medium">통화 완료된 연락처가 없습니다.</td></tr>
                                                ) : (
                                                    currentContacts.map(contact => {
                                                        const assignedVolunteer = volunteers.find(v => v.id === contact.assignedTo);
                                                        return (
                                                            <tr 
                                                                key={contact.id} 
                                                                className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors cursor-pointer"
                                                                onClick={() => handleEditClick(contact)}
                                                            >
                                                                <td className="p-4 pl-5 font-bold text-[#1e3a8a] flex items-center gap-2">
                                                                    {contact.name}
                                                                </td>
                                                                <td className="p-4 text-gray-500">{contact.age || '-'}</td>
                                                                <td className="p-4 text-gray-500">{contact.memberType || '-'}</td>
                                                                <td className="p-4 text-gray-500">{contact.region || '-'}</td>
                                                                <td className="p-4 font-mono text-gray-600">{contact.phone}</td>
                                                                <td className="p-4">
                                                                    <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-md text-xs">{contact.supportLevel || '미분류'}</span>
                                                                </td>
                                                                <td className="p-4 text-gray-600 font-medium">{assignedVolunteer ? assignedVolunteer.name : '알수없음'}</td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}

                        {activeTab === 'volunteers' && (
                            <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-7 flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-[20px] font-extrabold text-slate-800 flex items-center gap-2 border-l-4 border-[#1e3a8a] pl-3 tracking-tight">
                                        자원봉사자 전체 명단 ({volunteersWithStats.length}명)
                                    </h2>
                                </div>
                                
                                <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm selection-table">
                                    <table className="w-full text-left whitespace-nowrap">
                                        <thead className="bg-[#f8fafc] text-gray-800 border-b border-gray-100">
                                            <tr>
                                                <th className="p-4 pl-5 w-[25%] text-[14px] font-bold">이름</th>
                                                <th className="p-4 w-[15%] text-[14px] font-bold">할당됨</th>
                                                <th className="p-4 w-[15%] text-[14px] font-bold">완료</th>
                                                <th className="p-4 w-[30%] text-[14px] font-bold">진행률</th>
                                                <th className="p-4 pr-5 text-center w-[15%] text-[14px] font-bold">상태</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-[14px]">
                                            {volunteersWithStats.length === 0 && (
                                                <tr><td colSpan="5" className="p-6 text-center text-gray-500 font-medium bg-gray-50/50">등록된 자원봉사자가 없습니다.</td></tr>
                                            )}
                                            {volunteersWithStats.map(v => {
                                                const vStats = v.stats;
                                                const isDone = vStats.total > 0 && vStats.progress === 100;
                                                const isPending = vStats.total === 0;
                                                return (
                                                    <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors">
                                                        <td className="p-4 pl-5 font-bold text-[#1e3a8a] flex items-center gap-2">
                                                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                                                            <UserIcon size={14} className="text-blue-600 mt-1" />
                                                            </div>
                                                            {v.name}
                                                        </td>
                                                        <td className="p-4 font-semibold text-gray-800">{vStats.total}</td>
                                                        <td className="p-4 font-semibold text-gray-800">{vStats.completed}</td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[13px] font-bold text-gray-700 w-8">{vStats.progress}%</span>
                                                                <div className="flex-1 h-[6px] bg-gray-200 rounded-full overflow-hidden mr-2">
                                                                    <div className="h-full bg-[#1e3a8a] rounded-full" style={{ width: `${Math.max(10, vStats.progress)}%` }}></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 pr-5 text-center">
                                                            <div className="flex flex-col items-center gap-1.5 justify-center">
                                                                <div className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[12px] font-black tracking-tight leading-tight w-full max-w-[56px] shadow-sm
                                                                    ${isDone ? 'bg-[#e2e8f0] text-[#475569] border border-[#cbd5e1]' : 
                                                                    isPending ? 'bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0]' : 
                                                                    'bg-[#1e3a8a] text-white border border-[#1e3a8a]'}`}>
                                                                    {isDone ? '완료' : isPending ? '대기' : '진행 증'}
                                                                </div>
                                                                <button 
                                                                    onClick={() => navigate('/volunteer', { state: { volunteerId: v.id } })}
                                                                    className="text-[11px] font-bold text-[#1e3a8a] bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors w-full max-w-[56px] shadow-sm"
                                                                >
                                                                    화면 보기
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'users' && (
                            <>
                                <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-7">
                                    <h2 className="text-[20px] font-extrabold mb-4 text-slate-800 tracking-tight">승인 대기중인 사용자</h2>
                                    {pendingUsers.length === 0 ? (
                                        <p className="text-gray-500 p-4 bg-gray-50 border border-gray-100 rounded-lg text-center font-medium">승인 대기중인 사용자가 없습니다.</p>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {pendingUsers.map(user => (
                                                <div key={user.id} className="flex items-center justify-between p-4 border border-blue-200 bg-blue-50/50 rounded-lg">
                                                    <div>
                                                        <div className="font-bold text-lg text-gray-900">{user.name}</div>
                                                        <div className="text-sm text-gray-500">{user.email}</div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button className="px-4 py-2 bg-white border border-red-200 text-red-600 font-bold rounded-lg text-sm hover:bg-red-50 transition-colors" onClick={() => handleRoleUpdate(user.id, user.name, 'REJECTED')}>거절</button>
                                                        <button className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white font-bold rounded-lg text-sm transition-colors" onClick={() => handleRoleUpdate(user.id, user.name, 'VOLUNTEER')}>자원봉사자 승인</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-7">
                                    <h2 className="text-[20px] font-extrabold mb-4 text-slate-800 tracking-tight">전체 사용자 목록</h2>
                                    <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-[#f8fafc] text-gray-600 font-bold border-b border-gray-100">
                                                <tr>
                                                    <th className="p-4 pl-5">이름</th>
                                                    <th className="p-4">이메일</th>
                                                    <th className="p-4 text-right pr-5">현재 권한 및 변경</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allUsers.filter(u => u.role !== 'UNAUTHORIZED' && u.role !== 'REJECTED').map(user => (
                                                    <tr key={user.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                                        <td className="p-4 pl-5 font-bold text-gray-800">{user.name}</td>
                                                        <td className="p-4 text-gray-500">{user.email}</td>
                                                        <td className="p-4 text-right pr-5">
                                                            {user.id === currentUser.id ? (
                                                                <div className="inline-block px-4 py-1.5 bg-[#1e3a8a] text-white rounded-xl text-[13px] font-extrabold shadow-sm border border-slate-200/80">
                                                                    최고 관리자 (본인)
                                                                </div>
                                                            ) : (
                                                                <div className="flex justify-end gap-1.5 p-1 bg-slate-100 rounded-2xl w-max ml-auto shadow-inner border border-slate-200/60">
                                                                    <button 
                                                                        onClick={() => handleRoleUpdate(user.id, user.name, 'SUPER_ADMIN')}
                                                                        className={`px-3 py-1.5 text-[13px] font-extrabold rounded-xl transition-all ${user.role === 'SUPER_ADMIN' ? 'bg-white text-purple-700 shadow-sm border border-slate-200/80 scale-100' : 'text-slate-500 hover:text-purple-700 scale-95 hover:bg-slate-200/50'}`}
                                                                    >최고 관리자</button>
                                                                    <button 
                                                                        onClick={() => handleRoleUpdate(user.id, user.name, 'ADMIN')}
                                                                        className={`px-3 py-1.5 text-[13px] font-extrabold rounded-xl transition-all ${user.role === 'ADMIN' ? 'bg-white text-[#1e3a8a] shadow-sm border border-slate-200/80 scale-100' : 'text-slate-500 hover:text-slate-800 scale-95 hover:bg-slate-200/50'}`}
                                                                    >관리자</button>
                                                                    <button 
                                                                        onClick={() => handleRoleUpdate(user.id, user.name, 'VOLUNTEER')}
                                                                        className={`px-3 py-1.5 text-[13px] font-extrabold rounded-xl transition-all ${user.role === 'VOLUNTEER' ? 'bg-[#1e3a8a] text-white shadow-sm scale-100' : 'text-slate-500 hover:text-slate-800 scale-95 hover:bg-slate-200/50'}`}
                                                                    >자원봉사자</button>
                                                                    <button 
                                                                        onClick={() => handleRoleUpdate(user.id, user.name, 'UNAUTHORIZED')}
                                                                        className={`px-3 py-1.5 text-[13px] font-extrabold rounded-xl transition-all ${user.role === 'UNAUTHORIZED' ? 'bg-red-500 text-white shadow-sm scale-100' : 'text-slate-500 hover:text-red-500 scale-95 hover:bg-red-50'}`}
                                                                    >권한 해제</button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'contacts' && (
                            <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-7 flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-[20px] font-extrabold text-slate-800 flex items-center gap-2 border-l-4 border-[#1e3a8a] pl-3 tracking-tight">연락처 및 명부 관리</h2>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={async () => {
                                                if(window.confirm('서버에 저장된 1,300여 개의 최신 병합 데이터를 불러와 업로드하시겠습니까?')) {
                                                    try {
                                                        const res = await fetch('/merged_contacts.json');
                                                        const data = await res.json();
                                                        if(data && Array.isArray(data)) {
                                                            await importBulkContacts(data);
                                                            window.location.reload();
                                                        }
                                                    } catch (e) {
                                                        alert('JSON 파일을 불러오는데 실패했습니다.');
                                                        console.error(e);
                                                    }
                                                }
                                            }} 
                                            className="px-4 py-2 border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 text-[13px] font-extrabold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                            통합 데이터 업로드
                                        </button>
                                        <button onClick={resetTestData} className="px-4 py-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-[13px] font-extrabold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                            테스트 DB 초기화
                                        </button>
                                        <button onClick={handleAddClick} className="px-6 py-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-[14px] font-extrabold rounded-xl transition-all shadow-md active:scale-95">
                                            새 연락처 추가
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Bulk Selection Actions */}
                                {selectedContacts.length > 0 && (
                                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-[#1e3a8a] text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">{selectedContacts.length}</span>
                                            <span className="text-[14px] font-bold text-blue-900">명 선택됨</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <select
                                                className="pl-3 pr-8 py-2 bg-white border border-blue-200 rounded-lg outline-none text-[13px] font-bold text-gray-700 shadow-sm"
                                                value={bulkAssignVolunteer}
                                                onChange={(e) => setBulkAssignVolunteer(e.target.value)}
                                            >
                                                <option value="" disabled hidden>담당할 자원봉사자 선택</option>
                                                <option value="UNASSIGNED">-- 담당자 지정 해제 --</option>
                                                {volunteers.map(v => (
                                                    <option key={v.id} value={v.id}>{v.name}</option>
                                                ))}
                                            </select>
                                            <button 
                                                onClick={handleBulkReassign}
                                                className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-[13px] font-bold rounded-lg transition-all shadow-sm"
                                            >
                                                일괄 할당/변경
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-[#f8fafc] text-gray-600 font-bold border-b border-gray-100">
                                            <tr>
                                                <th className="p-4 pl-4 w-12">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-gray-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                                                        checked={contacts.length > 0 && selectedContacts.length === contacts.length}
                                                        onChange={handleSelectAll}
                                                    />
                                                </th>
                                                <th className="p-4">이름</th>
                                                <th className="p-4">나이</th>
                                                <th className="p-4">당원구분</th>
                                                <th className="p-4">지역</th>
                                                <th className="p-4">전화번호</th>
                                                <th className="p-4">담당자</th>
                                                <th className="p-4">상태</th>
                                                <th className="p-4">조사결과</th>
                                                <th className="p-4 pr-5 text-right">작업</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {contacts.length === 0 ? (
                                                <tr><td colSpan="10" className="p-6 text-center text-gray-500 font-medium bg-gray-50/50">등록된 연락처가 없습니다.</td></tr>
                                            ) : (
                                                contacts.map(contact => {
                                                    const assignedVolunteer = volunteers.find(v => v.id === contact.assignedTo);
                                                    return (
                                                        <tr key={contact.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors ${selectedContacts.includes(contact.id) ? 'bg-blue-50/30' : ''}`}>
                                                            <td className="p-4 pl-4">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-4 h-4 rounded border-gray-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                                                                    checked={selectedContacts.includes(contact.id)}
                                                                    onChange={() => handleSelectContact(contact.id)}
                                                                />
                                                            </td>
                                                            <td className="p-4 font-bold text-gray-800">{contact.name}</td>
                                                            <td className="p-4 text-gray-500">{contact.age || '-'}</td>
                                                            <td className="p-4 text-gray-500">{contact.memberType || '-'}</td>
                                                            <td className="p-4 text-gray-500">{contact.region || '-'}</td>
                                                            <td className="p-4 font-mono text-gray-600">{contact.phone}</td>
                                                            <td className="p-4 text-gray-600 font-medium">{assignedVolunteer ? assignedVolunteer.name : <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs font-bold">미할당</span>}</td>
                                                            <td className="p-4">
                                                                {contact.status === 'CALLED' ? (
                                                                    <Badge variant="success">완료</Badge>
                                                                ) : contact.status === 'UNASSIGNED' ? (
                                                                    <Badge variant="default">대기중</Badge>
                                                                ) : (
                                                                    <Badge variant="info">진행중</Badge>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-gray-500 font-medium">
                                                                {contact.surveyResult || '-'}
                                                            </td>
                                                            <td className="p-4 pr-5 text-right">
                                                                <div className="flex gap-2 justify-end">
                                                                    <button className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50" onClick={() => handleEditClick(contact)}>수정</button>
                                                                    <button className="px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50" onClick={() => {
                                                                        showDialog('confirm', '연락처 삭제', `${contact.name} 연락처를 삭제하시겠습니까?`, () => {
                                                                            deleteContact(contact.id);
                                                                        });
                                                                    }}>삭제</button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ContactFormModal
                isOpen={isContactModalOpen}
                onClose={() => setIsContactModalOpen(false)}
                onSubmit={handleContactSubmit}
                initialData={editingContact}
            />
            
            <ContactDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                contact={viewingContact}
            />
            
            <DialogModal
                isOpen={dialogConfig.isOpen}
                onClose={closeDialog}
                onConfirm={dialogConfig.onConfirm}
                title={dialogConfig.title}
                message={dialogConfig.message}
                type={dialogConfig.type}
            />
        </div>
    );
};
