// Notification Service - extracted from gatekeeper.js section 11
import {
    collection,
    doc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import type { Notification } from '@/types';

export async function getAllNotifications(): Promise<Notification[]> {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as Notification[];
}

export async function createNotification(data: Omit<Notification, 'id'>): Promise<string> {
    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
        ...data,
        createdAt: new Date().toISOString(),
        author: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
    });
    return notifRef.id;
}

export async function updateNotification(notifId: string, data: Partial<Notification>): Promise<void> {
    const { id: _id, ...updateData } = data;
    await updateDoc(doc(db, 'notifications', notifId), updateData);
}

export async function deleteNotification(notifId: string): Promise<void> {
    await deleteDoc(doc(db, 'notifications', notifId));
}
