import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getAllExams, getSubjects, getHighestScores } from '@/services/exam.service';
import { getAllNotifications } from '@/services/notification.service';
import { cn } from '@/lib/utils';
import type { ExamMetadata, Notification as NotifType, HighestScores } from '@/types';
import {
    GraduationCap,
    FileText,
    Languages,
    Bell,
    TrendingUp,
    Clock,
    BookOpen,
    ChevronRight,
    Sparkles,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [exams, setExams] = useState<ExamMetadata[]>([]);
    const [notifications, setNotifications] = useState<NotifType[]>([]);
    const [scores, setScores] = useState<HighestScores>({});
    const [loading, setLoading] = useState(true);

    const subjects = getSubjects();

    useEffect(() => {
        async function loadDashboard() {
            try {
                const [examList, notifs, highScores] = await Promise.all([
                    getAllExams(),
                    getAllNotifications(),
                    getHighestScores(),
                ]);
                setExams(examList);
                setNotifications(notifs.slice(0, 5));
                setScores(highScores);
            } catch (err) {
                console.error('[Dashboard] Load error:', err);
            }
            setLoading(false);
        }
        loadDashboard();
    }, []);

    const totalExams = exams.length;
    const completedExams = Object.keys(scores).length;
    const avgScore = completedExams > 0
        ? Math.round(Object.values(scores).reduce((sum, s) => sum + s.highestScore, 0) / completedExams * 10) / 10
        : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner size="lg" label="Đang tải..." />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome header */}
            <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-blue-500/5 to-indigo-500/10 p-6 dark:from-primary/20 dark:via-blue-600/10 dark:to-indigo-600/20">
                <div className="flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            Xin chào, {user?.displayName || 'bạn'}! 👋
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Chúc bạn một buổi học hiệu quả!
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                    label="Tổng đề thi"
                    value={totalExams}
                    icon={BookOpen}
                    color="text-blue-600 bg-blue-100 dark:bg-blue-900/30"
                />
                <StatCard
                    label="Đã làm"
                    value={completedExams}
                    icon={GraduationCap}
                    color="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30"
                />
                <StatCard
                    label="Điểm TB"
                    value={avgScore}
                    icon={TrendingUp}
                    color="text-amber-600 bg-amber-100 dark:bg-amber-900/30"
                    suffix="/10"
                />
                <StatCard
                    label="Lượt thi"
                    value={exams.reduce((sum, e) => sum + (e.attemptCount || 0), 0)}
                    icon={Clock}
                    color="text-purple-600 bg-purple-100 dark:bg-purple-900/30"
                />
            </div>

            {/* Quick access modules */}
            <div>
                <h2 className="mb-3 text-lg font-bold">📚 Truy cập nhanh</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <QuickAccessCard
                        title="Luyện thi"
                        description="Làm bài trắc nghiệm các môn"
                        icon={GraduationCap}
                        color="from-blue-500 to-blue-600"
                        onClick={() => navigate('/practice')}
                    />
                    <QuickAccessCard
                        title="E-test"
                        description="Bài đọc hiểu tiếng Anh"
                        icon={FileText}
                        color="from-emerald-500 to-teal-600"
                        onClick={() => navigate('/etest')}
                    />
                    <QuickAccessCard
                        title="Từ vựng"
                        description="Flashcard & matching game"
                        icon={Languages}
                        color="from-purple-500 to-indigo-600"
                        onClick={() => navigate('/vocab')}
                    />
                </div>
            </div>

            {/* Two-column: Recent exams + Notifications */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Recent exams by subject */}
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-bold">📐 Đề thi theo môn</h3>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/practice')}>
                            Xem tất cả <ChevronRight className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {subjects.map((sub) => {
                            const count = exams.filter((e) => e.subjectId === sub.id).length;
                            return (
                                <button
                                    key={sub.id}
                                    onClick={() => navigate(`/practice?subject=${sub.id}`)}
                                    className="flex items-center gap-2 rounded-lg border border-border/50 p-2.5 text-left transition-all hover:bg-accent hover:shadow-sm"
                                >
                                    <span className="text-xl">{sub.icon}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{sub.name}</p>
                                        <p className="text-xs text-muted-foreground">{count} đề</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Notifications */}
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        <h3 className="font-bold">Thông báo</h3>
                    </div>
                    {notifications.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            Không có thông báo mới
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className="rounded-lg border border-border/50 p-3 transition-colors hover:bg-accent/50"
                                >
                                    <div className="flex items-start gap-2">
                                        <NotifBadge category={notif.category} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{notif.title}</p>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{notif.content}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatCard({
    label,
    value,
    icon: Icon,
    color,
    suffix = '',
}: {
    label: string;
    value: number;
    icon: typeof BookOpen;
    color: string;
    suffix?: string;
}) {
    return (
        <div className="rounded-xl border border-border/50 bg-card p-4 transition-all hover:shadow-md">
            <div className={cn('mb-2 inline-flex rounded-lg p-2', color)}>
                <Icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-foreground">
                {value}{suffix}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}

function QuickAccessCard({
    title,
    description,
    icon: Icon,
    color,
    onClick,
}: {
    title: string;
    description: string;
    icon: typeof GraduationCap;
    color: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="group relative overflow-hidden rounded-xl p-5 text-left text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
        >
            <div className={cn('absolute inset-0 bg-gradient-to-br', color)} />
            <div className="relative z-10">
                <Icon className="mb-3 h-8 w-8 opacity-90 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-0.5 text-sm opacity-80">{description}</p>
            </div>
            <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
        </button>
    );
}

const notifCategoryColors: Record<string, string> = {
    update: 'bg-blue-100 text-blue-700',
    new: 'bg-emerald-100 text-emerald-700',
    fix: 'bg-amber-100 text-amber-700',
    remove: 'bg-red-100 text-red-700',
    edit: 'bg-purple-100 text-purple-700',
    info: 'bg-gray-100 text-gray-700',
};

function NotifBadge({ category }: { category: string }) {
    return (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', notifCategoryColors[category] || notifCategoryColors.info)}>
            {category}
        </span>
    );
}
