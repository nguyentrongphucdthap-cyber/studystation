import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllEtestExams } from '@/services/etest.service';
import { Spinner } from '@/components/ui/Spinner';
import type { EtestExam } from '@/types';

export default function EtestHome() {
    const navigate = useNavigate();
    const [exams, setExams] = useState<EtestExam[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getAllEtestExams()
            .then((data) => {
                setExams(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('[Etest] Fetch error:', err);
                setError('Không thể tải bài E-test. Vui lòng kiểm tra quyền truy cập hoặc kết nối mạng.');
                setLoading(false);
            });
    }, []);

    const filtered = search.trim()
        ? exams.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
        : exams;

    const tagColors: Record<string, string> = {
        'THPT QG': 'bg-blue-100 text-blue-700',
        'ĐGNL': 'bg-purple-100 text-purple-700',
        'default': 'bg-gray-100 text-gray-600',
    };

    if (loading) {
        return <div className="flex items-center justify-center py-20"><Spinner size="lg" label="Đang tải..." /></div>;
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Quay lại Menu
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header section */}
            <div className="bg-white/70 backdrop-blur-xl rounded-[32px] p-8 md:p-10 shadow-soft border border-white flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">E-test Reading</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm md:text-lg font-medium opacity-90">
                        Bài đọc hiểu tiếng Anh theo form chuẩn THPT QG.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-black rounded-full border border-emerald-100 dark:border-emerald-500/20 uppercase tracking-wider">
                            {exams.length} Bài thi hiện có
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/')}
                    className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-soft hover:shadow-medium active:scale-95 shrink-0 self-start md:self-center border border-gray-100 dark:border-gray-700"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Quay lại
                </button>
            </div>

            {/* Search & Actions */}
            <div className="relative group max-w-xl mx-auto">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm kiếm tiêu đề bài đọc..."
                    className="w-full pl-14 pr-6 py-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-[24px] border border-white dark:border-gray-700 shadow-soft focus:shadow-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-200 dark:focus:border-blue-500 transition-all text-base font-medium outline-none text-gray-900 dark:text-gray-100"
                />
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 bg-white/50 rounded-[32px] border border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold uppercase tracking-widest">Không tìm thấy bài đọc nào</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filtered.map((exam) => (
                        <button
                            key={exam.id}
                            onClick={() => navigate(`/etest/${exam.id}`)}
                            className="bg-white/80 backdrop-blur-md p-6 rounded-[28px] border border-white shadow-soft hover:shadow-heavy hover:-translate-y-1 transition-all duration-500 text-left group flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <h3 className="text-lg font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors tracking-tight leading-snug">
                                        {exam.title}
                                    </h3>
                                    <span className={`shrink-0 rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-widest ${tagColors[exam.tag || ''] || tagColors.default} shadow-sm border border-black/5`}>
                                        {exam.tag || 'Practice'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-[12px] text-gray-500 font-bold uppercase tracking-wider opacity-70">
                                    <span>{exam.sections?.length || 0} PASSAGE(S)</span>
                                    <span>{exam.time} MIN</span>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center text-[13px] font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                                Bắt đầu làm bài
                                <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
