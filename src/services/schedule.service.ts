import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import type { ScheduleConfig } from '@/types';

const SCHEDULE_DOC_ID = 'main'; // Single schedule for now

const DEFAULT_DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const DEFAULT_SCHEDULE: ScheduleConfig = {
    id: SCHEDULE_DOC_ID,
    days: DEFAULT_DAYS.map((day) => ({
        day,
        morning: Array(5).fill(''),
        afternoon: Array(5).fill(''),
    })),
};

export async function getSchedule(): Promise<ScheduleConfig> {
    try {
        const docRef = doc(db, 'schedules', SCHEDULE_DOC_ID);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            return snapshot.data() as ScheduleConfig;
        }

        // Return default if not found (don't save yet, wait for user action)
        return DEFAULT_SCHEDULE;
    } catch (error) {
        console.error('[Schedule] Failed to fetch schedule:', error);
        return DEFAULT_SCHEDULE;
    }
}

export function subscribeToSchedule(onUpdate: (data: ScheduleConfig) => void): () => void {
    const docRef = doc(db, 'schedules', SCHEDULE_DOC_ID);

    return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            onUpdate(snapshot.data() as ScheduleConfig);
        } else {
            onUpdate(DEFAULT_SCHEDULE);
        }
    }, (error) => {
        console.error('[Schedule] Subscription failed:', error);
    });
}

export async function saveSchedule(schedule: ScheduleConfig): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthorized');

    try {
        const docRef = doc(db, 'schedules', SCHEDULE_DOC_ID);
        await setDoc(docRef, {
            ...schedule,
            updatedAt: new Date().toISOString(),
            updatedBy: user.email,
        });
    } catch (error) {
        console.error('[Schedule] Failed to save schedule:', error);
        throw error;
    }
}
