import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Phone, User, Calendar, MapPin, Tag, FileText, X, Plus } from 'lucide-react';

export const ContactDetailModal = ({ isOpen, onClose, contact }) => {
    const { updateContact } = useCampaign();
    const [newRecord, setNewRecord] = useState('');

    if (!isOpen || !contact) return null;

    const handleAddRecord = () => {
        if (!newRecord.trim()) return;
        
        const now = new Date();
        const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const recordEntry = `[${dateString}] ${newRecord.trim()}`;
        
        const updatedNotes = contact.notes 
            ? `${contact.notes}\n${recordEntry}` 
            : recordEntry;

        updateContact(contact.id, { notes: updatedNotes });
        setNewRecord('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className="bg-[#1e3a8a] px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <h2 className="text-[18px] font-extrabold flex items-center gap-2">
                        <User size={20} /> 연락처 상세 정보
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors active:scale-95">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 font-sans text-slate-800 flex flex-col gap-6 bg-[#f8fafc]">
                    
                    {/* Basic Info Card */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[22px] font-black tracking-tight">{contact.name}</h3>
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
                                <span className="font-extrabold">{contact.age || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[12px] font-bold text-slate-400 mb-0.5 flex items-center gap-1"><Tag size={12}/>당원구분</span>
                                <span className="font-extrabold">{contact.memberType || '-'}</span>
                            </div>
                            <div className="flex flex-col col-span-2">
                                <span className="text-[12px] font-bold text-slate-400 mb-0.5 flex items-center gap-1"><MapPin size={12}/>지역/법정동</span>
                                <span className="font-extrabold">{contact.region || '-'}</span>
                            </div>
                            <div className="flex flex-col col-span-2">
                                <span className="text-[12px] font-bold text-slate-400 mb-0.5 flex items-center gap-1"><Phone size={12}/>전화번호</span>
                                <span className="font-extrabold font-mono text-lg tracking-tight text-[#1e3a8a]">{contact.phone}</span>
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
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-3">
                        <h4 className="text-[14px] font-extrabold text-[#1e3a8a]">새 통화내용 기록 추가</h4>
                        <div className="flex gap-2">
                            <textarea
                                className="w-full flex-1 border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] rounded-xl p-3 text-[13px] font-medium resize-none transition-all placeholder:text-slate-400"
                                placeholder="통화 내용을 상세하게 기록해주세요..."
                                rows={2}
                                value={newRecord}
                                onChange={(e) => setNewRecord(e.target.value)}
                            />
                            <button 
                                onClick={handleAddRecord}
                                disabled={!newRecord.trim()}
                                className="w-16 flex flex-col items-center justify-center gap-1 bg-[#1e3a8a] hover:bg-[#1e40af] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0 font-bold text-[12px] active:scale-95 shadow-sm"
                            >
                                <Plus size={18} />
                                등록
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
