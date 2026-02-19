import { useState, useEffect, useCallback } from 'react';
import { subscribeToSchedule, saveSchedule } from '@/services/schedule.service';
import type { ScheduleConfig } from '@/types';

export function useSchedule() {
    const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = subscribeToSchedule((data) => {
            setSchedule(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateSchedule = useCallback(async (newSchedule: ScheduleConfig) => {
        try {
            await saveSchedule(newSchedule);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to update schedule');
            setError(error);
            throw error;
        }
    }, []);

    return { schedule, loading, error, updateSchedule };
}
