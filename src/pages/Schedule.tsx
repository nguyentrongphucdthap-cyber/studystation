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
        <div className="animate-fade-in pb-10 w-full text-white">
            {/* Glassmorphism Container */}
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl ring-1 ring-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm md:text-base min-w-[1000px]">
                        <thead>
                            <tr className="bg-white/5 text-white/90">
                                <th className="p-5 border-b border-r border-white/10 w-24 text-center font-bold sticky left-0 bg-black/40 backdrop-blur-md z-20">
                                    Tiết
                                </th>
                                {safeDays.map((day, index) => {
                                    const isToday = index === currentDayIndex;
                                    return (
                                        <th
                                            key={day.day}
                                            className={cn(
                                                "p-5 border-b border-white/10 min-w-[140px] font-bold text-center transition-colors relative group",
                                                isToday ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                                            )}
                                        >
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-lg">{day.day}</span>
                                                {isToday && (
                                                    <span className="text-[10px] font-bold bg-gradient-to-r from-pink-500 to-rose-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-pink-500/20 animate-pulse">
                                                        HÔM NAY
                                                    </span>
                                                )}
                                            </div>
                                            {/* Hover effect border bottom */}
                                            <div className={cn("absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-300", isToday ? "bg-pink-500" : "bg-transparent group-hover:bg-white/20")} />
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Morning Session */}
                            <tr className="bg-gradient-to-r from-amber-500/20 to-orange-600/20 backdrop-blur-sm">
                                <td colSpan={safeDays.length + 1} className="p-3 px-6 font-bold text-amber-200 border-b border-white/10 uppercase tracking-widest text-xs shadow-inner">
                                    <div className="flex items-center gap-2">
                                        <Sun className="w-5 h-5 text-amber-300" />
                                        Buổi Sáng
                                    </div>
                                </td>
                            </tr>
                            {Array.from({ length: 5 }).map((_, periodIndex) => (
                                <tr key={`morning-${periodIndex}`} className="group hover:bg-white/5 transition-colors">
                                    <td className="p-4 border-r border-b border-white/10 text-center font-bold text-white/40 sticky left-0 bg-black/40 backdrop-blur-md group-hover:text-white/70 group-hover:bg-black/50 transition-colors z-10 w-24">
                                        {periodIndex + 1}
                                    </td>
                                    {safeDays.map((day, dayIndex) => {
                                        const isToday = dayIndex === currentDayIndex;
                                        return (
                                            <td
                                                key={`m-${dayIndex}-${periodIndex}`}
                                                className={cn(
                                                    "p-4 border-b border-white/5 text-center transition-all duration-200 border-r border-dashed border-white/5 last:border-r-0",
                                                    isToday ? "bg-white/5 font-medium text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]" : "text-white/80",
                                                    !day.morning[periodIndex] && "text-white/10"
                                                )}
                                            >
                                                <span className={cn("inline-block transform transition-transform group-hover:scale-105", day.morning[periodIndex] ? "" : "text-2xl font-light scale-150 opacity-20")}>
                                                    {day.morning[periodIndex] || "·"}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}

                            {/* Afternoon Session */}
                            <tr className="bg-gradient-to-r from-indigo-500/20 to-violet-600/20 backdrop-blur-sm">
                                <td colSpan={safeDays.length + 1} className="p-3 px-6 font-bold text-indigo-200 border-y border-white/10 uppercase tracking-widest text-xs shadow-inner">
                                    <div className="flex items-center gap-2">
                                        <Moon className="w-5 h-5 text-indigo-300" />
                                        Buổi Chiều
                                    </div>
                                </td>
                            </tr>
                            {Array.from({ length: 5 }).map((_, periodIndex) => (
                                <tr key={`afternoon-${periodIndex}`} className="group hover:bg-white/5 transition-colors">
                                    <td className="p-4 border-r border-b border-white/10 text-center font-bold text-white/40 sticky left-0 bg-black/40 backdrop-blur-md group-hover:text-white/70 group-hover:bg-black/50 transition-colors z-10 w-24">
                                        {periodIndex + 1}
                                    </td>
                                    {safeDays.map((day, dayIndex) => {
                                        const isToday = dayIndex === currentDayIndex;
                                        return (
                                            <td
                                                key={`a-${dayIndex}-${periodIndex}`}
                                                className={cn(
                                                    "p-4 border-b border-white/5 text-center transition-all duration-200 border-r border-dashed border-white/5 last:border-r-0",
                                                    isToday ? "bg-white/5 font-medium text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]" : "text-white/80",
                                                    !day.afternoon[periodIndex] && "text-white/10"
                                                )}
                                            >
                                                <span className={cn("inline-block transform transition-transform group-hover:scale-105", day.afternoon[periodIndex] ? "" : "text-2xl font-light scale-150 opacity-20")}>
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

            <div className="mt-4 text-center text-xs text-white/40">
                * Dữ liệu được cập nhật bởi quản trị viên
            </div>
        </div>
    );
}
