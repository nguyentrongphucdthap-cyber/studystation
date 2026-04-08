import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { 
    AlarmClock,
    Calendar,
    Clock,
    CheckCircle2,
    Timer,
    Sparkles
} from 'lucide-react';
import { Dialog } from '../components/ui/Dialog';

const menuItems = [
    {
        label: 'Bài Thi',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
        iconBg: 'bg-red-100 text-red-500',
        path: '/practice',
    },
    {
        label: 'Thời Khóa Biểu',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
        iconBg: 'bg-indigo-100 text-indigo-500',
        path: '/schedule',
    },
    {
        label: 'Tài Liệu',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        ),
        iconBg: 'bg-yellow-100 text-yellow-600',
        path: '',
        soon: true,
    },
    {
        label: 'Flashcard',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
        ),
        iconBg: 'bg-yellow-100 text-yellow-600',
        path: '/vocab',
    },
    {
        label: 'E-test',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        iconBg: 'bg-blue-100 text-blue-500',
        badge: 'EN',
        path: '/etest',
    },
    {
        label: 'Mago A.I',
        icon: <Sparkles className="w-6 h-6" />,
        iconBg: 'bg-purple-100 text-purple-500',
        path: '/mago',
    },
];

interface ExamItem {
    id: number;
    subject: string;
    date: string; // DD/MM/YYYY
    time: string; // HH:mm
    timestamp: number;
}

const EXAM_SCHEDULE: ExamItem[] = [
    { id: 1, subject: 'Ngữ văn', date: '16/03/2026', time: '07:05', timestamp: new Date(2026, 2, 16, 7, 5).getTime() },
    { id: 2, subject: 'Vật lý', date: '16/03/2026', time: '08:45', timestamp: new Date(2026, 2, 16, 8, 45).getTime() },
    { id: 3, subject: 'Toán', date: '17/03/2026', time: '07:05', timestamp: new Date(2026, 2, 17, 7, 5).getTime() },
    { id: 4, subject: 'Lịch sử', date: '18/03/2026', time: '07:05', timestamp: new Date(2026, 2, 18, 7, 5).getTime() },
    { id: 5, subject: 'Hóa học', date: '18/03/2026', time: '08:00', timestamp: new Date(2026, 2, 18, 8, 0).getTime() },
    { id: 6, subject: 'Tiếng Anh', date: '19/03/2026', time: '07:05', timestamp: new Date(2026, 2, 19, 7, 5).getTime() },
    { id: 7, subject: 'Sinh học', date: '19/03/2026', time: '08:15', timestamp: new Date(2026, 2, 19, 8, 15).getTime() },
    { id: 8, subject: 'Tin học', date: '21/03/2026', time: '07:05', timestamp: new Date(2026, 2, 21, 7, 5).getTime() },
];

export default function Dashboard() {
    const navigate = useNavigate();

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Exam Schedule Widget */}
            <ExamScheduleWidget />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {menuItems.map((item) => (
                    <MenuCard key={item.label} item={item} onClick={() => item.path && navigate(item.path)} />
                ))}
            </div>

            {/* Designer Credit - Fixed to bottom-left corner of screen */}
            <div className="fixed bottom-4 left-4 z-[50] flex flex-col items-start gap-1 opacity-60 hover:opacity-100 transition-opacity duration-300 select-none pointer-events-auto">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-slate-400">
                    Design & Development
                </p>
                <a 
                    href="mailto:studystation.auth@gmail.com" 
                    className="group flex items-center gap-2 text-[11px] font-bold text-gray-700 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                    <span className="relative">
                        Nguyễn Trọng Phúc
                        <span className="absolute -bottom-0.5 left-0 w-0 h-[1.5px] bg-purple-500 transition-all duration-300 group-hover:w-full" />
                    </span>
                    <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-700" />
                    <span className="text-[10px] font-medium opacity-90 transition-all duration-300">
                        studystation.auth@gmail.com
                    </span>
                </a>
            </div>
        </div>
    );
}

function ExamScheduleWidget() {
    const [now, setNow] = useState(Date.now());
    const [showFullSchedule, setShowFullSchedule] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const { clearExams, dimmedExam } = useMemo(() => {
        const futureExams = EXAM_SCHEDULE.filter(e => e.timestamp > now).sort((a, b) => a.timestamp - b.timestamp);
        if (futureExams.length === 0) return { clearExams: [], dimmedExam: null };

        const first = futureExams[0]!;
        const clear = futureExams.filter(e => e.date === first.date);
        
        // Find the first exam of a different day
        const dimmed = futureExams.find(e => e.date !== first.date) || null;

        return { clearExams: clear, dimmedExam: dimmed };
    }, [now]);

    const formatCountdown = (target: number) => {
        const diff = target - now;
        if (diff <= 0) return "00:00:00";
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (clearExams.length === 0) return null;

    const mainExam = clearExams[0]!;

    return (
        <>
            <button 
                onClick={() => setShowFullSchedule(true)}
                className="w-full text-left relative group overflow-hidden rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/50 dark:border-slate-800/50 shadow-sm p-2 px-4 transition-all hover:bg-white dark:hover:bg-slate-900 active:scale-[0.99]"
            >
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    {/* Main Section: Clear Exams */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-900 text-[10px] font-black text-white uppercase tracking-tighter">
                                {mainExam.date.split('/')[0]}/{mainExam.date.split('/')[1]}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                                {clearExams.map((e, idx) => (
                                    <div key={e.id} className="flex items-center gap-1.5 leading-none">
                                        <h4 className="text-xs font-black text-gray-800 dark:text-gray-200 tracking-tight whitespace-nowrap">
                                            {e.subject}
                                        </h4>
                                        <span className="text-[10px] font-bold text-gray-500">@{e.time}</span>
                                        {idx < clearExams.length - 1 && <div className="w-1 h-1 rounded-full bg-gray-300 mx-1" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Dimmed Section: Next Day's First Exam */}
                        {dimmedExam && (
                            <div className="flex items-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity border-l border-gray-100 dark:border-slate-800 pl-4">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Kế:</span>
                                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    {dimmedExam.subject} ({dimmedExam.date.split('/')[0]}/{dimmedExam.date.split('/')[1]})
                                </span>
                            </div>
                        )}
                    </div>
                    
                    {/* Countdown */}
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/30 shadow-sm">
                            <AlarmClock className="w-3 h-3 text-blue-500" />
                            <span className="font-mono font-black text-[11px] text-blue-600 dark:text-blue-400 tracking-wider">
                                {formatCountdown(mainExam.timestamp)}
                            </span>
                        </div>
                    </div>
                </div>
            </button>

            <Dialog open={showFullSchedule} onClose={() => setShowFullSchedule(false)} className="max-w-2xl overflow-hidden p-0 dark:bg-slate-900">
                <div className="p-6 md:p-8 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Chi Tiết Lịch Thi</h2>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Lớp 12 • Tự Nhiên</p>
                        </div>
                    </div>

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {EXAM_SCHEDULE.map((e) => {
                            const isPast = e.timestamp <= now;
                            const isNext = e.id === mainExam.id;
                            
                            return (
                                <div 
                                    key={e.id} 
                                    className={`
                                        flex items-center justify-between p-4 rounded-2xl border transition-all
                                        ${isPast ? 'bg-gray-50/50 dark:bg-slate-800/30 border-gray-100 dark:border-slate-800 opacity-60' : 
                                          isNext ? 'bg-white dark:bg-slate-800 border-blue-500 dark:border-blue-500 shadow-lg shadow-blue-500/10' : 
                                          'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700'}
                                    `}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`
                                            w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xs
                                            ${isPast ? 'bg-gray-100 text-gray-400' : isNext ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}
                                        `}>
                                            <div className="text-center">
                                                {e.date.split('/')[0]}
                                                <br />
                                                {e.date.split('/')[1]}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className={`text-sm font-black tracking-tight truncate ${isPast ? 'text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                                {e.subject}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Clock className="w-3 h-3 text-gray-400" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{e.time}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {isPast ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                    ) : isNext ? (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Sắp diễn ra</span>
                                            <div className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-mono font-black text-xs">
                                                {formatCountdown(e.timestamp)}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-700 text-gray-400 shrink-0">
                                            <Timer className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Dialog>
        </>
    );
}

interface MenuCardProps {
    item: typeof menuItems[0];
    onClick: () => void;
}

function MenuCard({ item, onClick }: MenuCardProps) {
    return (
        <button
            onClick={onClick}
            disabled={item.soon}
            className={`
                group relative rounded-[32px] p-4 md:p-8
                flex flex-col items-center justify-center aspect-square md:aspect-[10/9]
                transition-all duration-500 var(--cubic-out)
                border border-white
                bg-white/80 backdrop-blur-xl
                shadow-soft hover:shadow-heavy hover:-translate-y-2 hover:bg-white
                active:scale-[0.96]
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-soft
            `}
        >
            {/* Icon container */}
            <div className={`w-12 h-12 md:w-16 md:h-16 rounded-[20px] md:rounded-[22px] ${item.iconBg} flex items-center justify-center mb-3 md:mb-5 relative transition-all duration-500 group-hover:scale-110 shadow-sm group-hover:shadow-md`}>
                <div className="scale-100 md:scale-110">{item.icon}</div>
                {item.badge && (
                    <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        {item.badge}
                    </span>
                )}
            </div>

            {/* Label */}
            <span className="text-sm md:text-[17px] font-extrabold text-gray-900 dark:text-gray-100 transition-colors group-hover:text-blue-600 tracking-tight">{item.label}</span>

            {/* Soon badge */}
            {item.soon && (
                <div className="absolute bottom-3 md:bottom-4 px-2 md:px-3 py-0.5 md:py-1 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full border border-gray-200 dark:border-gray-700">
                    <span className="text-[8px] md:text-[9px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest">Soon</span>
                </div>
            )}
        </button>
    );
}
