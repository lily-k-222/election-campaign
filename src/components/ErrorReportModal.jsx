import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, X, Send, CheckCircle, Bug } from 'lucide-react';

export const ErrorReportModal = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [category, setCategory] = useState('기능 오류');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const categories = ['기능 오류', 'UI/디자인', '데이터 이상', '기타'];

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!description.trim()) {
            alert('오류 내용을 상세히 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('error_reports')
                .insert([{
                    user_id: user?.id,
                    user_email: user?.email,
                    user_name: user?.name,
                    category,
                    description: description.trim(),
                    metadata: {
                        url: window.location.href,
                        userAgent: navigator.userAgent,
                        timestamp: new Date().toISOString()
                    }
                }]);

            if (error) throw error;
            
            setIsSuccess(true);
            setTimeout(() => {
                onClose();
                // Reset state after closing
                setTimeout(() => {
                    setIsSuccess(false);
                    setDescription('');
                    setCategory('기능 오류');
                }, 300);
            }, 2000);
        } catch (error) {
            console.error('Error report submission failed:', error);
            alert(`신고 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-all animate-in fade-in duration-200">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className="bg-[#ef4444] px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <h2 className="text-[18px] font-black flex items-center gap-2 tracking-tight">
                        <Bug size={20} /> 시스템 오류 신고
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors active:scale-95">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col gap-5 bg-slate-50/50">
                    {isSuccess ? (
                        <div className="py-8 flex flex-col items-center justify-center text-center animate-in zoom-in-90 duration-300">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 border-2 border-green-200">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">신고가 접수되었습니다</h3>
                            <p className="text-slate-500 font-bold text-sm">
                                소중한 의견 감사합니다.<br />개발팀에서 신속히 확인하겠습니다.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-black text-slate-600 ml-1">오류 카테고리</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {categories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setCategory(cat)}
                                            className={`py-2.5 px-3 rounded-xl text-[13px] font-bold transition-all border ${
                                                category === cat 
                                                ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' 
                                                : 'bg-white border-slate-200 text-slate-500 hover:border-red-100 hover:bg-red-50/30'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-black text-slate-600 ml-1">상세 내용</label>
                                <textarea
                                    className="w-full border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 rounded-2xl p-4 text-[14px] font-bold text-slate-700 min-h-[120px] resize-none transition-all placeholder:text-slate-300 shadow-inner"
                                    placeholder="발생한 문제나 개선 요청 사항을 자유롭게 적어주세요."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2.5 shadow-sm">
                                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-[12px] font-bold text-amber-700 leading-relaxed">
                                    신고 시 현재 페이지 정보와 기기 정보가 개발자에게 함께 전달됩니다.
                                </p>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !description.trim()}
                                className="w-full py-4 bg-[#ef4444] hover:bg-red-600 text-white rounded-2xl font-black transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 mt-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        처리 중...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} /> 신고하기
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
