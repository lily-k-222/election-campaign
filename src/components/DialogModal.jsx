import React from 'react';

export const DialogModal = ({ isOpen, onClose, onConfirm, title, message, type = 'confirm' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4 transition-opacity">
            <div className="bg-white rounded-[24px] shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-7">
                    <h3 className="text-[20px] font-extrabold text-slate-800 mb-2 tracking-tight">{title}</h3>
                    <p className="text-[14px] font-bold text-slate-500 leading-relaxed">{message}</p>
                </div>
                <div className="bg-slate-50 px-7 py-4 flex justify-end gap-2 border-t border-slate-100">
                    {type === 'confirm' && (
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-[14px] font-extrabold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors active:scale-95"
                        >
                            취소
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            onClose();
                        }}
                        className="px-5 py-2.5 text-[14px] font-extrabold text-white bg-[#1e3a8a] hover:bg-[#1e40af] rounded-xl transition-colors shadow-sm active:scale-95"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
};
