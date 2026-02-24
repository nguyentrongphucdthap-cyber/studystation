import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState, useRef } from 'react';
import { subscribeToOnlineUsers } from '@/services/auth.service';
import { cn } from '@/lib/utils';
import { LogOut, Settings, Bell, ChevronDown, Music4, BarChart3 } from 'lucide-react';
import { FloatingHub } from '@/components/FloatingHub';

export function AppLayout() {
    const { user, isAdmin, logout } = useAuth();
    const { settings } = useTheme();
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
                            <span className="text-xs text-gray-500">🟢 {onlineCount} đang trực tuyến</span>
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
                <FloatingHub />
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
                <div
                    className="absolute right-0 top-full mt-2 w-60 bg-white/95 backdrop-blur-xl rounded-[24px] shadow-heavy border border-white/50 py-2 z-[100] origin-top-right animate-page-fade-in"
                    style={{ animationDuration: '0.3s' }}
                >
                    {/* User info */}
                    <div className="px-5 py-4 border-b border-gray-50">
                        <p className="text-[15px] font-bold text-gray-900 truncate">{user?.displayName || 'Thành viên'}</p>
                        <p className="text-[12px] text-gray-400 truncate mt-0.5">{user?.email}</p>
                    </div>

                    <div className="p-1.5 px-2">
                        {/* Admin link */}
                        {isAdmin && (
                            <button
                                onClick={() => { setShowUserMenu(false); navigate('/admin'); }}
                                className="w-full text-left px-4 py-2.5 text-[14px] text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-2xl flex items-center gap-3 transition-all font-medium"
                            >
                                <div className="p-2 bg-blue-50 rounded-xl text-blue-500">
                                    <Settings className="h-4 w-4" />
                                </div>
                                Khu vực Giáo Viên
                            </button>
                        )}

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-2.5 text-[14px] text-red-500 hover:bg-red-50 rounded-2xl flex items-center gap-3 transition-all font-medium"
                        >
                            <div className="p-2 bg-red-50 rounded-xl text-red-500">
                                <LogOut className="h-4 w-4" />
                            </div>
                            Đăng xuất
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    // --- Dashboard: full-screen Tet background ---
    const isSchedule = location.pathname === '/schedule';

    if (isDashboard || isSchedule) {
        return (
            <div className="min-h-screen bg-[#f8fafc] relative overflow-hidden flex flex-col">
                {/* Optimized Soft Blue Gradient (Matching New Image) */}
                <div className="absolute inset-0 pointer-events-none bg-[#f0f9ff]">
                    {/* Top blue focus blob */}
                    <div className="absolute inset-0 opacity-40"
                        style={{
                            background: 'radial-gradient(circle at 45% 25%, #3b82f6 0%, transparent 60%)'
                        }}
                    />
                    {/* Primary white/light glow in the bottom half */}
                    <div className="absolute inset-0 opacity-80"
                        style={{
                            background: 'radial-gradient(circle at 85% 85%, #ffffff 0%, transparent 60%)'
                        }}
                    />
                    {/* Soft left-middle side glow */}
                    <div className="absolute inset-0 opacity-50"
                        style={{
                            background: 'radial-gradient(circle at 5% 50%, #bae6fd 0%, transparent 50%)'
                        }}
                    />
                    {/* Bottom-left accent blob */}
                    <div className="absolute inset-0 opacity-30"
                        style={{
                            background: 'radial-gradient(circle at 15% 90%, #67e8f9 0%, transparent 40%)'
                        }}
                    />
                </div>

                {/* Custom User Background */}
                {settings.customBackground && (
                    <div
                        className="absolute inset-0 bg-cover bg-center transition-opacity duration-700 z-[1]"
                        style={{ backgroundImage: `url(${settings.customBackground})` }}
                    />
                )}

                {/* Optional Tet Decorations (Subtle) */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                    <div className="absolute top-0 left-[15%] text-2xl animate-pulse">🏮</div>
                    <div className="absolute top-0 right-[15%] text-2xl animate-pulse">🏮</div>
                </div>

                {/* Header */}
                <header className="relative z-20 flex items-center justify-between px-6 md:px-12 py-5 shrink-0">
                    {isSchedule ? (
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/')}
                                className="h-11 w-11 bg-white/60 hover:bg-white backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/40 shadow-soft transition-all group"
                            >
                                <ChevronDown className="h-6 w-6 text-gray-700 rotate-90 group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight leading-tight">Thời Khóa Biểu</h1>
                                <p className="text-[13px] text-gray-500 font-medium">Theo dõi lịch học</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            {/* Logo */}
                            <div className="h-12 w-12 bg-blue-600 rounded-[18px] flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <span className="text-white text-xl font-bold">S</span>
                            </div>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight leading-tight">
                                    Study Station
                                </h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="relative flex items-center">
                                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                        <span className="absolute w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-75" />
                                    </div>
                                    <span className="text-[12px] text-gray-600 font-bold uppercase tracking-wider">{onlineCount} ĐANG HỌC</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-4">
                        <button className="h-10 w-10 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-white/60 transition-all border border-transparent hover:border-white/40" title="Thông báo">
                            <Bell className="h-5 w-5" />
                        </button>
                        <div className="hidden sm:block text-right mr-2">
                            <p className="text-[10px] text-blue-600/70 font-black uppercase tracking-[0.12em]">Welcome back</p>
                            <p className="text-[15px] font-extrabold text-gray-900 leading-tight">{user?.displayName?.split(' ').pop() || 'Bạn'}</p>
                        </div>
                        {userDropdown}
                    </div>
                </header>

                {/* Menu content */}
                <main className={`relative z-10 flex-1 flex ${isSchedule ? 'items-start justify-center pt-8' : 'items-center justify-center'} px-4 overflow-y-auto`}>
                    <div className={`w-full ${isSchedule ? 'max-w-7xl pb-10' : 'max-w-[580px]'}`}>
                        <Outlet />
                    </div>
                </main>
                <FloatingHub />
            </div>
        );
    }

    const isExamPage = location.pathname.includes('/practice/') || location.pathname.includes('/etest/');

    // --- Sub-pages: modern white header layout ---
    return (
        <div className="min-h-screen bg-gray-50/50 relative overflow-hidden">
            {/* Custom User Background */}
            {settings.customBackground && (
                <div
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-700 z-[0]"
                    style={{ backgroundImage: `url(${settings.customBackground})` }}
                />
            )}

            {/* Premium Glass Header */}
            <header className="bg-white/80 backdrop-blur-xl border-b border-white/60 px-6 md:px-10 py-4 sticky top-0 z-30 shadow-soft">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => navigate('/')}
                    >
                        <div className="h-10 w-10 bg-blue-600 rounded-[18px] flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">S</div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">StudyStation</h1>
                    </div>

                    <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2 md:gap-4 mr-2">
                            <button className="p-2.5 hover:bg-gray-100 rounded-2xl text-gray-500 transition-all hover:scale-110 active:scale-90"><Music4 className="h-5 w-5" /></button>
                            <button className="p-2.5 hover:bg-gray-100 rounded-2xl text-gray-500 transition-all hover:scale-110 active:scale-90"><BarChart3 className="h-5 w-5" /></button>
                            <button className="p-2.5 hover:bg-gray-100 rounded-2xl text-gray-500 transition-all hover:scale-110 active:scale-90"><Settings className="h-5 w-5" /></button>
                        </div>
                        {userDropdown}
                    </div>
                </div>
            </header>

            <main className={cn(
                "relative z-10 w-full mx-auto px-4 py-6 md:py-10 min-h-[calc(100vh-160px)] transition-all duration-300",
                isExamPage ? "max-w-7xl" : "max-w-5xl"
            )}>
                <div className="page-fade-in">
                    <Outlet />
                </div>
            </main>

            <FloatingHub />
        </div>
    );
}
