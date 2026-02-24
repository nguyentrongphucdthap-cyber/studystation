import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAllExams, getSubjects, getHighestScores } from '@/services/exam.service';
import { Spinner } from '@/components/ui/Spinner';
import type { ExamMetadata, HighestScores } from '@/types';
import {
    Calculator, FlaskConical, Dna, Clock,
    Monitor, Atom, Languages, Book,
    ArrowLeft, Search, Trophy, Globe, Scale
} from 'lucide-react';

export default function PracticeHome() {
    const navigate = useNavigate();
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
            case 'toan': return { icon: <Calculator className="h-6 w-6 text-red-500" />, bg: 'bg-red-50' };
            case 'ly': return { icon: <Atom className="h-6 w-6 text-indigo-500" />, bg: 'bg-indigo-50' };
            case 'hoa': return { icon: <FlaskConical className="h-6 w-6 text-blue-500" />, bg: 'bg-blue-50' };
            case 'sinh': return { icon: <Dna className="h-6 w-6 text-emerald-500" />, bg: 'bg-emerald-50' };
            case 'van': return { icon: <Book className="h-6 w-6 text-rose-500" />, bg: 'bg-rose-50' };
            case 'su': return { icon: <Clock className="h-6 w-6 text-orange-500" />, bg: 'bg-orange-50' };
            case 'dia': return { icon: <Globe className="h-6 w-6 text-cyan-500" />, bg: 'bg-cyan-50' };
            case 'anh': return { icon: <Languages className="h-6 w-6 text-pink-500" />, bg: 'bg-pink-50' };
            case 'gdcd': return { icon: <Scale className="h-6 w-6 text-teal-500" />, bg: 'bg-teal-50' };
            case 'tin': return { icon: <Monitor className="h-6 w-6 text-purple-500" />, bg: 'bg-purple-50' };
            default: return { icon: <Book className="h-6 w-6 text-gray-500" />, bg: 'bg-gray-50' };
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
                <div className="bg-white/70 backdrop-blur-xl rounded-[32px] p-8 md:p-10 shadow-soft border border-white flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 tracking-tight">Ôn thi THPT QG 2025</h2>
                        <p className="text-gray-500 mt-2 text-sm md:text-lg font-medium opacity-80">
                            Cấu trúc đề mới nhất. Tích hợp công thức Toán/Lý/Hóa.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="bg-white hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-soft hover:shadow-medium active:scale-95 shrink-0 self-start md:self-center border border-gray-100"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Quay lại Menu
                    </button>
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
                                className="group bg-white/80 backdrop-blur-md p-8 rounded-[28px] border border-white shadow-soft hover:shadow-heavy hover:-translate-y-2 transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden active:scale-95"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white/80 backdrop-blur-xl p-6 rounded-[28px] border border-white shadow-soft">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setSearchParams({})}
                        className="p-3 hover:bg-gray-100 rounded-2xl text-gray-500 transition-all active:scale-90 bg-gray-50/50"
                        title="Quay lại"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{currentSubject?.name || activeSubject}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <p className="text-[11px] text-gray-400 uppercase tracking-[0.15em] font-bold">
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
                        className="w-full pl-12 pr-5 py-3 bg-gray-50/50 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium shadow-inset shadow-sm"
                    />
                </div>
            </div>

            {/* Exam list grid */}
            {filteredExams.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="h-8 w-8 text-gray-300" />
                    </div>
                    <p className="text-gray-400 font-medium">Không tìm thấy đề thi nào khớp với từ khóa.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredExams.map((exam) => {
                        const totalQ = (exam.questionCount?.part1 || 0) +
                            (exam.questionCount?.part2 || 0) +
                            (exam.questionCount?.part3 || 0);
                        const highScore = scores[exam.id];

                        return (
                            <button
                                key={exam.id}
                                onClick={() => navigate(`/practice/${exam.id}`)}
                                className="group relative bg-white/80 backdrop-blur-md p-6 rounded-[24px] border border-white shadow-soft hover:shadow-heavy hover:-translate-y-1 transition-all duration-500 text-left flex flex-col justify-between active:scale-[0.98]"
                            >
                                <div className="space-y-3">
                                    <h3 className="text-lg font-extrabold text-gray-800 line-clamp-2 group-hover:text-blue-600 transition-colors tracking-tight leading-snug">
                                        {exam.title}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-4 text-[12px] text-gray-500 font-bold uppercase tracking-wider">
                                        <span className="flex items-center gap-1.5 opacity-70"><Clock className="h-3.5 w-3.5" /> {exam.time}'</span>
                                        <span className="flex items-center gap-1.5 opacity-70"><Book className="h-3.5 w-3.5" /> {totalQ} CHƯƠNG</span>
                                        <span className="flex items-center gap-1.5 opacity-70">{exam.attemptCount || 0} LƯỢT</span>
                                    </div>
                                </div>

                                {highScore && (
                                    <div className="mt-6 flex items-center justify-between border-t border-gray-100/50 pt-4">
                                        <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">High Score</span>
                                        <div className="flex items-center gap-2 text-[13px] font-black text-amber-600 bg-amber-50/50 px-3 py-1 rounded-xl border border-amber-100/50 shadow-sm">
                                            <Trophy className="h-3.5 w-3.5" /> {highScore.highestScore.toFixed(1)}
                                        </div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
