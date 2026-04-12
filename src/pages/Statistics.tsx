import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserTotalHistory, getSubjects } from '@/services/exam.service';
import { getUserVocabSessions, getUserActivityForStats, type VocabSession, type ActivityLog } from '@/services/vocab-stats.service.ts';
import { Spinner } from '@/components/ui/Spinner';
import { 
    BarChart3, 
    Trophy, 
    Clock, 
    Target, 
    ArrowLeft, 
    TrendingUp, 
    Award,
    ChevronRight,
    BookOpen,
    Filter,
    Layout,
    Zap,
    History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PracticeHistory } from '@/types';

export default function StatisticsPage() {
    const navigate = useNavigate();
    const [history, setHistory] = useState<PracticeHistory[]>([]);
    const [vocabSessions, setVocabSessions] = useState<VocabSession[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('day');
    
    const subjects = getSubjects();

    useEffect(() => {
        async function load() {
            try {
                const [examData, vocabData, activityData] = await Promise.all([
                    getUserTotalHistory(),
                    getUserVocabSessions(),
                    getUserActivityForStats()
                ]);
                setHistory(examData);
                setVocabSessions(vocabData);
                setActivityLogs(activityData);
            } catch (err) {
                console.error('[Statistics] Load error:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // --- Data Processing ---

    const filteredHistory = useMemo(() => {
        if (selectedSubject === 'all') return history;
        return history.filter(h => h.subjectId === selectedSubject);
    }, [history, selectedSubject]);

    const stats = useMemo(() => {
        if (history.length === 0) return { totalExams: 0, avgScore: 0, totalSeconds: 0 };
        
        const totalExams = history.length;
        const sumScore = history.reduce((acc, curr) => acc + curr.score, 0);
        const totalSeconds = history.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
        
        return {
            totalExams,
            avgScore: sumScore / totalExams,
            totalSeconds
        };
    }, [history]);

    const evaluation = useMemo(() => {
        const score = stats.avgScore;
        if (history.length === 0) return { title: 'Chưa có dữ liệu', text: 'Hãy bắt đầu làm bài để xem đánh giá năng lực của bạn.', color: 'text-gray-400' };
        if (score >= 9) return { title: 'Xuất sắc', text: 'Bạn đang làm rất tốt! Hãy tiếp tục duy trì phong độ này.', color: 'text-emerald-500' };
        if (score >= 8) return { title: 'Giỏi', text: 'Kiến thức của bạn rất vững chắc. Một chút nỗ lực nữa sẽ đạt mức tuyệt vời.', color: 'text-blue-500' };
        if (score >= 6.5) return { title: 'Khá', text: 'Bạn có nền tảng tốt nhưng cần cẩn thận hơn trong các câu hỏi nâng cao.', color: 'text-indigo-500' };
        if (score >= 5) return { title: 'Trung bình', text: 'Bạn cần ôn tập thêm các kiến thức cơ bản để cải thiện điểm số.', color: 'text-amber-500' };
        return { title: 'Cần cố gắng', text: 'Đừng nản lòng! Hãy dành nhiều thời gian hơn cho các bài giảng và luyện tập cơ bản.', color: 'text-rose-500' };
    }, [stats, history]);

    // Enhanced productivity data (last 7 days/weeks/months)
    const productivityData = useMemo(() => {
        const now = new Date();
        const data: { label: string, time: number, count: number, avg: number }[] = [];
        
        if (timeRange === 'day') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                
                const dayLogs = history.filter(h => {
                    const hDate = new Date(h.timestamp);
                    return hDate.getDate() === d.getDate() && hDate.getMonth() === d.getMonth() && hDate.getFullYear() === d.getFullYear();
                });
                
                const daySeconds = dayLogs.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
                const dayCount = dayLogs.length;
                const dayAvg = dayCount > 0 ? (daySeconds / 60) / dayCount : 0;
                
                data.push({ label: dateStr, time: Math.round(daySeconds / 60), count: dayCount, avg: parseFloat(dayAvg.toFixed(1)) });
            }
        } else if (timeRange === 'week') {
            for (let i = 3; i >= 0; i--) {
                const start = new Date();
                start.setDate(now.getDate() - (i + 1) * 7);
                const end = new Date();
                end.setDate(now.getDate() - i * 7);
                
                const weekLogs = history.filter(h => {
                    const hDate = new Date(h.timestamp);
                    return hDate >= start && hDate < end;
                });
                
                const weekSeconds = weekLogs.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
                const weekCount = weekLogs.length;
                const weekAvg = weekCount > 0 ? (weekSeconds / 60) / weekCount : 0;
                
                data.push({ label: `T${4-i}`, time: Math.round(weekSeconds / 60), count: weekCount, avg: parseFloat(weekAvg.toFixed(1)) });
            }
        } else {
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(now.getMonth() - i);
                const monthStr = d.toLocaleDateString('vi-VN', { month: 'short' });
                
                const monthLogs = history.filter(h => {
                    const hDate = new Date(h.timestamp);
                    return hDate.getMonth() === d.getMonth() && hDate.getFullYear() === d.getFullYear();
                });
                
                const monthSeconds = monthLogs.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
                const monthCount = monthLogs.length;
                const monthAvg = monthCount > 0 ? (monthSeconds / 60) / monthCount : 0;
                
                data.push({ label: monthStr, time: Math.round(monthSeconds / 60), count: monthCount, avg: parseFloat(monthAvg.toFixed(1)) });
            }
        }
        return data;
    }, [history, timeRange]);

    // Subject performance comparison
    const subjectComparisonData = useMemo(() => {
        return subjects.map(s => {
            const subjectLogs = history.filter(h => h.subjectId === s.id);
            const avg = subjectLogs.length > 0 
                ? subjectLogs.reduce((acc, curr) => acc + curr.score, 0) / subjectLogs.length
                : 0;
            return { name: s.name, color: s.color, avg, count: subjectLogs.length };
        }).filter(s => s.count > 0).sort((a, b) => b.avg - a.avg);
    }, [history, subjects]);

    // --- Vocab Data Processing ---

    const vocabStats = useMemo(() => {
        // Total from localStorage (legacy + current) - Approximate
        let totalLearnedEver = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('vocab_learned_')) {
                try {
                    const ids = JSON.parse(localStorage.getItem(key) || '[]');
                    totalLearnedEver += Array.isArray(ids) ? ids.length : 0;
                } catch(e) {}
            }
        }

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        const startOfMonth = now.getTime() - (30 * 24 * 60 * 60 * 1000);

        const todaySessions = vocabSessions.filter(s => new Date(s.timestamp).getTime() >= startOfDay);
        const weekSessions = vocabSessions.filter(s => new Date(s.timestamp).getTime() >= startOfWeek);
        const monthSessions = vocabSessions.filter(s => new Date(s.timestamp).getTime() >= startOfMonth);

        const totalWordsToday = todaySessions.reduce((acc, s) => acc + s.wordsStudied, 0);
        const totalWordsWeek = weekSessions.reduce((acc, s) => acc + s.wordsStudied, 0);
        const totalWordsMonth = monthSessions.reduce((acc, s) => acc + s.wordsStudied, 0);

        const avgWordsPerSession = vocabSessions.length > 0
            ? vocabSessions.reduce((acc, s) => acc + s.wordsStudied, 0) / vocabSessions.length
            : 0;

        return {
            totalLearnedEver,
            today: totalWordsToday,
            week: totalWordsWeek,
            month: totalWordsMonth,
            avgPerSession: avgWordsPerSession
        };
    }, [vocabSessions]);

    const vocabTrendData = useMemo(() => {
        const now = new Date();
        const data: { label: string, count: number }[] = [];
        
        if (timeRange === 'day') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                
                const dayWords = vocabSessions
                    .filter(s => {
                        const sDate = new Date(s.timestamp);
                        return sDate.getDate() === d.getDate() && sDate.getMonth() === d.getMonth() && sDate.getFullYear() === d.getFullYear();
                    })
                    .reduce((acc, s) => acc + s.wordsStudied, 0);
                
                data.push({ label: dateStr, count: dayWords });
            }
        } else if (timeRange === 'week') {
            for (let i = 3; i >= 0; i--) {
                const start = new Date();
                start.setDate(now.getDate() - (i + 1) * 7);
                const end = new Date();
                end.setDate(now.getDate() - i * 7);
                
                const weekWords = vocabSessions
                    .filter(s => {
                        const sDate = new Date(s.timestamp);
                        return sDate >= start && sDate < end;
                    })
                    .reduce((acc, s) => acc + s.wordsStudied, 0);
                
                data.push({ label: `T${4-i}`, count: weekWords });
            }
        } else {
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(now.getMonth() - i);
                const monthStr = d.toLocaleDateString('vi-VN', { month: 'short' });
                
                const monthWords = vocabSessions
                    .filter(s => {
                        const sDate = new Date(s.timestamp);
                        return sDate.getMonth() === d.getMonth() && sDate.getFullYear() === d.getFullYear();
                    })
                    .reduce((acc, s) => acc + s.wordsStudied, 0);
                
                data.push({ label: monthStr, count: monthWords });
            }
        }
        return data;
    }, [vocabSessions, timeRange]);

    // --- Activity & Habit Processing ---

    const hourlyActivityData = useMemo(() => {
        const hours = Array(24).fill(0);
        activityLogs.forEach(log => {
            const date = new Date(log.timestamp);
            const hour = date.getHours();
            hours[hour]++;
        });

        // Normalize for chart (0-100)
        const max = Math.max(...hours, 1);
        return hours.map((count, hour) => ({
            hour,
            count,
            percentage: (count / max) * 100,
            label: `${hour}h`
        }));
    }, [activityLogs]);

    const peakStudyHour = useMemo(() => {
        if (hourlyActivityData.every(d => d.count === 0)) return null;
        const peak = [...hourlyActivityData].sort((a, b) => b.count - a.count)[0];
        return peak ? peak.hour : null;
    }, [hourlyActivityData]);

    const recentActivityTimeline = useMemo(() => {
        return activityLogs.slice(0, 10);
    }, [activityLogs]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Spinner size="lg" />
                <p className="text-gray-400 font-medium animate-pulse">Đang phân tích dữ liệu học tập...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-3 bg-white/80 backdrop-blur-md hover:bg-white rounded-2xl text-gray-500 transition-all border border-white/50 shadow-soft active:scale-95"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-3xl font-black text-gray-900 tracking-tight">Thống kê học tập</h1>
                        <p className="text-gray-500 font-medium text-[10px] sm:text-sm mt-0.5">Tổng quan lộ trình học tập của bạn</p>
                    </div>
                </div>
                
                <div className="flex bg-white/60 backdrop-blur-xl p-1 sm:p-1.5 rounded-2xl border border-white/60 shadow-soft overflow-x-auto scrollbar-hide">
                    {['all', ...Array.from(new Set(history.map(h => h.subjectId)))].slice(0, 6).map(id => {
                        const s = subjects.find(sub => sub.id === id);
                        return (
                            <button
                                key={id}
                                onClick={() => setSelectedSubject(id)}
                                className={cn(
                                    "px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all whitespace-nowrap",
                                    selectedSubject === id 
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                                        : "text-gray-500 hover:bg-white/40"
                                )}
                            >
                                {id === 'all' ? 'Tất cả' : (s?.name || id)}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Top Stats & Evaluation */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Stats Cards */}
                <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                    <StatCard 
                        icon={<Trophy className="h-5 w-5 sm:h-6 sm:w-6" />}
                        label="Điểm trung bình"
                        value={stats.avgScore.toFixed(1)}
                        suffix="/10"
                        color="bg-amber-50 text-amber-600"
                        trend="+0.2"
                    />
                    <StatCard 
                        icon={<Clock className="h-5 w-5 sm:h-6 sm:w-6" />}
                        label="TG học trung bình"
                        value={Math.round(stats.totalSeconds / (stats.totalExams || 1) / 60)}
                        suffix="m/bài"
                        color="bg-blue-50 text-blue-600"
                    />
                    <StatCard 
                        icon={<Layout className="h-5 w-5 sm:h-6 sm:w-6" />}
                        label="Tổng số bài"
                        value={stats.totalExams}
                        suffix="đề"
                        color="bg-emerald-50 text-emerald-600"
                    />

                    {/* NEW Flashcard Stats */}
                    <StatCard 
                        icon={<BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />}
                        label="Từ vựng đã học"
                        value={vocabStats.totalLearnedEver}
                        suffix="từ"
                        color="bg-indigo-50 text-indigo-600"
                    />
                    <StatCard 
                        icon={<Zap className="h-5 w-5 sm:h-6 sm:w-6" />}
                        label="TB mỗi phiên"
                        value={Math.round(vocabStats.avgPerSession)}
                        suffix="từ"
                        color="bg-orange-50 text-orange-600"
                    />
                    <StatCard 
                        icon={<Target className="h-5 w-5 sm:h-6 sm:w-6" />}
                        label="Học tuần này"
                        value={vocabStats.week}
                        suffix="từ"
                        color="bg-pink-50 text-pink-600"
                    />
                </div>

                {/* Evaluation Card */}
                <div className="lg:col-span-4 bg-white/80 backdrop-blur-xl p-6 rounded-[32px] border border-white shadow-heavy flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                        <Award className="w-32 h-32" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Đánh giá năng lực</h3>
                        </div>
                        <h4 className={cn("text-2xl font-black mb-2", evaluation.color)}>{evaluation.title}</h4>
                        <p className="text-gray-600 text-sm leading-relaxed font-medium">{evaluation.text}</p>
                    </div>
                    <button className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-700 transition-all border border-gray-100">
                        Xem chi tiết lộ trình <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Score Trend (Line Chart) */}
                <div className="lg:col-span-12 bg-white/90 backdrop-blur-xl p-5 sm:p-8 rounded-[32px] sm:rounded-[40px] border border-white shadow-soft relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl">
                                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">Biến thiên điểm số</h3>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="h-2 w-2 rounded-full bg-indigo-500" />
                                <span className="text-[10px] font-bold text-gray-500">Điểm của bạn</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-48 sm:h-64 mt-4">
                        <ScoreTrendChart history={filteredHistory} />
                    </div>
                </div>

                {/* Productivity Section: Study Time & Exam Count */}
                <div className="lg:col-span-12 bg-white/90 backdrop-blur-xl p-8 rounded-[40px] border border-white shadow-soft">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Năng suất học tập</h3>
                                <p className="text-xs text-gray-400 font-medium">Theo dõi thời gian và số lượng bài làm</p>
                            </div>
                        </div>
                        <div className="flex bg-gray-100/80 p-1 rounded-xl">
                            {(['day', 'week', 'month'] as const).map(range => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={cn(
                                        "px-4 py-1.5 text-[10px] font-black rounded-lg transition-all",
                                        timeRange === range ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    {range === 'day' ? 'Ngày' : range === 'week' ? 'Tuần' : 'Tháng'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                        {/* Exam Count Variation (New Chart) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Biến thiên số bài</h4>
                                <span className="text-xs font-black text-indigo-600">Tổng: {productivityData.reduce((acc, d) => acc + d.count, 0)} bài</span>
                            </div>
                            <div className="h-60">
                                <CountBarChart data={productivityData} />
                            </div>
                        </div>

                        {/* Vocab Count Variation (NEW) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Biến thiên từ vựng</h4>
                                <span className="text-xs font-black text-orange-600">Tổng: {vocabTrendData.reduce((acc, d) => acc + d.count, 0)} từ</span>
                            </div>
                            <div className="h-60">
                                <CountBarChart data={vocabTrendData} color="#f97316" />
                            </div>
                        </div>

                        {/* Avg Time Trend (New Chart) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">TG học trung bình (phút/bài)</h4>
                                <span className="text-xs font-black text-emerald-600">T.Bình: {(productivityData.reduce((acc, d) => acc + d.avg, 0) / (productivityData.filter(d => d.avg > 0).length || 1)).toFixed(1)}m</span>
                            </div>
                            <div className="h-60">
                                <AvgTimeLineChart data={productivityData} />
                            </div>
                        </div>

                        {/* Study Habits - Hourly Access (NEW) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Thói quen truy cập</h4>
                                <span className="text-xs font-black text-indigo-600">
                                    {peakStudyHour !== null ? `Giờ cao điểm: ${peakStudyHour}h` : 'Chưa có dữ liệu'}
                                </span>
                            </div>
                            <div className="h-60">
                                <HabitChart data={hourlyActivityData} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Subject Distribution */}
                <div className="lg:col-span-5 bg-white/90 backdrop-blur-xl p-8 rounded-[40px] border border-white shadow-soft">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Phân bố môn học</h3>
                    </div>
                    <div className="space-y-5">
                        {subjectComparisonData.map((s, i) => (
                            <div key={i} className="group">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                        <span className="text-sm font-bold text-gray-700">{s.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{s.count} Bài</span>
                                        <span className="text-sm font-black text-gray-900">{s.avg.toFixed(1)}</span>
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100/50">
                                    <div 
                                        className="h-full rounded-full transition-all duration-1000 group-hover:brightness-110" 
                                        style={{ width: `${(s.avg / 10) * 100}%`, backgroundColor: s.color }}
                                    />
                                </div>
                            </div>
                        ))}
                        {subjectComparisonData.length === 0 && (
                            <div className="py-10 text-center">
                                <p className="text-gray-400 text-sm font-medium">Chưa có dữ liệu bài làm</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent History Table */}
            <div className="bg-white/95 backdrop-blur-xl rounded-[32px] sm:rounded-[40px] border border-white shadow-soft overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-gray-100/60 flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">Lịch sử làm bài gần đây</h3>
                    <button 
                        onClick={() => navigate('/practice/history')}
                        className="text-[10px] sm:text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                    >
                        Tất cả <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
                
                {/* Desktop view */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Môn học</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Đề thi</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Ngày làm</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none text-right">Điểm số</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {history.slice(0, 5).map((log) => {
                                const s = subjects.find(sub => sub.id === log.subjectId);
                                return (
                                    <tr key={log.id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white shadow-soft flex items-center justify-center text-lg border border-gray-100">
                                                    {s?.icon || '📝'}
                                                </div>
                                                <span className="text-sm font-bold text-gray-900">{s?.name || 'Khác'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-sm font-medium text-gray-600 line-clamp-1">{log.examTitle}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900">{new Date(log.timestamp).toLocaleDateString('vi-VN')}</span>
                                                <span className="text-[10px] font-medium text-gray-400">{new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className={cn(
                                                "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-black",
                                                log.score >= 8 ? "bg-emerald-50 text-emerald-600" : log.score >= 5 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                                            )}>
                                                {log.score.toFixed(1)}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile view */}
                <div className="md:hidden divide-y divide-gray-50">
                    {history.slice(0, 5).map((log) => {
                        const s = subjects.find(sub => sub.id === log.subjectId);
                        return (
                            <div key={log.id} className="p-5 flex items-center justify-between group active:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl shrink-0">
                                        {s?.icon || '📝'}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-bold text-gray-900 truncate pr-2">{log.examTitle}</h4>
                                        <p className="text-[10px] font-medium text-gray-400">
                                            {new Date(log.timestamp).toLocaleDateString('vi-VN')} • {new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <div className={cn(
                                    "px-3 py-1 rounded-lg text-xs font-black shrink-0",
                                    log.score >= 8 ? "bg-emerald-50 text-emerald-600" : log.score >= 5 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                                )}>
                                    {log.score.toFixed(1)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Access History Timeline (NEW) */}
            <div className="bg-white/95 backdrop-blur-xl rounded-[32px] sm:rounded-[40px] border border-white shadow-soft overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-gray-100/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gray-50 text-gray-600 rounded-2xl">
                            <History className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Lịch sử truy cập StudyStation</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Module</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Nội dung</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Ngày/Giờ</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Thiết bị</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {recentActivityTimeline.map((log) => (
                                <tr key={log.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider">
                                                {log.moduleName}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-sm font-medium text-gray-600 line-clamp-1">{log.moduleLabel || '-'}</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-900">{new Date(log.timestamp).toLocaleDateString('vi-VN')}</span>
                                            <span className="text-[10px] font-medium text-gray-400">{new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-xs font-bold text-gray-400 capitalize">{log.deviceType || 'Unknown'}</span>
                                    </td>
                                </tr>
                            ))}
                            {recentActivityTimeline.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-10 text-center text-gray-400 font-medium italic">
                                        Chưa có dữ liệu truy cập
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, suffix, color, trend }: { icon: any, label: string, value: string | number, suffix: string, color: string, trend?: string }) {
    return (
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[32px] border border-white shadow-soft hover:shadow-heavy transition-all group overflow-hidden relative">
            <div className="flex flex-col gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-soft", color)}>
                    {icon}
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-gray-900 tracking-tight">{value}</span>
                        <span className="text-xs font-bold text-gray-400">{suffix}</span>
                    </div>
                </div>
                {trend && (
                    <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-50 w-fit px-2 py-0.5 rounded-lg">
                        <TrendingUp className="h-3 w-3" /> {trend}
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Custom SVG Components ---

function ScoreTrendChart({ history }: { history: PracticeHistory[] }) {
    const data = useMemo(() => {
        return history.slice(0, 15).reverse();
    }, [history]);

    if (data.length < 2) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-[32px] border-2 border-dashed border-gray-100 p-8">
                <Filter className="h-10 w-10 mb-4 opacity-20" />
                <p className="text-sm font-bold">Cần hoàn thành ít nhất 2 bài thi để hiển thị xu hướng</p>
            </div>
        );
    }

    const width = 1000;
    const height = 400;
    const padding = 50;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const stepX = chartWidth / (data.length - 1);

    const points = data.map((d, i) => ({
        x: padding + i * stepX,
        y: padding + (chartHeight - (d.score / 10) * chartHeight)
    }));

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    
    if (!firstPoint || !lastPoint) return null;

    const pathD = `M ${firstPoint.x},${firstPoint.y} ` + points.slice(1).map(p => `L ${p.x},${p.y}`).join(' ');
    const areaD = `${pathD} L ${lastPoint.x},${height - padding} L ${padding},${height - padding} Z`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            {/* Grid lines */}
            {[0, 2.5, 5, 7.5, 10].map(val => {
                const y = padding + (chartHeight - (val / 10) * chartHeight);
                return (
                    <g key={val}>
                        <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="2" strokeDasharray="5,5" />
                        <text x={padding - 15} y={y + 5} textAnchor="end" className="text-[14px] fill-gray-400 font-black">{val}</text>
                    </g>
                );
            })}

            {/* Area under the curve */}
            <path d={areaD} fill="url(#areaGradient)" />

            {/* The line itself */}
            <path d={pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />

            {/* Points */}
            {points.map((p, i) => (
                <circle 
                    key={i} 
                    cx={p.x} 
                    cy={p.y} 
                    r="8" 
                    className="fill-white stroke-indigo-600 stroke-[4] hover:r-10 transition-all cursor-crosshair shadow-lg" 
                />
            ))}

            {/* X Axis Labels */}
            {data.map((d, i) => {
                if (data.length > 7 && i % 2 !== 0) return null;
                return (
                    <text 
                        key={i} 
                        x={padding + i * stepX} 
                        y={height - 15} 
                        textAnchor="middle" 
                        className="text-[12px] fill-gray-400 font-bold"
                    >
                        {new Date(d.timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </text>
                );
            })}
        </svg>
    );
}

function CountBarChart({ data, color = "#6366f1" }: { data: { label: string, count: number }[], color?: string }) {
    const maxValue = Math.max(...data.map(d => d.count), 5);
    const width = 800;
    const height = 300;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const barWidth = (chartWidth / data.length) * 0.6;
    const gap = (chartWidth / data.length) * 0.4;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            {/* Grid lines */}
            {[0, 0.5, 1].map(lvl => {
                const y = padding + chartHeight * (1 - lvl);
                return (
                    <line key={lvl} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                );
            })}

            {data.map((d, i) => {
                const barHeight = (d.count / maxValue) * chartHeight;
                const x = padding + i * (barWidth + gap);
                const y = height - padding - barHeight;

                return (
                    <g key={i} className="group cursor-pointer">
                        <rect 
                            x={x} 
                            y={y} 
                            width={barWidth} 
                            height={barHeight} 
                            rx="6" 
                            fill={color} 
                            className="opacity-80 group-hover:opacity-100 transition-all duration-300"
                        />
                        <text 
                            x={x + barWidth / 2} 
                            y={y - 10} 
                            textAnchor="middle" 
                            style={{ fill: color }}
                            className="text-[14px] font-black opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            {d.count}
                        </text>
                        <text 
                            x={x + barWidth / 2} 
                            y={height - 15} 
                            textAnchor="middle" 
                            className="text-[12px] font-bold fill-gray-400"
                        >
                            {d.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

function HabitChart({ data }: { data: { hour: number, count: number, percentage: number, label: string }[] }) {
    const width = 800;
    const height = 240;
    const padding = 30;
    const chartWidth = width - padding * 2;
    const barWidth = chartWidth / 24;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            {data.map((d, i) => {
                const barHeight = Math.max((d.percentage / 100) * (height - padding * 2), 4);
                const x = padding + i * barWidth;
                const y = height - padding - barHeight;

                return (
                    <g key={i} className="group cursor-pointer">
                        <rect 
                            x={x + 2} 
                            y={y} 
                            width={barWidth - 4} 
                            height={barHeight} 
                            rx="4" 
                            className={cn(
                                "transition-all duration-500",
                                d.count > 0 ? "fill-indigo-500 opacity-60 group-hover:opacity-100" : "fill-gray-100"
                            )}
                        />
                        {d.count > 0 && (
                            <text 
                                x={x + barWidth / 2} 
                                y={y - 8} 
                                textAnchor="middle" 
                                className="text-[10px] font-black fill-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                {d.count}
                            </text>
                        )}
                        {i % 4 === 0 && (
                            <text 
                                x={x + barWidth / 2} 
                                y={height - 10} 
                                textAnchor="middle" 
                                className="text-[10px] font-bold fill-gray-400"
                            >
                                {d.label}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

function AvgTimeLineChart({ data }: { data: { label: string, avg: number }[] }) {
    if (data.length === 0) return null;

    const maxValue = Math.max(...data.map(d => d.avg), 30);
    const width = 800;
    const height = 300;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;

    const points = data.map((d, i) => ({
        x: padding + i * stepX,
        y: padding + (chartHeight - (d.avg / maxValue) * chartHeight)
    }));

    const p0 = points[0];
    const pathD = (points.length > 1 && p0) 
        ? `M ${p0.x},${p0.y} ` + points.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')
        : (points.length === 1 && p0) 
            ? `M ${p0.x},${p0.y} L ${p0.x},${p0.y}`
            : '';

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            {/* Grid lines */}
            {[0, 0.5, 1].map(lvl => {
                const y = padding + chartHeight * (1 - lvl);
                return (
                    <line key={lvl} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                );
            })}

            {/* The line */}
            <path d={pathD} fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

            {/* Points & Labels */}
            {points.map((p, i) => {
                const d = data[i];
                if (!d) return null;
                return (
                    <g key={i} className="group">
                        <circle 
                            cx={p.x} 
                            cy={p.y} 
                            r="5" 
                            fill="white" 
                            stroke="#10b981" 
                            strokeWidth="3" 
                            className="group-hover:r-7 transition-all cursor-crosshair"
                        />
                        <text 
                            x={p.x} 
                            y={p.y - 15} 
                            textAnchor="middle" 
                            className="text-[12px] font-black fill-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            {d.avg}m
                        </text>
                        <text 
                            x={p.x} 
                            y={height - 15} 
                            textAnchor="middle" 
                            className="text-[12px] font-bold fill-gray-400"
                        >
                            {d.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
