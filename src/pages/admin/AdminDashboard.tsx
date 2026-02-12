import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getAllExams } from '@/services/exam.service';
import { getAllAllowedUsers, getActivityStats } from '@/services/auth.service';
import { getAllEtestExams } from '@/services/etest.service';
import { getAllVocabSets } from '@/services/vocab.service';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard, GraduationCap, FileText, Languages,
    Bell, Calendar, Users, BarChart3,
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

    if (loading) return <div className="flex justify-center py-10"><Spinner size="md" label="Đang tải..." /></div>;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Tổng quan hệ thống
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <StatBox label="Đề thi Practice" value={stats.totalExams} icon="📐" />
                <StatBox label="Bài E-test" value={stats.totalEtests} icon="📝" />
                <StatBox label="Bộ từ vựng" value={stats.totalVocab} icon="📖" />
                {isSuperAdmin && <StatBox label="Người dùng" value={stats.totalUsers} icon="👥" />}
                <StatBox label="Lượt truy cập" value={stats.totalAccess} icon="📊" />
                <StatBox label="Users hoạt động" value={stats.uniqueUsers} icon="🟢" />
            </div>
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
