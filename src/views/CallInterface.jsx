import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

export const CallInterface = ({ contact, onClose }) => {
    const { recordCall } = useCampaign();
    const [result, setResult] = useState('');
    const [notes, setNotes] = useState('');

    const handleSave = () => {
        if (!result) {
            alert('설문 결과를 선택해주세요.');
            return;
        }
        recordCall(contact.id, result, notes);
        onClose();
    };

    const surveyOptions = [
        { value: 'STRONG_SUPPORT', label: '1. 적극 지지', activeColor: 'active-blue' },
        { value: 'LEAN_SUPPORT', label: '2. 다소 지지', activeColor: 'active-green' },
        { value: 'UNDECIDED', label: '3. 잘 모름', activeColor: 'active-gray' },
        { value: 'NO_RESPONSE', label: '4. 무응답', activeColor: 'active-gray' },
        { value: 'SUPPORT_CHA', label: '5. 차영수 지지', activeColor: 'active-purple' },
        { value: 'SUPPORT_KANG', label: '6. 강진원 지지', activeColor: 'active-red' },
    ];

    return (
        <div className="animate-fade-in flex flex-col gap-6 max-w-2xl mx-auto w-full">
            <div className="flex items-center justify-between mb-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                    &larr; 목록으로 돌아가기
                </Button>
                <span className="font-semibold text-muted">통화 중...</span>
            </div>

            <Card className="border-t-4" style={{ borderTopColor: 'var(--color-primary)' }}>
                <h2 className="text-2xl font-bold mb-2">{contact.name} 당원님</h2>
                <div className="flex gap-4 mb-6 items-center">
                    <a href={`tel:${contact.phone}`} className="text-lg text-primary font-mono bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 flex items-center gap-2 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {contact.phone}
                    </a>
                    <div className="text-muted flex items-center">
                        {contact.region} | {contact.gender} | {contact.ageGroup}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg mb-6 border border-gray-100">
                    <p className="font-medium mb-2 text-sm text-gray-700">스크립트 가이드:</p>
                    <p className="text-gray-600 leading-relaxed text-sm">
                        "안녕하세요, 당원님. 저는 김보미 후보 선거 캠프 자원봉사자입니다.
                        이번 선거에서 김보미 후보에 대해 어떻게 생각하시는지 간단한 여론을 여쭙고 있습니다."
                    </p>
                </div>

                <h3 className="font-semibold text-lg mb-3">통화 결과 입력</h3>
                <div className="toggle-group mb-6">
                    {surveyOptions.map(option => {
                        const isSelected = result === option.value;
                        return (
                            <button
                                key={option.value}
                                onClick={() => setResult(option.value)}
                                className={`toggle-btn ${isSelected ? option.activeColor : ''}`}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>

                <div className="mb-6">
                    <label className="block font-semibold mb-2">추가 메모 (선택)</label>
                    <textarea
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        rows="3"
                        placeholder="특이사항이나 당원님의 의견을 자유롭게 적어주세요."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    ></textarea>
                </div>

                <Button size="lg" className="w-full" onClick={handleSave}>
                    통화 결과 저장 완료
                </Button>
            </Card>
        </div>
    );
};
