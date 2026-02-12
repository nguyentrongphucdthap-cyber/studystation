import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { subscribeToOnlineUsers } from '@/services/auth.service';
import {
    BookOpen,
    GraduationCap,
    Languages,
    FileText,
    Settings,
    LogOut,
    Users,
    Menu,
    X,
    ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';


export function AppLayout() {
    const { user, isAdmin, isSuperAdmin, isGuest, logout } = useAuth();
    const navigate = useNavigate();
    const [onlineCount, setOnlineCount] = useState(0);
    const [showMenu, setShowMenu] = useState(false);
    const [showMobileNav, setShowMobileNav] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeToOnlineUsers(setOnlineCount);
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navLinks = [
        { to: '/', label: 'Dashboard', icon: BookOpen, show: !isGuest },
        { to: '/practice', label: 'Luyện thi', icon: GraduationCap, show: true },
        { to: '/etest', label: 'E-test', icon: FileText, show: !isGuest },
        { to: '/vocab', label: 'Từ vựng', icon: Languages, show: !isGuest },
        { to: '/admin', label: 'Admin', icon: Settings, show: isAdmin },
    ].filter((l) => l.show);

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
                    {/* Left: Logo + Mobile menu */}
                    <div className="flex items-center gap-3">
                        <button
                            className="lg:hidden"
                            onClick={() => setShowMobileNav(!showMobileNav)}
                        >
                            {showMobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                        <NavLink to="/" className="flex items-center gap-2 font-bold text-lg">
                            <span className="text-2xl">📚</span>
                            <span className="hidden sm:inline bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                                StudyStation
                            </span>
                        </NavLink>
                    </div>

                    {/* Center: Nav links (desktop) */}
                    <nav className="hidden lg:flex items-center gap-1">
                        {navLinks.map(({ to, label, icon: Icon }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === '/'}
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                                        isActive
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    )
                                }
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </NavLink>
                        ))}
                    </nav>

                    {/* Right: Online count + User menu */}
                    <div className="flex items-center gap-3">
                        {/* Online indicator */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            <span className="hidden sm:inline">{onlineCount}</span>
                        </div>

                        {/* User dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors"
                            >
                                {user?.photoURL ? (
                                    <img
                                        src={user.photoURL}
                                        alt="avatar"
                                        className="h-7 w-7 rounded-full object-cover ring-2 ring-border"
                                    />
                                ) : (
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                        {user?.displayName?.charAt(0) || '?'}
                                    </div>
                                )}
                                <span className="hidden md:inline text-sm font-medium max-w-[120px] truncate">
                                    {user?.displayName || 'User'}
                                </span>
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            </button>

                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                                        <div className="border-b border-border px-3 py-2 mb-1">
                                            <p className="text-sm font-medium truncate">{user?.displayName}</p>
                                            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                                        </div>
                                        {isSuperAdmin && (
                                            <button
                                                onClick={() => { navigate('/admin/students'); setShowMenu(false); }}
                                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                                            >
                                                <Users className="h-4 w-4" /> Quản lý học sinh
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { handleLogout(); setShowMenu(false); }}
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <LogOut className="h-4 w-4" /> Đăng xuất
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile nav */}
                {showMobileNav && (
                    <nav className="border-t border-border bg-card px-4 py-2 lg:hidden">
                        {navLinks.map(({ to, label, icon: Icon }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === '/'}
                                onClick={() => setShowMobileNav(false)}
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground hover:bg-accent'
                                    )
                                }
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </NavLink>
                        ))}
                    </nav>
                )}
            </header>

            {/* Main content */}
            <main className="mx-auto max-w-7xl px-4 py-6">
                <Outlet />
            </main>
        </div>
    );
}
