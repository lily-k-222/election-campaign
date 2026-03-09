import React, { useState, useEffect } from 'react';
import { Button } from './Button';

export const ContactFormModal = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState({
        name: '',
        age: '',
        memberType: '',
        region: '',
        phone: '',
        notes: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                age: initialData.age || '',
                memberType: initialData.memberType || '',
                region: initialData.region || '',
                phone: initialData.phone || '',
                notes: initialData.notes || ''
            });
        } else {
            setFormData({
                name: '',
                age: '',
                memberType: '',
                region: '',
                phone: '',
                notes: ''
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
                <div className="p-6 border-b border-border">
                    <h2 className="text-xl font-bold">
                        {initialData ? '연락처 수정' : '새 연락처 추가'}
                    </h2>
                </div>
                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">이름 *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="홍길동"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">나이</label>
                            <input
                                type="text"
                                name="age"
                                value={formData.age}
                                onChange={handleChange}
                                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/20 outline-none"
                                placeholder="예: 40대"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">당원구분</label>
                            <input
                                type="text"
                                name="memberType"
                                value={formData.memberType}
                                onChange={handleChange}
                                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/20 outline-none"
                                placeholder="예: 권리당원"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">법정동</label>
                        <input
                            type="text"
                            name="region"
                            value={formData.region}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="예: 역삼동"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">전화번호 *</label>
                        <input
                            type="text"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            required
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                            placeholder="010-0000-0000"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">비고 (메모)</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows={3}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                            placeholder="특이사항 입력..."
                        />
                    </div>

                    <div className="flex gap-2 justify-end mt-4">
                        <Button type="button" variant="outline" onClick={onClose}>취소</Button>
                        <Button type="submit" variant="primary">
                            {initialData ? '수정 저장' : '추가하기'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
