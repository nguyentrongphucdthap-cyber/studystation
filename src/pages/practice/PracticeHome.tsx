import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAllExams, getSubjects, getHighestScores } from '@/services/exam.service';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import type { ExamMetadata, HighestScores } from '@/types';
import {
    Search,
    BookOpen,
    Clock,
    Users,
    Trophy,
} from 'lucide-react';

export default function PracticeHome() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [exams, setExams] = useState<ExamMetadata[]>([]);
    const [scores, setScores] = useState<HighestScores>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const subjects = getSubjects();
    const activeSubject = searchParams.get('subject') || 'all';

    useEffect(() => {
        async function load() {
            try {
                const [examList, highScores] = await Promise.all([
                    getAllExams(),
                    getHighestScores(),
                ]);
                setExams(examList);
                setScores(highScores);
            } catch (err) {
                console.error('[Practice] Load error:', err);
            }
            setLoading(false);
        }
        load();
    }, []);

    const filteredExams = useMemo(() => {
        let filtered = exams;
        if (activeSubject !== 'all') {
            filtered = filtered.filter((e) => e.subjectId === activeSubject);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (e) => e.title.toLowerCase().includes(q) || e.subjectId.toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [exams, activeSubject, searchQuery]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner size="lg" label="Đang tải danh sách đề..." />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BookOpen className="h-6 w-6 text-primary" />
                    Luyện thi
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {exams.length} đề thi · {Object.keys(scores).length} đề đã làm
                </p>
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm đề thi..."
                        className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                </div>
            </div>

            {/* Subject filter chips */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSearchParams({})}
                    className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                        activeSubject === 'all'
                            ? 'bg-primary text-primary-foreground shadow'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                    )}
                >
                    Tất cả ({exams.length})
                </button>
                {subjects.map((sub) => {
                    const count = exams.filter((e) => e.subjectId === sub.id).length;
                    if (count === 0) return null;
                    return (
                        <button
                            key={sub.id}
                            onClick={() => setSearchParams({ subject: sub.id })}
                            className={cn(
                                'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                                activeSubject === sub.id
                                    ? 'bg-primary text-primary-foreground shadow'
                                    : 'bg-muted text-muted-foreground hover:bg-accent'
                            )}
                        >
                            <span>{sub.icon}</span> {sub.name} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Exam grid */}
            {filteredExams.length === 0 ? (
                <div className="py-16 text-center">
                    <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                    <p className="text-muted-foreground">Không tìm thấy đề thi nào</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredExams.map((exam) => {
                        const subject = subjects.find((s) => s.id === exam.subjectId);
                        const highScore = scores[exam.id];
                        return (
                            <ExamCard
                                key={exam.id}
                                exam={exam}
                                subjectIcon={subject?.icon || '📝'}
                                subjectName={subject?.name || exam.subjectId}
                                subjectColor={subject?.color || '#6B7280'}
                                highScore={highScore?.highestScore}
                                onClick={() => navigate(`/practice/${exam.id}`)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ============================================================
// EXAM CARD
// ============================================================

function ExamCard({
    exam,
    subjectIcon,
    subjectColor,
    highScore,
    onClick,
}: {
    exam: ExamMetadata;
    subjectIcon: string;
    subjectName: string;
    subjectColor: string;
    highScore?: number;
    onClick: () => void;
}) {
    const totalQ = (exam.questionCount?.part1 || 0) +
        (exam.questionCount?.part2 || 0) +
        (exam.questionCount?.part3 || 0);

    return (
        <button
            onClick={onClick}
            className="group flex flex-col rounded-xl border border-border/50 bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.99]"
        >
            <div className="mb-3 flex items-start justify-between">
                <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                    style={{ backgroundColor: `${subjectColor}20` }}
                >
                    {subjectIcon}
                </div>
                {highScore !== undefined && (
                    <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <Trophy className="h-3 w-3" />
                        {highScore.toFixed(1)}
                    </div>
                )}
            </div>

            <h3 className="mb-1 text-sm font-semibold text-card-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {exam.title}
            </h3>

            <div className="mt-auto flex items-center gap-3 pt-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {exam.time} phút
                </span>
                <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> {totalQ} câu
                </span>
                <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {exam.attemptCount || 0}
                </span>
            </div>
        </button>
    );
}
