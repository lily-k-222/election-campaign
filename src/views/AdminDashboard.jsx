import React, { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Badge } from '../components/Badge';
import { ContactFormModal } from '../components/ContactFormModal';
import { ContactDetailModal } from '../components/ContactDetailModal';
import { DialogModal } from '../components/DialogModal';
import { Search, SlidersHorizontal, User as UserIcon, BarChart2, ClipboardList, Edit2, Save, X, Download, ArrowLeft, ChevronRight, Bug } from 'lucide-react';
import { utils, writeFile } from 'xlsx';

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
        importBulkContacts,
        fetchContactsPaginated,
        fetchAllVolunteerStats,
        fetchAllContactsForExport,
        fetchErrorReports,
        updateErrorReportStatus,
        resetDatabase,
        loading: contextLoading
    } = useCampaign();

    const { users, updateUserRole, updateUserName, addUserManually, fetchUsers, user: currentUser } = useAuth();
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

    // Users Tab Search & Sort
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [userRoleSort, setUserRoleSort] = useState('ALL');
    const [errorReports, setErrorReports] = useState([]);
    const [isReportsLoading, setIsReportsLoading] = useState(false);

    // Volunteers Tab Search
    const [volunteerSearchTerm, setVolunteerSearchTerm] = useState('');

    // Contacts Tab Search & Pagination
    const [contactData, setContactData] = useState([]);
    const [totalContacts, setTotalContacts] = useState(0);
    const [contactSearchTerm, setContactSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('agent'); // 'agent', 'status', 'support'
    const [volunteerFilter, setVolunteerFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [supportLevelFilter, setSupportLevelFilter] = useState('ALL');
    const [contactPage, setContactPage] = useState(1);
    const contactsPerPage = 50;
    const [isDataLoading, setIsDataLoading] = useState(false);
    
    // Manual User Addition state
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ email: '', name: '', role: 'VOLUNTEER' });

    // Editing State
    const [editingUserId, setEditingUserId] = useState(null);
    const [tempName, setTempName] = useState('');
    
    // Stats State
    const [campaignStats, setCampaignStats] = useState({ total: 0, completed: 0, surveyCount: 0, results: {} });
    const [unassignedCount, setUnassignedCount] = useState(0);
    const [volunteerStatsMap, setVolunteerStatsMap] = useState({});
    const [isStatsLoading, setIsStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState(null);

    const showDialog = (type, title, message, onConfirm = null) => {
        setDialogConfig({ isOpen: true, type, title, message, onConfirm });
    };
    
    const closeDialog = () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
    };

    const loadStats = React.useCallback(async () => {
        setIsStatsLoading(true);
        setStatsError(null);
        try {
            console.log('AdminDashboard: Loading stats...');
            const s = await getCampaignStats();
            if (s.error) {
                setStatsError(s.error);
            }
            setCampaignStats(s);
            setUnassignedCount(s.unassigned || 0); 

            if (users && users.length > 0) {
                // Fetch stats for all users who might have assigned contacts (Admins and Volunteers)
                const vids = users
                    .filter(u => u.role !== 'DEVELOPER' && u.role !== 'REJECTED' && u.role !== 'UNAUTHORIZED')
                    .map(u => u.id);
                if (vids.length > 0) {
                    const vStats = await fetchAllVolunteerStats(vids);
                    console.log('AdminDashboard: Volunteer stats updated', vStats);
                    setVolunteerStatsMap(vStats);
                }
            }
        } catch (e) {
            console.error("Stats fetch failed", e);
            setStatsError(e.message);
        } finally {
            setIsStatsLoading(false);
        }
    }, [users, getCampaignStats, fetchAllVolunteerStats]);

    const handleLocalUpdate = (updatedContact) => {
        console.log('AdminDashboard: Local update received', updatedContact);
        setContactData(prev => prev.map(c => c.id === updatedContact.id ? { ...c, ...updatedContact } : c));
        if (viewingContact && viewingContact.id === updatedContact.id) {
            setViewingContact(prev => ({ ...prev, ...updatedContact }));
        }
        // Immediately refresh campaign stats for the dashboard counters
        loadStats();
    };

    const loadContacts = async () => {
        if (activeTab === 'contacts' || activeTab === 'result_detail') {
            setIsDataLoading(true);
            const result = await fetchContactsPaginated({ 
                page: contactPage, 
                pageSize: contactsPerPage, 
                filters: { 
                    volunteerId: activeTab === 'contacts' ? volunteerFilter : 'ALL',
                    status: activeTab === 'contacts' ? statusFilter : 'CALLED',
                    supportLevel: (activeTab === 'contacts' || activeTab === 'result_detail') ? supportLevelFilter : 'ALL'
                },
                search: contactSearchTerm 
            });
            setContactData(result.data || []);
            setTotalContacts(result.total || 0);
            setIsDataLoading(false);
        }
    };

    // Debounced stats loader to prevent thrashing
    const [statsTimeout, setStatsTimeout] = useState(null);
    const debouncedLoadStats = React.useCallback(() => {
        if (statsTimeout) clearTimeout(statsTimeout);
        const timer = setTimeout(() => {
            loadStats();
        }, 5000); // 5s debounce
        setStatsTimeout(timer);
    }, [statsTimeout, loadStats]);

    // Initial Stats Load & Real-time Subscription for Dashboard
    React.useEffect(() => {
        if (activeTab === 'campaign' || activeTab === 'users' || activeTab === 'volunteers') {
            loadStats();
        }

        if (activeTab === 'campaign') {
            // Subscribe to all changes on contacts table to refresh stats in real-time
            // Throttled via debouncedLoadStats
            const channel = supabase
                .channel('admin-stats-monitor')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'contacts' 
                }, () => {
                    console.log('Real-time: Contact change detected, queuing stats refresh');
                    debouncedLoadStats();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
                if (statsTimeout) clearTimeout(statsTimeout);
            };
        }
    }, [activeTab, loadStats, debouncedLoadStats, statsTimeout]);

    // Paginated Fetch Effect
    React.useEffect(() => {
        loadContacts();
    }, [activeTab, contactPage, contactSearchTerm, volunteerFilter, statusFilter, supportLevelFilter]);

    // Assignable users are all registered users except rejected or unauthorized
    const assignableUsers = users.filter(u => u.role !== 'REJECTED' && u.role !== 'UNAUTHORIZED' && u.role !== 'DEVELOPER');
    // For specific "pending" view
    const pendingUsers = users.filter(u => u.role === 'UNAUTHORIZED');

    // Pre-calculate assignee stats and sort
    // List of users who can have contacts assigned (Admins + Volunteers)
    const assigneesWithStats = assignableUsers.map(v => ({
        ...v,
        stats: volunteerStatsMap[v.id] || { completed: 0, total: 0, progress: 0 }
    })).sort((a, b) => b.stats.completed - a.stats.completed); // Sort by performance

    const managersWithStats = assigneesWithStats; // Admins are also managers/assignees now

    const stats = campaignStats;
    const progressPercent = stats.total === 0 ? "0" : ((stats.completed / stats.total) * 100).toFixed(2);

    const [selectedVolunteer, setSelectedVolunteer] = useState('');
    const [assignCount, setAssignCount] = useState(5);

    // New Features: Announcements and Global Settings
    const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '' });
    const [globalSettings, setGlobalSettings] = useState({ call_guide: '' });

    useEffect(() => {
        if (currentUser && currentUser.role === 'DEVELOPER' && activeTab === 'errorReports') {
            loadErrorReports();
        }
    }, [currentUser, activeTab]);

    const loadErrorReports = async () => {
        setIsReportsLoading(true);
        const reports = await fetchErrorReports();
        setErrorReports(reports);
        setIsReportsLoading(false);
    };

    const handleStatusUpdate = async (reportId, newStatus) => {
        const { success } = await updateErrorReportStatus(reportId, newStatus);
        if (success) {
            setErrorReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
        }
    };

    useEffect(() => {
        const fetchSettings = async () => {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .eq('key', 'call_guide')
                .single();
            if (data) {
                setGlobalSettings({ call_guide: data.value.text });
            }
        };
        fetchSettings();
    }, []);

    const handleSendAnnouncement = async () => {
        if (!announcementForm.title || !announcementForm.content) {
            showDialog('alert', '안내', '제목과 내용을 모두 입력해주세요.');
            return;
        }

        const { error } = await supabase
            .from('announcements')
            .insert([{ title: announcementForm.title, content: announcementForm.content }]);

        if (error) {
            showDialog('alert', '오류', '공지사항 전송에 실패했습니다.');
        } else {
            showDialog('alert', '전송 완료', '모든 사용자에게 공지 팝업이 전송되었습니다.');
            setAnnouncementForm({ title: '', content: '' });
            setIsAnnouncementModalOpen(false);
        }
    };

    const handleUpdateGlobalGuide = async () => {
        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'call_guide', value: { text: globalSettings.call_guide } });

        if (error) {
            showDialog('alert', '오류', '안내문구 수정에 실패했습니다.');
        } else {
            showDialog('alert', '수정 완료', '전체 연락처의 기본 안내문구가 업데이트되었습니다.');
            setIsSettingsModalOpen(false);
        }
    };

    const handleExportToExcel = async () => {
        setIsDataLoading(true);
        try {
            // Fetch all data for export (handling pagination in context)
            const allContacts = await fetchAllContactsForExport({ 
                volunteerId: volunteerFilter,
                status: statusFilter,
                supportLevel: (activeTab === 'contacts' || activeTab === 'result_detail') ? supportLevelFilter : 'ALL'
            }, contactSearchTerm);

            if (!allContacts || allContacts.length === 0) {
                alert('다운로드할 데이터가 없습니다.');
                setIsDataLoading(false);
                return;
            }

            // Map data for Excel export
            const exportData = allContacts.map(c => ({
                '이름': c.name,
                '전화번호': c.phone,
                '지역': c.region,
                '나이': c.age,
                '성향': c.supportLevel || '미확인',
                '상태': c.status === 'CALLED' ? '통화 완료' : (c.assignedTo ? '진행 대기' : '배정 대기'),
                '담당자': assignableUsers.find(u => u.id === c.assignedTo)?.name || '미배정',
                '메모/기록': c.notes
            }));

            const worksheet = utils.json_to_sheet(exportData);
            const workbook = utils.book_new();
            utils.book_append_sheet(workbook, worksheet, "연락처 명부");
            
            const dateStr = new Date().toISOString().split('T')[0];
            writeFile(workbook, `강진_캠페인_명부_${dateStr}.xlsx`);
            
            showDialog('alert', '다운로드 완료', '전체 데이터가 포함된 엑셀 파일이 다운로드됩니다.');
        } catch (error) {
            console.error('Excel export failed:', error);
            showDialog('alert', '오류', '엑셀 다운로드 중 오류가 발생했습니다.');
        } finally {
            setIsDataLoading(false);
        }
    };
    const handleAssign = async () => {
        if (!selectedVolunteer) {
            showDialog('alert', '안내', '할당할 담당자를 먼저 선택해주세요.');
            return;
        }
        await assignQuota(selectedVolunteer, assignCount);
        // Manual Refresh
        loadStats();
        loadContacts();
        setSelectedVolunteer(''); // Reset
    };

    const handleRoleUpdate = (userId, name, newRole) => {
        showDialog('confirm', '권한 변경', `${name} 회원의 권한을 변경하시겠습니까?`, async () => {
            const result = await updateUserRole(userId, newRole);
            if (result && result.success) {
                showDialog('alert', '권한 변경 완료', `${name} 회원의 권한이 ${newRole}으로 변경되었습니다.`);
                // Manual Refresh
                fetchUsers();
            } else {
                const errMsg = result?.error?.message || '알 수 없는 오류가 발생했습니다.';
                showDialog('alert', '권한 변경 실패', `오류: ${errMsg}`);
            }
        });
    };

    const handleNameEdit = (user) => {
        setEditingUserId(user.id);
        setTempName(user.name);
    };

    const handleNameSave = async (userId) => {
        if (!tempName.trim()) return;
        const result = await updateUserName(userId, tempName);
        if (result && result.success) {
            setEditingUserId(null);
            // Manual Refresh
            fetchUsers();
        } else {
            showDialog('alert', '오류', '이름 수정에 실패했습니다.');
        }
    };

    const handleManualUserAdd = async () => {
        if (!newUserForm.email || !newUserForm.name) {
            showDialog('alert', '안내', '이메일과 이름을 모두 입력해주세요.');
            return;
        }
        
        const res = await addUserManually(newUserForm.email, newUserForm.name, newUserForm.role);
        if (res.success) {
            showDialog('alert', '추가 완료', `${newUserForm.name} 회원을 ${newUserForm.role === 'ADMIN' ? '관리자' : '담당자'} 권한으로 등록했습니다.`);
            setIsAddUserModalOpen(false);
            setNewUserForm({ email: '', name: '', role: 'VOLUNTEER' });
            fetchUsers();
        } else {
            showDialog('alert', '오류', res.error || '사용자 추가에 실패했습니다.');
        }
    };

    // const unassignedCount = contacts.filter(c => !c.assignedTo || c.assignedTo === 'UNASSIGNED').length;
    // (Already in state)

    const handleAddClick = () => {
        setEditingContact(null);
        setIsContactModalOpen(true);
    };

    const handleEditClick = (contact) => {
        setViewingContact(contact);
        setIsDetailModalOpen(true);
    };

    const handleContactSubmit = async (formData) => {
        let res;
        if (editingContact) {
            res = await updateContact(editingContact.id, formData);
        } else {
            res = await addContact(formData);
        }
        if (res?.success) {
            loadContacts();
            loadStats();
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedContacts(contactData.map(c => c.id));
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
            showDialog('alert', '안내', '할당할 담당자를 선택해주세요.');
            return;
        }
        showDialog('confirm', '일괄 할당', `선택한 ${selectedContacts.length}명의 연락처를 지정한 담당자에게 할당하시겠습니까?`, async () => {
            const res = await reassignContacts(selectedContacts, bulkAssignVolunteer);
            if (res && res.success) {
                setSelectedContacts([]);
                setBulkAssignVolunteer('');
                showDialog('alert', '할당 완료', '연락처가 성공적으로 일괄 할당되었습니다.');
                // Manual Refresh
                loadContacts();
                loadStats();
            } else {
                showDialog('alert', '오류', '할당 변경에 실패했습니다.');
            }
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
                {currentUser?.role === 'DEVELOPER' && (
                    <button
                        onClick={() => setActiveTab('errorReports')}
                        className={`px-6 py-2.5 font-bold rounded-t-lg transition-colors border-x border-t z-10 -mb-px text-[15px] flex items-center gap-2 ${
                            activeTab === 'errorReports'
                            ? 'bg-[#ef4444] text-white border-[#ef4444]'
                            : 'bg-transparent text-gray-600 border-transparent hover:text-gray-800'
                        }`}
                    >
                        <Bug size={18} /> 오류 신고 내역
                    </button>
                )}
                <div className="flex-1"></div>
                <button
                    onClick={() => navigate('/volunteer')}
                    className="px-6 py-2.5 font-bold rounded-t-lg transition-colors border-x border-t z-10 -mb-px text-[15px] bg-blue-50 text-[#1e3a8a] border-blue-200 hover:bg-blue-100 flex items-center gap-2"
                >
                    담당자 화면 열람 
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </button>
            </div>

            {/* Campaign Dashboard Content */}
            {activeTab === 'campaign' && (
                <div className="px-8 py-6 text-gray-900 bg-[#e8edf2] flex-1 w-full flex flex-col items-center">
                    <div className="w-full max-w-[1100px] mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">대시보드</h1>
                            <p className="text-sm text-slate-500 font-medium">캠페인 진행 현황을 실시간으로 확인하세요.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {statsError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 animate-pulse">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    일일 할당량 초과됨 (나중에 다시 시도)
                                </div>
                            )}
                            <button 
                                onClick={loadStats}
                                disabled={isStatsLoading}
                                className={`flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:shadow-md transition-all active:scale-95 ${isStatsLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                <svg 
                                    className={`${isStatsLoading ? 'animate-spin' : ''}`}
                                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                >
                                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                    <path d="M3 3v5h5"/>
                                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                                    <path d="M16 16h5v5"/>
                                </svg>
                                {isStatsLoading ? '불러오는 중...' : '통계 새로고침'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full max-w-[1100px]">
                        
                        {/* Card 1: 전체 캠페인 진행 상황 */}
                        <div 
                            onClick={() => {
                                setStatusFilter('CALLED');
                                setVolunteerFilter('ALL');
                                setActiveTab('contacts');
                                setContactPage(1);
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
                                                    width: item.value === 0 ? '0%' : `${Math.min(100, (item.value / Math.max(1, stats.surveyCount)) * 100)}%`,
                                                    background: `linear-gradient(90deg, ${item.color} 0%, rgba(220,230,240,0.4) 100%)`,
                                                }}>
                                            </div>
                                        </div>
                                        <span className="text-[14px] font-bold text-gray-800 w-8 text-right">{item.value}</span>
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
                                        <span className="text-[14px] font-bold text-gray-800 block mb-2 tracking-tight">미할당 연락처 (전체 {stats.total}명 대비):</span>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-400 text-white pb-0.5">
                                                <UserIcon size={18} fill="currentColor" />
                                            </div>
                                            <span className="text-[28px] font-black text-gray-800 tracking-tighter">{unassignedCount}명</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-8">
                                        <span className="text-[13px] font-bold text-gray-800 block mb-2 tracking-tight">할당할 인원 수</span>
                                        <div className="flex bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden">
                                            <input 
                                                type="number"
                                                min="1"
                                                max={unassignedCount}
                                                value={assignCount}
                                                onChange={(e) => setAssignCount(Number(e.target.value))}
                                                className="w-full py-1.5 px-3 text-[14px] font-extrabold text-gray-800 outline-none"
                                            />
                                            <span className="bg-gray-50 px-4 flex items-center text-gray-500 font-bold border-l border-gray-200">명</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Vertical Divider */}
                                <div className="hidden md:block w-px bg-gray-100 my-2"></div>
                                
                                {/* Right side */}
                                <div className="flex-1 flex flex-col justify-between pt-1">
                                    <div>
                                        <span className="text-[14px] font-bold text-gray-800 block mb-2 tracking-tight">담당자 선택</span>
                                        
                                        <div className="relative mb-3">
                                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <select
                                                className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] outline-none text-[14px] font-bold text-gray-700 appearance-none shadow-sm"
                                                value={selectedVolunteer}
                                                onChange={(e) => setSelectedVolunteer(e.target.value)}
                                            >
                                                <option value="" disabled hidden>Q 이름 검색</option>
                                                {assignableUsers.map(v => (
                                                    <option key={v.id} value={v.id}>{v.name} ({v.role === 'ADMIN' ? '관리자' : '담당자'})</option>
                                                ))}
                                            </select>
                                            <SlidersHorizontal size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                        </div>
                                        
                                        {selectedVolunteer && (
                                            <div className="inline-flex items-center px-4 py-1.5 bg-[#e8edf2] rounded-md text-[14px] font-extrabold text-gray-800 w-auto">
                                                {assignableUsers.find(v => v.id === selectedVolunteer)?.name}
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

                        {/* Card 4: 담당자별 현황 */}
                        <div 
                            onClick={() => setActiveTab('volunteers')}
                            className="bg-white rounded-[24px] shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100 p-7 flex flex-col cursor-pointer hover:bg-slate-50 relative"
                        >
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="text-[20px] font-extrabold text-slate-800 tracking-tight whitespace-nowrap">담당자별 현황 (TOP 3)</h2>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); loadStats(); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-[#1e3a8a]"
                                    title="새로고침"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>
                                </button>
                            </div>
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
                                        {assigneesWithStats.length === 0 && (
                                            <tr><td colSpan="5" className="p-6 text-center text-gray-500 font-medium">등록된 담당자가 없습니다.</td></tr>
                                        )}
                                        {assigneesWithStats.slice(0, 3).map(v => {
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
                                                            <span className="text-[12px] font-black text-slate-700 w-[58px] shrink-0 leading-none">{vStats.progress}%</span>
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
            {(activeTab === 'users' || activeTab === 'contacts' || activeTab === 'volunteers' || (activeTab === 'errorReports' && currentUser?.role === 'DEVELOPER')) && (
                <div className="px-8 py-6 text-gray-900 bg-[#e8edf2] flex-1 w-full flex flex-col items-center overflow-y-auto">
                    <div className="w-full max-w-[1100px] flex flex-col gap-6">
                        

                        {activeTab === 'volunteers' && (
                            <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-7 flex flex-col">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                                    <h2 className="text-[20px] font-extrabold text-slate-800 flex items-center gap-2 border-l-4 border-[#1e3a8a] pl-3 tracking-tight">
                                        담당자 전체 명단 ({assigneesWithStats.length}명)
                                    </h2>
                                    <div className="relative w-full sm:w-64">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input 
                                            type="text"
                                            placeholder="담당자 이름 검색"
                                            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20"
                                            value={volunteerSearchTerm}
                                            onChange={e => setVolunteerSearchTerm(e.target.value)}
                                        />
                                    </div>
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
                                            {(() => {
                                                const filteredManagers = volunteerSearchTerm 
                                                    ? managersWithStats.filter(v => v.name.includes(volunteerSearchTerm))
                                                    : managersWithStats;

                                                if (filteredManagers.length === 0) {
                                                    return <tr><td colSpan="5" className="p-6 text-center text-gray-500 font-medium bg-gray-50/50">검색된 담당자가 없습니다.</td></tr>;
                                                }

                                                return filteredManagers.map(v => {
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
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        
                        {activeTab === 'users' && (
                            <>
                                {/* Global Management Buttons */}
                                <div className="w-full max-w-[1100px] mb-4 flex gap-4">
                                    <button 
                                        onClick={() => setIsAnnouncementModalOpen(true)}
                                        className="flex-1 bg-[#1e3a8a] text-white py-4 rounded-2xl font-black text-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                                        전체 공지 보내기
                                    </button>
                                    <button 
                                        onClick={() => setIsSettingsModalOpen(true)}
                                        className="flex-1 bg-white border-2 border-[#1e3a8a] text-[#1e3a8a] py-4 rounded-2xl font-black text-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        전체 안내문구 수정
                                    </button>
                                </div>

                                <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-7 mb-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-[20px] font-extrabold text-slate-800 tracking-tight">승인 대기중인 사용자</h2>
                                        <button 
                                            onClick={() => setIsAddUserModalOpen(true)}
                                            className="px-5 py-2.5 bg-[#1e3a8a] text-white text-[14px] font-extrabold rounded-xl shadow-md hover:bg-[#1e40af] transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <UserIcon size={16} />
                                            사용자 직접 추가
                                        </button>
                                    </div>
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
                                                        <button className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white font-bold rounded-lg text-sm transition-colors" onClick={() => handleRoleUpdate(user.id, user.name, 'VOLUNTEER')}>담당자 승인</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-7">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                                        <h2 className="text-[20px] font-extrabold text-slate-800 tracking-tight">전체 사용자 목록</h2>
                                        <div className="flex gap-2">
                                            <div className="relative">
                                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input 
                                                    type="text"
                                                    placeholder="이름/이메일 검색"
                                                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 w-40 sm:w-auto"
                                                    value={userSearchTerm}
                                                    onChange={e => setUserSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <select 
                                                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none text-gray-600 font-bold"
                                                value={userRoleSort}
                                                onChange={e => setUserRoleSort(e.target.value)}
                                            >
                                                <option value="ALL">전체 권한</option>
                                                <option value="ADMIN">관리자</option>
                                                <option value="VOLUNTEER">담당자</option>
                                                <option value="REJECTED">권한 해제됨</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-[#f8fafc] text-gray-600 font-bold border-b border-gray-100">
                                                <tr>
                                                    <th className="p-4 pl-5">이름</th>
                                                    <th className="p-4">이메일</th>
                                                    <th className="p-4">할당/완료</th>
                                                    <th className="p-4 text-right pr-5">현재 권한 및 변경</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    let list = users;
                                                    if (userRoleSort === 'ALL') {
                                                        // Show only active users for 'ALL' to keep it clean, as requested before
                                                        list = list.filter(u => u.role === 'ADMIN' || u.role === 'VOLUNTEER' || u.role === 'DEVELOPER');
                                                    } else {
                                                        // Show specific role (including REJECTED if selected)
                                                        list = list.filter(u => u.role === userRoleSort);
                                                    }
                                                    if (userSearchTerm) {
                                                        const term = userSearchTerm.toLowerCase();
                                                        list = list.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
                                                    }
                                                    
                                                    if (list.length === 0) {
                                                        return <tr><td colSpan="4" className="p-6 text-center text-gray-500 font-medium">검색 결과가 없습니다.</td></tr>;
                                                    }

                                                    return list.map(user => {
                                                        const stats = volunteerStatsMap[user.id] || { completed: 0, total: 0 };
                                                        const isEditing = editingUserId === user.id;

                                                        return (
                                                            <tr key={user.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                                                <td className="p-4 pl-5 font-bold text-gray-800">
                                                                    {isEditing ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <input 
                                                                                type="text" 
                                                                                className="px-2 py-1 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-100 text-sm w-32"
                                                                                value={tempName}
                                                                                onChange={(e) => setTempName(e.target.value)}
                                                                                autoFocus
                                                                            />
                                                                            <button onClick={() => handleNameSave(user.id)} className="text-blue-600 hover:text-blue-800"><Save size={16} /></button>
                                                                            <button onClick={() => setEditingUserId(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 group">
                                                                            {user.name}
                                                                            <button 
                                                                                onClick={() => handleNameEdit(user)}
                                                                                className="text-gray-400 hover:text-[#1e3a8a] transition-all"
                                                                            >
                                                                                <Edit2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-gray-500">{user.email}</td>
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-bold text-gray-700">{stats.completed}</span>
                                                                        <span className="text-xs text-gray-400">/</span>
                                                                        <span className="text-sm font-medium text-gray-500">{stats.total}</span>
                                                                    </div>
                                                                </td>
                                                            <td className="p-4 text-right pr-5">
                                                                {user.id === currentUser?.id ? (
                                                                    <div className="inline-block px-4 py-1.5 bg-[#1e3a8a] text-white rounded-xl text-[13px] font-extrabold shadow-sm border border-slate-200/80">
                                                                        관리자 (본인)
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex justify-end gap-1.5 p-1 bg-slate-100 rounded-2xl w-max ml-auto shadow-inner border border-slate-200/60">
                                                                        <button 
                                                                            onClick={() => handleRoleUpdate(user.id, user.name, 'VOLUNTEER')}
                                                                            className={`px-3 py-1.5 text-[13px] font-extrabold rounded-xl transition-all ${user.role === 'VOLUNTEER' ? 'bg-[#1e3a8a] text-white shadow-sm scale-100' : 'text-slate-500 hover:text-slate-800 scale-95 hover:bg-slate-200/50'}`}
                                                                        >담당자</button>
                                                                        <button 
                                                                            onClick={() => handleRoleUpdate(user.id, user.name, 'REJECTED')}
                                                                            className={`px-3 py-1.5 text-[13px] font-extrabold rounded-xl transition-all ${user.role === 'REJECTED' ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:text-red-500 scale-95 hover:bg-red-50'}`}
                                                                        >권한 해제</button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'errorReports' && currentUser?.role === 'DEVELOPER' && (
                            <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-7 flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-[20px] font-extrabold text-slate-800 flex items-center gap-2 border-l-4 border-red-500 pl-3 tracking-tight">시스템 오류 신고 내역</h2>
                                    <button 
                                        onClick={loadErrorReports}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[13px] font-bold rounded-xl transition-all flex items-center gap-1"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                                        새로고침
                                    </button>
                                </div>

                                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-red-50/50 text-slate-600 font-bold border-b border-red-100">
                                            <tr>
                                                <th className="p-4 pl-5">접수 일시</th>
                                                <th className="p-4">신고자</th>
                                                <th className="p-4">카테고리</th>
                                                <th className="p-4">오류 내용</th>
                                                <th className="p-4">상태</th>
                                                <th className="p-4 pr-5 text-right">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {isReportsLoading ? (
                                                <tr><td colSpan="6" className="p-12 text-center text-slate-400 font-bold">로딩 중...</td></tr>
                                            ) : errorReports.length === 0 ? (
                                                <tr><td colSpan="6" className="p-12 text-center text-slate-500 font-medium">신고된 내역이 없습니다.</td></tr>
                                            ) : (
                                                errorReports.map(report => (
                                                    <tr key={report.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-4 pl-5 text-slate-500 font-mono text-[12px]">
                                                            {new Date(report.created_at).toLocaleString()}
                                                        </td>
                                                        <td className="p-4 font-bold text-slate-700">
                                                            {report.user_name}
                                                            <div className="text-[11px] font-medium text-slate-400 font-mono">{report.user_email}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-[12px] font-black border border-red-100">
                                                                {report.category}
                                                            </span>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="max-w-[400px] whitespace-normal font-medium text-slate-700 leading-relaxed">
                                                                {report.description}
                                                            </div>
                                                            {report.metadata && (
                                                                <div className="mt-1 text-[10px] text-slate-400 font-mono">
                                                                    URL: {report.metadata.url?.split('/').pop() || '/'}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4">
                                                            <Badge variant={report.status === 'FIXED' ? 'success' : report.status === 'PENDING' ? 'warning' : 'default'}>
                                                                {report.status === 'PENDING' ? '확인대기' : report.status === 'INVESTIGATING' ? '조사중' : '조치완료'}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-4 pr-5 text-right">
                                                            <div className="flex gap-1.5 justify-end">
                                                                <button 
                                                                    onClick={() => handleStatusUpdate(report.id, 'INVESTIGATING')}
                                                                    className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[11px] font-bold hover:bg-blue-100"
                                                                >조사중</button>
                                                                <button 
                                                                    onClick={() => handleStatusUpdate(report.id, 'FIXED')}
                                                                    className="px-2 py-1 bg-green-50 text-green-600 rounded text-[11px] font-bold hover:bg-green-100"
                                                                >완료</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'contacts' && (
                            <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-7 flex flex-col">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-[20px] font-extrabold text-slate-800 flex items-center gap-2 border-l-4 border-[#1e3a8a] pl-3 tracking-tight">연락처 및 명부 관리</h2>
                                    <div className="flex gap-2">
                                        {currentUser?.role === 'DEVELOPER' && (
                                            <button 
                                                onClick={resetDatabase}
                                                className="px-4 py-2 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-[13px] font-extrabold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                🚨 DB 전체 초기화 (강진 명부)
                                            </button>
                                        )}
                                        <button 
                                            onClick={handleExportToExcel}
                                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-[14px] font-extrabold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                                        >
                                            <Download size={16} />
                                            엑셀 다운로드
                                        </button>
                                        <button onClick={handleAddClick} className="px-6 py-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-[14px] font-extrabold rounded-xl transition-all shadow-md active:scale-95">
                                            새 연락처 추가
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center mb-6">
                                    <div className="relative w-full sm:w-80">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input 
                                            type="text"
                                            placeholder="이름, 전화번호, 지역, 성향 등으로 전체 검색"
                                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20"
                                            value={contactSearchTerm}
                                            onChange={e => {
                                                setContactSearchTerm(e.target.value);
                                                setContactPage(1); // Reset to page 1 on search
                                            }}
                                        />
                                    </div>
                                    <div className="ml-auto flex items-center gap-3">
                                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                                            {[
                                                { id: 'agent', label: '담당자' },
                                                { id: 'status', label: '상태' },
                                                { id: 'support', label: '성향' }
                                            ].map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => {
                                                        setFilterCategory(cat.id);
                                                        // Reset other categories' filters to 'ALL' to avoid invisible conflicting filters
                                                        if (cat.id === 'agent') { setStatusFilter('ALL'); setSupportLevelFilter('ALL'); }
                                                        else if (cat.id === 'status') { setVolunteerFilter('ALL'); setSupportLevelFilter('ALL'); }
                                                        else if (cat.id === 'support') { setVolunteerFilter('ALL'); setStatusFilter('ALL'); }
                                                        setContactPage(1);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${filterCategory === cat.id ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    {cat.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="h-6 w-px bg-slate-200"></div>

                                        {filterCategory === 'agent' && (
                                            <select
                                                className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg outline-none text-[13px] font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-100"
                                                value={volunteerFilter}
                                                onChange={(e) => {
                                                    setVolunteerFilter(e.target.value);
                                                    setContactPage(1);
                                                }}
                                            >
                                                <option value="ALL">전체 담당자</option>
                                                <option value="UNASSIGNED">미할당 연락처</option>
                                                {assignableUsers.map(v => (
                                                    <option key={v.id} value={v.id}>{v.name}</option>
                                                ))}
                                            </select>
                                        )}
                                        
                                        {filterCategory === 'status' && (
                                            <select
                                                className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg outline-none text-[13px] font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-100"
                                                value={statusFilter}
                                                onChange={(e) => {
                                                    setStatusFilter(e.target.value);
                                                    setContactPage(1);
                                                }}
                                            >
                                                <option value="ALL">전체 상태</option>
                                                <option value="UNASSIGNED">배정 대기</option>
                                                <option value="ASSIGNED">진행 대기(배정완료)</option>
                                                <option value="CALLED">통화 완료</option>
                                            </select>
                                        )}

                                        {filterCategory === 'support' && (
                                            <select
                                                className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg outline-none text-[13px] font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-100"
                                                value={supportLevelFilter}
                                                onChange={(e) => {
                                                    setSupportLevelFilter(e.target.value);
                                                    setContactPage(1);
                                                }}
                                            >
                                                <option value="ALL">전체 성향</option>
                                                <option value="강하게 지지">강하게 지지</option>
                                                <option value="약하게 지지">약하게 지지</option>
                                                <option value="관심없음">관심없음</option>
                                                <option value="지지하지 않음">지지하지 않음</option>
                                                <option value="다른후보 지지">다른후보 지지</option>
                                            </select>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Pagination Controls (MOVED TO TOP) */}
                                {!isDataLoading && totalContacts > 0 && (
                                    <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100 shadow-inner">
                                        <div className="text-[13px] text-gray-500 font-bold">
                                            전체 <span className="text-[#1e3a8a]">{totalContacts}</span>명 중 {(contactPage - 1) * contactsPerPage + 1} - {Math.min(contactPage * contactsPerPage, totalContacts)}
                                        </div>
                                        
                                        <div className="flex bg-gray-200/50 rounded-lg p-1 items-center gap-2">
                                            <button 
                                                onClick={() => setContactPage(p => Math.max(1, p - 1))}
                                                disabled={contactPage === 1}
                                                className="px-3 py-1.5 rounded-md text-sm font-bold bg-white shadow-sm disabled:opacity-50 disabled:shadow-none hover:bg-gray-50 flex items-center gap-1 min-w-[60px]"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg> 이전
                                            </button>
                                            
                                            <div className="flex items-center gap-2 px-2">
                                                <input 
                                                    type="number" 
                                                    min="1" 
                                                    max={Math.ceil(totalContacts / contactsPerPage)}
                                                    defaultValue={contactPage}
                                                    key={contactPage}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            let val = parseInt(e.target.value);
                                                            const max = Math.ceil(totalContacts / contactsPerPage);
                                                            if (!isNaN(val) && val >= 1 && val <= max) {
                                                                setContactPage(val);
                                                            } else {
                                                                e.target.value = contactPage;
                                                            }
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        let val = parseInt(e.target.value);
                                                        const max = Math.ceil(totalContacts / contactsPerPage);
                                                        if (!isNaN(val) && val >= 1 && val <= max) {
                                                            setContactPage(val);
                                                        } else {
                                                            e.target.value = contactPage;
                                                        }
                                                    }}
                                                    className="w-12 text-center py-1 rounded border border-gray-300 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 shadow-sm"
                                                />
                                                <span className="text-sm font-bold text-gray-500">/ {Math.ceil(totalContacts / contactsPerPage)}</span>
                                            </div>

                                            <button 
                                                onClick={() => setContactPage(p => Math.min(Math.ceil(totalContacts / contactsPerPage), p + 1))}
                                                disabled={contactPage === Math.ceil(totalContacts / contactsPerPage)}
                                                className="px-3 py-1.5 rounded-md text-sm font-bold bg-white shadow-sm disabled:opacity-50 disabled:shadow-none hover:bg-gray-50 flex items-center gap-1 min-w-[60px]"
                                            >
                                                다음 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
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
                                                <option value="" disabled hidden>담당자 선택 (일괄)</option>
                                                <option value="UNASSIGNED">-- 담당자 지정 해제 --</option>
                                                {assignableUsers.map(v => (
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
                                                        checked={contactData.length > 0 && selectedContacts.length === contactData.length}
                                                        onChange={handleSelectAll}
                                                    />
                                                </th>
                                                <th className="p-4">이름</th>
                                                <th className="p-4">전화번호</th>
                                                <th className="p-4">지역</th>
                                                <th className="p-4">성향</th>
                                                <th className="p-4">상태</th>
                                                <th className="p-4">담당자</th>
                                                <th className="p-4 pr-5 text-right">작업</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {isDataLoading ? (
                                                <tr><td colSpan="11" className="p-16 text-center text-gray-400 font-bold bg-gray-50/50">데이터를 불러오는 중입니다...</td></tr>
                                            ) : contactData.length === 0 ? (
                                                <tr><td colSpan="11" className="p-16 text-center text-gray-500 font-medium bg-gray-50/50">등록되거나 검색된 연락처가 없습니다.</td></tr>
                                            ) : (
                                                contactData.map(contact => {
                                                    const assignedVolunteer = assignableUsers.find(v => v.id === contact.assignedTo);
                                                    const isSelected = selectedContacts.includes(contact.id);
                                                    return (
                                                        <tr key={contact.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                                                            <td className="p-4 pl-4">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-4 h-4 rounded border-gray-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                                                                    checked={isSelected}
                                                                    onChange={() => handleSelectContact(contact.id)}
                                                                />
                                                            </td>
                                                            <td className="p-4 font-bold text-gray-800">{contact.name}</td>
                                                            <td className="p-4 font-mono text-gray-600">{contact.phone}</td>
                                                            <td className="p-4 text-gray-500 max-w-[120px] truncate" title={contact.region}>{contact.region || '-'}</td>
                                                            <td className="p-4">
                                                                {contact.supportLevel ? (
                                                                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md text-[12px] whitespace-nowrap">{contact.supportLevel}</span>
                                                                ) : (
                                                                    <span className="text-gray-300">-</span>
                                                                )}
                                                            </td>
                                                            <td className="p-4">
                                                                <Badge variant={
                                                                    contact.status === 'CALLED' ? 'success' : 
                                                                    (contact.assignedTo && contact.assignedTo !== 'UNASSIGNED') ? 'warning' : 'default'
                                                                }>
                                                                    {contact.status === 'CALLED' ? '통화 완료' : 
                                                                     (contact.assignedTo && contact.assignedTo !== 'UNASSIGNED') ? '진행 대기' : '배정 대기'}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-4 text-gray-600 font-medium">
                                                                {assignedVolunteer ? assignedVolunteer.name : <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs font-bold">미할당</span>}
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
                onUpdate={handleLocalUpdate}
            />
            
            <DialogModal
                isOpen={dialogConfig.isOpen}
                onClose={closeDialog}
                onConfirm={dialogConfig.onConfirm}
                title={dialogConfig.title}
                message={dialogConfig.message}
                type={dialogConfig.type}
            />
            {/* Announcement Modal */}
            {isAnnouncementModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-[500px] overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-[#1e3a8a] px-8 py-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                                전체 공지사항 작성
                            </h3>
                            <button onClick={() => setIsAnnouncementModalOpen(false)} className="hover:rotate-90 transition-transform">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-2">공지 제목</label>
                                <input 
                                    type="text"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 outline-none font-bold"
                                    placeholder="공지사항의 제목을 입력하세요"
                                    value={announcementForm.title}
                                    onChange={e => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-2">공지 내용</label>
                                <textarea 
                                    rows="5"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 outline-none font-bold"
                                    placeholder="담당자분들께 전달할 내용을 입력하세요"
                                    value={announcementForm.content}
                                    onChange={e => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                                ></textarea>
                            </div>
                            <button 
                                onClick={handleSendAnnouncement}
                                className="w-full py-4 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-2xl font-black shadow-lg transition-all active:scale-[0.98]"
                            >
                                지금 즉시 전송하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Settings Modal */}
            {isSettingsModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-[500px] overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-[#1e3a8a] px-8 py-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                전체 안내문구(스크립트) 수정
                            </h3>
                            <button onClick={() => setIsSettingsModalOpen(false)} className="hover:rotate-90 transition-transform">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <p className="text-sm text-slate-500 font-bold leading-relaxed">
                                이곳에서 수정하는 내용은 모든 연락처 상세 페이지에 기본으로 표시되는 안내문구(전화 상담 가이드)입니다. 
                            </p>
                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-2">기본 안내문구 내용</label>
                                <textarea 
                                    rows="8"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 outline-none font-bold text-slate-700"
                                    value={globalSettings.call_guide}
                                    onChange={e => setGlobalSettings({ ...globalSettings, call_guide: e.target.value })}
                                ></textarea>
                            </div>
                            <button 
                                onClick={handleUpdateGlobalGuide}
                                className="w-full py-4 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-2xl font-black shadow-lg transition-all active:scale-[0.98]"
                            >
                                전체 적용 및 저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Manual User Add Modal */}
            {isAddUserModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl border border-white/20 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-[#1e3a8a] p-8 text-center relative">
                            <button onClick={() => setIsAddUserModalOpen(false)} className="absolute right-6 top-6 text-white/60 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-inner">
                                <UserIcon size={32} className="text-white" />
                            </div>
                            <h2 className="text-2xl font-black text-white tracking-tight">사용자 직접 추가</h2>
                            <p className="text-white/70 text-sm mt-2 font-medium">관리자가 직접 사용자를 등록합니다.</p>
                        </div>
                        <div className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[13px] font-black text-slate-500 ml-1">사용자 이름</label>
                                <input 
                                    type="text"
                                    placeholder="실명을 입력하세요 (예: 홍길동)"
                                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#1e3a8a] focus:bg-white outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                                    value={newUserForm.name}
                                    onChange={e => setNewUserForm(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[13px] font-black text-slate-500 ml-1">구글 계정 (이메일)</label>
                                <input 
                                    type="email"
                                    placeholder="aaa@gmail.com"
                                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#1e3a8a] focus:bg-white outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                                    value={newUserForm.email}
                                    onChange={e => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                                />
                                <p className="text-[11px] text-gray-400 ml-1">* 해당 사용자가 로그인할 때 사용할 구글 이메일을 정확히 입력해주세요.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[13px] font-black text-slate-500 ml-1">부여할 권한</label>
                                <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[20px] border border-slate-200/60 shadow-inner">
                                    <button 
                                        onClick={() => setNewUserForm(prev => ({ ...prev, role: 'VOLUNTEER' }))}
                                        className={`flex-1 py-3 px-4 rounded-[14px] text-sm font-black transition-all ${newUserForm.role === 'VOLUNTEER' ? 'bg-[#1e3a8a] text-white shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
                                    >담당자</button>
                                    <button 
                                        onClick={() => setNewUserForm(prev => ({ ...prev, role: 'ADMIN' }))}
                                        className={`flex-1 py-3 px-4 rounded-[14px] text-sm font-black transition-all ${newUserForm.role === 'ADMIN' ? 'bg-[#1e3a8a] text-white shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
                                    >관리자</button>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={() => setIsAddUserModalOpen(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                                >취소</button>
                                <button 
                                    onClick={handleManualUserAdd}
                                    className="flex-[1.5] py-4 bg-[#1e3a8a] text-white font-black rounded-2xl hover:bg-[#1e40af] transition-all shadow-lg shadow-blue-900/10 active:scale-95 flex items-center justify-center gap-2"
                                >등록 완료</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
