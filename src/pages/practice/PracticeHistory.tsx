import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserTotalHistory, getSubjects } from '@/services/exam.service';
import { Spinner } from '@/components/ui/Spinner';
import type { PracticeHistory } from '@/types';
import { ArrowLeft, Clock, Trophy, Calendar, ChevronRight, BookOpen } from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';

export default function PracticeHistoryPage() {
    const navigate = useNavigate();
    const [history, setHistory] = useState<PracticeHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const subjects = getSubjects();

    useEffect(() => {
        async function load() {
            try {
                const data = await getUserTotalHistory();
                setHistory(data);
            } catch (err) {
                console.error('[History] Load error:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner size="lg" label="Đang tải lịch sử..." />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl p-6 rounded-[28px] border border-white shadow-soft">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/practice')}
                        className="p-3 hover:bg-gray-100 rounded-2xl text-gray-500 transition-all active:scale-90 bg-gray-50/50"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Lịch sử làm bài</h2>
                        <p className="text-[11px] text-gray-400 uppercase tracking-[0.15em] font-bold mt-1">
                            {history.length} LẦN LUYỆN TẬP GẦN NHẤT
                        </p>
                    </div>
                </div>
            </div>

            {history.length === 0 ? (
                <div className="bg-white rounded-3xl p-20 text-center border border-gray-100 shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="h-8 w-8 text-gray-200" />
                    </div>
                    <p className="text-gray-400 font-medium">Bạn chưa thực hiện bài luyện tập nào.</p>
                    <button
                        onClick={() => navigate('/practice')}
                        className="mt-4 text-blue-600 font-bold hover:underline"
                    >
                        Bắt đầu luyện tập ngay
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Biểu đồ điểm số 10 lần gần nhất */}
                    {history.length > 0 && (
                        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[28px] border border-white shadow-sm overflow-hidden relative group">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-6">
                                <Trophy className="h-4 w-4 text-amber-500" />
                                Biến thiên điểm số ({Math.min(history.length, 10)} lần gần nhất)
                            </h3>
                            <div className="h-32 w-full relative">
                                {(() => {
                                    const recent10 = history.slice(0, 10).reverse();
                                    const maxScore = 10;
                                    const width = 400;
                                    const height = 100;
                                    const stepX = width / (recent10.length - 1);
                                    if (recent10.length < 2) {
                                        return (
                                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-400">
                                                Cần làm ít nhất 2 bài để xem biểu đồ
                                            </div>
                                        );
                                    }

                                    const points = recent10.map((log, i) => {
                                        const x = i * stepX;
                                        // y is inverted (0 at top, 100 at bottom)
                                        const y = height - (log.score / maxScore) * height;
                                        return { x, y, score: log.score, title: log.examTitle };
                                    });

                                    const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
                                    // create a smooth area under the line
                                    const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

                                    return (
                                        <svg className="w-full h-full overflow-visible" viewBox={`0 -20 ${width} ${height + 40}`}>
                                            <defs>
                                                <linearGradient id="scoreArea" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                                </linearGradient>
                                                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                                                    <stop offset="0%" stopColor="#60a5fa" />
                                                    <stop offset="50%" stopColor="#3b82f6" />
                                                    <stop offset="100%" stopColor="#2563eb" />
                                                </linearGradient>
                                            </defs>
                                            <path d={areaD} fill="url(#scoreArea)" />
                                            <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                            
                                            {points.map((p, i) => (
                                                <g key={i} className="group/point">
                                                    {/* Data point circle */}
                                                    <circle 
                                                        cx={p.x} cy={p.y} r="5" 
                                                        className="fill-white stroke-blue-500 stroke-[3] transition-all duration-300 group-hover/point:r-6 group-hover/point:stroke-emerald-500 cursor-pointer"
                                                    />
                                                    
                                                    {/* Tooltip / Label */}
                                                    <text
                                                        x={p.x}
                                                        y={p.y - 12}
                                                        textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                                                        className="text-[12px] font-black fill-gray-500 transition-all opacity-0 group-hover:opacity-100 group-hover/point:fill-emerald-600 group-hover/point:-translate-y-1 group-hover/point:text-[14px]"
                                                    >
                                                        {p.score.toFixed(1)}
                                                    </text>
                                                    
                                                    {/* Vertical invisible hover area to make it easier to hit */}
                                                    <rect 
                                                        x={p.x - stepX/2} 
                                                        y={-20} 
                                                        width={stepX} 
                                                        height={height + 40} 
                                                        fill="transparent"
                                                        className="cursor-pointer"
                                                    />
                                                </g>
                                            ))}
                                            
                                            {/* Baseline */}
                                            <line x1="0" y1={height} x2={width} y2={height} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
                                        </svg>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    <div className="grid gap-4">
                        {history.map((log) => {
                        const subject = subjects.find(s => s.id === log.subjectId);
                        const date = new Date(log.timestamp).toLocaleDateString('vi-VN', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        });

                        return (
                            <div
                                key={log.id}
                                className="group bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-white/60 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="hidden sm:flex w-12 h-12 rounded-xl bg-gray-50 items-center justify-center text-2xl shadow-inner shrink-0">
                                        {subject?.icon || '📝'}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                                            {log.examTitle}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {date}</span>
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(log.durationSeconds)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0">
                                    <div className="text-center sm:text-right">
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-0.5">Kết quả</p>
                                        <div className={cn(
                                            "flex items-center gap-1.5 font-black text-lg",
                                            log.score >= 8 ? "text-emerald-600" : log.score >= 5 ? "text-amber-600" : "text-red-600"
                                        )}>
                                            <Trophy className="h-4 w-4" /> {log.score.toFixed(1)}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/practice/${log.examId}`)}
                                        className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-all text-gray-300"
                                        title="Làm lại đề này"
                                    >
                                        <ChevronRight className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>
            )}
        </div>
    );
}
