import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { 
    ChevronRight, 
    AlarmClock
} from 'lucide-react';

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
        </div>
    );
}

function ExamScheduleWidget() {
    const { settings: _settings } = useTheme(); // Not directly used in ribbon but theme context available
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const next = useMemo(() => {
        return EXAM_SCHEDULE.filter(e => e.timestamp > now).sort((a, b) => a.timestamp - b.timestamp)[0] || null;
    }, [now]);

    const formatCountdown = (target: number) => {
        const diff = target - now;
        if (diff <= 0) return "00:00:00";
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (!next) return null;

    return (
        <div className="relative group overflow-hidden rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/50 dark:border-slate-800/50 shadow-sm p-2 px-4 transition-all hover:bg-white dark:hover:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-900 text-[10px] font-black text-white uppercase tracking-tighter">
                        {next.date.split('/')[0]}/{next.date.split('/')[1]}
                    </span>
                    <h4 className="text-xs font-black text-gray-800 dark:text-gray-200 truncate tracking-tight">
                        {next.subject} <span className="text-[10px] font-bold text-gray-400 ml-1">@ {next.time}</span>
                    </h4>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/30">
                        <AlarmClock className="w-3 h-3 text-blue-500" />
                        <span className="font-mono font-black text-[11px] text-blue-600 dark:text-blue-400 tracking-wider">
                            {formatCountdown(next.timestamp)}
                        </span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-gray-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
            </div>
        </div>
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
