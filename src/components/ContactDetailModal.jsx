import React, { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Phone, User, Calendar, MapPin, Tag, FileText, X, Plus, Heart, Edit2, Save } from 'lucide-react';

export const ContactDetailModal = ({ isOpen, onClose, contact }) => {
    const { updateContact } = useCampaign();
    const [newRecord, setNewRecord] = useState('');
    const [supportLevel, setSupportLevel] = useState('관심없음');
    const [isEditing, setIsEditing] = useState(false);
    
    // Edit Form State
    const [editForm, setEditForm] = useState({
        name: '',
        age: '',
        memberType: '',
        region: '',
        phone: ''
    });

    useEffect(() => {
        if (contact) {
            setSupportLevel(contact.supportLevel || '관심없음');
            setEditForm({
                name: contact.name || '',
                age: contact.age || '',
                memberType: contact.memberType || '',
                region: contact.region || '',
                phone: contact.phone || ''
            });
            setIsEditing(false); // Reset edit state when contact changes
        }
    }, [contact]);

    if (!isOpen || !contact) return null;

    const supportOptions = ['강하게 지지', '약하게 지지', '관심없음', '지지하지 않음', '다른후보 지지'];

    const handleSaveAll = () => {
        let updateData = { supportLevel, status: 'CALLED' };
        
        const now = new Date();
        const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const recordText = newRecord.trim() ? `${newRecord.trim()}\n` : '';
        const recordEntry = `[${dateString}] ${recordText}(성향: ${supportLevel})`;
        
        let previousNotes = contact.notes;
        // Ignore the default test note when appending a real record
        if (previousNotes === '테스트용 데이터입니다.') {
            previousNotes = '';
        }
        
        updateData.notes = previousNotes 
            ? `${previousNotes}\n${recordEntry}` 
            : recordEntry;
            
        setNewRecord('');
        
        updateContact(contact.id, updateData);
        alert('저장되었습니다.');
        onClose();
    };

    const handleSaveEdit = () => {
        updateContact(contact.id, { 
            name: editForm.name,
            age: editForm.age,
            memberType: editForm.memberType,
            region: editForm.region,
            phone: editForm.phone
        });
        setIsEditing(false);
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
                            <button onClick={handleSaveEdit} className="flex items-center gap-1 bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm">
                                <Save size={16} /> 수정완료
                            </button>
                        ) : (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                                <Edit2 size={16} /> 수정
                            </button>
                        )}
                        <button 
                            onClick={handleSaveAll}
                            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm text-white border border-slate-600 ml-1"
                        >
                            <Save size={16} /> 저장
                        </button>
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
                        <h4 className="text-[15px] font-extrabold flex items-center gap-2 text-slate-700 border-b border-slate-100 pb-2">
                            <FileText size={16} /> 기존 메모 및 통화 기록
                        </h4>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 min-h-[100px] max-h-[200px] overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap font-medium text-slate-600">
                            {contact.notes || <span className="text-slate-400 italic">등록된 내용이 없습니다.</span>}
                        </div>
                    </div>

                    {/* Add New Record */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4">
                        <h4 className="text-[14px] font-extrabold text-[#1e3a8a]">새 통화내용 기록 추가</h4>
                        
                        {/* 멘트 스크립트 박스 */}
                        <div className="bg-[#1e3a8a]/5 p-3 rounded-xl border border-[#1e3a8a]/20">
                            <p className="text-[13px] font-bold text-[#1e3a8a] leading-relaxed">
                                "안녕하세요! 바쁘신 중에 전화 받아주셔서 감사합니다. 저는 강진군 발전을 위해 뛰고 있는 김보미 후보 선거캠프에서 연락드렸습니다. 이번 선거에서 저희 김보미 후보를 응원해주실 마음이 있으신지 조심스럽게 고견을 여쭙고 싶습니다."
                            </p>
                        </div>

                        {/* 성향 선택 버튼 */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-bold text-slate-600">유권자 성향 파악</label>
                            <div className="flex flex-wrap gap-2 items-center">
                                {supportOptions.map(option => (
                                    <button
                                        key={option}
                                        onClick={() => {
                                            setSupportLevel(option);
                                            updateContact(contact.id, { supportLevel: option });
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
