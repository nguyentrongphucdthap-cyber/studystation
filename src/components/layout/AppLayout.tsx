import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { subscribeToOnlineUsers } from '@/services/auth.service';
import { LogOut, Settings, Users } from 'lucide-react';

export function AppLayout() {
    const { user, isAdmin, isSuperAdmin, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [onlineCount, setOnlineCount] = useState(0);

    // Check if we're in admin section - admin keeps its own layout style
    const isAdminRoute = location.pathname.startsWith('/admin');

    useEffect(() => {
        const unsubscribe = subscribeToOnlineUsers(setOnlineCount);
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Admin routes use a wider layout
    if (isAdminRoute) {
        return (
            <div className="min-h-screen bg-gray-100">
                {/* Admin header */}
                <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
                    <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 font-bold text-lg"
                        >
                            <Settings className="h-5 w-5 text-blue-600" />
                            <span className="text-gray-800">Admin Panel</span>
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                                🟢 {onlineCount} online
                            </span>
                            <button
                                onClick={handleLogout}
                                className="text-sm text-red-600 hover:underline flex items-center gap-1"
                            >
                                <LogOut className="h-4 w-4" /> Đăng xuất
                            </button>
                        </div>
                    </div>
                </header>
                <main className="mx-auto max-w-7xl px-4 py-6">
                    <Outlet />
                </main>
            </div>
        );
    }

    // Main app layout: centered white card (matches original)
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Main Card Container */}
            <div className="w-full max-w-3xl mx-auto bg-white rounded-lg shadow-lg my-4 md:my-8">
                {/* Top bar inside card */}
                <div className="flex items-center justify-between px-6 pt-5 md:px-10 md:pt-6">
                    {/* User info */}
                    <div className="flex items-center gap-2">
                        {user?.photoURL ? (
                            <img
                                src={user.photoURL}
                                alt="avatar"
                                className="h-8 w-8 rounded-full object-cover ring-2 ring-gray-200"
                            />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                                {user?.displayName?.charAt(0) || '?'}
                            </div>
                        )}
                        <div className="hidden sm:block">
                            <p className="text-sm font-medium text-gray-800 truncate max-w-[150px]">
                                {user?.displayName || 'User'}
                            </p>
                            <p className="text-xs text-gray-400">🟢 {onlineCount} online</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <button
                                onClick={() => navigate('/admin')}
                                className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <Settings className="h-3.5 w-3.5" /> Admin
                            </button>
                        )}
                        {isSuperAdmin && (
                            <button
                                onClick={() => navigate('/admin/students')}
                                className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <Users className="h-3.5 w-3.5" />
                            </button>
                        )}
                        <button
                            onClick={handleLogout}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="h-3.5 w-3.5" /> Đăng xuất
                        </button>
                    </div>
                </div>

                {/* Main content area */}
                <main className="w-full p-6 md:p-10 min-h-[500px]">
                    <div className="page-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Credits footer */}
            <div className="text-center text-[12px] text-gray-400 pb-6">
                <p>Designed & Developed by <strong className="text-gray-500 font-semibold">Trọng Phúc</strong> | From Concept to Content by <strong className="text-gray-500 font-semibold">Phương Kiều</strong></p>
            </div>
        </div>
    );
}
