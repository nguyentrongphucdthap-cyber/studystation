// Auth Service - extracted from gatekeeper.js sections 1-5
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    type User,
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    query,
    deleteDoc,
    orderBy,
    limit as firestoreLimit,
} from 'firebase/firestore';
import {
    ref,
    set,
    onValue,
    onDisconnect,
    serverTimestamp as rtdbTimestamp,
    remove,
} from 'firebase/database';
import { auth, db, rtdb } from '@/config/firebase';
import type { AllowedUser, UserRole, DeviceType } from '@/types';
import { getDeviceType, generateSessionId } from '@/lib/utils';

// ============================================================
// CONSTANTS
// ============================================================
const SESSION_ID_KEY = 'gatekeeper_session_id';
const DEVICE_TYPE_KEY = 'gatekeeper_device_type';
const ENTRY_TOKEN_KEY = 'study_entry_token';
const USER_ROLE_KEY = 'study_user_role';
const DEFAULT_ROLE: UserRole = 'user';

// ============================================================
// SESSION & TOKEN MANAGEMENT
// ============================================================

export function setEntryToken() {
    sessionStorage.setItem(ENTRY_TOKEN_KEY, Date.now().toString());
}

export function hasValidEntryToken(maxAgeMs = 300000): boolean {
    const t = sessionStorage.getItem(ENTRY_TOKEN_KEY);
    if (!t) return false;
    return Date.now() - parseInt(t) < maxAgeMs;
}

export function setUserRole(role: string) {
    sessionStorage.setItem(USER_ROLE_KEY, role);
}

export function getUserRole(): string {
    return sessionStorage.getItem(USER_ROLE_KEY) || DEFAULT_ROLE;
}

export function clearStorage() {
    sessionStorage.removeItem(ENTRY_TOKEN_KEY);
    sessionStorage.removeItem(USER_ROLE_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
    sessionStorage.removeItem(DEVICE_TYPE_KEY);
}

// ============================================================
// AUTH FUNCTIONS
// ============================================================

const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
        await signInWithPopup(auth, googleProvider);
        return { success: true };
    } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'auth/popup-closed-by-user') {
            return { success: false, error: 'Đăng nhập bị hủy.' };
        }
        return { success: false, error: err.message || 'Lỗi đăng nhập Google.' };
    }
}

export async function loginWithUsername(
    username: string,
    password: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const email = `${username.toLowerCase()}@studystation.site`;
        await signInWithEmailAndPassword(auth, email, password);
        return { success: true };
    } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
        }
        return { success: false, error: 'Đăng nhập thất bại. Vui lòng thử lại.' };
    }
}

export async function submitRegistration(data: {
    fullName: string;
    birthDate: string;
    gender: string;
    classRoom: string;
    username: string;
    password: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const email = `${data.username.toLowerCase()}@studystation.site`;

        // Check if username exists in allowed_users
        const userRef = doc(db, 'allowed_users', email);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return { success: false, error: 'Tên đăng nhập đã tồn tại.' };
        }

        // Create Firebase Auth account
        const userCredential = await createUserWithEmailAndPassword(auth, email, data.password);
        await updateProfile(userCredential.user, { displayName: data.fullName });

        // Add to whitelist (auto-approve)
        await setDoc(userRef, {
            role: 'user',
            name: data.fullName,
            birthDate: data.birthDate,
            gender: data.gender,
            classRoom: data.classRoom,
            username: data.username.toLowerCase(),
            addedAt: new Date().toISOString(),
            addedBy: 'self-registration',
        });

        // Also sync to users collection
        await setDoc(doc(db, 'users', email), {
            displayName: data.fullName,
            email: email,
            photoURL: null,
            lastLogin: new Date().toISOString(),
        });

        return { success: true };
    } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'auth/email-already-in-use') {
            return { success: false, error: 'Tên đăng nhập đã tồn tại.' };
        }
        return { success: false, error: err.message || 'Đăng ký thất bại.' };
    }
}

export async function logoutUser() {
    await stopPresence();
    clearStorage();
    await signOut(auth);
}

// ============================================================
// WHITELIST & ROLE CHECK
// ============================================================

export async function checkWhitelist(email: string): Promise<{ isAllowed: boolean; role: string }> {
    try {
        const userRef = doc(db, 'allowed_users', email);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            return { isAllowed: true, role: data.role || DEFAULT_ROLE };
        }
        return { isAllowed: false, role: 'guest' };
    } catch {
        return { isAllowed: false, role: 'guest' };
    }
}

export function checkIsAdmin(role: string): boolean {
    return /admin/i.test(role);
}

export function checkIsSuperAdmin(role: string): boolean {
    return /super-admin/i.test(role);
}

export function checkIsGuest(role: string): boolean {
    return role === 'guest';
}

// ============================================================
// SESSION MANAGEMENT (one device per type)
// ============================================================

export function setupSession(): { sessionId: string; deviceType: DeviceType } {
    let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
        sessionId = generateSessionId();
        sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }

    let deviceType = sessionStorage.getItem(DEVICE_TYPE_KEY) as DeviceType | null;
    if (!deviceType) {
        deviceType = getDeviceType();
        sessionStorage.setItem(DEVICE_TYPE_KEY, deviceType);
    }

    return { sessionId, deviceType };
}

export async function registerSession(email: string, sessionId: string, deviceType: DeviceType) {
    try {
        const userRef = doc(db, 'allowed_users', email);
        await setDoc(userRef, {
            [`session_${deviceType}`]: sessionId,
            [`session_${deviceType}_time`]: new Date().toISOString(),
        }, { merge: true });
    } catch (err) {
        console.warn('[Session] Failed to register session:', err);
    }
}

// ============================================================
// AUTH STATE LISTENER
// ============================================================

export function onAuthChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
}

// ============================================================
// USER MANAGEMENT (Admin/Super-Admin)
// ============================================================

export async function getAllAllowedUsers(): Promise<AllowedUser[]> {
    const snapshot = await getDocs(collection(db, 'allowed_users'));
    return snapshot.docs.map((d) => ({
        email: d.id,
        ...d.data(),
    })) as AllowedUser[];
}

export async function addAllowedUser(email: string, role = 'user'): Promise<void> {
    await setDoc(doc(db, 'allowed_users', email), {
        role,
        addedAt: new Date().toISOString(),
        addedBy: auth.currentUser?.email || 'unknown',
    });
    await logWhitelistAction('add', email, role);
}

export async function updateUserRole(email: string, newRole: string): Promise<void> {
    await setDoc(doc(db, 'allowed_users', email), { role: newRole }, { merge: true });
    await logWhitelistAction('update_role', email, newRole);
}

export async function deleteAllowedUser(email: string): Promise<void> {
    const userRef = doc(db, 'allowed_users', email);
    const snap = await getDoc(userRef);
    const oldRole = snap.exists() ? snap.data().role : 'unknown';
    await deleteDoc(userRef);
    await logWhitelistAction('remove', email, oldRole);
}

async function logWhitelistAction(action: string, targetEmail: string, targetRole: string) {
    try {
        await setDoc(doc(collection(db, 'whitelist_logs')), {
            action,
            targetEmail,
            targetRole,
            performedBy: auth.currentUser?.email || 'unknown',
            timestamp: new Date().toISOString(),
        });
    } catch {
        // Silent fail for logging
    }
}

export async function getWhitelistLogs(limitCount = 50) {
    const q = query(
        collection(db, 'whitelist_logs'),
        orderBy('timestamp', 'desc'),
        firestoreLimit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ============================================================
// PRESENCE TRACKING (Realtime Database) — Heartbeat-based
// ============================================================

const HEARTBEAT_INTERVAL_MS = 60_000; // Update heartbeat every 60s
const STALE_THRESHOLD_MS = 120_000;   // Consider user offline after 2min without heartbeat

let presenceRef: ReturnType<typeof ref> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let presenceCleanupBound: (() => void) | null = null;
let visibilityHandlerBound: (() => void) | null = null;

function getPresenceData(user: { email: string | null; displayName: string | null; photoURL: string | null }, deviceType: string) {
    return {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        deviceType,
        lastHeartbeat: rtdbTimestamp(),
        status: 'online',
    };
}

export async function startPresence() {
    const user = auth.currentUser;
    if (!user) return;

    // Clean up any previous presence
    await stopPresence();

    const deviceType = getDeviceType();
    presenceRef = ref(rtdb, `presence/${user.uid}_${deviceType}`);
    const data = getPresenceData(user, deviceType);

    // Listen to connection state
    const connectedRef = ref(rtdb, '.info/connected');
    onValue(connectedRef, (snap) => {
        if (snap.val() === true && presenceRef) {
            onDisconnect(presenceRef).remove();
            set(presenceRef, data);
        }
    });

    // Heartbeat: update lastHeartbeat every 60s
    heartbeatInterval = setInterval(() => {
        if (presenceRef && auth.currentUser) {
            set(presenceRef, getPresenceData(auth.currentUser, deviceType)).catch(() => { });
        }
    }, HEARTBEAT_INTERVAL_MS);

    // Cleanup on page unload
    presenceCleanupBound = () => {
        if (presenceRef) {
            // Use remove (best-effort) — onDisconnect is backup
            remove(presenceRef).catch(() => { });
            presenceRef = null;
        }
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    };
    window.addEventListener('beforeunload', presenceCleanupBound);

    // Pause heartbeat when tab hidden, resume when visible
    visibilityHandlerBound = () => {
        if (document.visibilityState === 'hidden') {
            // Stop heartbeat; the entry will go stale after 2min
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }
        } else if (document.visibilityState === 'visible') {
            // Resume: immediately heartbeat + restart interval
            if (presenceRef && auth.currentUser) {
                set(presenceRef, getPresenceData(auth.currentUser, deviceType)).catch(() => { });
            }
            if (!heartbeatInterval) {
                heartbeatInterval = setInterval(() => {
                    if (presenceRef && auth.currentUser) {
                        set(presenceRef, getPresenceData(auth.currentUser, deviceType)).catch(() => { });
                    }
                }, HEARTBEAT_INTERVAL_MS);
            }
        }
    };
    document.addEventListener('visibilitychange', visibilityHandlerBound);
}

export async function stopPresence() {
    // Clear heartbeat interval
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    // Remove presence from RTDB
    if (presenceRef) {
        try {
            await remove(presenceRef);
        } catch {
            // Silent fail
        }
        presenceRef = null;
    }

    // Remove event listeners
    if (presenceCleanupBound) {
        window.removeEventListener('beforeunload', presenceCleanupBound);
        presenceCleanupBound = null;
    }
    if (visibilityHandlerBound) {
        document.removeEventListener('visibilitychange', visibilityHandlerBound);
        visibilityHandlerBound = null;
    }
}

// Server time offset for accurate heartbeat checking
let serverTimeOffset = 0;
const offsetRef = ref(rtdb, '.info/serverTimeOffset');
onValue(offsetRef, (snap) => {
    serverTimeOffset = snap.val() || 0;
});

function getClientAdjustedTime() {
    return Date.now() + serverTimeOffset;
}

/**
 * Filter entries that have a valid lastHeartbeat within the stale threshold.
 * Returns count of genuinely active UNIQUE users (by email).
 */
function countActiveEntries(data: Record<string, { email: string; lastHeartbeat?: number }> | null): number {
    if (!data) return 0;
    const now = getClientAdjustedTime();
    const activeEmails = new Set<string>();

    for (const entry of Object.values(data)) {
        // lastHeartbeat is a server timestamp (ms since epoch)
        if (entry.lastHeartbeat && (now - entry.lastHeartbeat) < STALE_THRESHOLD_MS) {
            if (entry.email) activeEmails.add(entry.email.toLowerCase());
        }
    }
    return activeEmails.size;
}

function getActiveUsers(data: Record<string, { email: string; displayName: string; deviceType: string; lastHeartbeat?: number }> | null): Array<{ email: string; displayName: string; deviceType: string }> {
    if (!data) return [];
    const now = getClientAdjustedTime();
    const users: Array<{ email: string; displayName: string; deviceType: string }> = [];
    const processedEmails = new Set<string>();

    for (const entry of Object.values(data)) {
        if (entry.lastHeartbeat && (now - entry.lastHeartbeat) < STALE_THRESHOLD_MS) {
            const email = entry.email?.toLowerCase() || '';
            if (!processedEmails.has(email)) {
                users.push({ email: entry.email, displayName: entry.displayName, deviceType: entry.deviceType });
                processedEmails.add(email);
            }
        }
    }
    return users;
}

/**
 * Subscribe to online user count with heartbeat-based filtering.
 * Re-evaluates stale entries every 60s even without RTDB changes.
 */
export function subscribeToOnlineUsers(callback: (count: number) => void) {
    const presenceListRef = ref(rtdb, 'presence');
    let latestData: Record<string, { email: string; lastHeartbeat?: number }> | null = null;

    // Real-time listener
    const unsubscribeRtdb = onValue(presenceListRef, (snap) => {
        latestData = snap.val();
        callback(countActiveEntries(latestData));
    });

    // Re-evaluate every 60s to expire stale entries
    const recheckInterval = setInterval(() => {
        callback(countActiveEntries(latestData));
    }, HEARTBEAT_INTERVAL_MS);

    // Return cleanup function
    return () => {
        unsubscribeRtdb();
        clearInterval(recheckInterval);
    };
}

export function subscribeToOnlineUsersList(
    callback: (users: Array<{ email: string; displayName: string; deviceType: string }>) => void
) {
    const presenceListRef = ref(rtdb, 'presence');
    let latestData: Record<string, { email: string; displayName: string; deviceType: string; lastHeartbeat?: number }> | null = null;

    const unsubscribeRtdb = onValue(presenceListRef, (snap) => {
        latestData = snap.val();
        callback(getActiveUsers(latestData));
    });

    const recheckInterval = setInterval(() => {
        callback(getActiveUsers(latestData));
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
        unsubscribeRtdb();
        clearInterval(recheckInterval);
    };
}

// ============================================================
// USER PROFILE SYNC
// ============================================================

export async function syncUserProfile(user: User) {
    try {
        await setDoc(doc(db, 'users', user.email || user.uid), {
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: new Date().toISOString(),
        }, { merge: true });
    } catch {
        // Silent fail
    }
}

// ============================================================
// ACTIVITY LOGGING
// ============================================================

export async function logUserActivity(moduleName: string, moduleLabel = '') {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await setDoc(doc(collection(db, 'user_activity_logs')), {
            userEmail: user.email,
            userName: user.displayName,
            moduleName,
            moduleLabel,
            deviceType: getDeviceType(),
            timestamp: new Date().toISOString(),
        });
    } catch {
        // Silent fail for activity logging
    }
}

export async function getUserActivityLogs(limitCount = 100) {
    const q = query(
        collection(db, 'user_activity_logs'),
        orderBy('timestamp', 'desc'),
        firestoreLimit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getActivityStats() {
    const logs = await getUserActivityLogs(500);
    const moduleStats: Record<string, number> = {};
    const recentUsers = new Set<string>();

    for (const log of logs) {
        const data = log as Record<string, unknown>;
        const mod = data.moduleName as string;
        moduleStats[mod] = (moduleStats[mod] || 0) + 1;
        recentUsers.add(data.userEmail as string);
    }

    return {
        totalAccess: logs.length,
        moduleStats,
        uniqueUsers: recentUsers.size,
    };
}
