import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export const Layout = () => {
    return (
        <div className="container p-4 min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
};

