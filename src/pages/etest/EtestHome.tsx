import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllEtestExams } from '@/services/etest.service';
import { logUserActivity } from '@/services/auth.service';
import { Spinner } from '@/components/ui/Spinner';
import type { EtestExam } from '@/types';
import { 
    FileText, ArrowLeft, Search, Folder, ChevronRight, Home, 
    ArrowUpLeft, Clock, Layers 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as folderUtils from '@/lib/folderUtils';

export default function EtestHome() {
    const navigate = useNavigate();
    const [exams, setExams] = useState<EtestExam[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState<string[]>([]);

    useEffect(() => {
        getAllEtestExams()
            .then((data) => {
                setExams(data);
                logUserActivity('EtestHome', 'Xem danh sách đề E-test', {
                    eventType: 'view',
                    status: 'success',
                    metadata: { totalEtests: data.length },
                });
                setLoading(false);
            })
            .catch((err) => {
                console.error('[Etest] Fetch error:', err);
                setError('Không thể tải bài E-test. Vui lòng kiểm tra quyền truy cập hoặc kết nối mạng.');
                setLoading(false);
            });
    }, []);

    const currentFullPath = useMemo(() => currentPath.join('/'), [currentPath]);

    const itemsAtLevel = useMemo(() => {
        if (search.trim()) {
            const q = search.toLowerCase();
            return {
                folders: [],
                exams: exams.filter(e => e.title.toLowerCase().includes(q))
            };
        }

        const allPaths = Array.from(new Set(exams.map(e => (e.customFolder || '').trim()).filter(Boolean)));
        const folders = folderUtils.getSubFoldersAtLevel(allPaths, currentFullPath);
        const examsAtThisLevel = exams.filter(e => (e.customFolder || '') === currentFullPath);

        return { folders, exams: examsAtThisLevel };
    }, [exams, currentFullPath, search]);

    if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" label="Đang tải..." /></div>;

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

    const tagColors: Record<string, string> = {
        'THPT QG': 'bg-blue-600 text-white',
        'ĐGNL': 'bg-purple-600 text-white',
        'default': 'bg-slate-600 text-white',
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-12">
            {/* Header section */}
            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl rounded-[32px] p-8 md:p-10 shadow-soft border border-white dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                     <div className="flex items-center gap-3 mb-4">
                        <span className="bg-blue-600 p-2 rounded-xl text-white">
                            <FileText className="h-6 w-6" />
                        </span>
                        <span className="text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                            E-test Collection
                        </span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">E-test Reading</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-4 text-sm md:text-lg font-medium opacity-90 max-w-xl">
                        Bộ sưu tập các bài đọc hiểu tiếng Anh theo form chuẩn THPT QG và Đề minh họa của Bộ giáo dục. 
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 shrink-0 self-start md:self-center">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center justify-center min-w-[100px]">
                        <span className="text-2xl font-black text-blue-600">{exams.length}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Bài đọc</span>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 px-6 py-4 rounded-[20px] font-bold text-sm shadow-soft transition-all flex items-center gap-2 border border-gray-100 dark:border-gray-700 active:scale-95"
                    >
                        <ArrowLeft className="h-5 w-5" /> Quay lại
                    </button>
                </div>
            </div>

            {/* Explorer Toolbar / Search Area */}
            <div className="bg-white/40 dark:bg-slate-900/40 p-3 rounded-[32px] border border-gray-100/50 dark:border-slate-800/50 backdrop-blur-md shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="relative w-full md:max-w-xl">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tìm kiếm nhanh tiêu đề bài đọc..."
                        className="w-full pl-12 pr-6 py-4 bg-white/80 dark:bg-slate-800/80 border-none rounded-[22px] shadow-inner text-sm font-bold focus:ring-2 focus:ring-blue-500/50 outline-none dark:text-white"
                    />
                </div>
            </div>

            {/* Hierarchical Explorer */}
            <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl rounded-[32px] border border-white dark:border-slate-800/50 shadow-soft overflow-hidden min-h-[500px]">
                {!search.trim() && (
                    <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800/60 bg-white/30 dark:bg-slate-900/30 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => setCurrentPath([])}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all",
                                currentPath.length === 0 ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                            )}
                        >
                            <Home className="h-4 w-4" /> TRANG CHỦ
                        </button>
                        {currentPath.map((folder, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                                <ChevronRight className="h-4 w-4 text-gray-300" />
                                <button
                                    onClick={() => setCurrentPath(currentPath.slice(0, idx + 1))}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap",
                                        idx === currentPath.length - 1 ? "bg-blue-500 text-white shadow-lg" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                                    )}
                                >
                                    {folder.toUpperCase()}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="p-8">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {/* Up-level button */}
                        {currentPath.length > 0 && !search.trim() && (
                            <button
                                onClick={() => setCurrentPath(currentPath.slice(0, -1))}
                                className="group flex flex-col items-center gap-3 p-4 rounded-3xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                            >
                                <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 transition-transform group-hover:-translate-y-1 shadow-sm">
                                    <ArrowUpLeft className="h-7 w-7" />
                                </div>
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Trở lên</span>
                            </button>
                        )}

                        {/* Folders */}
                        {itemsAtLevel.folders.map((folderName) => (
                            <button
                                key={folderName}
                                onClick={() => setCurrentPath([...currentPath, folderName])}
                                className="group flex flex-col items-center gap-4 p-5 rounded-[32px] hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700 hover:shadow-xl active:scale-95"
                            >
                                <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 transition-all group-hover:scale-110 group-hover:bg-amber-100/50">
                                    <Folder className="h-11 w-11 fill-current" />
                                </div>
                                <span className="text-[13px] font-black text-slate-700 dark:text-slate-200 line-clamp-2 text-center leading-tight px-1">
                                    {folderName}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Exams List (Grid layout for student view) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10 pt-10 border-t border-gray-100 dark:border-slate-800/60">
                        {itemsAtLevel.exams.map((exam) => (
                            <button
                                key={exam.id}
                                onClick={() => navigate(`/etest/${exam.id}`)}
                                className="bg-white dark:bg-slate-900/60 backdrop-blur-md p-6 rounded-[32px] border border-gray-100/80 dark:border-slate-800 shadow-soft hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 text-left group flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <h3 className="text-[17px] font-black text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors tracking-tight leading-tight line-clamp-2">
                                            {exam.title}
                                        </h3>
                                        <span className={cn(
                                            "shrink-0 rounded-xl px-2.5 py-1 text-[9px] font-black uppercase tracking-widest shadow-sm border border-black/5",
                                            tagColors[exam.tag || ''] || tagColors.default
                                        )}>
                                            {exam.tag || 'StudyStation'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                        <div className="flex items-center gap-1.5">
                                            <Layers className="h-3.5 w-3.5 text-emerald-500" />
                                            <span>{exam.sections?.length || 0} Passages</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5 text-blue-500" />
                                            <span>{exam.time} Mins</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 flex items-center justify-between">
                                    <div className="text-[13px] font-black text-blue-600 group-hover:translate-x-1 transition-transform inline-flex items-center">
                                        VÀO LÀM BÀI
                                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Empty State */}
                    {itemsAtLevel.folders.length === 0 && itemsAtLevel.exams.length === 0 && (
                        <div className="py-24 text-center">
                            <FileText className="h-20 w-20 text-gray-200 dark:text-slate-800 mx-auto mb-6 opacity-50" />
                            <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-sm">Thư mục hiện tại đang trống</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
