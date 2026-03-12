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

    const supportOptions = ['강하게 지지', '약하게 지지', '관심없음', '지지하지 않음', '다른후보 지지'];


    const handleSaveAll = () => {
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
                
            // If a record is added or support level is set, it's definitely a call
            // But if support level was removed and no new record, the top-level logic handles ASSIGNED
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

        // Include basic info if editing
        if (isEditing) {
            updateData.name = editForm.name;
            updateData.age = editForm.age;
            updateData.memberType = editForm.memberType;
            updateData.region = editForm.region;
            updateData.phone = editForm.phone;
        }
        
        setNewRecord('');
        updateContact(contact.id, updateData);
        if (onUpdate) onUpdate({ id: contact.id, ...updateData });
        
        setIsEditing(false);
        setIsEditingGuide(false);
        alert('저장되었습니다.');
        onClose();
    };

    const handleSaveEdit = () => {
        handleSaveAll();
    };

    const handleCallFailed = () => {
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
        setNewRecord('');
        updateContact(contact.id, updateData);
        if (onUpdate) onUpdate({ id: contact.id, ...updateData });
        
        setIsEditing(false);
        setIsEditingGuide(false);
        alert('통화 실패로 기록되었습니다.');
        onClose();
    };

    const handleSaveGuide = () => {
        updateContact(contact.id, { callGuide: guideText });
        setIsEditingGuide(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className="bg-[#1e3a8a] px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <h2 className="text-[18px] font-extrabold flex items-center gap-2">
                        <User size={20} /> 연락처 상세 정보
                    </h2>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <button onClick={handleSaveEdit} className="flex items-center gap-1 bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95">
                                <Save size={16} /> 수정 완료
                            </button>
                        ) : (
                            <>
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors">
                                    <Edit2 size={14} /> 정보 수정
                                </button>
                                <button 
                                    onClick={handleSaveAll}
                                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-xl text-[11px] sm:text-[12px] font-black transition-all shadow-md text-white border border-slate-600 active:scale-95"
                                >
                                    <Save size={14} className="sm:w-[15px] sm:h-[15px]" /> 기록 저장
                                </button>
                                <button 
                                    onClick={handleCallFailed}
                                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-xl text-[11px] sm:text-[12px] font-black transition-all shadow-md text-white border border-amber-400 active:scale-95"
                                >
                                    <PhoneOff size={14} className="sm:w-[15px] sm:h-[15px]" /> 통화 실패
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors active:scale-95 ml-2">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 font-sans text-slate-800 flex flex-col gap-6 bg-[#f8fafc]">
                    
                    {/* Basic Info Card */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4 relative">
                        {/* Name and Phone Call Action */}
                        <div className="flex items-center justify-between">
                            {isEditing ? (
                                <input 
                                    type="text" 
                                    className="text-[20px] font-black tracking-tight border-b border-gray-300 outline-none focus:border-[#1e3a8a] py-1 bg-slate-50 px-2 rounded-t w-1/2"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                    placeholder="이름"
                                />
                            ) : (
                                <h3 className="text-[22px] font-black tracking-tight">{contact.name}</h3>
                            )}
                            <a 
                                href={`tel:${contact.phone}`} 
                                className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-sm transition-colors active:scale-95 text-[14px]"
                            >
                                <Phone size={16} /> 통화 걸기
                            </a>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[14px] mt-2">
                            <div className="flex flex-col">
                                <span className="text-[12px] font-bold text-slate-400 mb-0.5 flex items-center gap-1"><Calendar size={12}/>나이</span>
                                {isEditing ? (
                                    <input type="text" className="font-extrabold border-b border-gray-300 outline-none focus:border-[#1e3a8a] bg-slate-50 px-1" value={editForm.age} onChange={(e) => setEditForm({...editForm, age: e.target.value})} />
                                ) : (
                                    <span className="font-extrabold">{contact.age || '-'}</span>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[12px] font-bold text-slate-400 mb-0.5 flex items-center gap-1"><Tag size={12}/>당원구분</span>
                                {isEditing ? (
                                    <input type="text" className="font-extrabold border-b border-gray-300 outline-none focus:border-[#1e3a8a] bg-slate-50 px-1" value={editForm.memberType} onChange={(e) => setEditForm({...editForm, memberType: e.target.value})} />
                                ) : (
                                    <span className="font-extrabold">{contact.memberType || '-'}</span>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[12px] font-bold text-slate-400 mb-0.5 flex items-center gap-1"><Heart size={12}/>현재 성향</span>
                                <span className="font-extrabold text-[#1e3a8a]">{contact.supportLevel || '-'}</span>
                            </div>
                            <div className="flex flex-col col-span-2">
                                <span className="text-[12px] font-bold text-slate-400 mb-0.5 flex items-center gap-1"><MapPin size={12}/>지역/법정동</span>
                                {isEditing ? (
                                    <input type="text" className="font-extrabold border-b border-gray-300 outline-none focus:border-[#1e3a8a] bg-slate-50 px-1 w-full" value={editForm.region} onChange={(e) => setEditForm({...editForm, region: e.target.value})} />
                                ) : (
                                    <span className="font-extrabold">{contact.region || '-'}</span>
                                )}
                            </div>
                            <div className="flex flex-col col-span-2">
                                <span className="text-[12px] font-bold text-slate-400 mb-0.5 flex items-center gap-1"><Phone size={12}/>전화번호</span>
                                {isEditing ? (
                                    <input type="text" className="font-extrabold font-mono text-lg tracking-tight text-[#1e3a8a] border-b border-gray-300 outline-none focus:border-[#1e3a8a] bg-slate-50 px-1 w-full" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} />
                                ) : (
                                    <span className="font-extrabold font-mono text-lg tracking-tight text-[#1e3a8a]">{contact.phone}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Memos / Call Records */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-3">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <h4 className="text-[15px] font-extrabold flex items-center gap-2 text-slate-700">
                                <FileText size={16} /> 기존 메모 및 통화 기록
                            </h4>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 min-h-[100px] max-h-[200px] overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap font-medium text-slate-600">
                            {isEditing ? (
                                <textarea 
                                    className="w-full bg-transparent outline-none h-full min-h-[100px] resize-none"
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                                    placeholder="메모를 입력하세요..."
                                />
                            ) : (
                                contact.notes || <span className="text-slate-400 italic">등록된 내용이 없습니다.</span>
                            )}
                        </div>
                    </div>

                    {/* Add New Record */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[14px] font-extrabold text-[#1e3a8a]">새 통화내용 기록 추가</h4>
                            <button 
                                onClick={() => isEditingGuide ? handleSaveGuide() : setIsEditingGuide(true)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-black transition-all ${
                                    isEditingGuide 
                                    ? 'bg-green-500 text-white shadow-sm' 
                                    : 'text-[#1e3a8a] bg-blue-50 border border-blue-100 hover:bg-blue-100'
                                }`}
                            >
                                {isEditingGuide ? <><Save size={12}/> 안내문구 저장</> : <><Edit2 size={12}/> 안내문구 수정</>}
                            </button>
                        </div>
                        
                        {/* 멘트 스크립트 박스 */}
                        <div className={`p-3 rounded-xl border transition-all ${isEditingGuide ? 'bg-slate-50 border-blue-300 ring-2 ring-blue-100' : 'bg-[#1e3a8a]/5 border-[#1e3a8a]/20'}`}>
                            {isEditingGuide ? (
                                <textarea 
                                    className="w-full bg-transparent outline-none text-[13px] font-bold text-slate-700 leading-relaxed min-h-[80px] resize-none"
                                    value={guideText || globalGuide}
                                    onChange={(e) => setGuideText(e.target.value)}
                                    placeholder="개별 안내문구를 입력하세요..."
                                />
                            ) : (
                                <p className="text-[13px] font-bold text-[#1e3a8a] leading-relaxed">
                                    "{guideText || globalGuide || '안내문구가 설정되지 않았습니다.'}"
                                </p>
                            )}
                            {isEditingGuide && (
                                <p className="text-[10px] text-slate-400 font-bold mt-2">* 이 연락처에만 적용되는 특별 안내문구입니다.</p>
                            )}
                        </div>

                        {/* 성향 선택 버튼 */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-bold text-slate-600">유권자 성향 파악</label>
                            <div className="flex flex-wrap gap-2 items-center">
                                {supportOptions.map(option => (
                                    <button
                                        key={option}
                                        onClick={() => {
                                            const newLevel = supportLevel === option ? null : option;
                                            setSupportLevel(newLevel);
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors border ${
                                            supportLevel === option 
                                                ? 'bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-sm' 
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 메모 입력 및 등록 버튼 */}
                        <div className="flex gap-2">
                            <textarea
                                className="w-full flex-1 border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] rounded-xl p-3 text-[13px] font-medium resize-none transition-all placeholder:text-slate-400"
                                placeholder="통화 내용을 상세하게 기록해주세요... (상단의 저장 버튼을 누르면 기록이 저장됩니다)"
                                rows={3}
                                value={newRecord}
                                onChange={(e) => setNewRecord(e.target.value)}
                            />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
