// Vocab Stats Service — track flashcard study sessions in Firestore
import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit as firestoreLimit,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';

// ── Types ──

export interface VocabSession {
    id?: string;
    userId: string;
    userEmail: string;
    vocabSetId: string;
    vocabSetTitle: string;
    wordsStudied: number;
    knownCount: number;
    unknownCount: number;
    durationSeconds: number;
    timestamp: string;
}

// ── Save a completed flashcard session ──

export async function saveVocabSession(data: Omit<VocabSession, 'id' | 'userId' | 'userEmail'>): Promise<{ coinsEarned: number }> {
    const user = auth.currentUser;
    if (!user) return { coinsEarned: 0 };

    let coinsEarned = 0;
    try {
        const docRef = doc(collection(db, 'vocab_sessions'));
        await setDoc(docRef, {
            ...data,
            userId: user.uid,
            userEmail: user.email || '',
            timestamp: data.timestamp || new Date().toISOString(),
        });
        
        if (data.wordsStudied > 0 && user.email) {
            coinsEarned = data.wordsStudied * 0.01;
            const { updateMagocoins } = await import('@/services/magocoin.service');
            await updateMagocoins(user.email, coinsEarned);
        }
    } catch (err) {
        console.warn('[VocabStats] Failed to save session:', err);
    }
    
    return { coinsEarned };
}

// ── Get all vocab sessions for the current user ──

export async function getUserVocabSessions(limitCount = 500): Promise<VocabSession[]> {
    const user = auth.currentUser;
    if (!user) return [];

    try {
        const q = query(
            collection(db, 'vocab_sessions'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'desc'),
            firestoreLimit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as VocabSession[];
    } catch (err) {
        console.warn('[VocabStats] Failed to get sessions:', err);
        return [];
    }
}

// ── Get activity logs for the current user (for study habit analysis) ──

export interface ActivityLog {
    id: string;
    moduleName: string;
    moduleLabel?: string;
    timestamp: string;
    deviceType?: string;
}

export async function getUserActivityForStats(limitCount = 300): Promise<ActivityLog[]> {
    const user = auth.currentUser;
    if (!user) return [];

    try {
        const q = query(
            collection(db, 'user_activity_logs'),
            where('userEmail', '==', user.email),
            orderBy('timestamp', 'desc'),
            firestoreLimit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ActivityLog[];
    } catch (err) {
        console.warn('[VocabStats] Failed to get activity logs:', err);
        return [];
    }
}
