// Exam Service
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    limit as firestoreLimit,
    getDocFromCache,
    increment,
    type DocumentData,
    type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import type { Exam, ExamMetadata, PracticeLog, PracticeHistory, HighestScores } from '@/types';

// ============================================================
// CACHING
// ============================================================

const examContentCache = new Map<string, Exam>();
let examListCache: ExamMetadata[] | null = null;
let examListCacheTime = 0;
const EXAM_LIST_CACHE_DURATION = 300000; // 5 minutes

let highestScoresCache: HighestScores | null = null;
let highestScoresCacheTime = 0;
const HIGHEST_SCORES_CACHE_DURATION = 60000; // 1 minute

// ============================================================
// EXAM CRUD
// ============================================================

export async function getAllExams(): Promise<ExamMetadata[]> {
    // Check memory cache
    if (examListCache && Date.now() - examListCacheTime < EXAM_LIST_CACHE_DURATION) {
        return examListCache;
    }

    // Try IndexedDB cache first, then server
    try {
        const snapshot = await getDocs(collection(db, 'exams'));
        const exams = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
            const data = d.data();
            return {
                id: d.id,
                title: data.title,
                subjectId: data.subjectId,
                time: data.time,
                attemptCount: data.attemptCount || 0,
                createdAt: data.createdAt,
                examCode: data.examCode,
                questionCount: {
                    part1: (data.part1 || []).length,
                    part2: (data.part2 || []).length,
                    part3: (data.part3 || []).length,
                },
            } as ExamMetadata;
        });

        examListCache = exams;
        examListCacheTime = Date.now();
        return exams;
    } catch (error) {
        console.error('[Exam] Failed to fetch exams:', error);
        return examListCache || [];
    }
}

export async function getExamContent(examId: string): Promise<Exam | null> {
    // Check memory cache
    if (examContentCache.has(examId)) {
        return examContentCache.get(examId) || null;
    }

    try {
        // Try cache first
        let examSnap;
        try {
            examSnap = await getDocFromCache(doc(db, 'exams', examId));
        } catch {
            examSnap = await getDoc(doc(db, 'exams', examId));
        }

        if (!examSnap.exists()) return null;

        const data = examSnap.data();
        const exam: Exam = {
            id: examSnap.id,
            title: data.title,
            subjectId: data.subjectId,
            time: data.time,
            part1: data.part1 || [],
            part2: data.part2 || [],
            part3: data.part3 || [],
            attemptCount: data.attemptCount || 0,
            createdAt: data.createdAt,
            createdBy: data.createdBy,
            examCode: data.examCode,
        };

        examContentCache.set(examId, exam);
        return exam;
    } catch (error) {
        console.error('[Exam] Failed to fetch exam content:', error);
        return null;
    }
}

export async function createExam(examData: Omit<Exam, 'id'>, customId?: string): Promise<string> {
    // Generate ID: {subjectId}-{XXX}
    let examId = customId;
    if (!examId) {
        const existingExams = await getAllExams();
        const subjectExams = existingExams.filter((e) => e.subjectId === examData.subjectId);
        const nextNum = (subjectExams.length + 1).toString().padStart(3, '0');
        examId = `${examData.subjectId}-${nextNum}`;
    }

    await setDoc(doc(db, 'exams', examId), {
        ...examData,
        attemptCount: 0,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || 'unknown',
    });

    clearExamListCache();
    return examId;
}

export async function updateExam(examId: string, examData: Partial<Exam>): Promise<void> {
    const { id: _id, ...data } = examData;
    await updateDoc(doc(db, 'exams', examId), data);
    clearExamListCache();
    clearExamContentCache(examId);
}

export async function deleteExam(examId: string): Promise<void> {
    await deleteDoc(doc(db, 'exams', examId));
    clearExamListCache();
    clearExamContentCache(examId);
}

export function clearExamListCache() {
    examListCache = null;
    examListCacheTime = 0;
}

export function clearExamContentCache(examId?: string) {
    if (examId) {
        examContentCache.delete(examId);
    } else {
        examContentCache.clear();
    }
}

// ============================================================
// PRACTICE LOGGING
// ============================================================

export async function logPracticeAttempt(
    examId: string,
    examTitle: string,
    subjectId: string,
    mode = 'classic',
    durationSeconds: number | null = null
): Promise<string> {
    const user = auth.currentUser;
    const logData: Record<string, unknown> = {
        examId,
        examTitle,
        subjectId,
        mode,
        userEmail: user?.email || 'guest',
        userName: user?.displayName || 'Khách',
        timestamp: new Date().toISOString(),
    };

    if (durationSeconds !== null) {
        logData.durationSeconds = durationSeconds;
    }

    const logRef = doc(collection(db, 'practice_logs'));
    await setDoc(logRef, logData);

    // Increment attempt count on exam
    try {
        await updateDoc(doc(db, 'exams', examId), {
            attemptCount: increment(1),
        });
    } catch {
        // Silent fail
    }

    return logRef.id;
}

export async function savePracticeResult(result: {
    examId: string;
    examTitle: string;
    subjectId: string;
    score: number;
    correctCount: number;
    totalQuestions: number;
    durationSeconds: number;
    answers: Record<string, unknown>;
}): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const historyRef = doc(collection(db, 'practice_history'));
    await setDoc(historyRef, {
        ...result,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName,
        timestamp: new Date().toISOString(),
    });

    clearHighestScoresCache();
    return historyRef.id;
}

export async function getPracticeHistory(examId: string): Promise<PracticeHistory[]> {
    const user = auth.currentUser;
    if (!user) return [];

    const q = query(
        collection(db, 'practice_history'),
        where('userId', '==', user.uid),
        where('examId', '==', examId),
        orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() })) as PracticeHistory[];
}

export async function getAllPracticeLogs(): Promise<PracticeLog[]> {
    const q = query(
        collection(db, 'practice_logs'),
        orderBy('timestamp', 'desc'),
        firestoreLimit(200)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() })) as PracticeLog[];
}

// ============================================================
// HIGHEST SCORES
// ============================================================

export async function getHighestScores(): Promise<HighestScores> {
    if (highestScoresCache && Date.now() - highestScoresCacheTime < HIGHEST_SCORES_CACHE_DURATION) {
        return highestScoresCache;
    }

    const user = auth.currentUser;
    if (!user) return {};

    const q = query(
        collection(db, 'practice_history'),
        where('userId', '==', user.uid)
    );
    const snapshot = await getDocs(q);

    const scores: HighestScores = {};
    snapshot.docs.forEach((d: QueryDocumentSnapshot<DocumentData>) => {
        const data = d.data();
        const examId = data.examId as string;
        const score = data.score as number;

        if (!scores[examId] || score > scores[examId].highestScore) {
            scores[examId] = {
                highestScore: score,
                attemptCount: (scores[examId]?.attemptCount || 0) + 1,
            };
        } else {
            scores[examId].attemptCount++;
        }
    });

    highestScoresCache = scores;
    highestScoresCacheTime = Date.now();
    return scores;
}

export function clearHighestScoresCache() {
    highestScoresCache = null;
    highestScoresCacheTime = 0;
}

// ============================================================
// SUBJECTS (hardcoded, same as gatekeeper.js)
// ============================================================

export function getSubjects() {
    return [
        { id: 'toan', name: 'Toán', icon: '📐', color: '#3B82F6' },
        { id: 'ly', name: 'Vật Lý', icon: '⚡', color: '#F59E0B' },
        { id: 'hoa', name: 'Hóa Học', icon: '🧪', color: '#10B981' },
        { id: 'sinh', name: 'Sinh Học', icon: '🧬', color: '#8B5CF6' },
        { id: 'van', name: 'Ngữ Văn', icon: '📖', color: '#EF4444' },
        { id: 'su', name: 'Lịch Sử', icon: '🏛️', color: '#D97706' },
        { id: 'dia', name: 'Địa Lý', icon: '🌍', color: '#06B6D4' },
        { id: 'anh', name: 'Tiếng Anh', icon: '🇬🇧', color: '#EC4899' },
        { id: 'gdcd', name: 'GDCD', icon: '⚖️', color: '#14B8A6' },
        { id: 'tin', name: 'Tin Học', icon: '💻', color: '#6366F1' },
    ];
}

// ============================================================
// FEEDBACK SYSTEM
// ============================================================

export async function getExamFeedbacks(examId: string) {
    const q = query(
        collection(db, 'feedbacks', examId, 'comments'),
        orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }));
}

export async function addFeedback(examId: string, content: string) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const commentRef = doc(collection(db, 'feedbacks', examId, 'comments'));
    await setDoc(commentRef, {
        content: content.substring(0, 256),
        userId: user.uid,
        userName: user.displayName || 'Ẩn danh',
        userAvatar: user.photoURL,
        createdAt: new Date().toISOString(),
    });
    return commentRef.id;
}

export async function deleteFeedback(examId: string, commentId: string) {
    await deleteDoc(doc(db, 'feedbacks', examId, 'comments', commentId));
}
