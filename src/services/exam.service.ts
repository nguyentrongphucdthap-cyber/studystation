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
    increment,
    writeBatch,
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

    try {
        const snapshot = await getDocs(collection(db, 'exams'));
        const exams = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
            const data = d.data();
            // In the new structure, exams collection only contains metadata.
            // Old documents might contain full data, but we only extract metadata here.
            return {
                id: d.id,
                title: data.title,
                subjectId: data.subjectId,
                time: data.time,
                attemptCount: data.attemptCount || 0,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                examCode: data.examCode,
                questionCount: data.questionCount || {
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
    // 1. Check memory cache
    if (examContentCache.has(examId)) {
        return examContentCache.get(examId) || null;
    }

    // 2. Check localStorage cache
    try {
        const cached = localStorage.getItem(`exam_content_${examId}`);
        if (cached) {
            const parsed = JSON.parse(cached);
            // Optional: check version/timestamp here
            examContentCache.set(examId, parsed);
            return parsed;
        }
    } catch (e) {
        console.warn('[Exam] Cache read failed', e);
    }

    try {
        // 3. Try to fetch from exam_contents (New Structure)
        let contentSnap = await getDoc(doc(db, 'exam_contents', examId));
        let examData: Partial<Exam> = {};

        if (contentSnap.exists()) {
            examData = contentSnap.data();
            // Fetch metadata to complete the object
            const metaSnap = await getDoc(doc(db, 'exams', examId));
            if (metaSnap.exists()) {
                const meta = metaSnap.data();
                examData = { ...meta, ...examData };
            }
        } else {
            // 4. Fallback to exams collection (Old Structure)
            const oldSnap = await getDoc(doc(db, 'exams', examId));
            if (!oldSnap.exists()) return null;
            examData = oldSnap.data();
        }

        const exam: Exam = {
            id: examId,
            title: examData.title || '',
            subjectId: examData.subjectId || '',
            time: examData.time || 50,
            part1: examData.part1 || [],
            part2: examData.part2 || [],
            part3: examData.part3 || [],
            attemptCount: examData.attemptCount || 0,
            createdAt: examData.createdAt || '',
            createdBy: examData.createdBy || '',
            examCode: examData.examCode,
        };

        // Update caches
        examContentCache.set(examId, exam);
        localStorage.setItem(`exam_content_${examId}`, JSON.stringify(exam));

        return exam;
    } catch (error) {
        console.error('[Exam] Failed to fetch exam content:', error);
        return null;
    }
}

export async function createExam(examData: Omit<Exam, 'id'>, customId?: string): Promise<string> {
    // 1. Generate ID
    let examId = customId;
    if (!examId) {
        const existingExams = await getAllExams();
        const subjectExams = existingExams.filter((e) => e.subjectId === examData.subjectId);
        const nextNum = (subjectExams.length + 1).toString().padStart(3, '0');
        examId = `${examData.subjectId}-${nextNum}`;
    }

    const { part1, part2, part3, ...metadata } = examData;
    const now = new Date().toISOString();

    // 2. Use Batch to save metadata and content separately (Atomic)
    const batch = writeBatch(db);

    // Meta doc: exams/ID
    const metaRef = doc(db, 'exams', examId);
    batch.set(metaRef, {
        ...metadata,
        // Keep part1/2/3 in meta temporarily for backward compatibility
        part1: part1 || [],
        part2: part2 || [],
        part3: part3 || [],
        questionCount: {
            part1: (part1 || []).length,
            part2: (part2 || []).length,
            part3: (part3 || []).length,
        },
        attemptCount: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: auth.currentUser?.email || 'unknown',
    });

    // Content doc: exam_contents/ID
    const contentRef = doc(db, 'exam_contents', examId);
    batch.set(contentRef, {
        part1: part1 || [],
        part2: part2 || [],
        part3: part3 || [],
    });

    await batch.commit();

    clearExamListCache();
    return examId;
}

export async function updateExam(examId: string, examData: Partial<Exam>): Promise<void> {
    const { id: _id, part1, part2, part3, ...metadata } = examData;
    const now = new Date().toISOString();

    const batch = writeBatch(db);

    // 1. Update metadata and content in 'exams' collection
    if (Object.keys(metadata).length > 0 || part1 || part2 || part3) {
        const metaRef = doc(db, 'exams', examId);
        const updatePayload: any = { ...metadata, updatedAt: now };

        if (part1 || part2 || part3) {
            if (part1) updatePayload.part1 = part1;
            if (part2) updatePayload.part2 = part2;
            if (part3) updatePayload.part3 = part3;

            updatePayload.questionCount = {
                part1: part1 ? part1.length : (metadata as any).questionCount?.part1,
                part2: part2 ? part2.length : (metadata as any).questionCount?.part2,
                part3: part3 ? part3.length : (metadata as any).questionCount?.part3,
            };
        }
        batch.update(metaRef, updatePayload);
    }

    // 2. Update exam_contents collection
    if (part1 || part2 || part3) {
        const contentRef = doc(db, 'exam_contents', examId);
        const contentPayload: any = {};
        if (part1) contentPayload.part1 = part1;
        if (part2) contentPayload.part2 = part2;
        if (part3) contentPayload.part3 = part3;
        batch.set(contentRef, contentPayload, { merge: true });
    }

    await batch.commit();

    clearExamListCache();
    clearExamContentCache(examId);
    localStorage.removeItem(`exam_content_${examId}`);
}

export async function deleteExam(examId: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'exams', examId));
    batch.delete(doc(db, 'exam_contents', examId));
    await batch.commit();

    clearExamListCache();
    clearExamContentCache(examId);
    localStorage.removeItem(`exam_content_${examId}`);
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
        { id: 'toan', name: 'Toán', icon: '📐', color: '#3B82F6', gradient: 'bg-gradient-to-br from-blue-500 to-blue-600' },
        { id: 'ly', name: 'Vật Lý', icon: '⚡', color: '#F59E0B', gradient: 'bg-gradient-to-br from-amber-400 to-orange-500' },
        { id: 'hoa', name: 'Hóa Học', icon: '🧪', color: '#10B981', gradient: 'bg-gradient-to-br from-emerald-500 to-green-600' },
        { id: 'sinh', name: 'Sinh Học', icon: '🧬', color: '#8B5CF6', gradient: 'bg-gradient-to-br from-purple-500 to-violet-600' },
        { id: 'van', name: 'Ngữ Văn', icon: '📖', color: '#EF4444', gradient: 'bg-gradient-to-br from-red-400 to-rose-500' },
        { id: 'su', name: 'Lịch Sử', icon: '🏛️', color: '#D97706', gradient: 'bg-gradient-to-br from-yellow-500 to-amber-600' },
        { id: 'dia', name: 'Địa Lý', icon: '🌍', color: '#06B6D4', gradient: 'bg-gradient-to-br from-cyan-500 to-teal-600' },
        { id: 'anh', name: 'Tiếng Anh', icon: '🇬🇧', color: '#EC4899', gradient: 'bg-gradient-to-br from-pink-500 to-rose-600' },
        { id: 'gdcd', name: 'GDCD', icon: '⚖️', color: '#14B8A6', gradient: 'bg-gradient-to-br from-teal-400 to-emerald-500' },
        { id: 'tin', name: 'Tin Học', icon: '💻', color: '#6366F1', gradient: 'bg-gradient-to-br from-indigo-500 to-violet-600' },
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
