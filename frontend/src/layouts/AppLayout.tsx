import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import NotificationDrawer from '../components/NotificationDrawer';
import { useSocket } from '../hooks/useSocket';
import { useAlertStore } from '../store/alertStore';
import { alertApi } from '../api/index';

export default function AppLayout() {
    useSocket();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { setUnreadCount } = useAlertStore();

    // Auto-open drawer if there are unread alerts on first load
    useEffect(() => {
        alertApi.getUnreadCount()
            .then(r => {
                const count = r.data.data?.count || 0;
                setUnreadCount(count);
                if (count > 0) {
                    setTimeout(() => setDrawerOpen(true), 1500);
                }
            })
            .catch(() => { });
    }, []);

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            {/* Skip-to-content link — invisible until focused, lets keyboard
                users bypass the sidebar nav instead of tabbing through
                every link on every single page load. */}
            <a
                href="#main-content"
                style={{
                    position: 'absolute', left: -9999, top: 0, zIndex: 2000,
                    padding: '10px 16px', background: 'var(--accent-primary)', color: '#fff',
                    borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none',
                }}
                onFocus={e => { e.currentTarget.style.left = '12px'; e.currentTarget.style.top = '12px'; }}
                onBlur={e => { e.currentTarget.style.left = '-9999px'; }}
            >
                Skip to main content
            </a>
            <Sidebar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Topbar onOpenNotifications={() => setDrawerOpen(true)} />
                <main id="main-content" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="page-enter">
                    <Outlet />
                </main>
            </div>
            <NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </div>
    );
}
