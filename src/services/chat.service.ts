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
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, addDoc, where } from 'firebase/firestore';
import { auth, rtdb, db } from '@/config/firebase';
import type { ChatMessage, Friend, GroupChat } from '@/types';

// ============================================================
// HELPERS
// ============================================================

/** Sanitize email for use as Firebase RTDB key */
export function sanitizeEmail(email: string): string {
    return email.toLowerCase().replace(/\./g, ',').replace(/@/g, '_at_');
}

function getCurrentEmail(): string {
    return auth.currentUser?.email?.toLowerCase() || '';
}

function getCurrentName(): string {
    return auth.currentUser?.displayName || 'User';
}

/** Generate deterministic conversation ID from two emails */
export function getConversationId(email1: string, email2: string): string {
    const sorted = [sanitizeEmail(email1.toLowerCase()), sanitizeEmail(email2.toLowerCase())].sort();
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

    // Log unfriend action
    try {
        await addDoc(collection(db, 'unfriend_logs'), {
            userEmail: currentEmail,
            unfriendedEmail: friendEmail,
            timestamp: Date.now()
        });
    } catch (err) {
        console.error('[Chat] Failed to log unfriend action:', err);
    }
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

// In-memory cache for conversation logs to avoid reading doc every time
const convoLogCache: Record<string, string> = {};

export async function sendChatMessage(conversationId: string, text: string): Promise<ChatMessage | null> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail || !text.trim()) return null;

    // Get both user emails from conversationId
    const parts = conversationId.split('__');
    const myKey = sanitizeEmail(currentEmail);
    const partnerKey = parts.find(p => p !== myKey) ?? parts[0] ?? '';

    const timestamp = Date.now();
    const line = encodeMsg(timestamp, currentEmail, text.trim()) + MSG_LINE_BREAK;

    // Construct optimistic message
    const optimisticMsg: ChatMessage = {
        id: `msg_${Date.now()}_${timestamp}`,
        text: text.trim(),
        senderEmail: currentEmail,
        senderName: getCurrentName(),
        timestamp,
        role: 'user'
    };

    // Append to both users' docs (so each user has their own copy)
    for (const owner of parts) {
        // Unsanitize to get email for doc path
        const ownerEmail = owner.replace(/_at_/g, '@').replace(/,/g, '.');
        const partnerEmail = (owner === myKey ? partnerKey : myKey).replace(/_at_/g, '@').replace(/,/g, '.');

        // Use cache key: ownerEmail_partnerKey
        const cacheKey = `${ownerEmail}_${owner === myKey ? partnerKey : myKey}`;
        const docRef = getConvoDocRef(ownerEmail, owner === myKey ? partnerKey : myKey);

        try {
            console.log(`[Chat] Processing write for owner: ${ownerEmail} (Ref: chats/${ownerEmail}/convos/${owner === myKey ? partnerKey : myKey})`);

            let currentLog = convoLogCache[cacheKey];

            // If cache miss, fetch doc
            if (currentLog === undefined) {
                console.log(`[Chat] Cache miss for ${cacheKey}, fetching doc...`);
                const snap = await getDoc(docRef);
                currentLog = snap.exists() ? snap.data()?.log || '' : '';
                console.log(`[Chat] Doc fetched, length: ${currentLog?.length || 0}`);
            } else {
                console.log(`[Chat] Cache hit for ${cacheKey}`);
            }

            const newLog = currentLog + line;
            convoLogCache[cacheKey] = newLog; // Update cache

            const participants = [ownerEmail.toLowerCase(), partnerEmail.toLowerCase()].sort();
            const payload = {
                log: newLog,
                updatedAt: timestamp,
                participants,
                ownerEmail: ownerEmail.toLowerCase(),
                partnerEmail: partnerEmail.toLowerCase()
            };

            console.log(`[Chat] Writing payload to Firestore...`);
            if (currentLog) {
                await updateDoc(docRef, payload);
            } else {
                await setDoc(docRef, payload);
            }
            console.log(`[Chat] Write success for ${ownerEmail}`);
        } catch (err) {
            console.error(`[Chat] CRITICAL ERROR updating convo for ${ownerEmail}:`, err);
            // Invalidate cache on error
            delete convoLogCache[cacheKey];
        }
    }

    return optimisticMsg;
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
                // Map sanitized key back to email for UI lookup (e.g. user_at_gmail,com -> user@gmail.com)
                const email = docSnap.id === 'mago' ? 'mago' : docSnap.id.toLowerCase().replace(/_at_/g, '@').replace(/,/g, '.');
                results[email] = last;
            }
        });
        callback(results);
    }, (err) => {
        console.warn('[Chat] Firestore collection listener error:', err.message);
        callback({});
    });
}

// ============================================================
// GROUP CHAT SYSTEM — Firestore at group_chats/{groupId}
// ============================================================

const GROUP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export async function createGroupChat(name: string, members: string[]): Promise<string | null> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail || !name.trim()) return null;

    try {
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const groupRef = doc(db, 'group_chats', groupId);

        const allMembers = Array.from(new Set([currentEmail, ...members.map(m => m.toLowerCase())]));
        const avatarColor = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];

        const groupData: GroupChat = {
            id: groupId,
            name: name.trim(),
            createdBy: currentEmail,
            members: allMembers,
            createdAt: new Date().toISOString(),
            updatedAt: Date.now(),
            avatarColor
        };

        await setDoc(groupRef, {
            ...groupData,
            log: ''
        });

        return groupId;
    } catch (err) {
        console.error('[Chat] Failed to create group:', err);
        return null;
    }
}

export async function sendGroupMessage(groupId: string, text: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail || !text.trim()) return;

    try {
        const groupRef = doc(db, 'group_chats', groupId);
        const timestamp = Date.now();
        const line = encodeMsg(timestamp, currentEmail, text.trim()) + MSG_LINE_BREAK;

        const snap = await getDoc(groupRef);
        if (!snap.exists()) return;

        const currentLog = snap.data()?.log || '';
        await updateDoc(groupRef, {
            log: currentLog + line,
            updatedAt: timestamp
        });
    } catch (err) {
        console.error('[Chat] Failed to send group message:', err);
    }
}

export function subscribeToGroupMessages(groupId: string, callback: (messages: ChatMessage[]) => void) {
    const groupRef = doc(db, 'group_chats', groupId);

    return onSnapshot(
        groupRef,
        (snap) => {
            if (!snap.exists()) { callback([]); return; }
            const data = snap.data();
            callback(decodeLog(data?.log || ''));
        },
        (error) => {
            console.error("[Chat] Group messages listener error:", error);
            callback([]);
        }
    );
}

export function subscribeToGroupChats(callback: (groups: GroupChat[]) => void) {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) { callback([]); return () => { }; }

    const groupsRef = collection(db, 'group_chats');
    const q = query(groupsRef, where('members', 'array-contains', currentEmail.toLowerCase()));

    return onSnapshot(
        q,
        (snap) => {
            const groups: GroupChat[] = [];
            snap.forEach(docSnap => {
                const data = docSnap.data();
                groups.push({
                    id: docSnap.id,
                    name: data.name,
                    createdBy: data.createdBy,
                    members: data.members,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    avatarColor: data.avatarColor
                });
            });
            // Sort by updatedAt
            groups.sort((a, b) => b.updatedAt - a.updatedAt);
            callback(groups);
        },
        (err) => {
            console.warn('[Chat] Failed to subscribe to groups:', err);
            callback([]);
        }
    );
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
    const participants = [currentEmail.toLowerCase(), 'mago@studystation.site'];
    const payload = {
        log: (snap.exists() ? snap.data()?.log || '' : '') + line,
        updatedAt: Date.now(),
        participants,
        ownerEmail: currentEmail.toLowerCase(),
        partnerEmail: 'mago@studystation.site'
    };

    if (snap.exists()) {
        await updateDoc(docRef, payload);
    } else {
        await setDoc(docRef, payload);
    }
}

export async function saveMagoResponse(text: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) return;

    const line = encodeMsg(Date.now(), 'mago@studystation.site', text.trim(), 'mago') + MSG_LINE_BREAK;
    const docRef = getConvoDocRef(currentEmail, 'mago');

    const snap = await getDoc(docRef);
    const participants = [currentEmail.toLowerCase(), 'mago@studystation.site'];
    const payload = {
        log: (snap.exists() ? snap.data()?.log || '' : '') + line,
        updatedAt: Date.now(),
        participants,
        ownerEmail: currentEmail.toLowerCase(),
        partnerEmail: 'mago@studystation.site'
    };

    if (snap.exists()) {
        await updateDoc(docRef, payload);
    } else {
        await setDoc(docRef, payload);
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
