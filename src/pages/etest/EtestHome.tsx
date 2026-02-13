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
        <div>
            {/* Back button */}
            <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors duration-300 mb-6 group"
            >
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-medium">Quay lại Menu</span>
            </button>

            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">E-test</h2>
            <p className="text-gray-500 mb-6">Bài đọc hiểu tiếng Anh · {exams.length} bài</p>

            {/* Search */}
            <div className="mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm kiếm bài đọc..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-sm"
                />
            </div>

            {/* Exam list */}
            {filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Không tìm thấy bài đọc nào.</p>
                </div>
            ) : (
                <ul className="space-y-4">
                    {filtered.map((exam) => (
                        <li key={exam.id}>
                            <button
                                onClick={() => navigate(`/etest/${exam.id}`)}
                                className="w-full text-left p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-base font-semibold text-gray-800 group-hover:text-emerald-600 transition-colors">
                                        {exam.title}
                                    </h3>
                                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${tagColors[exam.tag || ''] || tagColors.default}`}>
                                        {exam.tag || 'Practice'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500">
                                    {exam.sections?.length || 0} passage(s) · {exam.sections?.reduce((s, sec) => s + (sec.questions?.length || 0), 0) || 0} questions · {exam.time} min
                                </p>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
