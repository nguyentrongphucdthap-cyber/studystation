import { useSchedule } from '@/hooks/useSchedule';
import { Spinner } from '@/components/ui/Spinner';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Schedule() {
    const { schedule, loading } = useSchedule();

    const ensureArrayLength = (arr: string[], length: number) => {
        const newArr = [...arr];
        while (newArr.length < length) newArr.push('');
        return newArr.slice(0, length);
    };

    if (loading) return <div className="h-full flex justify-center items-center pt-20"><Spinner size="lg" /></div>;
    if (!schedule) return <div className="h-full flex justify-center items-center pt-20 text-white">Không có dữ liệu</div>;

    // Process data for safety
    const safeDays = schedule.days.map(d => ({
        ...d,
        morning: ensureArrayLength(d.morning, 5),
        afternoon: ensureArrayLength(d.afternoon, 5)
    }));

    const today = new Date().getDay();
    // 0=Sun, 1=Mon -> Index 0. 
    const currentDayIndex = today === 0 ? -1 : today - 1;

    return (
        <div className="animate-page-fade-in pb-10 w-full">
            {/* White Soft UI Container */}
            <div className="bg-white/70 backdrop-blur-2xl rounded-[32px] border border-white overflow-hidden shadow-soft">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm md:text-base min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-black/20">
                                <th className="p-6 border-b border-r border-gray-100 dark:border-gray-800 w-24 text-center font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-[11px] sticky left-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md z-20">
                                    Tiết
                                </th>
                                {safeDays.map((day, index) => {
                                    const isToday = index === currentDayIndex;
                                    return (
                                        <th
                                            key={day.day}
                                            className={cn(
                                                "p-6 border-b border-gray-100 dark:border-gray-800 min-w-[140px] font-extrabold text-center transition-all relative group",
                                                isToday ? "bg-blue-50/30 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50/80 dark:hover:bg-gray-800/50"
                                            )}
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-lg tracking-tight">{day.day}</span>
                                                {isToday && (
                                                    <span className="text-[9px] font-black bg-blue-600 text-white px-2.5 py-1 rounded-full shadow-lg shadow-blue-500/30 uppercase tracking-widest">
                                                        Hôm nay
                                                    </span>
                                                )}
                                            </div>
                                            {/* Hover effect indicator */}
                                            <div className={cn("absolute bottom-0 left-6 right-6 h-1 rounded-full transition-all duration-300", isToday ? "bg-blue-500" : "bg-transparent group-hover:bg-gray-200")} />
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Morning Session */}
                            <tr className="bg-amber-50/30 backdrop-blur-sm border-b border-amber-100/20">
                                <td colSpan={safeDays.length + 1} className="p-4 px-8 font-black text-amber-600 uppercase tracking-[0.2em] text-[10px] shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                                            <Sun className="w-4 h-4" />
                                        </div>
                                        Buổi Sáng
                                    </div>
                                </td>
                            </tr>
                            {Array.from({ length: 5 }).map((_, periodIndex) => (
                                <tr key={`morning-${periodIndex}`} className="group hover:bg-blue-50/20 transition-colors">
                                    <td className="p-5 border-r border-b border-gray-50 text-center font-extrabold text-gray-300 sticky left-0 bg-white/90 backdrop-blur-md group-hover:text-blue-500 transition-colors z-10 w-24">
                                        {periodIndex + 1}
                                    </td>
                                    {safeDays.map((day, dayIndex) => {
                                        const isToday = dayIndex === currentDayIndex;
                                        return (
                                            <td
                                                key={`m-${dayIndex}-${periodIndex}`}
                                                className={cn(
                                                    "p-5 border-b border-gray-50 text-center transition-all duration-300 border-r border-gray-50/50 last:border-r-0",
                                                    isToday ? "bg-blue-50/10 font-bold text-gray-900" : "text-gray-600",
                                                    !day.morning[periodIndex] && "text-gray-200"
                                                )}
                                            >
                                                <span className={cn("inline-block transform transition-transform group-hover:scale-105", day.morning[periodIndex] ? "font-bold" : "text-2xl font-light opacity-10")}>
                                                    {day.morning[periodIndex] || "·"}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}

                            {/* Afternoon Session */}
                            <tr className="bg-indigo-50/30 backdrop-blur-sm border-y border-indigo-100/20">
                                <td colSpan={safeDays.length + 1} className="p-4 px-8 font-black text-indigo-600 uppercase tracking-[0.2em] text-[10px] shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                                            <Moon className="w-4 h-4" />
                                        </div>
                                        Buổi Chiều
                                    </div>
                                </td>
                            </tr>
                            {Array.from({ length: 5 }).map((_, periodIndex) => (
                                <tr key={`afternoon-${periodIndex}`} className="group hover:bg-blue-50/20 transition-colors">
                                    <td className="p-5 border-r border-b border-gray-50 text-center font-extrabold text-gray-300 sticky left-0 bg-white/90 backdrop-blur-md group-hover:text-blue-500 transition-colors z-10 w-24">
                                        {periodIndex + 1}
                                    </td>
                                    {safeDays.map((day, dayIndex) => {
                                        const isToday = dayIndex === currentDayIndex;
                                        return (
                                            <td
                                                key={`a-${dayIndex}-${periodIndex}`}
                                                className={cn(
                                                    "p-5 border-b border-gray-50 text-center transition-all duration-300 border-r border-gray-50/50 last:border-r-0",
                                                    isToday ? "bg-blue-50/10 font-bold text-gray-900" : "text-gray-600",
                                                    !day.afternoon[periodIndex] && "text-gray-200"
                                                )}
                                            >
                                                <span className={cn("inline-block transform transition-transform group-hover:scale-105", day.afternoon[periodIndex] ? "font-bold" : "text-2xl font-light opacity-10")}>
                                                    {day.afternoon[periodIndex] || "·"}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-8 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest opacity-60">
                * Dữ liệu được cập nhật bởi quản trị viên
            </div>
        </div>
    );
}
