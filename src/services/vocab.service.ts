// Vocab Service - extracted from gatekeeper.js section 8
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
import type { VocabSet } from '@/types';

export async function getAllVocabSets(): Promise<VocabSet[]> {
    const snapshot = await getDocs(collection(db, 'vocab_sets'));
    return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as VocabSet[];
}

export async function getVocabSet(setId: string): Promise<VocabSet | null> {
    const snap = await getDoc(doc(db, 'vocab_sets', setId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as VocabSet;
}

export async function createVocabSet(vocabData: Omit<VocabSet, 'id'>, customId?: string): Promise<string> {
    const setId = customId || doc(collection(db, 'vocab_sets')).id;
    await setDoc(doc(db, 'vocab_sets', setId), {
        ...vocabData,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || 'unknown',
    });
    return setId;
}

export async function updateVocabSet(setId: string, vocabData: Partial<VocabSet>): Promise<void> {
    const { id: _id, ...data } = vocabData;
    await updateDoc(doc(db, 'vocab_sets', setId), data);
}

export async function deleteVocabSet(setId: string): Promise<void> {
    await deleteDoc(doc(db, 'vocab_sets', setId));
}
