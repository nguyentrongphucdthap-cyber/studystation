import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllEtestExams } from '@/services/etest.service';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import type { EtestExam } from '@/types';
import { FileText, Clock, Search, BookOpen } from 'lucide-react';

export default function EtestHome() {
    const navigate = useNavigate();
    const [exams, setExams] = useState<EtestExam[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        getAllEtestExams().then((data) => {
            setExams(data);
            setLoading(false);
        });
    }, []);

    const filtered = search.trim()
        ? exams.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
        : exams;

    const tagColors: Record<string, string> = {
        'THPT QG': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'ĐGNL': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        'default': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    };

    if (loading) {
        return <div className="flex items-center justify-center py-20"><Spinner size="lg" label="Đang tải..." /></div>;
    }

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="h-6 w-6 text-emerald-600" /> E-test
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Bài đọc hiểu tiếng Anh · {exams.length} bài</p>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm kiếm bài đọc..."
                    className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
            </div>

            {filtered.length === 0 ? (
                <div className="py-16 text-center">
                    <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                    <p className="text-muted-foreground">Không tìm thấy bài đọc nào</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((exam) => (
                        <button
                            key={exam.id}
                            onClick={() => navigate(`/etest/${exam.id}`)}
                            className="group flex flex-col rounded-xl border border-border/50 bg-card p-4 text-left transition-all hover:border-emerald-300 hover:shadow-lg active:scale-[0.99]"
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <span className={cn(
                                    'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase',
                                    tagColors[exam.tag || ''] || tagColors.default
                                )}>
                                    {exam.tag || 'Practice'}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" /> {exam.time} min
                                </span>
                            </div>
                            <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-emerald-600 transition-colors">
                                {exam.title}
                            </h3>
                            <p className="mt-auto pt-2 text-[11px] text-muted-foreground">
                                {exam.sections?.length || 0} passage(s) · {exam.sections?.reduce((s, sec) => s + (sec.questions?.length || 0), 0) || 0} questions
                            </p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
