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
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, addDoc, where, deleteDoc, arrayUnion, arrayRemove, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { runTransaction } from 'firebase/firestore';
import { auth, rtdb, db } from '@/config/firebase';
import type { ChatMessage, Friend, GroupChat } from '@/types';
import { getUserRole, hasUnlimitedMagoAccess } from './auth.service';
import { getUserMagocoins, updateMagocoins } from './magocoin.service';

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

/** Cancel a sent friend request */
export async function cancelFriendRequest(targetEmail: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    const myKey = sanitizeEmail(currentEmail);
    const friendKey = sanitizeEmail(targetEmail);

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

        const normalizedCreator = currentEmail.toLowerCase();
        const pending = members.map(m => m.toLowerCase()).filter(m => m !== normalizedCreator);
        const avatarColor = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];

        const groupData: GroupChat = {
            id: groupId,
            name: name.trim(),
            createdBy: currentEmail,
            members: [normalizedCreator], // Only creator is a member initially
            pendingInvites: pending,
            allRelated: [normalizedCreator, ...pending],
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

export async function renameGroupChat(groupId: string, newName: string): Promise<void> {
    const groupRef = doc(db, 'group_chats', groupId);
    await updateDoc(groupRef, {
        name: newName.trim(),
        updatedAt: Date.now()
    });
}

export async function deleteGroupChat(groupId: string): Promise<void> {
    const groupRef = doc(db, 'group_chats', groupId);
    await deleteDoc(groupRef);
}

export async function addGroupMembers(groupId: string, newMemberEmails: string[]): Promise<void> {
    const groupRef = doc(db, 'group_chats', groupId);
    const normalized = newMemberEmails.map(m => m.toLowerCase());
    await updateDoc(groupRef, {
        pendingInvites: arrayUnion(...normalized),
        allRelated: arrayUnion(...normalized)
    });
}

export async function leaveGroupChat(groupId: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) return;
    const groupRef = doc(db, 'group_chats', groupId);
    await updateDoc(groupRef, {
        members: arrayRemove(currentEmail.toLowerCase()),
        allRelated: arrayRemove(currentEmail.toLowerCase())
    });
}

export async function acceptGroupInvite(groupId: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) return;
    const normalized = currentEmail.toLowerCase();
    const groupRef = doc(db, 'group_chats', groupId);
    await updateDoc(groupRef, {
        members: arrayUnion(normalized),
        pendingInvites: arrayRemove(normalized)
    });
}

export async function rejectGroupInvite(groupId: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) return;
    const normalized = currentEmail.toLowerCase();
    const groupRef = doc(db, 'group_chats', groupId);
    await updateDoc(groupRef, {
        pendingInvites: arrayRemove(normalized),
        allRelated: arrayRemove(normalized)
    });
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
    // Query groups where user is a member OR has a pending invite via allRelated field
    const q = query(groupsRef, where('allRelated', 'array-contains', currentEmail.toLowerCase()));

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
                    pendingInvites: data.pendingInvites,
                    allRelated: data.allRelated,
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

// MAGO_DAILY_LIMIT replaced by Magocoin system
const MAGO_TRAINING_COLLECTION = 'mago_training';
const MAGO_TRAINING_CACHE_TTL_MS = 60_000;
const MAGO_PRIVATE_OWNER_EMAILS = [
    'duongkhanhnhu1304@gmail.com',
    'nguyentrongphucdthap@gmail.com',
];
const MAGO_PRIVATE_OWNER_ALIASES = ['phopuc', 'pho phuc', 'phophuc'];
const MAGO_PRIVATE_OWNER_LOCALS = MAGO_PRIVATE_OWNER_EMAILS
    .map((email) => email.split('@')[0] || '')
    .filter(Boolean);

let magoTrainingPromptCache: {
    value: Record<string, string>;
    expiresAt: number;
} = {
    value: {},
    expiresAt: 0,
};

type MagoTrainingEntry = {
    content?: string;
    createdAt?: number;
    createdBy?: string;
    roleSnapshot?: string;
    visibility?: 'public' | 'owner_only';
    visibleTo?: string[];
};

export type MagoTrainingKnowledgeItem = {
    id: string;
    content: string;
    createdAt: number;
    createdBy: string;
    visibility: 'public' | 'owner_only';
    roleSnapshot?: string;
};

function isBossRole(role: string): boolean {
    return /boss/i.test(role);
}

function includesPrivateOwnerAlias(value: string): boolean {
    const lower = value.toLowerCase();
    return MAGO_PRIVATE_OWNER_ALIASES.some(alias => lower.includes(alias));
}

function isOwnerEmail(email: string): boolean {
    return MAGO_PRIVATE_OWNER_EMAILS.includes(String(email || '').toLowerCase());
}

function shouldKeepPrivateKnowledge(params: { content: string; createdBy: string; roleSnapshot?: string }): boolean {
    const content = params.content.toLowerCase();
    const createdBy = params.createdBy.toLowerCase();
    const roleSnapshot = String(params.roleSnapshot || '');
    return (
        isBossRole(roleSnapshot) ||
        isOwnerEmail(createdBy) ||
        MAGO_PRIVATE_OWNER_EMAILS.some((email) => content.includes(email)) ||
        MAGO_PRIVATE_OWNER_LOCALS.some((local) => content.includes(local)) ||
        includesPrivateOwnerAlias(content)
    );
}

function canViewerAccessKnowledge(entry: MagoTrainingEntry, viewerEmail: string): boolean {
    const viewer = viewerEmail.toLowerCase();
    const viewerRole = getUserRole();
    if (isBossRole(viewerRole)) {
        return true;
    }

    const createdBy = String(entry.createdBy || '').toLowerCase();
    const roleSnapshot = String(entry.roleSnapshot || '');
    const visibleTo = Array.isArray(entry.visibleTo)
        ? entry.visibleTo.map((e) => String(e || '').toLowerCase())
        : [];

    if (entry.visibility === 'owner_only') {
        return isOwnerEmail(viewer) || visibleTo.includes(viewer);
    }

    // Backward compatibility for older docs:
    // if created by protected owner or content clearly targets PhoPhuc, treat as private.
    const rawContent = String(entry.content || '');
    if (shouldKeepPrivateKnowledge({ content: rawContent, createdBy, roleSnapshot })) {
        return isOwnerEmail(viewer) || visibleTo.includes(viewer);
    }

    return true;
}

function buildMagoPrivacyGuardrail(viewerEmail: string): string {
    const isOwner = isOwnerEmail(viewerEmail);
    const isBossViewer = isBossRole(getUserRole());
    const ownersText = MAGO_PRIVATE_OWNER_EMAILS.join(' / ');
    if (isOwner || isBossViewer) {
        return [
            '',
            '[QUY TAC BAO MAT NOI BO - PHOPHUC]',
            `Noi dung rieng tu lien quan PhoPhuc chi duoc chia se voi cac tai khoan chu: ${ownersText}.`,
            '',
        ].join('\n');
    }

    return [
        '',
        '[QUY TAC BAO MAT NOI BO - PHOPHUC]',
        `Tuyet doi KHONG tiet lo, nhac lai, tom tat, suy dien hay xac nhan bat ky noi dung nao lien quan PhoPhuc/phopuc/phophuc cho bat ky ai khac ngoai cac tai khoan chu: ${ownersText}.`,
        'Neu nguoi dung hoi ve noi dung rieng tu do, tu choi lich su va noi rang thong tin nay duoc bao mat.',
        '',
    ].join('\n');
}

function normalizeVN(input: string): string {
    return String(input || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();
}

function extractRelayContent(raw: string): string {
    const text = String(raw || '').trim();
    if (!text) return '';

    const colonMatch = text.match(/[:：]\s*(.+)$/);
    if (colonMatch?.[1]) {
        return colonMatch[1].trim();
    }

    const clauseMatch = text.match(/(?:rằng|rang|là|la|nội dung|noi dung)\s+(.+)$/i);
    if (clauseMatch?.[1]) {
        return clauseMatch[1].trim();
    }

    const leadRemoved = text.replace(
        /^(?:mago\s+)?(?:nhắn|nhan|gửi|gui|báo|bao)\s+(?:tin\s+)?(?:giúp\s+)?(?:cho|tới|toi)?\s*(?:ph[oô] ?ph[uư]c|phophuc|bà chủ|ba chu|chị chủ|chi chu|chủ web|chu web|duongkhanhnhu1304@gmail\.com|nguyentrongphucdthap@gmail\.com)\s*/i,
        ''
    ).trim();

    if (leadRemoved.length >= 3 && leadRemoved !== text) {
        return leadRemoved;
    }

    return '';
}

function isRelayToOwnersRequest(raw: string): boolean {
    const normalized = normalizeVN(raw);
    const hasAction = /(nhan|gui|bao|chuyen loi)/.test(normalized);
    const hasTarget = /(pho ?phuc|phophuc|ba chu|chi chu|chu web|duongkhanhnhu1304@gmail\.com|nguyentrongphucdthap@gmail\.com)/.test(normalized);
    return hasAction && hasTarget;
}

function extractMarkdownImageUrls(text: string): string[] {
    const urls: string[] = [];
    const regex = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(text)) !== null) {
        if (match[1]) urls.push(match[1]);
    }
    return Array.from(new Set(urls));
}

export async function relayMagoMessageToOwnersIfRequested(rawUserText: string): Promise<{ relayed: boolean; deliveredTo: string[] }> {
    return relayMagoMessageToOwnersIfRequestedWithSource(rawUserText, rawUserText);
}

async function appendMagoRelayForOwner(ownerEmail: string, relayLine: string): Promise<void> {
    const docRef = getConvoDocRef(ownerEmail, 'mago');
    const participants = [ownerEmail.toLowerCase(), 'mago@studystation.site'];

    await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        const currentLog = snap.exists() ? (snap.data()?.log || '') : '';
        const payload = {
            log: currentLog + relayLine,
            updatedAt: Date.now(),
            participants,
            ownerEmail: ownerEmail.toLowerCase(),
            partnerEmail: 'mago@studystation.site',
        };

        if (snap.exists()) {
            tx.update(docRef, payload);
        } else {
            tx.set(docRef, payload);
        }
    });
}

export async function relayMagoMessageToOwnersIfRequestedWithSource(
    rawUserText: string,
    relaySourceText: string
): Promise<{ relayed: boolean; deliveredTo: string[]; failedTo: string[] }> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) return { relayed: false, deliveredTo: [], failedTo: [] };

    if (!isRelayToOwnersRequest(rawUserText)) {
        return { relayed: false, deliveredTo: [], failedTo: [] };
    }

    const relayContent =
        extractRelayContent(relaySourceText) ||
        extractRelayContent(rawUserText) ||
        String(relaySourceText || '').trim();
    if (!relayContent) {
        return { relayed: false, deliveredTo: [], failedTo: [] };
    }

    const deliveredTo: string[] = [];
    const failedTo: string[] = [];
    const imageUrls = extractMarkdownImageUrls(relayContent);
    const imageLinks = imageUrls.length > 0
        ? `\n\nLink ảnh trực tiếp:\n${imageUrls.map((url, idx) => `${idx + 1}. ${url}`).join('\n')}`
        : '';
    const relayLine = encodeMsg(
        Date.now(),
        'mago@studystation.site',
        `📨 Có người dùng nhờ tôi nhắn: ${relayContent}${imageLinks}\n\n(Người gửi: ${currentEmail})`,
        'mago'
    ) + MSG_LINE_BREAK;

    for (const ownerEmail of MAGO_PRIVATE_OWNER_EMAILS) {
        try {
            await appendMagoRelayForOwner(ownerEmail, relayLine);
            deliveredTo.push(ownerEmail);
        } catch (error) {
            console.error('[Chat] Relay to owner failed:', ownerEmail, error);
            failedTo.push(ownerEmail);
        }
    }

    return { relayed: deliveredTo.length > 0, deliveredTo, failedTo };
}

/**
 * Removed getMagoUsageCountToday and replaced with Magocoin system.
 */

export async function sendMagoMessage(text: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail || !text.trim()) return;

    // Check usage limit (everyone must use Magocoins)
    const balance = await getUserMagocoins(currentEmail);
    if (balance < 1) {
        throw new Error('MAGO_LIMIT_REACHED');
    }
    // Deduct 1 Magocoin
    await updateMagocoins(currentEmail, -1);

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

export async function addMagoTeachingKnowledge(content: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) return;

    const role = getUserRole();
    if (!hasUnlimitedMagoAccess(role)) {
        throw new Error('MAGO_TEACH_FORBIDDEN');
    }

    const cleaned = String(content || '').trim();
    if (!cleaned) return;

    const trimmed = cleaned.slice(0, 8000);
    const isPrivate = shouldKeepPrivateKnowledge({
        content: trimmed,
        createdBy: currentEmail,
        roleSnapshot: role,
    });

    await addDoc(collection(db, MAGO_TRAINING_COLLECTION), {
        content: trimmed,
        createdBy: currentEmail,
        createdAt: Date.now(),
        roleSnapshot: role,
        visibility: isPrivate ? 'owner_only' : 'public',
        visibleTo: isPrivate ? MAGO_PRIVATE_OWNER_EMAILS : [],
    });

    // Invalidate prompt cache so newest teaching appears immediately.
    magoTrainingPromptCache.expiresAt = 0;
    magoTrainingPromptCache.value = {};
}

export async function getMagoTeachingKnowledgeList(): Promise<MagoTrainingKnowledgeItem[]> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) return [];

    const role = getUserRole();
    if (!hasUnlimitedMagoAccess(role)) {
        throw new Error('MAGO_TEACH_FORBIDDEN');
    }

    const q = query(
        collection(db, MAGO_TRAINING_COLLECTION),
        orderBy('createdAt', 'desc'),
        firestoreLimit(120)
    );
    const snap = await getDocs(q);

    return snap.docs
        .map((docSnap) => {
            const data = docSnap.data() as MagoTrainingEntry;
            return {
                id: docSnap.id,
                content: String(data.content || ''),
                createdAt: Number(data.createdAt || 0),
                createdBy: String(data.createdBy || 'unknown'),
                visibility: (data.visibility || 'public') as 'public' | 'owner_only',
                roleSnapshot: data.roleSnapshot,
            } as MagoTrainingKnowledgeItem;
        })
        .filter((item) => item.content.trim());
}

export async function updateMagoTeachingKnowledge(id: string, content: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) return;

    const role = getUserRole();
    if (!hasUnlimitedMagoAccess(role)) {
        throw new Error('MAGO_TEACH_FORBIDDEN');
    }

    const cleaned = String(content || '').trim();
    if (!cleaned) {
        throw new Error('MAGO_TEACH_EMPTY');
    }

    const refDoc = doc(db, MAGO_TRAINING_COLLECTION, id);
    const snap = await getDoc(refDoc);
    if (!snap.exists()) {
        throw new Error('MAGO_TEACH_NOT_FOUND');
    }

    const existing = snap.data() as MagoTrainingEntry;
    const trimmed = cleaned.slice(0, 8000);
    const isPrivate = shouldKeepPrivateKnowledge({
        content: trimmed,
        createdBy: String(existing.createdBy || currentEmail),
        roleSnapshot: String(existing.roleSnapshot || role),
    });

    await updateDoc(refDoc, {
        content: trimmed,
        visibility: isPrivate ? 'owner_only' : 'public',
        visibleTo: isPrivate ? MAGO_PRIVATE_OWNER_EMAILS : [],
        updatedAt: Date.now(),
        updatedBy: currentEmail,
    });

    magoTrainingPromptCache.expiresAt = 0;
    magoTrainingPromptCache.value = {};
}

export async function deleteMagoTeachingKnowledge(id: string): Promise<void> {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) return;

    const role = getUserRole();
    if (!hasUnlimitedMagoAccess(role)) {
        throw new Error('MAGO_TEACH_FORBIDDEN');
    }

    await deleteDoc(doc(db, MAGO_TRAINING_COLLECTION, id));

    magoTrainingPromptCache.expiresAt = 0;
    magoTrainingPromptCache.value = {};
}

export async function getMagoTeachingSystemPrompt(viewerEmail?: string): Promise<string> {
    const resolvedViewer = String(viewerEmail || getCurrentEmail() || '').toLowerCase();
    if (!resolvedViewer) {
        return buildMagoPrivacyGuardrail('');
    }

    const now = Date.now();
    if (now < magoTrainingPromptCache.expiresAt && magoTrainingPromptCache.value[resolvedViewer] !== undefined) {
        return magoTrainingPromptCache.value[resolvedViewer];
    }

    try {
        const q = query(
            collection(db, MAGO_TRAINING_COLLECTION),
            orderBy('createdAt', 'desc'),
            firestoreLimit(30)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            const onlyGuardrail = buildMagoPrivacyGuardrail(resolvedViewer);
            magoTrainingPromptCache = {
                value: {
                    ...magoTrainingPromptCache.value,
                    [resolvedViewer]: onlyGuardrail,
                },
                expiresAt: now + MAGO_TRAINING_CACHE_TTL_MS,
            };
            return onlyGuardrail;
        }

        const entries = snap.docs
            .map((d) => d.data() as MagoTrainingEntry)
            .filter((d) => typeof d.content === 'string' && d.content.trim() && canViewerAccessKnowledge(d, resolvedViewer))
            .reverse();

        const lines = entries.map((entry, idx) => {
            const compact = entry.content!.replace(/\s+/g, ' ').trim().slice(0, 420);
            return `${idx + 1}. ${compact}`;
        });

        const privacyGuardrail = buildMagoPrivacyGuardrail(resolvedViewer);
        const promptAddon = lines.length
            ? [
                privacyGuardrail,
                '[TRI THUC BO SUNG TU CHE DO DAY CUA BOSS/SUPER ADMIN]',
                'Duoi day la cac thong tin da duoc day bo sung. Uu tien ap dung neu phu hop va khong mau thuan:',
                ...lines,
                '',
            ].join('\n')
            : privacyGuardrail;

        magoTrainingPromptCache = {
            value: {
                ...magoTrainingPromptCache.value,
                [resolvedViewer]: promptAddon,
            },
            expiresAt: now + MAGO_TRAINING_CACHE_TTL_MS,
        };

        return promptAddon;
    } catch (err) {
        console.warn('[Chat] Failed to load Mago teaching knowledge:', err);
        return '';
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
export const MAGO_SYSTEM_PROMPT = `Bạn là Mago 🧙‍♂️ — trợ lý AI siêu dễ thương của StudyStation! Luôn xưng "tôi" (Mago) và gọi người dùng là "bạn".

🏫 VỀ STUDYSTATION:
StudyStation (v1.2) là nền tảng học tập trực tuyến dành cho học sinh, được phát triển bởi Nguyễn Trọng Phúc (biệt danh: PhoPhuc). 💖 Tin mật từ Mago: PhoPhuc đã có người yêu rồi nhé, và cô ấy chính là người con gái vừa xinh đẹp vừa học giỏi nhất thế gian! 🎓😍 Website giúp học sinh ôn bài, làm đề thi, học từ vựng và kết nối cùng bạn bè.

📚 CÁC TÍNH NĂNG CHÍNH:
1. **Bài Thi (Practice)**: Kho đề thi trắc nghiệm nhiều môn — có 2 chế độ:
   - Classic Mode: Làm bài và nộp một lần
   - Review Mode: Xem đáp án ngay sau mỗi câu, luyện tập thoải mái
2. **E-test**: Đề thi tiếng Anh chuyên biệt, giao diện riêng
3. **Flashcard (Từ vựng)**: Học từ vựng bằng thẻ lật, giúp ghi nhớ nhanh hơn
4. **Thời Khóa Biểu**: Xem lịch học hàng tuần, do giáo viên cập nhật
5. **Hub — Nút tròn góc màn hình** (FloatingHub):
   - 💬 Chat: Nhắn tin với bạn bè, tạo nhóm chat, mời bạn vào nhóm
   - 🧙‍♂️ Mago AI: Trợ lý thông minh (chính là tôi đây!)
   - ⏱ Pomodoro: Đồng hồ tập trung 25 phút
   - 📝 Notes: Ghi chú nhanh với editor rich text
   - 📊 Study Tracker: Theo dõi tiến độ học tập, streak học mỗi ngày
   - 🎵 Music: Nghe nhạc Lofi để tập trung (YouTube, Spotify, SoundCloud)
   - 🎨 Theme: Đổi giao diện, màu sắc, dark mode, hình nền tùy chỉnh
   - 👥 Phòng học (Study Rooms): Học nhóm trực tuyến với đồng hồ Pomodoro đồng bộ và chat nhóm
6. **Khu vực Giáo viên (Admin)**: Quản lý đề thi, học sinh, thông báo — chỉ dành cho thầy cô

🎭 PHONG CÁCH TRẢ LỜI:
1. LUÔN xưng "tôi" và gọi "bạn" — TUYỆT ĐỐI KHÔNG dùng "mình", "em", "anh", "chị"
2. Trả lời NGẮN GỌN, dí dỏm, gần gũi như một người bạn học vui tính
3. Dùng emoji vui vẻ nhưng đừng quá lộn xộn (1-3 emoji mỗi tin nhắn)
4. Tiếng Việt là chính, có thể xen chút tiếng Anh cho "cool"
5. Hay pha trò, nói kiểu gen Z một chút cho dễ thương
6. Khi giải thích kiến thức, phải dễ hiểu, ví dụ thực tế, tránh học thuật khô khan
7. Khuyến khích và động viên người dùng học tập

🚫 KHÔNG ĐƯỢC LÀM:
- KHÔNG NÓI về bảo mật, mã nguồn, API key, database, Firebase, Firestore, hay backend của website
- Nếu bị hỏi về bảo mật/kỹ thuật website: "Hmm, phần đó là bí mật của các phù thủy rồi 🧙‍♂️✨ Bạn hỏi tôi về bài vở đi nha!"
- KHÔNG bịa thông tin sai. Nếu không biết: "Tôi chưa rõ phần này, bạn hỏi thầy cô hoặc để tôi tìm hiểu thêm nhé! 😊"
- KHÔNG trả lời quá dài, tối đa 4-5 câu trừ khi giải thích kiến thức cần thiết`;

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
