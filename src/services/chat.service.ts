/**
 * Chat Service — Firebase RTDB-based chat system
 * Handles friend requests, messaging, and Mago AI conversations
 */
import {
    ref,
    set,
    onValue,
    remove,
    get,
} from 'firebase/database';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query } from 'firebase/firestore';
import { auth, rtdb, db } from '@/config/firebase';
import type { ChatMessage, Friend } from '@/types';

// ============================================================
// HELPERS
// ============================================================

/** Sanitize email for use as Firebase RTDB key */
export function sanitizeEmail(email: string): string {
    return email.replace(/\./g, ',').replace(/@/g, '_at_');
}

function getCurrentEmail(): string {
    return auth.currentUser?.email || '';
}

function getCurrentName(): string {
    return auth.currentUser?.displayName || 'User';
}

/** Generate deterministic conversation ID from two emails */
export function getConversationId(email1: string, email2: string): string {
    const sorted = [sanitizeEmail(email1), sanitizeEmail(email2)].sort();
    return `${sorted[0]}__${sorted[1]}`;
}

// ============================================================
// FRIEND SYSTEM
// ============================================================

export async function sendFriendRequest(targetEmail: string): Promise<{ success: boolean; error?: string }> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) return { success: false, error: 'Chưa đăng nhập' };

    const normalizedTarget = targetEmail.trim().toLowerCase();
    const normalizedCurrent = currentEmail.toLowerCase();

    if (normalizedTarget === normalizedCurrent) {
        return { success: false, error: 'Không thể tự kết bạn' };
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedTarget)) {
        return { success: false, error: 'Email không hợp lệ' };
    }

    const myKey = sanitizeEmail(normalizedCurrent);
    const friendKey = sanitizeEmail(normalizedTarget);

    try {
        // Check if target email exists in system (allowed_users)
        const userDoc = await getDoc(doc(db, 'allowed_users', normalizedTarget));
        if (!userDoc.exists()) {
            return { success: false, error: 'Email này chưa đăng ký StudyStation' };
        }

        // Check if already friends or pending
        const existingRef = ref(rtdb, `hub/friends/${myKey}/${friendKey}`);
        const existingSnap = await get(existingRef);
        if (existingSnap.exists()) {
            const data = existingSnap.val();
            if (data.status === 'accepted') return { success: false, error: 'Đã là bạn bè' };
            if (data.status === 'pending_sent') return { success: false, error: 'Đã gửi lời mời rồi' };
            if (data.status === 'pending_received') return { success: false, error: 'Người này đã gửi lời mời cho bạn, hãy chấp nhận!' };
        }

        // Get target user's display name from Firestore
        const targetData = userDoc.data();
        const targetDisplayName = targetData?.name || normalizedTarget;

        // Create friend entry for current user (sent)
        await set(ref(rtdb, `hub/friends/${myKey}/${friendKey}`), {
            email: normalizedTarget,
            displayName: targetDisplayName,
            photoURL: targetData?.photoURL || null,
            status: 'pending_sent',
            addedAt: new Date().toISOString(),
        });

        // Create friend entry for target user (received)
        await set(ref(rtdb, `hub/friends/${friendKey}/${myKey}`), {
            email: normalizedCurrent,
            displayName: getCurrentName(),
            photoURL: auth.currentUser?.photoURL || null,
            status: 'pending_received',
            addedAt: new Date().toISOString(),
        });

        return { success: true };
    } catch (err) {
        console.error('[Chat] Friend request error:', err);
        return { success: false, error: 'Lỗi gửi lời mời. Vui lòng thử lại.' };
    }
}

export async function acceptFriendRequest(friendEmail: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    const myKey = sanitizeEmail(currentEmail);
    const friendKey = sanitizeEmail(friendEmail);

    await set(ref(rtdb, `hub/friends/${myKey}/${friendKey}/status`), 'accepted');
    await set(ref(rtdb, `hub/friends/${friendKey}/${myKey}/status`), 'accepted');
    // Update display name for the friend's entry
    await set(ref(rtdb, `hub/friends/${friendKey}/${myKey}/displayName`), getCurrentName());
}

export async function removeFriend(friendEmail: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    const myKey = sanitizeEmail(currentEmail);
    const friendKey = sanitizeEmail(friendEmail);

    await remove(ref(rtdb, `hub/friends/${myKey}/${friendKey}`));
    await remove(ref(rtdb, `hub/friends/${friendKey}/${myKey}`));
}

export function subscribeFriends(callback: (friends: Friend[]) => void) {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) { callback([]); return () => { }; }

    const myKey = sanitizeEmail(currentEmail);
    const friendsRef = ref(rtdb, `hub/friends/${myKey}`);

    return onValue(friendsRef, (snap) => {
        const data = snap.val();
        if (!data) { callback([]); return; }

        const friends: Friend[] = Object.entries(data).map(([, val]) => {
            const v = val as Friend;
            return {
                email: v.email,
                displayName: v.displayName || v.email,
                photoURL: v.photoURL,
                status: v.status,
                addedAt: v.addedAt,
            };
        });
        callback(friends);
    });
}

// ============================================================
// MESSAGING — Firestore compact text format
// Structure: chats/{userEmail}/convos/{partnerEmail}
// Each doc has a `log` field: "timestamp|sender|text\n" per line
// ============================================================

const MSG_SEPARATOR = '|';
const MSG_LINE_BREAK = '\n';

/** Encode a message line */
function encodeMsg(timestamp: number, senderEmail: string, text: string, role?: string): string {
    // Escape pipe and newline in text
    const safeText = text.replace(/\|/g, '\\|').replace(/\n/g, '\\n');
    const parts = [timestamp, senderEmail, safeText];
    if (role) parts.push(role);
    return parts.join(MSG_SEPARATOR);
}

/** Decode a log string into ChatMessage array */
function decodeLog(log: string): ChatMessage[] {
    if (!log || !log.trim()) return [];
    return log.trim().split(MSG_LINE_BREAK).filter(Boolean).map((line, idx) => {
        const parts = line.split(MSG_SEPARATOR);
        const timestamp = parseInt(parts[0] || '0');
        const senderEmail = parts[1] || '';
        // Rejoin remaining parts in case text had escaped pipes
        const lastPart = parts[parts.length - 1] ?? '';
        const hasRole = parts.length > 3 && ['user', 'mago'].includes(lastPart);
        let text = parts.slice(2, hasRole ? parts.length - 1 : parts.length).join('|');
        text = text.replace(/\\\|/g, '|').replace(/\\n/g, '\n');
        const role = hasRole ? lastPart as 'user' | 'mago' : undefined;
        return {
            id: `msg_${idx}_${timestamp}`,
            text,
            senderEmail,
            senderName: senderEmail.split('@')[0] || senderEmail,
            timestamp,
            ...(role ? { role } : {}),
        };
    });
}

/** Get the Firestore doc ref for a conversation */
function getConvoDocRef(userEmail: string, partnerKey: string) {
    return doc(db, 'chats', userEmail, 'convos', partnerKey);
}

export async function sendChatMessage(conversationId: string, text: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail || !text.trim()) return;

    // Get both user emails from conversationId
    const parts = conversationId.split('__');
    const myKey = sanitizeEmail(currentEmail);
    const partnerKey = parts.find(p => p !== myKey) ?? parts[0] ?? '';

    const line = encodeMsg(Date.now(), currentEmail, text.trim()) + MSG_LINE_BREAK;

    // Append to both users' docs (so each user has their own copy)

    for (const owner of parts) {
        // Unsanitize to get email for doc path
        const ownerEmail = owner.replace(/_at_/g, '@').replace(/,/g, '.');
        const pKey = owner === myKey ? partnerKey : myKey;
        const docRef = getConvoDocRef(ownerEmail, pKey);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            await updateDoc(docRef, { log: (snap.data().log || '') + line, updatedAt: Date.now() });
        } else {
            await setDoc(docRef, { log: line, updatedAt: Date.now() });
        }
    }
}

export function subscribeToMessages(conversationId: string, callback: (messages: ChatMessage[]) => void) {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) { callback([]); return () => { }; }

    const myKey = sanitizeEmail(currentEmail);
    const parts = conversationId.split('__');
    const partnerKey = parts.find(p => p !== myKey) ?? parts[0] ?? '';

    const docRef = getConvoDocRef(currentEmail, partnerKey);

    // Use Firestore onSnapshot for real-time
    return onSnapshot(docRef, (snap) => {
        if (!snap.exists()) { callback([]); return; }
        const data = snap.data();
        callback(decodeLog(data?.log || ''));
    }, (err) => {
        console.warn('[Chat] Firestore listener error (permission?):', err.message);
        callback([]);
    });
}

/** Subscribe to all conversations for the current user in one listener */
export function subscribeToAllConvos(callback: (lastMessages: Record<string, ChatMessage>) => void) {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) { callback({}); return () => { }; }

    const colRef = collection(db, 'chats', currentEmail, 'convos');
    const q = query(colRef);

    return onSnapshot(q, (snap) => {
        const results: Record<string, ChatMessage> = {};
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const msgs = decodeLog(data.log || '');
            const last = msgs[msgs.length - 1];
            if (last) {
                results[docSnap.id] = last;
            }
        });
        callback(results);
    }, (err) => {
        console.warn('[Chat] Firestore collection listener error:', err.message);
        callback({});
    });
}

// ============================================================
// MAGO AI CHAT — stored in Firestore at chats/{email}/convos/mago
// ============================================================

export async function sendMagoMessage(text: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail || !text.trim()) return;

    const line = encodeMsg(Date.now(), currentEmail, text.trim(), 'user') + MSG_LINE_BREAK;
    const docRef = getConvoDocRef(currentEmail, 'mago');

    const snap = await getDoc(docRef);
    if (snap.exists()) {
        await updateDoc(docRef, { log: (snap.data().log || '') + line, updatedAt: Date.now() });
    } else {
        await setDoc(docRef, { log: line, updatedAt: Date.now() });
    }
}

export async function saveMagoResponse(text: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) return;

    const line = encodeMsg(Date.now(), 'mago@studystation.site', text.trim(), 'mago') + MSG_LINE_BREAK;
    const docRef = getConvoDocRef(currentEmail, 'mago');

    const snap = await getDoc(docRef);
    if (snap.exists()) {
        await updateDoc(docRef, { log: (snap.data().log || '') + line, updatedAt: Date.now() });
    } else {
        await setDoc(docRef, { log: line, updatedAt: Date.now() });
    }
}

export function subscribeToMagoMessages(callback: (messages: ChatMessage[]) => void) {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) { callback([]); return () => { }; }

    const docRef = getConvoDocRef(currentEmail, 'mago');

    return onSnapshot(docRef, (snap) => {
        if (!snap.exists()) { callback([]); return; }
        const data = snap.data();
        callback(decodeLog(data?.log || ''));
    }, (err) => {
        console.warn('[Chat] Mago Firestore listener error (permission?):', err.message);
        callback([]);
    });
}

// MAGO SYSTEM PROMPT
export const MAGO_SYSTEM_PROMPT = `Bạn là Mago 🧙‍♂️ — trợ lý AI của StudyStation. Luôn xưng "tôi" (Mago) và gọi người dùng là "bạn".

StudyStation là nền tảng học tập trực tuyến:
- Bài Thi: Trắc nghiệm nhiều môn (Classic/Review mode)
- E-test: Đề thi tiếng Anh
- Flashcard: Học từ vựng
- Thời Khóa Biểu: Xem lịch học
- Hub (nút tròn góc màn hình): Pomodoro, Notes, Chat, Study Tracker, Theme
- Admin: Khu vực giáo viên quản lý đề thi, học sinh

QUY TẮC BẮT BUỘC:
1. LUÔN xưng "tôi" và gọi "bạn" — KHÔNG ĐƯỢC dùng "mình", "em", "anh", "chị"
2. Trả lời NGẮN GỌN NHẤT CÓ THỂ, tối đa 2-3 câu, đúng trọng tâm
3. Dùng emoji phù hợp nhưng không quá nhiều
4. Tiếng Việt, thân thiện, vui vẻ
5. Nếu không biết: "Tôi chưa rõ phần này, bạn hỏi thầy cô nhé! 😊"`;

// ============================================================
// PRESENCE CHECK FOR FRIENDS (3-minute threshold)
// ============================================================

const FRIEND_ONLINE_THRESHOLD_MS = 180_000; // 3 minutes

export function subscribeFriendPresence(
    friendEmails: string[],
    callback: (onlineMap: Record<string, boolean>) => void
) {
    if (!friendEmails.length) { callback({}); return () => { }; }

    const presenceListRef = ref(rtdb, 'presence');
    let latestData: Record<string, { email?: string; lastHeartbeat?: number }> | null = null;

    const evaluate = () => {
        const result: Record<string, boolean> = {};
        const now = Date.now();
        const normalizedEmails = new Set(friendEmails.map(e => e.toLowerCase()));

        if (latestData) {
            for (const entry of Object.values(latestData)) {
                const email = entry.email?.toLowerCase();
                if (email && normalizedEmails.has(email)) {
                    const isOnline = entry.lastHeartbeat
                        ? (now - entry.lastHeartbeat) < FRIEND_ONLINE_THRESHOLD_MS
                        : false;
                    if (!result[email] || isOnline) {
                        result[email] = isOnline;
                    }
                }
            }
        }

        for (const email of normalizedEmails) {
            if (!(email in result)) result[email] = false;
        }
        callback(result);
    };

    const unsub = onValue(presenceListRef, (snap) => {
        latestData = snap.val();
        evaluate();
    });

    const recheckInterval = setInterval(evaluate, 60_000);

    return () => {
        unsub();
        clearInterval(recheckInterval);
    };
}
