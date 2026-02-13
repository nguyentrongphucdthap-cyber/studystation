import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { subscribeToOnlineUsers } from '@/services/auth.service';
import { LogOut, Settings, Bell, ChevronDown, Music4, BarChart3 } from 'lucide-react';

export function AppLayout() {
    const { user, isAdmin, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [onlineCount, setOnlineCount] = useState(0);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const isAdminRoute = location.pathname.startsWith('/admin');
    const isDashboard = location.pathname === '/';

    useEffect(() => {
        const unsubscribe = subscribeToOnlineUsers(setOnlineCount);
        return () => unsubscribe();
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowUserMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close dropdown on route change
    useEffect(() => {
        setShowUserMenu(false);
    }, [location.pathname]);

    const handleLogout = async () => {
        setShowUserMenu(false);
        await logout();
        navigate('/login');
    };

    // --- Admin layout ---
    if (isAdminRoute) {
        return (
            <div className="min-h-screen bg-gray-100">
                <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
                    <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
                        <button onClick={() => navigate('/admin')} className="flex items-center gap-2 font-bold text-lg">
                            <Settings className="h-5 w-5 text-blue-600" />
                            <span className="text-gray-800">Khu vực Giáo Viên</span>
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">🟢 {onlineCount} online</span>
                            <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                                ← Trang chủ
                            </button>
                            <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
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

    // --- Build avatar dropdown ---
    const avatarElement = user?.photoURL ? (
        <img src={user.photoURL} alt="" className={`h-9 w-9 rounded-full object-cover ring-2 ${isDashboard ? 'ring-white/30' : 'ring-gray-200'}`} />
    ) : (
        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold ${isDashboard ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>
            {user?.displayName?.charAt(0) || '?'}
        </div>
    );

    const userDropdown = (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center gap-1.5 rounded-full px-1 py-1 transition-all cursor-pointer ${isDashboard ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
            >
                {avatarElement}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isDashboard ? 'text-white/60' : 'text-gray-400'} ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-[100]" style={{ animation: 'fadeIn 0.15s ease' }}>
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user?.displayName || 'User'}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</p>
                    </div>

                    {/* Admin link */}
                    {isAdmin && (
                        <button
                            onClick={() => { setShowUserMenu(false); navigate('/admin'); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2.5 transition-colors"
                        >
                            <Settings className="h-4 w-4 text-blue-500" />
                            Khu vực Giáo Viên
                        </button>
                    )}

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Đăng xuất
                    </button>
                </div>
            )}
        </div>
    );

    // --- Dashboard: full-screen Tet background ---
    if (isDashboard) {
        return (
            <div className="min-h-screen bg-[#8B0000] relative overflow-hidden flex flex-col">
                {/* Tet decorations */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-yellow-900/20 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[#5a0000] to-transparent" />
                    <div className="absolute top-0 left-[10%] text-5xl opacity-70 animate-pulse" style={{ animationDuration: '3s' }}>🏮</div>
                    <div className="absolute top-0 right-[10%] text-5xl opacity-70 animate-pulse" style={{ animationDuration: '4s' }}>🏮</div>
                    <div className="absolute top-0 left-[30%] text-3xl opacity-50 animate-pulse" style={{ animationDuration: '3.5s' }}>🏮</div>
                    <div className="absolute top-0 right-[30%] text-3xl opacity-50 animate-pulse" style={{ animationDuration: '2.5s' }}>🏮</div>
                    <div className="absolute bottom-[5%] left-[5%] text-4xl opacity-40">🌸</div>
                    <div className="absolute bottom-[15%] left-[15%] text-3xl opacity-30">🌸</div>
                    <div className="absolute bottom-[8%] right-[8%] text-4xl opacity-40">🌸</div>
                    <div className="absolute bottom-[20%] right-[15%] text-3xl opacity-30">🌸</div>
                    <div className="absolute bottom-[10%] left-[40%] text-2xl opacity-25">🌸</div>
                    <div className="absolute bottom-[12%] right-[35%] text-2xl opacity-25">🌸</div>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
                        <p className="text-5xl md:text-6xl font-bold text-yellow-600/30 tracking-widest">2026</p>
                        <p className="text-xs md:text-sm text-yellow-600/25 tracking-[0.3em] uppercase mt-1">Happy New Year</p>
                    </div>
                </div>

                {/* Header */}
                <header className="relative z-20 flex items-center justify-between px-5 md:px-8 py-4 shrink-0">
                    <div className="flex items-center gap-3">
                        {/* Logo */}
                        <div className="h-10 w-10 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center border border-white/20">
                            <span className="text-white text-lg font-bold">S</span>
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-white leading-tight">
                                Study Station <span className="text-sm">🇻🇳</span>
                            </h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" style={{ boxShadow: '0 0 6px rgba(74,222,128,0.6)' }} />
                                <span className="text-[11px] text-white/70 font-medium">{onlineCount} người đang học</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all" title="Thông báo">
                            <Bell className="h-4 w-4" />
                        </button>
                        <div className="hidden sm:block text-right mr-1">
                            <p className="text-[10px] text-white/50 uppercase tracking-wider">Xin chào</p>
                            <p className="text-sm font-semibold text-white leading-tight">{user?.displayName?.split(' ').pop() || 'Bạn'}</p>
                        </div>
                        {userDropdown}
                    </div>
                </header>

                {/* Menu content — flex-1 to fill remaining height and center vertically */}
                <main className="relative z-10 flex-1 flex items-center justify-center px-4">
                    <div className="w-full max-w-[580px]">
                        <Outlet />
                    </div>
                </main>
            </div>
        );
    }

    // --- Sub-pages: modern white header layout ---
    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* White Header */}
            <header className="bg-white border-b border-gray-100 px-5 md:px-8 py-3 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center text-white text-base font-bold shadow-lg shadow-blue-500/20">S</div>
                        <h1 className="text-lg font-bold text-gray-800 tracking-tight">StudyStation</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 md:gap-4 mr-2">
                            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><Music4 className="h-5 w-5" /></button>
                            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><BarChart3 className="h-5 w-5" /></button>
                            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><Settings className="h-5 w-5" /></button>
                        </div>
                        {userDropdown}
                    </div>
                </div>
            </header>

            <main className="w-full max-w-5xl mx-auto px-4 py-6 md:py-10 min-h-[calc(100vh-160px)]">
                <div className="page-fade-in">
                    <Outlet />
                </div>
            </main>

            <footer className="text-center text-[12px] text-gray-400 py-8 border-t border-gray-100 mt-10">
                <p>Designed & Developed by <strong className="text-gray-500 font-semibold">Trọng Phúc</strong> | From Concept to Content by <strong className="text-gray-500 font-semibold">Phương Kiều</strong></p>
            </footer>
        </div>
    );
}
