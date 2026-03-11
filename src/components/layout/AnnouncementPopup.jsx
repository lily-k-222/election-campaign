import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { X, Bell, Info } from 'lucide-react';

export const AnnouncementPopup = () => {
    const [announcement, setAnnouncement] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const fetchLatestAnnouncement = async () => {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .eq('active', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                const latest = data[0];
                const dismissedId = localStorage.getItem('dismissed_announcement_id');
                
                if (dismissedId !== latest.id) {
                    setAnnouncement(latest);
                    setIsVisible(true);
                }
            }
        };

        fetchLatestAnnouncement();

        // Optional: Real-time listener for new announcements
        const channel = supabase
            .channel('public:announcements')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
                setAnnouncement(payload.new);
                setIsVisible(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleClose = () => {
        if (announcement) {
            localStorage.setItem('dismissed_announcement_id', announcement.id);
        }
        setIsVisible(false);
    };

    if (!isVisible || !announcement) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-[450px] overflow-hidden animate-in zoom-in-95 self-center sm:self-center border border-slate-100">
                {/* Header Decoration */}
                <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="bg-blue-50 p-3 rounded-2xl">
                            <Bell className="text-blue-600" size={28} />
                        </div>
                        <button 
                            onClick={handleClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors active:scale-95"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <span className="text-[12px] font-black text-blue-600 uppercase tracking-widest">Global Notice</span>
                            <h3 className="text-[22px] font-black text-slate-900 leading-tight">
                                {announcement.title}
                            </h3>
                        </div>
                        
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                            <p className="text-[15px] text-slate-600 font-bold leading-relaxed whitespace-pre-wrap">
                                {announcement.content}
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col gap-3">
                        <button 
                            onClick={handleClose}
                            className="w-full py-4 bg-[#1e3a8a] text-white rounded-2xl font-black text-[16px] shadow-lg shadow-blue-900/10 hover:bg-[#1e40af] transition-all active:scale-[0.98]"
                        >
                            확인했습니다
                        </button>
                    </div>
                    
                    <p className="text-center text-[11px] text-slate-400 font-bold mt-4 uppercase tracking-tighter">
                        선거캠프 운영본부 공지사항
                    </p>
                </div>
            </div>
        </div>
    );
};
