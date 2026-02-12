// E-test Service
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import type { EtestExam } from '@/types';

export async function getAllEtestExams(): Promise<EtestExam[]> {
    const snapshot = await getDocs(collection(db, 'etest_exams'));
    return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as EtestExam[];
}

export async function getEtestExam(examId: string): Promise<EtestExam | null> {
    const snap = await getDoc(doc(db, 'etest_exams', examId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as EtestExam;
}

export async function createEtestExam(examData: Omit<EtestExam, 'id'>, customId?: string): Promise<string> {
    const examId = customId || doc(collection(db, 'etest_exams')).id;
    await setDoc(doc(db, 'etest_exams', examId), {
        ...examData,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || 'unknown',
    });
    return examId;
}

export async function updateEtestExam(examId: string, examData: Partial<EtestExam>): Promise<void> {
    const { id: _id, ...data } = examData;
    await updateDoc(doc(db, 'etest_exams', examId), data);
}

export async function deleteEtestExam(examId: string): Promise<void> {
    await deleteDoc(doc(db, 'etest_exams', examId));
}
