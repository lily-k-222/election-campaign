import React, { useState, useMemo } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { ContactDetailModal } from '../components/ContactDetailModal';
import { DialogModal } from '../components/DialogModal';
import { Search, ChevronRight, Phone, User, CheckCircle2, ArrowLeft } from 'lucide-react';

export const VolunteerDashboard = () => {
    const { getVolunteerStats, contacts, updateContact } = useCampaign();
    const { user: currentUser, getAllUsers } = useAuth();
    const location = useLocation();
    
    const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';

    const [adminSearchQuery, setAdminSearchQuery] = useState('');
    const [selectedVolunteerId, setSelectedVolunteerId] = useState(isAdmin ? (location.state?.volunteerId || '') : currentUser.id);

    const targetUserId = isAdmin ? selectedVolunteerId : currentUser.id;

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContact, setSelectedContact] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [showAllContacts, setShowAllContacts] = useState(false);
    
    // Status Modal State
    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null });

    const stats = targetUserId ? getVolunteerStats(targetUserId) : { progress: 0, total: 0, completed: 0 };
    const myContacts = targetUserId ? contacts.filter(c => c.assignedTo === targetUserId) : [];

    // Filter contacts based on search query
    const filteredSearchContacts = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        return myContacts.filter(c => 
            c.name.toLowerCase().includes(query) || 
            (c.phone && c.phone.includes(query))
        );
    }, [searchQuery, myContacts]);

    // Contacts to display in the main list
    const displayContacts = showAllContacts ? myContacts : myContacts.slice(0, 5);

    const openContactDetail = (contact) => {
        setSelectedContact(contact);
        setIsDetailModalOpen(true);
        setSearchQuery(''); // Optional: clear search after opening
    };

    const handleStatusChange = (contact, newStatus) => {
        if (contact.status === newStatus) return;

        setDialogConfig({
            isOpen: true,
            type: 'confirm',
            title: '통화 상태 변경',
            message: `${contact.name}님의 상태를 [${newStatus === 'CALLED' ? '완료' : '진행 대기'}]로 변경하시겠습니까?`,
            onConfirm: () => {
                updateContact(contact.id, { status: newStatus });
            }
        });
    };

    // --- Admin Volunteer Selector UI ---
    if (isAdmin && !selectedVolunteerId) {
        const allUsers = getAllUsers ? getAllUsers() : [];
        const volunteers = allUsers.filter(u => u.role === 'VOLUNTEER');
        const filteredVols = volunteers.filter(v => v.name.includes(adminSearchQuery));

        return (
            <div className="flex flex-col w-full h-full font-sans bg-[#e8edf2] overflow-y-auto">
                <div className="bg-[#1e3a8a] text-white px-8 py-6 pb-8 shadow-md">
                    <div className="max-w-[800px] mx-auto w-full">
                        <h1 className="text-2xl font-black mb-1">자원봉사자 대시보드 열람</h1>
                        <p className="text-blue-200 font-bold">진행 상황을 확인할 자원봉사자를 검색하고 선택해주세요.</p>
                    </div>
                </div>
                <div className="max-w-[800px] mx-auto w-full px-8 mt-6 flex flex-col gap-6 pb-12">
                    <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col relative z-20">
                        <h2 className="text-[16px] font-extrabold text-slate-800 tracking-tight mb-3">자원봉사자 검색 및 선택</h2>
                        <div className="relative mb-4">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="이름으로 검색..."
                                value={adminSearchQuery}
                                onChange={(e) => setAdminSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-full focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] outline-none text-[15px] font-bold text-slate-700 placeholder:text-slate-400 shadow-inner transition-all"
                            />
                        </div>
                        <div className="grid gap-2">
                            {filteredVols.length === 0 ? (
                                <p className="text-center text-slate-500 font-bold py-4">등록된/검색된 자원봉사자가 없습니다.</p>
                            ) : (
                                filteredVols.map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => setSelectedVolunteerId(v.id)}
                                        className="px-5 py-4 bg-white border border-slate-200 hover:border-[#1e3a8a] hover:bg-blue-50/50 rounded-2xl flex items-center justify-between transition-all group active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                <User size={18} />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="font-extrabold text-[16px] text-slate-800">{v.name}</span>
                                                <span className="text-[13px] text-slate-500 font-medium">자원봉사자</span>
                                            </div>
                                        </div>
                                        <div className="text-[#1e3a8a] font-bold text-[13px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            화면 보기 <ChevronRight size={16} />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const targetUser = isAdmin ? getAllUsers().find(u => u.id === targetUserId) : currentUser;

    return (
        <div className="flex flex-col w-full h-full font-sans bg-[#e8edf2] overflow-y-auto">
            {/* Header Area */}
            <div className="bg-[#1e3a8a] text-white px-8 py-6 pb-8 shadow-md relative">
                <div className="max-w-[800px] mx-auto w-full relative flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-black mb-1">
                            {isAdmin ? `${targetUser?.name}님의 화면` : `${currentUser.name} 봉사자님`}
                        </h1>
                        <p className="text-[13px] text-blue-200 font-bold">
                            {isAdmin ? "관리자 권한 열람 중" : "오늘도 선거 승리를 위해 힘찬 하루 되세요!"}
                        </p>
                    </div>
                    {isAdmin && (
                        <button 
                            onClick={() => setSelectedVolunteerId('')}
                            className="text-[12px] font-bold text-blue-200 hover:text-white transition-colors flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-full"
                        >
                            <ArrowLeft size={14} /> 목록으로
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-[800px] mx-auto w-full px-8 mt-6 flex flex-col gap-6 pb-12">
                
                {/* 1) Campaign Progress */}
                <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col">
                    <div className="flex justify-between items-end mb-4">
                        <h2 className="text-[18px] font-extrabold text-slate-800 tracking-tight">나의 캠페인 진행 상황</h2>
                        <button 
                            onClick={() => setShowAllContacts(true)}
                            className="text-[13px] font-extrabold text-[#1e3a8a] hover:text-[#1e40af] flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full transition-colors active:scale-95"
                        >
                            안내 명단 가기 <ChevronRight size={14} />
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center border-4 border-[#1e3a8a] relative shrink-0">
                            <span className="text-lg font-black text-[#1e3a8a]">{stats.progress}%</span>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between text-[14px] font-bold text-slate-600 mb-2">
                                <span>할당된 전체 통화: {stats.total}건</span>
                                <span className="text-[#1e3a8a]">완료: {stats.completed}건</span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                <div 
                                    className="h-full bg-[#1e3a8a] rounded-full transition-all duration-1000 ease-out" 
                                    style={{ width: `${stats.progress}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2) Search Bar */}
                <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col relative z-20">
                    <h2 className="text-[16px] font-extrabold text-slate-800 tracking-tight mb-3">연락처 빠른 검색</h2>
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="이름 또는 전화번호로 검색해보세요"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-full focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] outline-none text-[15px] font-bold text-slate-700 placeholder:text-slate-400 shadow-inner transition-all"
                        />
                    </div>
                    
                    {/* Search Results Dropdown */}
                    {searchQuery.trim() && (
                        <div className="absolute top-[100%] left-6 right-6 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-30 flex flex-col">
                            {filteredSearchContacts.length === 0 ? (
                                <div className="p-4 text-center text-slate-500 font-bold text-[14px]">검색 결과가 없습니다.</div>
                            ) : (
                                <ul className="max-h-[300px] overflow-y-auto">
                                    {filteredSearchContacts.map(c => (
                                        <li key={c.id}>
                                            <button 
                                                onClick={() => openContactDetail(c)}
                                                className="w-full text-left px-5 py-3.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center justify-between transition-colors group"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-extrabold text-slate-800 text-[15px]">{c.name}</span>
                                                    <span className="text-slate-500 font-mono text-[13px]">{c.phone}</span>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-blue-50 text-[#1e3a8a] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ChevronRight size={16} />
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                {/* 3) Assigned Contacts List */}
                <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col z-10">
                    <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
                        <h2 className="text-[18px] font-extrabold text-slate-800 tracking-tight flex items-center gap-2 border-l-4 border-[#1e3a8a] pl-3">
                            나의 할당 명단
                            <span className="bg-slate-100 text-slate-600 text-[12px] px-2 py-0.5 rounded-full">{myContacts.length}</span>
                        </h2>
                        {!showAllContacts && myContacts.length > 5 && (
                            <button 
                                onClick={() => setShowAllContacts(true)}
                                className="text-[13px] font-black text-[#1e3a8a] hover:text-[#1e40af] bg-blue-50 px-3 py-1.5 rounded-full transition-colors active:scale-95"
                            >
                                전체보기
                            </button>
                        )}
                        {showAllContacts && (
                            <button 
                                onClick={() => setShowAllContacts(false)}
                                className="text-[13px] font-extrabold text-slate-500 hover:text-slate-800 px-3 py-1.5 transition-colors"
                            >
                                접기
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        {myContacts.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 font-bold bg-slate-50 rounded-2xl border border-slate-100">
                                아직 관리자로부터 할당받은 연락처가 없습니다.
                            </div>
                        ) : (
                            displayContacts.map(contact => (
                                <div key={contact.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#1e3a8a]/30 transition-all shadow-sm gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                            <User size={18} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-extrabold text-slate-800 text-[16px] whitespace-nowrap">{contact.name}</span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-slate-500 text-[12px] font-bold bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">{contact.memberType || '구분없음'}</span>
                                                <span className="text-slate-500 text-[13px] font-medium truncate max-w-[120px]">{contact.region || '지역 미상'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                                        {/* Status Toggle (Like Role Toggle) */}
                                        <div className="flex justify-end gap-1 p-1 bg-slate-100 rounded-xl w-max shadow-inner border border-slate-200/60 grow sm:grow-0">
                                            <button 
                                                onClick={() => handleStatusChange(contact, 'UNASSIGNED')}
                                                className={`px-4 py-1.5 text-[13px] font-extrabold rounded-lg transition-all ${contact.status !== 'CALLED' ? 'bg-white text-slate-800 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-700 scale-95 hover:bg-slate-200/50'}`}
                                            >대기</button>
                                            <button 
                                                onClick={() => handleStatusChange(contact, 'CALLED')}
                                                className={`px-4 py-1.5 text-[13px] font-extrabold rounded-lg transition-all flex items-center gap-1 ${contact.status === 'CALLED' ? 'bg-green-500 text-white shadow-sm scale-100' : 'text-slate-500 hover:text-green-600 scale-95 hover:bg-green-50'}`}
                                            >
                                                {contact.status === 'CALLED' && <CheckCircle2 size={14} />}
                                                완료
                                            </button>
                                        </div>
                                        
                                        {/* View Detail Button */}
                                        <button 
                                            onClick={() => openContactDetail(contact)}
                                            className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-[13px] font-extrabold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1 shrink-0 ml-auto sm:ml-0"
                                        >
                                            <Phone size={14} /> 연락처
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>

            <ContactDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                contact={selectedContact}
            />
            
            <DialogModal
                isOpen={dialogConfig.isOpen}
                onClose={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={dialogConfig.onConfirm}
                title={dialogConfig.title}
                message={dialogConfig.message}
                type={dialogConfig.type}
            />
        </div>
    );
};
