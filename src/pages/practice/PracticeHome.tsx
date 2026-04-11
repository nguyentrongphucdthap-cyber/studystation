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
    ArrowLeft, Search, Globe, Scale, Users, Folder, ChevronRight, Home, ArrowUpLeft
} from 'lucide-react';
import * as folderUtils from '@/lib/folderUtils';

export default function PracticeHome() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [exams, setExams] = useState<ExamMetadata[]>([]);
    const [scores, setScores] = useState<HighestScores>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState<string[]>([]);

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
                
                logUserActivity('PracticeHome', 'Xem danh sách đề thi', {
                    eventType: 'view',
                    status: 'success',
                    metadata: { totalExams: examList.length },
                });
            } catch (err) {
                console.error('[Practice] Load error:', err);
                setError('Không thể tải danh sách đề thi. Vui lòng kiểm tra kết nối mạng hoặc quyền truy cập.');
            }
            setLoading(false);
        }
        load();
    }, []);

    // Reset currentPath when subject changes
    useEffect(() => {
        setCurrentPath([]);
    }, [activeSubject]);

    const filteredExams = useMemo(() => {
        let filtered = exams;
        
        // Subject filter
        if (activeSubject) {
            filtered = filtered.filter((e) => e.subjectId === activeSubject);
        }
        
        // Special Access check
        filtered = filtered.filter(e => {
            if (!e.isSpecial) return true;
            return e.allowedEmails?.includes(user?.email || '');
        });

        return filtered;
    }, [exams, activeSubject, user?.email]);

    const currentFullPath = useMemo(() => currentPath.join('/'), [currentPath]);

    const itemsAtLevel = useMemo(() => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return {
                folders: [],
                exams: filteredExams.filter(e => e.title.toLowerCase().includes(q))
            };
        }

        // Discovery folders from metadata
        const allPaths = Array.from(new Set(filteredExams.map(e => (e.customFolder || '').trim()).filter(Boolean)));
        const folders = folderUtils.getSubFoldersAtLevel(allPaths, currentFullPath);
        const examsAtThisLevel = filteredExams.filter(e => (e.customFolder || '') === currentFullPath);

        return { folders, exams: examsAtThisLevel };
    }, [filteredExams, currentFullPath, searchQuery]);

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

    if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" label="Đang tải danh sách đề..." /></div>;

    if (error) return (
        <div className="text-center py-20 px-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600 max-w-md mx-auto">
                <p className="font-semibold mb-2">Lỗi tải dữ liệu</p>
                <p className="text-sm opacity-90 mb-4">{error}</p>
                <button onClick={() => navigate('/')} className="text-sm font-medium hover:underline flex items-center justify-center gap-2 mx-auto">
                    <ArrowLeft className="w-4 h-4" /> Quay lại Menu
                </button>
            </div>
        </div>
    );

    // Initial Subject Selection
    if (!activeSubject) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl rounded-[32px] p-8 md:p-10 shadow-soft border border-white/80 dark:border-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">Ôn thi THPT QG 2025</h2>
                        <p className="text-gray-500 mt-2 text-sm md:text-lg font-medium opacity-80">
                            Cấu trúc đề mới nhất. Tích hợp công thức Toán/Lý/Hóa.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0 self-start md:self-center">
                        <button onClick={() => navigate('/practice/history')} className="bg-blue-50/80 hover:bg-blue-100 text-blue-600 px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95 border border-blue-100/50">
                            <Clock className="h-5 w-5" /> Lịch sử
                        </button>
                        <button onClick={() => navigate('/')} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-soft border border-gray-100 dark:border-slate-700">
                            <ArrowLeft className="h-5 w-5" /> Menu
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {subjects.map((sub) => {
                        const count = exams.filter((e) => e.subjectId === sub.id).length;
                        const { icon, bg } = getSubjectIcon(sub.id);
                        return (
                            <button
                                key={sub.id}
                                onClick={() => setSearchParams({ subject: sub.id })}
                                className="group bg-white/85 dark:bg-slate-900/60 backdrop-blur-md p-8 rounded-[32px] border border-white/70 dark:border-slate-800/50 shadow-soft hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 text-center relative overflow-hidden active:scale-95"
                            >
                                <div className={cn("w-16 h-16 rounded-[22px] mx-auto flex items-center justify-center mb-5 transition-transform group-hover:scale-110", bg)}>
                                    <div className="scale-110">{icon}</div>
                                </div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-1 group-hover:text-blue-600 transition-colors tracking-tight">
                                    {sub.name}
                                </h3>
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{count} đề thi hiện có</p>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Selected Subject View
    const currentSubject = subjects.find(s => s.id === activeSubject);
    
    const getScoreStyle = (score: number | undefined) => {
        if (score === undefined || isNaN(score)) return { border: 'border-slate-200/50', badge: 'bg-slate-50 text-slate-400', glow: 'from-slate-50/50', accent: 'bg-slate-400' };
        if (score >= 8.0) return { border: 'border-emerald-200/40', badge: 'bg-emerald-50 text-emerald-600', glow: 'from-emerald-50/50', accent: 'bg-emerald-500' };
        if (score >= 6.5) return { border: 'border-blue-200/40', badge: 'bg-blue-50 text-blue-600', glow: 'from-blue-50/50', accent: 'bg-blue-500' };
        if (score >= 4.0) return { border: 'border-orange-200/40', badge: 'bg-orange-50 text-orange-600', glow: 'from-orange-50/50', accent: 'bg-orange-500' };
        return { border: 'border-red-200/40', badge: 'bg-red-50 text-red-600', glow: 'from-red-50/50', accent: 'bg-red-500' };
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header / Sidebar / Search area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl p-6 rounded-[28px] border border-white dark:border-slate-800/50 shadow-soft">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSearchParams({})} className="p-3 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl text-gray-500 transition-all active:scale-90 bg-gray-50/50 dark:bg-slate-800/50 shadow-sm border border-gray-100 dark:border-slate-700">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{currentSubject?.name || 'Môn học'}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">{filteredExams.length} ĐỀ THI</p>
                        </div>
                    </div>
                </div>

                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
                        placeholder="Tìm kiếm nhanh tiêu đề..."
                        className="w-full pl-12 pr-5 py-3.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100/50 dark:border-slate-700/50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm font-bold shadow-soft dark:text-white"
                    />
                </div>
            </div>

            {/* Breadcrumbs Explorer */}
            <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl rounded-[28px] border border-white dark:border-slate-800/50 shadow-soft overflow-hidden">
                {!searchQuery.trim() && (
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800/60 bg-white/30 dark:bg-slate-900/30 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => setCurrentPath([])}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all",
                                currentPath.length === 0 ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                            )}
                        >
                            <Home className="h-3.5 w-3.5" /> GỐC
                        </button>
                        {currentPath.map((folder, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                                <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                                <button
                                    onClick={() => setCurrentPath(currentPath.slice(0, idx + 1))}
                                    className={cn(
                                        "px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap",
                                        idx === currentPath.length - 1 ? "bg-blue-500 text-white shadow-lg" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                                    )}
                                >
                                    {folder.toUpperCase()}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="p-6 min-h-[400px]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {/* Up-level button */}
                        {currentPath.length > 0 && !searchQuery.trim() && (
                            <button
                                onClick={() => setCurrentPath(currentPath.slice(0, -1))}
                                className="group flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                            >
                                <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 transition-transform group-hover:-translate-y-1">
                                    <ArrowUpLeft className="h-6 w-6" />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase">Trở lên</span>
                            </button>
                        )}

                        {/* Folders */}
                        {itemsAtLevel.folders.map((folderName) => (
                            <button
                                key={folderName}
                                onClick={() => setCurrentPath([...currentPath, folderName])}
                                className="group flex flex-col items-center gap-3 p-4 rounded-3xl hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700 hover:shadow-xl group"
                            >
                                <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 transition-all group-hover:scale-110 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40">
                                    <Folder className="h-9 w-9 fill-current" />
                                </div>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-200 line-clamp-2 text-center leading-tight">
                                    {folderName}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Exams Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 mt-6 border-t border-gray-100 dark:border-slate-800/60 pt-6">
                        {itemsAtLevel.exams.map((exam) => {
                            const totalQ = (exam.questionCount?.part1 || 0) + (exam.questionCount?.part2 || 0) + (exam.questionCount?.part3 || 0);
                            const highScore = scores[exam.id]?.highestScore;
                            const style = getScoreStyle(highScore);
                            
                            return (
                                <button
                                    key={exam.id} onClick={() => navigate(`/practice/${exam.id}`)}
                                    className={cn(
                                        "group relative bg-white dark:bg-slate-900 rounded-[28px] p-5 border transition-all duration-500 text-left flex flex-col active:scale-[0.97] overflow-hidden hover:shadow-2xl hover:-translate-y-1.5",
                                        style.border
                                    )}
                                >
                                    <div className={cn("absolute inset-0 bg-gradient-to-br to-white/0 opacity-0 group-hover:opacity-10 dark:opacity-0 transition-opacity duration-500", style.glow)} />
                                    <div className="relative space-y-4">
                                        <div className="flex justify-between items-start gap-3">
                                            <h3 className="text-[13px] font-black text-slate-800 dark:text-white line-clamp-2 leading-tight pr-1 group-hover:text-blue-600 transition-colors tracking-tight">
                                                {exam.title}
                                                {exam.isSpecial && <span className="ml-2 inline-block px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[8px] font-black uppercase tracking-tighter align-middle">PRO</span>}
                                            </h3>
                                            {highScore !== undefined && !isNaN(highScore) && (
                                                <div className={cn("shrink-0 w-11 h-11 rounded-2xl flex flex-col items-center justify-center border transition-all group-hover:scale-110 duration-500", style.badge)}>
                                                    <span className="text-[15px] font-black tracking-tight">{highScore.toFixed(highScore === 10 ? 0 : 1)}</span>
                                                    <span className="text-[6.5px] font-black opacity-50 uppercase tracking-widest leading-none">SCORE</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] text-slate-500 font-bold border border-slate-100 dark:border-slate-700">
                                                <Clock className="h-3 w-3 text-blue-500" /> {exam.time}'
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] text-slate-500 font-bold border border-slate-100 dark:border-slate-700">
                                                <Book className="h-3 w-3 text-emerald-500" /> {totalQ} CH
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Empty State */}
                    {itemsAtLevel.folders.length === 0 && itemsAtLevel.exams.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                            <Book className="h-16 w-16 mb-4 opacity-10" />
                            <p className="text-sm font-black uppercase tracking-[0.2em]">Thư mục trống</p>
                            <p className="text-xs font-medium opacity-60 mt-1">Chưa có đề thi nào trong mục này</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
