import React, { useState, useMemo } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { ContactDetailModal } from '../components/ContactDetailModal';
import { DialogModal } from '../components/DialogModal';
import { Search, ChevronRight, Phone, PhoneOff, User, CheckCircle2, ArrowLeft } from 'lucide-react';

export const VolunteerDashboard = () => {
    const { getVolunteerStats, contacts, updateContact, fetchVolunteerContacts } = useCampaign();
    const { user: currentUser, getAllUsers } = useAuth();
    const location = useLocation();
    
    const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.role === 'DEVELOPER';

    const [adminSearchQuery, setAdminSearchQuery] = useState('');
    const [selectedVolunteerId, setSelectedVolunteerId] = useState(isAdmin ? (location.state?.volunteerId || '') : currentUser.id);

    const targetUserId = isAdmin ? selectedVolunteerId : currentUser.id;

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContact, setSelectedContact] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'PENDING', 'CALLED'
    const [currentPage, setCurrentPage] = useState(1);
    const contactsPerPage = 10;
    
    // Status Modal State
    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null });

    const [volunteerContacts, setVolunteerContacts] = useState([]);
    const [isVStatsLoading, setIsVStatsLoading] = useState(false);

    // Fetch contacts for the target volunteer (especially for admins who don't have global listener)
    React.useEffect(() => {
        if (!targetUserId) return;
        
        // If it's the current volunteer, contacts are already loaded via user-specific listener in context
        if (!isAdmin && currentUser.id === targetUserId) {
            setVolunteerContacts(contacts);
            return;
        }

        // For admins viewing a specific volunteer, we fetch the data.
        // We do NOT add 'contacts' to the dependency array to avoid race conditions
        // where a global update triggers a refetch that overwrites optimistic local updates.
        const loadVolunteerData = async () => {
            setIsVStatsLoading(true);
            try {
                const data = await fetchVolunteerContacts(targetUserId);
                setVolunteerContacts(data);
            } catch (e) {
                console.error(e);
            } finally {
                setIsVStatsLoading(false);
            }
        };
        
        loadVolunteerData();
    }, [targetUserId, isAdmin, fetchVolunteerContacts, currentUser.id, contacts]);

    const handleCallFailedDirect = async (contact) => {
        const now = new Date();
        const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const recordEntry = `[${dateString}] 통화 실패`;
        const finalNotes = contact.notes ? `${contact.notes}\n${recordEntry}` : recordEntry;

        const updateData = { 
            notes: finalNotes, 
            supportLevel: null, 
            status: 'CALLED'
        };

        console.log('VolunteerDashboard: handleCallFailedDirect', updateData);
        const res = await updateContact(contact.id, updateData);
        
        if (res.success) {
            setVolunteerContacts(prev => prev.map(c => c.id === contact.id ? { ...c, ...updateData } : c));
        } else {
            alert(`통화 실패 기록 중 오류가 발생했습니다: ${res.error?.message || '알 수 없는 오류'}`);
        }
    };

    const stats = targetUserId ? getVolunteerStats(targetUserId) : { progress: 0, total: 0, completed: 0 };
    // If stats are 0 but we are admin, we might need to show the ones from AdminDashboard.
    // For now, let's just use the filtered contacts to calculate stats locally if they are loaded.
    const localStats = useMemo(() => {
        const assigned = volunteerContacts;
        const completed = assigned.filter(c => c.status === 'CALLED').length;
        const total = assigned.length;
        return {
            total,
            completed,
            remaining: total - completed,
            progress: total === 0 ? 0 : ((completed / total) * 100).toFixed(2)
        };
    }, [volunteerContacts]);

    const displayStats = (isAdmin && localStats.total === 0) ? stats : localStats;
    
    const myContacts = useMemo(() => {
        let list = volunteerContacts;
        if (statusFilter === 'CALLED') {
            list = volunteerContacts.filter(c => c.status === 'CALLED');
        } else if (statusFilter === 'PENDING') {
            list = volunteerContacts.filter(c => c.status !== 'CALLED');
        }
        
        // Final search filtering inside myContacts to make pagination work with search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter(c => 
                c.name.toLowerCase().includes(query) || 
                (c.phone && c.phone.includes(query))
            );
        }
        
        return list;
    }, [volunteerContacts, statusFilter, searchQuery]);

    // Reset page when filter or search changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, searchQuery]);

    const totalContacts = myContacts.length;
    const totalPages = Math.ceil(totalContacts / contactsPerPage);
    
    // Contacts to display in the main list
    const displayContacts = useMemo(() => {
        const start = (currentPage - 1) * contactsPerPage;
        return myContacts.slice(start, start + contactsPerPage);
    }, [myContacts, currentPage]);

    // --- Today's Saved Contacts logic ---
    const todaySavedContacts = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayString = `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        return volunteerContacts
            .filter(c => {
                if (c.status !== 'CALLED') return false;
                const isUpdatedToday = c.updatedAt && new Date(c.updatedAt).getTime() >= startOfToday;
                const isNotedToday = c.notes && c.notes.includes(todayString);
                return isUpdatedToday || isNotedToday;
            })
            .map(c => {
                let sortTime = c.updatedAt ? new Date(c.updatedAt).getTime() : 0;
                let displayTime = c.updatedAt || new Date().toISOString();
                
                if (c.notes && c.notes.includes(todayString)) {
                    // Extract times like "[2026-03-19 09:41]"
                    const regex = new RegExp(`\\[(${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} \\d{2}:\\d{2})\\]`, 'g');
                    let match;
                    let latestNoteTime = 0;
                    while ((match = regex.exec(c.notes)) !== null) {
                        const noteTime = new Date(match[1]).getTime();
                        if (noteTime > latestNoteTime) latestNoteTime = noteTime;
                    }
                    if (latestNoteTime > sortTime) {
                        sortTime = latestNoteTime;
                        displayTime = new Date(latestNoteTime).toISOString();
                    }
                }
                return { ...c, sortTime, displayTime };
            })
            .sort((a, b) => b.sortTime - a.sortTime);
    }, [volunteerContacts]);

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
            onConfirm: async () => {
                const res = await updateContact(contact.id, { status: newStatus });
                if (!res.success) {
                    alert(`상태 변경 중 오류가 발생했습니다: ${res.error?.message || '알 수 없는 오류'}`);
                }
            }
        });
    };

    // --- Admin Volunteer Selector UI ---
    if (isAdmin && !selectedVolunteerId) {
        const allUsers = getAllUsers ? getAllUsers() : [];
        const assignableUsers = allUsers.filter(u => u.role !== 'REJECTED' && u.role !== 'UNAUTHORIZED' && u.role !== 'DEVELOPER');
        const filteredVols = assignableUsers.filter(v => v.name.includes(adminSearchQuery));

        return (
            <div className="flex flex-col w-full h-full font-sans bg-[#e8edf2] overflow-y-auto">
                <div className="bg-[#1e3a8a] text-white px-8 py-6 pb-8 shadow-md">
                    <div className="max-w-[800px] mx-auto w-full">
                        <h1 className="text-2xl font-black mb-1">담당자 대시보드 열람</h1>
                        <p className="text-blue-200 font-bold">진행 상황을 확인할 담당자를 검색하고 선택해주세요.</p>
                    </div>
                </div>
                <div className="max-w-[800px] mx-auto w-full px-8 mt-6 flex flex-col gap-6 pb-12">
                    <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col relative z-20">
                        <h2 className="text-[16px] font-extrabold text-slate-800 tracking-tight mb-3">담당자 검색 및 선택</h2>
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
                                <p className="text-center text-slate-500 font-bold py-4">등록된/검색된 담당자가 없습니다.</p>
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
                                                <span className="text-[13px] text-slate-500 font-medium">{v.role === 'ADMIN' ? '관리자' : '담당자'}</span>
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
                            {isAdmin ? `${targetUser?.name}님의 화면` : `${currentUser.name} 담당자님`}
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
                    </div>
                    
                    {isVStatsLoading ? (
                        <div className="py-4 text-center text-slate-400 font-bold">데이터를 불러오는 중...</div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center border-4 border-[#1e3a8a] relative shrink-0">
                                <span className="text-[13px] font-black text-[#1e3a8a]">{displayStats.progress}%</span>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-[14px] font-bold text-slate-600 mb-2">
                                    <span>할당된 전체 통화: {displayStats.total}건</span>
                                    <span className="text-[#1e3a8a]">완료: {displayStats.completed}건</span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className="h-full bg-[#1e3a8a] rounded-full transition-all duration-1000 ease-out" 
                                        style={{ width: `${displayStats.progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 1.5) Today's Saved List (Reassurance Section) */}
                <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col relative overflow-hidden">
                    {/* Decorative Background Element */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full -mr-10 -mt-10 z-0" />
                    
                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <div className="flex flex-col">
                            <h2 className="text-[18px] font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                                <CheckCircle2 size={20} className="text-green-500" />
                                오늘 내가 저장한 명단
                            </h2>
                            <p className="text-[12px] text-slate-500 font-bold mt-0.5">실시간으로 저장 내역이 확인됩니다</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black border border-green-100 shadow-sm animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> LIVE
                        </div>
                    </div>

                    {todaySavedContacts.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 relative z-10">
                            <p className="text-slate-400 font-bold text-[13px]">오늘 아직 저장된 명단이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 relative z-10">
                            {todaySavedContacts.slice(0, 5).map(contact => (
                                <div key={contact.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-blue-200 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-[#1e3a8a] font-black text-[14px] border border-blue-100">
                                            {contact.name.substring(0, 1)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-extrabold text-slate-800 text-[14px]">{contact.name}</span>
                                            <span className="text-[11px] font-bold text-[#1e3a8a]">{contact.supportLevel || '성향 미확인'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="hidden sm:flex flex-col items-end max-w-[150px]">
                                            <span className="text-[10px] text-slate-400 font-medium truncate w-full text-right">
                                                {contact.notes ? contact.notes.split('\n').filter(l => l.includes(']')).pop()?.split(']').pop()?.trim() || '기록됨' : '기록됨'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors shrink-0">
                                            {new Date(contact.displayTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {todaySavedContacts.length > 5 && (
                                <div className="text-center mt-1">
                                    <p className="text-[11px] text-slate-400 font-bold">외 {todaySavedContacts.length - 5}명의 명단이 더 있습니다.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 2) Assigned Contacts List */}
                <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 flex flex-col z-10">
                    <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
                        <h2 className="text-[18px] font-extrabold text-slate-800 tracking-tight flex items-center gap-2 border-l-4 border-[#1e3a8a] pl-3">
                            나의 할당 명단
                            <span className="bg-slate-100 text-slate-600 text-[12px] px-2 py-0.5 rounded-full">{totalContacts}</span>
                        </h2>
                    </div>

                    {/* Pagination Controls */}
                    {totalContacts > 0 && (
                        <div className="flex justify-between items-center mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-[12px] text-slate-500 font-bold">
                                {(currentPage - 1) * contactsPerPage + 1} - {Math.min(currentPage * contactsPerPage, totalContacts)} / {totalContacts}
                            </div>
                            
                            <div className="flex bg-slate-200/50 rounded-lg p-1 items-center gap-2">
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-md text-[12px] font-bold bg-white shadow-sm disabled:opacity-50 disabled:shadow-none hover:bg-gray-50 flex items-center gap-1"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg> 이전
                                </button>
                                
                                <div className="flex items-center gap-1 px-1">
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max={totalPages}
                                        defaultValue={currentPage}
                                        key={currentPage}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                let val = parseInt(e.target.value);
                                                if (!isNaN(val) && val >= 1 && val <= totalPages) {
                                                    setCurrentPage(val);
                                                } else {
                                                    e.target.value = currentPage;
                                                }
                                            }
                                        }}
                                        onBlur={(e) => {
                                            let val = parseInt(e.target.value);
                                            if (!isNaN(val) && val >= 1 && val <= totalPages) {
                                                setCurrentPage(val);
                                            } else {
                                                e.target.value = currentPage;
                                            }
                                        }}
                                        className="w-10 text-center py-1 rounded border border-slate-200 text-[12px] font-bold outline-none focus:ring-2 focus:ring-[#1e3a8a]/20"
                                    />
                                    <span className="text-[12px] font-bold text-slate-400">/ {totalPages}</span>
                                </div>

                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-md text-[12px] font-bold bg-white shadow-sm disabled:opacity-50 disabled:shadow-none hover:bg-gray-50 flex items-center gap-1"
                                >
                                    다음 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Search Bar */}
                    <div className="relative mb-5">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="명단 내 빠른 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] outline-none text-[14px] font-bold text-slate-700 placeholder:text-slate-400 transition-all shadow-inner"
                        />
                    </div>
                    
                    {/* Status Filter Tabs */}
                    <div className="flex p-1 bg-slate-100 rounded-xl mb-5">
                        <button 
                            onClick={() => setStatusFilter('ALL')}
                            className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all ${statusFilter === 'ALL' ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
                        >
                            전체 ({volunteerContacts.length})
                        </button>
                        <button 
                            onClick={() => setStatusFilter('PENDING')}
                            className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all ${statusFilter === 'PENDING' ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
                        >
                            진행 대기 ({volunteerContacts.filter(c => c.status !== 'CALLED').length})
                        </button>
                        <button 
                            onClick={() => setStatusFilter('CALLED')}
                            className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all ${statusFilter === 'CALLED' ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
                        >
                            통화 완료 ({volunteerContacts.filter(c => c.status === 'CALLED').length})
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {myContacts.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 font-bold bg-slate-50 rounded-2xl border border-slate-100">
                                아직 관리자로부터 할당받은 연락처가 없습니다.
                            </div>
                        ) : (
                            displayContacts.map(contact => (
                                <div key={contact.id} className="flex flex-col sm:flex-row items-start sm:items-center p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#1e3a8a]/30 transition-all shadow-sm gap-3 sm:gap-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border shadow-sm transition-colors ${contact.status === 'CALLED' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                            {contact.status === 'CALLED' ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-black leading-none uppercase">DONE</span>
                                                    <CheckCircle2 size={12} className="mt-0.5" />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-black leading-none uppercase">WAIT</span>
                                                    <Phone size={12} className="mt-0.5" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-extrabold text-slate-800 text-[16px] truncate">{contact.name}</span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-slate-500 text-[12px] font-bold bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">{contact.memberType || '구분없음'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                                            <button 
                                                onClick={() => openContactDetail(contact)}
                                                className="px-4 py-2 bg-[#1e3a8a] text-white hover:bg-[#1e40af] text-[13px] font-black rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 shrink-0 border border-[#1e3a8a]"
                                            >
                                                <Phone size={14} className="animate-pulse" /> 전화 걸기
                                            </button>
                                            
                                            {contact.status === 'CALLED' ? (
                                                <div className="px-4 py-2 text-[13px] font-black rounded-xl bg-green-100 text-green-700 border border-green-200 flex items-center gap-1.5 shadow-sm shrink-0">
                                                    <CheckCircle2 size={14} /> 통화완료
                                                </div>
                                            ) : (
                                                <div className="px-4 py-2 text-[13px] font-black rounded-xl bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1.5 shrink-0">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" /> 진행대기
                                                </div>
                                            )}

                                            <button 
                                                onClick={() => handleCallFailedDirect(contact)}
                                                className="px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 text-[13px] font-black rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0 border border-amber-400"
                                            >
                                                <PhoneOff size={14} /> 통화실패
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
                onUpdate={(updatedContact) => {
                    // Update the local list reflecting changes from the modal
                    setVolunteerContacts(prev => prev.map(c => c.id === updatedContact.id ? { ...c, ...updatedContact } : c));
                    // If this is the current volunteer, the context 'contacts' is already updated optimistically by updateContact
                }}
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
