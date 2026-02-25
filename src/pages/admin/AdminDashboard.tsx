import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getAllExams } from '@/services/exam.service';
import { getAllAllowedUsers, getActivityStats } from '@/services/auth.service';
import { getAllEtestExams } from '@/services/etest.service';
import { getAllVocabSets } from '@/services/vocab.service';
import { getApiKeys, checkApiKeyHealth, type ApiKeyStatus } from '@/services/ai.service';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard, GraduationCap, FileText, Languages,
    Bell, Calendar, Users, BarChart3, Key, RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AdminDashboard() {
    const { isSuperAdmin } = useAuth();

    const navItems = [
        { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
        { to: '/admin/practice', label: 'Đề thi', icon: GraduationCap },
        { to: '/admin/etest', label: 'E-test', icon: FileText },
        { to: '/admin/vocab', label: 'Từ vựng', icon: Languages },
        { to: '/admin/notifications', label: 'Thông báo', icon: Bell },
        { to: '/admin/schedule', label: 'TKB', icon: Calendar },
        ...(isSuperAdmin ? [{ to: '/admin/students', label: 'Học sinh', icon: Users }] : []),
    ];

    return (
        <div className="flex flex-col gap-4 lg:flex-row">
            {/* Sidebar */}
            <aside className="flex gap-1 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-visible">
                {navItems.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                            cn(
                                'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-accent'
                            )
                        }
                    >
                        <Icon className="h-4 w-4 flex-shrink-0" /> {label}
                    </NavLink>
                ))}
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">
                <Outlet />

                {/* Default view (overview) - shown when visiting /admin exactly */}
            </div>
        </div>
    );
}

// ============================================================
// ADMIN OVERVIEW (default /admin route)
// ============================================================

export function AdminOverview() {
    const { isSuperAdmin } = useAuth();
    const [stats, setStats] = useState({
        totalExams: 0, totalEtests: 0, totalVocab: 0, totalUsers: 0,
        totalAccess: 0, uniqueUsers: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [exams, etests, vocab, users, activity] = await Promise.all([
                    getAllExams(),
                    getAllEtestExams(),
                    getAllVocabSets(),
                    isSuperAdmin ? getAllAllowedUsers() : Promise.resolve([]),
                    getActivityStats(),
                ]);
                setStats({
                    totalExams: exams.length,
                    totalEtests: etests.length,
                    totalVocab: vocab.length,
                    totalUsers: users.length,
                    totalAccess: activity.totalAccess,
                    uniqueUsers: activity.uniqueUsers,
                });
            } catch (err) {
                console.error('[AdminOverview] Error:', err);
            }
            setLoading(false);
        }
        load();
    }, [isSuperAdmin]);

    // API Key health check (super-admin only)
    const [keyStatuses, setKeyStatuses] = useState<ApiKeyStatus[]>([]);
    const [checkingKeys, setCheckingKeys] = useState(false);

    const handleCheckKeys = async () => {
        setCheckingKeys(true);
        setKeyStatuses([]);
        const keys = getApiKeys();
        const results: ApiKeyStatus[] = [];
        for (const k of keys) {
            const result = await checkApiKeyHealth(k.fullKey);
            result.index = k.index;
            results.push(result);
        }
        setKeyStatuses(results);
        setCheckingKeys(false);
    };

    if (loading) return <div className="flex justify-center py-10"><Spinner size="md" label="Đang tải..." /></div>;

    const statusColor: Record<string, string> = {
        ok: 'bg-green-100 text-green-700 border-green-200',
        quota_exceeded: 'bg-red-100 text-red-700 border-red-200',
        invalid: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        error: 'bg-gray-100 text-gray-700 border-gray-200',
    };

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Khu vực Giáo Viên — Tổng quan
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <StatBox label="Đề thi Practice" value={stats.totalExams} icon="📐" />
                <StatBox label="Bài E-test" value={stats.totalEtests} icon="📝" />
                <StatBox label="Bộ từ vựng" value={stats.totalVocab} icon="📖" />
                {isSuperAdmin && <StatBox label="Người dùng" value={stats.totalUsers} icon="👥" />}
                <StatBox label="Lượt truy cập" value={stats.totalAccess} icon="📊" />
                <StatBox label="Users hoạt động" value={stats.uniqueUsers} icon="🟢" />
            </div>

            {/* API Key Health Check — super admin only */}
            {isSuperAdmin && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold flex items-center gap-2">
                            <Key className="h-4 w-4 text-primary" /> Gemini API Keys
                        </h3>
                        <button
                            onClick={handleCheckKeys}
                            disabled={checkingKeys}
                            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${checkingKeys ? 'animate-spin' : ''}`} />
                            {checkingKeys ? 'Đang kiểm tra...' : 'Kiểm tra'}
                        </button>
                    </div>

                    {keyStatuses.length > 0 && (
                        <div className="space-y-2">
                            {keyStatuses.map((ks) => (
                                <div key={ks.index} className="flex items-center gap-3 rounded-lg border p-3 text-xs">
                                    <span className="font-mono font-semibold text-muted-foreground">Key {ks.index}</span>
                                    <span className="font-mono text-muted-foreground/70">{ks.key}</span>
                                    <span className={`ml-auto rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusColor[ks.status] || ''}`}>
                                        {ks.status === 'ok' ? '✅ OK' : ks.status === 'quota_exceeded' ? '🔴 Hết quota' : ks.status === 'invalid' ? '⚠️ Lỗi' : '❌ Lỗi'}
                                    </span>
                                </div>
                            ))}
                            <p className="text-[11px] text-muted-foreground">Model: {keyStatuses[0]?.model}</p>
                        </div>
                    )}

                    {keyStatuses.length === 0 && !checkingKeys && (
                        <p className="text-xs text-muted-foreground">Nhấn "Kiểm tra" để xem trạng thái các API keys.</p>
                    )}
                </div>
            )}
        </div>
    );
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: string }) {
    return (
        <div className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md">
            <div className="text-2xl mb-1">{icon}</div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}
