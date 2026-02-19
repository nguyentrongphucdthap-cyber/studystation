import React, { useState, useEffect } from 'react';
import { useSchedule } from '@/hooks/useSchedule';
import type { ScheduleConfig } from '@/types';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { Save, RefreshCw } from 'lucide-react';

const SESSIONS = [
    { id: 'morning', label: 'Buổi Sáng (5 Tiết)', count: 5 },
    { id: 'afternoon', label: 'Buổi Chiều (5 Tiết)', count: 5 },
];

export default function AdminSchedule() {
    const { schedule: remoteSchedule, loading, updateSchedule } = useSchedule();
    const { toast } = useToast();
    const [localSchedule, setLocalSchedule] = useState<ScheduleConfig | null>(null);
    const [saving, setSaving] = useState(false);

    // Sync remote to local once on load or when refresh is triggered
    useEffect(() => {
        if (remoteSchedule && !localSchedule) {
            setLocalSchedule(remoteSchedule);
        }
    }, [remoteSchedule, localSchedule]);

    const handleRefresh = () => {
        setLocalSchedule(remoteSchedule);
        toast({ title: 'Đã cập nhật', message: 'Dữ liệu đã được đồng bộ từ máy chủ', type: 'info' });
    };

    const handleSave = async () => {
        if (!localSchedule) return;
        setSaving(true);
        try {
            await updateSchedule(localSchedule);
            toast({ title: 'Thành công', message: 'Đã lưu thời khóa biểu!', type: 'success' });
        } catch (error) {
            console.error(error);
            toast({ title: 'Lỗi', message: 'Lỗi khi lưu', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleCellChange = (
        dayIndex: number,
        session: 'morning' | 'afternoon',
        periodIndex: number,
        value: string
    ) => {
        if (!localSchedule) return;
        const newDays = [...localSchedule.days];
        const day = newDays[dayIndex];
        if (!day) return;

        if (session === 'morning') {
            const newSession = [...day.morning];
            newSession[periodIndex] = value;
            newDays[dayIndex] = { ...day, morning: newSession };
        } else {
            const newSession = [...day.afternoon];
            newSession[periodIndex] = value;
            newDays[dayIndex] = { ...day, afternoon: newSession };
        }

        setLocalSchedule({ ...localSchedule, days: newDays });
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;
    if (!localSchedule) return <div className="p-10 text-center">Không có dữ liệu</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    📅 Thời Khóa Biểu
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-md"
                    >
                        <RefreshCw className="w-4 h-4" /> Tải lại
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                        {saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
                        Lưu thay đổi
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto border rounded-xl shadow-sm bg-card">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-muted/50 border-b">
                            <th className="p-3 text-left font-medium w-24 sticky left-0 bg-muted/50 z-10">Tiết</th>
                            {localSchedule.days.map((d) => (
                                <th key={d.day} className="p-3 text-center font-bold min-w-[140px] border-l">
                                    {d.day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {SESSIONS.map((session) => (
                            <React.Fragment key={session.id}>
                                <tr key={`header-${session.id}`} className="bg-primary/5 border-y">
                                    <td colSpan={localSchedule.days.length + 1} className="p-2 px-4 font-bold text-primary">
                                        {session.label}
                                    </td>
                                </tr>
                                {Array.from({ length: session.count }).map((_, periodIndex) => (
                                    <tr key={`${session.id}-${periodIndex}`} className="border-b last:border-0 hover:bg-accent/5">
                                        <td className="p-3 font-medium text-center sticky left-0 bg-card z-10 border-r">
                                            {periodIndex + 1}
                                        </td>
                                        {localSchedule.days.map((day, dayIndex) => (
                                            <td key={`${day.day}-${session.id}-${periodIndex}`} className="p-1 border-l">
                                                <input
                                                    type="text"
                                                    value={day[session.id as 'morning' | 'afternoon'][periodIndex] || ''}
                                                    onChange={(e) =>
                                                        handleCellChange(dayIndex, session.id as 'morning' | 'afternoon', periodIndex, e.target.value)
                                                    }
                                                    className="w-full p-2 text-center bg-transparent focus:bg-accent focus:outline-none rounded-sm"
                                                    placeholder="..."
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="text-xs text-muted-foreground text-center">
                * Nhập tên môn học vào các ô và nhấn Lưu.
            </div>
        </div>
    );
}
