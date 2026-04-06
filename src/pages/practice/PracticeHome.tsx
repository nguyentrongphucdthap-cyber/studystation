import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getAllExams, getSubjects, getHighestScores } from '@/services/exam.service';
import { logUserActivity } from '@/services/auth.service';
import { Spinner } from '@/components/ui/Spinner';
import type { ExamMetadata, HighestScores } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
    Calculator, FlaskConical, Dna, Clock,
    Monitor, Atom, Book,
    ArrowLeft, Search, Globe, Scale, Users
} from 'lucide-react';

export default function PracticeHome() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [exams, setExams] = useState<ExamMetadata[]>([]);
    const [scores, setScores] = useState<HighestScores>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);

    const subjects = getSubjects();
    const activeSubject = searchParams.get('subject') || '';

    useEffect(() => {
        async function load() {
            try {
                const [examList, highScores] = await Promise.all([
                    getAllExams(),
                    getHighestScores(),
                ]);
                setExams(examList);
                setScores(highScores);
                
                // Log visiting practice home
                logUserActivity('PracticeHome', 'Xem danh sách đề thi');
            } catch (err) {
                console.error('[Practice] Load error:', err);
                setError('Không thể tải danh sách đề thi. Vui lòng kiểm tra kết nối mạng hoặc quyền truy cập.');
            }
            setLoading(false);
        }
        load();
    }, []);

    const filteredExams = useMemo(() => {
        let filtered = exams;
        if (activeSubject) {
            filtered = filtered.filter((e) => e.subjectId === activeSubject);
        }
        
        // Filter Special Exams
        filtered = filtered.filter(e => {
            if (!e.isSpecial) return true;
            return e.allowedEmails?.includes(user?.email || '');
        });

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (e) => e.title.toLowerCase().includes(q) || e.subjectId.toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [exams, activeSubject, searchQuery]);

    // Icon mapping for subjects
    const getSubjectIcon = (id: string) => {
        switch (id) {
            case 'toan': return { icon: <Calculator className="h-6 w-6 text-red-500" />, bg: 'bg-red-50 dark:bg-red-500/10' };
            case 'ly': return { icon: <Atom className="h-6 w-6 text-indigo-500" />, bg: 'bg-indigo-50 dark:bg-indigo-500/10' };
            case 'hoa': return { icon: <FlaskConical className="h-6 w-6 text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-500/10' };
            case 'sinh': return { icon: <Dna className="h-6 w-6 text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-500/10' };
            case 'van': return { icon: <Book className="h-6 w-6 text-rose-500" />, bg: 'bg-rose-50 dark:bg-rose-500/10' };
            case 'su': return { icon: <Clock className="h-6 w-6 text-orange-500" />, bg: 'bg-orange-50 dark:bg-orange-500/10' };
            case 'dia': return { icon: <Globe className="h-6 w-6 text-cyan-500" />, bg: 'bg-cyan-50 dark:bg-cyan-500/10' };
            case 'gdcd': return { icon: <Scale className="h-6 w-6 text-teal-500" />, bg: 'bg-teal-50 dark:bg-teal-500/10' };
            case 'tin': return { icon: <Monitor className="h-6 w-6 text-purple-500" />, bg: 'bg-purple-50 dark:bg-purple-500/10' };
            default: return { icon: <Book className="h-6 w-6 text-gray-500" />, bg: 'bg-gray-50 dark:bg-gray-500/10' };
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner size="lg" label="Đang tải danh sách đề..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-20 px-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600 max-w-md mx-auto">
                    <p className="font-semibold mb-2">Lỗi tải dữ liệu</p>
                    <p className="text-sm opacity-90 mb-4">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="text-sm font-medium hover:underline flex items-center justify-center gap-2 mx-auto"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Quay lại Menu
                    </button>
                </div>
            </div>
        );
    }

    // If no subject selected, show subject selection (Redesigned)
    if (!activeSubject) {
        return (
            <div className="space-y-6">
                {/* Header Card */}
                <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl rounded-[32px] p-8 md:p-10 shadow-soft border border-white/80 dark:border-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Ôn thi THPT QG 2025</h2>
                        <p className="text-gray-500 mt-2 text-sm md:text-lg font-medium opacity-80">
                            Cấu trúc đề mới nhất. Tích hợp công thức Toán/Lý/Hóa.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0 self-start md:self-center">
                        <button
                            onClick={() => navigate('/practice/history')}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95 border border-blue-100"
                        >
                            <Clock className="h-5 w-5" />
                            Lịch sử
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-soft hover:shadow-medium active:scale-95 border border-gray-100 dark:border-slate-700"
                        >
                            <ArrowLeft className="h-5 w-5" />
                            Quay lại Menu
                        </button>
                    </div>
                </div>

                {/* Grid of Subjects */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {subjects.map((sub) => {
                        const count = exams.filter((e) => e.subjectId === sub.id).length;
                        const { icon, bg } = getSubjectIcon(sub.id);
                        return (
                            <button
                                key={sub.id}
                                onClick={() => setSearchParams({ subject: sub.id })}
                                className="group bg-white/85 dark:bg-slate-900/60 backdrop-blur-md p-8 rounded-[28px] border border-white/70 dark:border-slate-800/50 shadow-card hover:shadow-card-hover hover:-translate-y-2 transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden active:scale-95"
                            >
                                <div className={`w-16 h-16 rounded-[22px] ${bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-sm`}>
                                    <div className="scale-110">{icon}</div>
                                </div>
                                <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-tight">
                                    {sub.name}
                                </h3>
                                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest bg-gray-50/50 dark:bg-black/20 px-3 py-1 rounded-full border border-gray-100 dark:border-gray-800">
                                    {count} đề thi
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Subject selected: show exam list
    const currentSubject = subjects.find(s => s.id === activeSubject);

    return (
        <div className="space-y-6">
            {/* Header for exam list */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl p-6 rounded-[28px] border border-white dark:border-slate-800/50 shadow-soft">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setSearchParams({})}
                        className="p-3 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl text-gray-500 transition-all active:scale-90 bg-gray-50/50 dark:bg-slate-800/50"
                        title="Quay lại"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{currentSubject?.name || activeSubject}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-bold">
                                {filteredExams.length} ĐỀ THI HIỆN CÓ
                            </p>
                        </div>
                    </div>
                </div>

                {/* Compact Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-4 top-1/2 -track-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm đề thi..."
                        className="w-full pl-12 pr-5 py-3 bg-gray-50/50 dark:bg-slate-800/50 border border-transparent dark:border-slate-700/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm font-medium shadow-inset shadow-sm dark:text-white"
                    />
                </div>
            </div>

            {/* Exam list grid */}
            {filteredExams.length === 0 ? (
                <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl p-12 text-center border border-gray-100 dark:border-slate-800/50 shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="h-8 w-8 text-gray-300" />
                    </div>
                    <p className="text-gray-400 font-medium">Không tìm thấy đề thi nào khớp với từ khóa.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                    {filteredExams.map((exam) => {
                        const totalQ = (exam.questionCount?.part1 || 0) +
                            (exam.questionCount?.part2 || 0) +
                            (exam.questionCount?.part3 || 0);
                        const highScore = scores[exam.id]?.highestScore;

                        // Helper for score-based styling
                        const getScoreStyle = (score: number | undefined) => {
                            if (score === undefined || isNaN(score)) return {
                                border: 'border-slate-200/50',
                                badge: 'bg-slate-50 text-slate-400 border-slate-200/60',
                                accent: 'bg-slate-400',
                                shadow: 'shadow-sm',
                                ring: 'group-hover:ring-slate-100',
                                glow: 'from-slate-50/50'
                            };
                            if (score >= 8.0) return {
                                border: 'border-emerald-200/40',
                                badge: 'bg-emerald-50 text-emerald-600 border-emerald-200/50 shadow-emerald-100/50',
                                accent: 'bg-emerald-500',
                                shadow: 'shadow-emerald-500/5',
                                ring: 'group-hover:ring-emerald-200/30',
                                glow: 'from-emerald-50/50'
                            };
                            if (score >= 6.5) return {
                                border: 'border-blue-200/40',
                                badge: 'bg-blue-50 text-blue-600 border-blue-200/50 shadow-blue-100/50',
                                accent: 'bg-blue-500',
                                shadow: 'shadow-blue-500/5',
                                ring: 'group-hover:ring-blue-200/30',
                                glow: 'from-blue-50/50'
                            };
                            if (score >= 4.0) return {
                                border: 'border-orange-200/40',
                                badge: 'bg-orange-50 text-orange-600 border-orange-200/50 shadow-orange-100/50',
                                accent: 'bg-orange-500',
                                shadow: 'shadow-orange-500/5',
                                ring: 'group-hover:ring-orange-200/30',
                                glow: 'from-orange-50/50'
                            };
                            return {
                                border: 'border-red-200/40',
                                badge: 'bg-red-50 text-red-600 border-red-200/50 shadow-red-100/50',
                                accent: 'bg-red-500',
                                shadow: 'shadow-red-500/5',
                                ring: 'group-hover:ring-red-200/30',
                                glow: 'from-red-50/50'
                            };
                        };

                        const style = getScoreStyle(highScore);

                        return (
                            <button
                                key={exam.id}
                                onClick={() => navigate(`/practice/${exam.id}`)}
                                className={cn(
                                    "group relative bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-[28px] p-4 border transition-all duration-500 text-left flex flex-col active:scale-[0.97] overflow-hidden hover:shadow-2xl hover:-translate-y-1.5 hover:ring-4",
                                    style.border,
                                    style.ring,
                                    style.shadow
                                )}
                            >
                                {/* Decorative Gradient Overlay */}
                                <div className={cn(
                                    "absolute inset-0 bg-gradient-to-br to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                                    style.glow
                                )} />

                                {/* Fixed Background Accent Glow */}
                                <div className={cn(
                                    "absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 rounded-full opacity-[0.06] group-hover:opacity-[0.15] transition-all duration-700 blur-2xl",
                                    style.accent
                                )} />

                                <div className="relative space-y-3">
                                    <div className="flex justify-between items-start gap-3">
                                        <h3 className="text-[14px] font-extrabold text-gray-800 dark:text-white line-clamp-2 leading-tight pr-2 group-hover:text-gray-950 dark:group-hover:text-white transition-colors tracking-tight">
                                            {exam.title}
                                            {exam.isSpecial && (
                                                <span className="ml-2 inline-block px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase tracking-tighter align-middle">Đặc biệt</span>
                                            )}
                                        </h3>
                                        {highScore !== undefined && !isNaN(highScore) && (
                                            <div className={cn(
                                                "shrink-0 w-12 h-12 rounded-[18px] flex flex-col items-center justify-center border-2 shadow-sm transition-all group-hover:scale-110 group-hover:rotate-3 duration-500",
                                                style.badge
                                            )}>
                                                <span className="text-[16px] font-black leading-none tracking-tighter">
                                                    {highScore.toFixed(highScore === 10 ? 0 : 1)}
                                                </span>
                                                <span className="text-[7px] font-black opacity-40 uppercase tracking-widest mt-0.5">Score</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-50/50 dark:bg-slate-800/50 rounded-lg text-[9px] text-gray-500 dark:text-gray-400 font-bold tracking-tight border border-gray-100/50 dark:border-slate-700/50 shadow-sm group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
                                            <Clock className="h-3 w-3 opacity-50 text-blue-500" />
                                            {exam.time}'
                                        </div>
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-50/50 dark:bg-slate-800/50 rounded-lg text-[9px] text-gray-500 dark:text-gray-400 font-bold tracking-tight border border-gray-100/50 dark:border-slate-700/50 shadow-sm group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
                                            <Book className="h-3 w-3 opacity-50 text-emerald-500" />
                                            {totalQ} Q
                                        </div>
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-50/50 dark:bg-slate-800/50 rounded-lg text-[9px] text-gray-400 dark:text-gray-500 font-bold tracking-tight border border-gray-100/50 dark:border-slate-700/50 shadow-sm group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
                                            <Users className="h-3 w-3 opacity-40" />
                                            {exam.attemptCount || 0}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
