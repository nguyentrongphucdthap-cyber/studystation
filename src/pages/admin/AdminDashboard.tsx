import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getAllExams } from '@/services/exam.service';
import { getAllAllowedUsers, getActivityStats, getBlacklist } from '@/services/auth.service';
import { getAllEtestExams } from '@/services/etest.service';
import { getAllVocabSets } from '@/services/vocab.service';
import { getApiKeys, checkApiKeyHealth, checkApiKeysViaProxy, type ApiKeyStatus } from '@/services/ai.service';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard, GraduationCap, FileText, Languages,
    Bell, Calendar, Users, BarChart3, Key, RefreshCw,
    Shield, UserPlus, Coins
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AdminDashboard() {
    const { isSuperAdmin, isAdmin, role } = useAuth();
    const location = useLocation();

    const navItems = [
        { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
        { to: '/admin/practice', label: 'Đề thi', icon: GraduationCap },
        { to: '/admin/etest', label: 'E-test', icon: FileText },
        { to: '/admin/vocab', label: 'Từ vựng', icon: Languages },
        { to: '/admin/notifications', label: 'Thông báo', icon: Bell },
        { to: '/admin/schedule', label: 'TKB', icon: Calendar },
        ...(isSuperAdmin || isAdmin || role === 'teacher' ? [{ to: '/admin/students', label: 'Học sinh', icon: Users }] : []),
        ...(isSuperAdmin || role === 'boss' ? [{ to: '/admin/access-requests', label: 'Yêu cầu truy cập', icon: UserPlus }] : []),
        ...(isSuperAdmin ? [{ to: '/admin/teachers', label: 'Giáo viên', icon: Shield }] : []),
        ...(isSuperAdmin || (role as string).includes('boss') ? [{ to: '/admin/mago', label: 'Mago A.I', icon: Coins }] : []),
    ];

    const visibleNavItems = navItems;

    // Only restrict paths that literally don't exist in navItems (like /admin/teachers for non-supers)
    const availablePaths = navItems.map(item => item.to);
    const isPathAllowed = availablePaths.some(p => {
        if (p === '/admin') return location.pathname === '/admin';
        return location.pathname.startsWith(p);
    });

    if (!isPathAllowed) {
        return <Navigate to="/admin" replace />;
    }

    return (
        <div className="admin-panel -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row w-full">
                {/* Sidebar */}
                <aside className="admin-card p-2 sm:p-4 flex gap-2 overflow-x-auto lg:w-72 lg:flex-col lg:overflow-visible shrink-0 self-start sticky top-20 sm:top-24 z-30 min-h-0 lg:min-h-[calc(100vh-8rem)] scrollbar-hide">
                    <div className="hidden lg:flex items-center gap-3 px-3 py-4 mb-4 border-b border-slate-100 dark:border-slate-700/50">
                        <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                            <Shield className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-sm tracking-tight text-slate-800 dark:text-slate-200">Giáo Viên</h2>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider pt-0.5">Quản lý lớp học</p>
                        </div>
                    </div>
                    {visibleNavItems.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                cn(
                                    'admin-nav-item flex items-center gap-3 whitespace-nowrap px-4 py-3.5 text-sm font-semibold rounded-xl mb-1',
                                    isActive
                                        ? 'active'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50 hover:translate-x-1'
                                )
                            }
                        >
                            <Icon className="h-4 w-4 shrink-0" /> {label}
                        </NavLink>
                    ))}
                </aside>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}

// ============================================================
// ADMIN OVERVIEW (default /admin route)
// ============================================================

export function AdminOverview() {
    const { isSuperAdmin, isAdmin } = useAuth();
    const [stats, setStats] = useState({
        totalExams: 0, totalEtests: 0, totalVocab: 0, totalUsers: 0,
        totalAccess: 0, uniqueUsers: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [exams, etests, vocab, users, activity, blacklist] = await Promise.all([
                    getAllExams(),
                    getAllEtestExams(),
                    getAllVocabSets(),
                    (isSuperAdmin || isAdmin) ? getAllAllowedUsers() : Promise.resolve([]),
                    getActivityStats(),
                    (isSuperAdmin || isAdmin) ? getBlacklist() : Promise.resolve([]),
                ]);

                let filteredUsers = users;
                let filteredUniqueCount = activity.uniqueUsers;

                if ((isSuperAdmin || isAdmin) && blacklist) {
                    const blacklistedEmails = (blacklist || []).map(b => b.email.toLowerCase());
                    filteredUsers = users.filter(u => !blacklistedEmails.includes(u.email.toLowerCase()));
                    
                    if (activity.recentEmails) {
                        filteredUniqueCount = activity.recentEmails.filter(email => 
                            !blacklistedEmails.includes(email.toLowerCase())
                        ).length;
                    }
                }

                setStats({
                    totalExams: exams.length,
                    totalEtests: etests.length,
                    totalVocab: vocab.length,
                    totalUsers: filteredUsers.length,
                    totalAccess: activity.totalAccess,
                    uniqueUsers: filteredUniqueCount,
                });
            } catch (err) {
                console.error('[AdminOverview] Error:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [isSuperAdmin, isAdmin]);

    // API Key health check (super-admin only)
    const [keyStatuses, setKeyStatuses] = useState<ApiKeyStatus[]>([]);
    const [checkingKeys, setCheckingKeys] = useState(false);

    const handleCheckKeys = async () => {
        setCheckingKeys(true);
        setKeyStatuses([]);

        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (isLocal) {
            // Local dev: check keys directly
            const keys = getApiKeys();
            const results: ApiKeyStatus[] = [];
            for (const k of keys) {
                const result = await checkApiKeyHealth(k.fullKey);
                result.index = k.index;
                results.push(result);
            }
            setKeyStatuses(results);
        } else {
            // Production: check via server-side proxy (keys never sent to client)
            const results = await checkApiKeysViaProxy();
            setKeyStatuses(results);
        }

        setCheckingKeys(false);
    };

    if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" label="Đang tải dữ liệu tổng quan..." /></div>;

    const statusColor: Record<string, string> = {
        ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        quota_exceeded: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
        leaked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-2 ring-red-400/50 animate-pulse',
        invalid: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        error: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Tổng quan hệ thống</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Theo dõi các chỉ số hoạt động của StudyStation</p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
                <StatBox label="Đề thi Practice" value={stats.totalExams} icon={GraduationCap} colorClass="text-indigo-600 bg-indigo-100" />
                <StatBox label="Bài E-test" value={stats.totalEtests} icon={FileText} colorClass="text-teal-600 bg-teal-100" />
                <StatBox label="Bộ từ vựng" value={stats.totalVocab} icon={Languages} colorClass="text-amber-600 bg-amber-100" />
                {(isSuperAdmin || isAdmin) && <StatBox label="Học sinh" value={stats.totalUsers} icon={Users} colorClass="text-rose-600 bg-rose-100" />}
                <StatBox label="Lượt truy cập" value={stats.totalAccess} icon={BarChart3} colorClass="text-blue-600 bg-blue-100" />
                <StatBox label="Users hoạt động" value={stats.uniqueUsers} icon={LayoutDashboard} colorClass="text-violet-600 bg-violet-100" />
            </div>

            {/* API Key Health Check — super admin only */}
            {isSuperAdmin && (
                <div className="admin-card p-6 space-y-4 mt-8">
                    <div className="flex items-center justify-between border-b pb-4 mb-2">
                        <div>
                            <h3 className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <Key className="h-5 w-5 text-indigo-500" /> API Keys / AI Services
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Kiểm tra trạng thái hoạt động của các AI model</p>
                        </div>
                        <button
                            onClick={handleCheckKeys}
                            disabled={checkingKeys}
                            className="admin-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold hover:shadow-lg disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${checkingKeys ? 'animate-spin' : ''}`} />
                            {checkingKeys ? 'Đang kiểm tra...' : 'Check Status'}
                        </button>
                    </div>

                    {keyStatuses.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                            {keyStatuses.map((ks) => (
                                <div key={ks.index} className="admin-stat-card flex flex-col gap-2 relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-sm dark:text-slate-300">Key #{ks.index}</span>
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusColor[ks.status] || ''}`}>
                                            {ks.status === 'ok' ? 'Online' : ks.status === 'quota_exceeded' ? 'Hết lượt' : ks.status === 'leaked' ? '⚠️ LEAKED' : 'Lỗi'}
                                        </span>
                                    </div>
                                    <span className="font-mono text-xs text-slate-500 bg-slate-50/50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 truncate">
                                        {ks.key}
                                    </span>
                                    {ks.status !== 'ok' && (
                                        <p className="text-[10px] text-rose-500 font-semibold mt-1 truncate">{ks.message}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {keyStatuses.length > 0 && (
                        <p className="text-[11px] text-center font-medium text-slate-400 mt-2">Active model: <span className="text-indigo-500">{keyStatuses[0]?.model}</span></p>
                    )}

                    {keyStatuses.length === 0 && !checkingKeys && (
                        <div className="admin-stat-card flex flex-col items-center justify-center py-8 text-center border border-dashed border-slate-200 dark:border-slate-700 shadow-none">
                            <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                                <Key className="h-6 w-6" />
                            </div>
                            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Chưa tải dữ liệu API Key</p>
                            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Nhấn Check Status để kiểm tra xem hệ thống AI còn quote để tạo đề và chấm điểm hay không.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function StatBox({ label, value, icon: Icon, colorClass }: { label: string; value: number; icon: any; colorClass: string }) {
    return (
        <div className="admin-card p-5 transition-transform hover:-translate-y-1">
            <div className={`inline-flex p-3 rounded-2xl mb-4 shadow-inner ${colorClass}`}>
                <Icon className="h-6 w-6" />
            </div>
            <div>
                <p className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none mb-1">{value}</p>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
            </div>
        </div>
    );
}
