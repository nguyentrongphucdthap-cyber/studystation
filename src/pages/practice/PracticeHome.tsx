import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAllExams, getSubjects, getHighestScores } from '@/services/exam.service';
import { Spinner } from '@/components/ui/Spinner';
import type { ExamMetadata, HighestScores } from '@/types';

export default function PracticeHome() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [exams, setExams] = useState<ExamMetadata[]>([]);
    const [scores, setScores] = useState<HighestScores>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner size="lg" label="Đang tải danh sách đề..." />
            </div>
        );
    }

    // If no subject selected, show subject selection (like original)
    if (!activeSubject) {
        return (
            <div>
                {/* Back to Menu */}
                <BackButton onClick={() => navigate('/')} label="Quay lại Menu" />

                <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">Chọn môn học</h2>

                <div className="grid grid-cols-2 gap-6">
                    {subjects.map((sub) => {
                        const count = exams.filter((e) => e.subjectId === sub.id).length;
                        return (
                            <button
                                key={sub.id}
                                onClick={() => setSearchParams({ subject: sub.id })}
                                className={`subject-card p-6 text-white rounded-xl cursor-pointer text-left ${sub.gradient || 'bg-gradient-to-br from-blue-500 to-blue-600'}`}
                            >
                                <h3 className="text-xl md:text-2xl font-semibold mb-2">{sub.name}</h3>
                                <p className="font-light text-sm opacity-90">{count} đề thi</p>
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
        <div>
            {/* Back to subjects */}
            <BackButton onClick={() => setSearchParams({})} label="Quay lại chọn môn" />

            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6">
                {currentSubject?.name || activeSubject}
            </h2>

            {/* Search */}
            <div className="mb-6">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm đề thi..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-sm"
                />
            </div>

            {/* Exam list */}
            {filteredExams.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Không tìm thấy đề thi nào.</p>
                </div>
            ) : (
                <ul className="space-y-4">
                    {filteredExams.map((exam) => {
                        const totalQ = (exam.questionCount?.part1 || 0) +
                            (exam.questionCount?.part2 || 0) +
                            (exam.questionCount?.part3 || 0);
                        const highScore = scores[exam.id];

                        return (
                            <li key={exam.id}>
                                <button
                                    onClick={() => navigate(`/practice/${exam.id}`)}
                                    className="w-full text-left p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                                                {exam.title}
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {totalQ} câu · {exam.time} phút · {exam.attemptCount || 0} lượt thi
                                            </p>
                                        </div>
                                        {highScore && (
                                            <div className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                                🏆 {highScore.highestScore.toFixed(1)}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

// Shared back button component (matches original design)
function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors duration-300 mb-6 group"
        >
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">{label}</span>
        </button>
    );
}
