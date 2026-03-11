import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { AnnouncementPopup } from './AnnouncementPopup';

export const Layout = () => {
    return (
        <div className="min-h-screen bg-[#e8edf2] flex flex-col font-sans">
            <AnnouncementPopup />
            <Header />
            <main className="flex-1 w-full mx-auto">
                <Outlet />
            </main>
        </div>
    );
};
