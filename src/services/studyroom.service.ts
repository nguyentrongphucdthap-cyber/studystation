import {
    collection,
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    arrayUnion,
    arrayRemove,
    getDoc
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { StudyRoom, StudyRoomMessage, StudyRoomMember } from '../types';

const ROOMS_COL = 'study_rooms';
const MESSAGES_COL = 'study_room_messages';

/**
 * Create a new study room
 */
export const createStudyRoom = async (
    name: string,
    subject: string,
    ownerEmail: string,
    ownerName: string,
    isPrivate: boolean = false,
    passcode?: string
) => {
    const roomRef = collection(db, ROOMS_COL);
    const newRoom: Omit<StudyRoom, 'id'> = {
        name,
        subject,
        ownerEmail,
        ownerName,
        members: [{
            email: ownerEmail,
            name: ownerName,
            role: 'owner',
            joinedAt: Date.now()
        }],
        isPrivate,
        ...(passcode ? { passcode } : {}),
        createdAt: Date.now(),
        lastActive: Date.now(),
        timerState: {
            mode: 'focus',
            timeLeft: 25 * 60,
            isRunning: false,
            updatedAt: Date.now()
        }
    };
    const docRef = await addDoc(roomRef, newRoom);
    return docRef.id;
};

/**
 * Join a room
 */
export const joinStudyRoom = async (roomId: string, userEmail: string, userName: string, photoURL?: string) => {
    const roomRef = doc(db, ROOMS_COL, roomId);
    const member: StudyRoomMember = {
        email: userEmail,
        name: userName,
        photoURL,
        role: 'member',
        joinedAt: Date.now()
    };
    await updateDoc(roomRef, {
        members: arrayUnion(member),
        lastActive: Date.now()
    });
};

/**
 * Leave a room
 */
export const leaveStudyRoom = async (roomId: string, member: StudyRoomMember) => {
    const roomRef = doc(db, ROOMS_COL, roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const room = snap.data() as StudyRoom;

    // Auto-delete the room if the owner leaves, or if it's the last member
    if (member.role === 'owner' || room.members.length <= 1) {
        await deleteDoc(roomRef);
    } else {
        await updateDoc(roomRef, {
            members: arrayRemove(member)
        });
    }
};

/**
 * Subscribe to all available rooms
 */
export const subscribeToRooms = (callback: (rooms: StudyRoom[]) => void) => {
    const q = query(collection(db, ROOMS_COL), orderBy('lastActive', 'desc'));
    return onSnapshot(
        q,
        (snapshot) => {
            const rooms = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudyRoom));
            callback(rooms);
        },
        (error) => {
            console.error("Error in subscribeToRooms:", error);
        }
    );
};

/**
 * Subscribe to a specific room
 */
export const subscribeToRoom = (roomId: string, callback: (room: StudyRoom | null) => void) => {
    return onSnapshot(
        doc(db, ROOMS_COL, roomId),
        (d) => {
            if (d.exists()) {
                callback({ id: d.id, ...d.data() } as StudyRoom);
            } else {
                callback(null);
            }
        },
        (error) => {
            console.error("Error in subscribeToRoom:", error);
        }
    );
};

/**
 * Send message in room
 */
export const sendRoomMessage = async (roomId: string, senderEmail: string, senderName: string, text: string) => {
    const msgRef = collection(db, MESSAGES_COL);
    const newMsg: Omit<StudyRoomMessage, 'id'> = {
        roomId,
        senderEmail,
        senderName,
        text,
        timestamp: Date.now()
    };
    await addDoc(msgRef, newMsg);
    // Update room last active
    await updateDoc(doc(db, ROOMS_COL, roomId), { lastActive: Date.now() });
};

/**
 * Subscribe to room messages
 */
export const subscribeToRoomMessages = (roomId: string, callback: (msgs: StudyRoomMessage[]) => void) => {
    const q = query(
        collection(db, MESSAGES_COL),
        where('roomId', '==', roomId),
        orderBy('timestamp', 'asc')
    );
    return onSnapshot(
        q,
        (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudyRoomMessage));
            callback(msgs);
        },
        (error) => {
            console.error("Error in subscribeToRoomMessages:", error);
        }
    );
};

/**
 * Update sync timer state
 */
export const updateRoomTimer = async (roomId: string, timerState: StudyRoom['timerState']) => {
    if (!timerState) return;
    const roomRef = doc(db, ROOMS_COL, roomId);
    await updateDoc(roomRef, {
        timerState: {
            ...timerState,
            updatedAt: Date.now()
        }
    });
};

/**
 * Delete a room (only owner)
 */
export const deleteStudyRoom = async (roomId: string) => {
    await deleteDoc(doc(db, ROOMS_COL, roomId));
};
