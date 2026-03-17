import React, { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Phone, User, Calendar, MapPin, Tag, FileText, X, Plus, Heart, Edit2, Save, MessageSquare, PhoneOff } from 'lucide-react';
import { supabase } from '../supabase';

export const ContactDetailModal = ({ isOpen, onClose, contact, onUpdate }) => {
    const { updateContact } = useCampaign();
    const [newRecord, setNewRecord] = useState('');
    const [supportLevel, setSupportLevel] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingGuide, setIsEditingGuide] = useState(false);
    const [guideText, setGuideText] = useState('');
    const [globalGuide, setGlobalGuide] = useState('');
    
    // Edit Form State
    const [editForm, setEditForm] = useState({
        name: '',
        age: '',
        memberType: '',
        region: '',
        phone: '',
        notes: ''
    });

    useEffect(() => {
        const fetchGlobalGuide = async () => {
            const { data } = await supabase.from('settings').select('*').eq('key', 'call_guide').single();
            if (data) setGlobalGuide(data.value.text);
        };
        fetchGlobalGuide();

        if (contact) {
            setSupportLevel(contact.supportLevel || null);
            setGuideText(contact.callGuide || '');
            setEditForm({
                name: contact.name || '',
                age: contact.age || '',
                memberType: contact.memberType || '',
                region: contact.region || '',
                phone: contact.phone || '',
                notes: contact.notes || ''
            });
            setIsEditing(false);
            setIsEditingGuide(false);
        }
    }, [contact]);

    if (!isOpen || !contact) return null;

    const supportOptions = ['강하게 지지', '약하게 지지', '보통', '지지하지 않음', '관심없음', '기타'];


    const handleSaveAll = async () => {
        let finalNotes = isEditing ? editForm.notes : (contact.notes || '');
        let finalSupportLevel = supportLevel;
        let finalStatus = finalSupportLevel ? 'CALLED' : 'ASSIGNED';
        
        const isSupportChanged = finalSupportLevel !== contact.supportLevel;
        const hasNewRecord = newRecord.trim().length > 0;

        // Handle new record addition OR support level change logging
        if (hasNewRecord || isSupportChanged) {
            const now = new Date();
            const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            
            const recordText = hasNewRecord ? `${newRecord.trim()}\n` : '';
            const supportText = finalSupportLevel ? `(성향: ${finalSupportLevel})` : '(성향: 미확인)';
            const recordEntry = `[${dateString}] ${recordText}${supportText}`;
            
            if (finalNotes === '테스트용 데이터입니다.') {
                finalNotes = '';
            }
            
            finalNotes = finalNotes 
                ? `${finalNotes}\n${recordEntry}` 
                : recordEntry;
                
            if (finalSupportLevel) finalStatus = 'CALLED';
        } else if (!isEditing) {
            // Nothing changed and not editing
            onClose();
            return;
        }

        const updateData = { 
            notes: finalNotes, 
            supportLevel: finalSupportLevel, 
            status: finalStatus
        };

        if (isEditing) {
            updateData.name = editForm.name;
            updateData.age = editForm.age;
            updateData.memberType = editForm.memberType;
            updateData.region = editForm.region;
            updateData.phone = editForm.phone;
        }
        
        const res = await updateContact(contact.id, updateData);
        
        if (res.success) {
            setNewRecord('');
            if (onUpdate) onUpdate({ id: contact.id, ...updateData });
            setIsEditing(false);
            setIsEditingGuide(false);
            alert('저장되었습니다.');
            onClose();
        } else {
            alert(`저장 중 오류가 발생했습니다: ${res.error?.message || '알 수 없는 오류'}`);
        }
    };

    const handleSaveEdit = () => {
        handleSaveAll();
    };

    const handleCallFailed = async () => {
        const now = new Date();
        const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const recordEntry = `[${dateString}] 통화 실패`;
        let currentNotes = isEditing ? editForm.notes : (contact.notes || '');
        
        if (currentNotes === '테스트용 데이터입니다.') {
            currentNotes = '';
        }
        
        const finalNotes = currentNotes 
            ? `${currentNotes}\n${recordEntry}` 
            : recordEntry;

        const updateData = { 
            notes: finalNotes, 
            supportLevel: null, 
            status: 'CALLED'
        };

        console.log('ContactDetailModal: handleCallFailed', updateData);
        
        const res = await updateContact(contact.id, updateData);
        if (res.success) {
            setNewRecord('');
            if (onUpdate) onUpdate({ id: contact.id, ...updateData });
            setIsEditing(false);
            setIsEditingGuide(false);
            alert('통화 실패로 기록되었습니다.');
            onClose();
        } else {
            alert(`기록 중 오류가 발생했습니다: ${res.error?.message || '알 수 없는 오류'}`);
        }
    };

    const handleSaveGuide = () => {
        updateContact(contact.id, { callGuide: guideText });
        setIsEditingGuide(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className="bg-[#1e3a8a] px-5 py-3 flex justify-between items-center text-white shrink-0">
                    <h2 className="text-[16px] font-extrabold flex items-center gap-2">
                        <User size={18} /> 연락처 상세 정보
                    </h2>
                    <div className="flex items-center gap-1.5">
                        {isEditing ? (
                            <button onClick={handleSaveEdit} className="flex items-center gap-1 bg-green-500 hover:bg-green-600 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all shadow-md active:scale-95">
                                <Save size={14} /> 완료
                            </button>
                        ) : (
                            <>
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors">
                                    <Edit2 size={12} /> 수정
                                </button>
                                <button 
                                    onClick={handleSaveAll}
                                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black transition-all shadow-md text-white border border-slate-600 active:scale-95"
                                >
                                    <Save size={14} /> 저장
                                </button>
                                <button 
                                    onClick={handleCallFailed}
                                    className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black transition-all shadow-md text-white border border-amber-400 active:scale-95"
                                >
                                    <PhoneOff size={14} /> 통화실패
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors active:scale-95 ml-1">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 font-sans text-slate-800 flex flex-col gap-3 bg-[#f8fafc]">
                    
                    {/* Basic Info Row */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex flex-col gap-2 relative">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1">
                                {isEditing ? (
                                    <input 
                                        type="text" 
                                        className="text-[18px] font-black tracking-tight border-b border-gray-300 outline-none focus:border-[#1e3a8a] py-0.5 bg-slate-50 px-2 rounded-t w-24"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                        placeholder="이름"
                                    />
                                ) : (
                                    <h3 className="text-[18px] font-black tracking-tight">{contact.name}</h3>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-extrabold text-[#1e3a8a] bg-blue-50 px-2 py-0.5 rounded-md">{contact.age || '-'}세</span>
                                    <span className="text-[12px] font-extrabold text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md">{contact.memberType || '-'}</span>
                                </div>
                            </div>
                            <a 
                                href={`tel:${contact.phone}`} 
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow-sm transition-colors active:scale-95 text-[12px] shrink-0"
                            >
                                <Phone size={14} /> 통화
                            </a>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] border-t border-slate-50 pt-2">
                            <div className="flex items-center gap-1.5">
                                <MapPin size={12} className="text-slate-400"/>
                                <span className="font-bold text-slate-600">{contact.region || '-'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Phone size={12} className="text-slate-400"/>
                                <span className="font-bold font-mono text-[#1e3a8a]">{contact.phone}</span>
                            </div>
                            <div className="flex items-center gap-1.5 ml-auto">
                                <Heart size={12} className="text-rose-400"/>
                                <span className="font-extrabold text-[#1e3a8a]">{contact.supportLevel || '성향 미확인'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Area: Guide & Support & Input */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex flex-col gap-3">
                        {/* 멘트 및 성향 */}
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[12px] font-extrabold text-[#1e3a8a] flex items-center gap-1.5">
                                    <MessageSquare size={14} /> 안내문구 및 성향 파악
                                </h4>
                                <button 
                                    onClick={() => isEditingGuide ? handleSaveGuide() : setIsEditingGuide(true)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                        isEditingGuide 
                                        ? 'bg-green-500 text-white' 
                                        : 'text-[#1e3a8a] bg-blue-50 border border-blue-100'
                                    }`}
                                >
                                    {isEditingGuide ? '저장' : '문구수정'}
                                </button>
                            </div>
                            
                            <div className={`p-2 rounded-lg border text-[12px] leading-relaxed ${isEditingGuide ? 'bg-slate-50 border-blue-300 ring-1 ring-blue-100' : 'bg-[#1e3a8a]/5 border-[#1e3a8a]/10'}`}>
                                {isEditingGuide ? (
                                    <textarea 
                                        className="w-full bg-transparent outline-none font-bold text-slate-700 min-h-[40px] resize-none"
                                        value={guideText || globalGuide}
                                        onChange={(e) => setGuideText(e.target.value)}
                                    />
                                ) : (
                                    <p className="font-bold text-[#1e3a8a]">
                                        "{guideText || globalGuide || '안내문구가 설정되지 않았습니다.'}"
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                                {supportOptions.map(option => (
                                    <button
                                        key={option}
                                        onClick={() => setSupportLevel(supportLevel === option ? null : option)}
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors border ${
                                            supportLevel === option 
                                                ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]' 
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 입력창 */}
                        <div className="relative">
                            <textarea
                                className="w-full border border-slate-200 bg-slate-50 outline-none focus:ring-1 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] rounded-lg p-2 text-[12px] font-medium resize-none transition-all min-h-[50px] max-h-[80px]"
                                placeholder="통화 기록 입력..."
                                value={newRecord}
                                onChange={(e) => setNewRecord(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Memos / Call Records */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex flex-col gap-2">
                        <h4 className="text-[12px] font-extrabold flex items-center gap-1.5 text-slate-600">
                            <FileText size={14} /> 기존 기록 확인
                        </h4>
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 max-h-[100px] overflow-y-auto text-[12px] leading-relaxed whitespace-pre-wrap text-slate-600">
                            {isEditing ? (
                                <textarea 
                                    className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                                />
                            ) : (
                                contact.notes || <span className="text-slate-400 italic">내역 없음</span>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
