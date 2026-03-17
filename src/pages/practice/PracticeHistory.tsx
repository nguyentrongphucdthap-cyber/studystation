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
    const [chartLimit, setChartLimit] = useState(10);
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
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <Trophy className="h-4 w-4 text-amber-500" />
                                    Biến thiên điểm số
                                </h3>
                                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                                    {[10, 20, 30].map(num => (
                                        <button
                                            key={num}
                                            onClick={() => setChartLimit(num)}
                                            className={cn(
                                                "px-3 py-1 text-[10px] font-black rounded-lg transition-all",
                                                chartLimit === num ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                            )}
                                        >
                                            {num} LẦN
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="h-48 w-full relative">
                                {(() => {
                                    const recentN = history.slice(0, chartLimit).reverse();
                                    const maxScore = 10;
                                    const width = 800; // base width for coordinate system
                                    const height = 180;
                                    const padding = 30;
                                    const chartWidth = width - padding * 2;
                                    const chartHeight = height - padding * 2;
                                    const stepX = chartWidth / (Math.max(recentN.length - 1, 1));

                                    if (recentN.length < 2) {
                                        return (
                                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                                                Cần thực hiện ít nhất 2 bài thi để hiển thị biểu đồ xu hướng
                                            </div>
                                        );
                                    }

                                    const points = recentN.map((log, i) => {
                                        const x = padding + i * stepX;
                                        const y = padding + (chartHeight - (log.score / maxScore) * chartHeight);
                                        return { x, y, score: log.score, title: log.examTitle };
                                    });

                                    // Simple path: Straight lines for logic, we can add curves later if path logic is stable.
                                    const pathD = points.length > 0 ? `M ${points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')}` : '';
                                    const areaD = points.length > 0 ? `${pathD} L ${points[points.length-1].x.toFixed(2)},${height} L ${points[0].x.toFixed(2)},${height} Z` : '';

                                    return (
                                        <svg className="w-full h-full overflow-visible drop-shadow-sm" viewBox={`0 0 ${width} ${height + 20}`}>
                                            <defs>
                                                <linearGradient id="scoreArea" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                                </linearGradient>
                                                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                                                    <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                                                    <feOffset dx="0" dy="4" result="offsetblur" />
                                                    <feComponentTransfer>
                                                        <feFuncA type="linear" slope="0.2" />
                                                    </feComponentTransfer>
                                                    <feMerge>
                                                        <feMergeNode />
                                                        <feMergeNode in="SourceGraphic" />
                                                    </feMerge>
                                                </filter>
                                            </defs>
                                            
                                            {/* Reference lines */}
                                            {[0, 2.5, 5, 7.5, 10].map(val => {
                                                const y = padding + (chartHeight - (val / 10) * chartHeight);
                                                return (
                                                    <g key={val}>
                                                        <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                                                        <text x={padding - 10} y={y + 3} textAnchor="end" className="text-[10px] fill-slate-300 font-bold">{val}</text>
                                                    </g>
                                                );
                                            })}

                                            <path d={areaD} fill="url(#scoreArea)" />
                                            <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#shadow)" />
                                            
                                            {points.map((p, i) => (
                                                <g key={i} className="group/point">
                                                    <circle 
                                                        cx={p.x} cy={p.y} r="6" 
                                                        className="fill-white stroke-blue-600 stroke-[3] transition-all duration-300 group-hover/point:r-8 group-hover/point:stroke-emerald-500 cursor-pointer shadow-lg"
                                                    />
                                                    
                                                    {/* Floating Label */}
                                                    <g className="opacity-0 group-hover/point:opacity-100 transition-opacity pointer-events-none">
                                                        <rect 
                                                            x={p.x - 20} y={p.y - 35} width="40" height="22" rx="6" 
                                                            className="fill-slate-900 shadow-xl"
                                                        />
                                                        <text 
                                                            x={p.x} y={p.y - 20} textAnchor="middle" 
                                                            className="text-[12px] font-black fill-white"
                                                        >
                                                            {p.score.toFixed(1)}
                                                        </text>
                                                    </g>
                                                    
                                                    {/* Hover area */}
                                                    <rect 
                                                        x={p.x - stepX/2} y={0} width={stepX} height={height} 
                                                        fill="transparent" className="cursor-pointer"
                                                    />
                                                </g>
                                            ))}
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
