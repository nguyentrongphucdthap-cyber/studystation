import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    increment,
    onSnapshot,
    runTransaction,
    collection,
    query,
    orderBy,
    limit as firestoreLimit,
    getDocs,
    deleteDoc
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';

const MAGOCOIN_COLLECTION = 'user_magocoins';
const DEFAULT_MAGOCOIN_BALANCE = 10;

export interface MagocoinData {
    email: string;
    balance: number;
    updatedAt: string;
    redeemedCodes?: string[];
}

export interface GiftcodeData {
    code: string;
    amount: number;
    maxUses: number;
    currentUses: number;
    createdAt: string;
    expiresAt?: string;
    createdBy: string;
}

export interface GiftcodeHistoryData {
    id: string;
    code: string;
    amount: number;
    redeemedBy: string;
    timestamp: string;
}

/**
 * Lấy tham chiếu đến document lưu coin của user (doc ID: email).
 */
const getCoinDocRef = (email: string) => {
    // Dots are actually valid in doc IDs. Removing comma sanitization 
    // to make Firebase Security Rules comparison easier and more reliable.
    const safeEmail = email.toLowerCase().trim();
    return doc(db, MAGOCOIN_COLLECTION, safeEmail);
};

/**
 * Lấy số lượng Magocoin hiện tại của user.
 */
export async function getUserMagocoins(email: string): Promise<number> {
    if (!email) return 0;
    try {
        const docRef = getCoinDocRef(email);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return Number(snap.data().balance) || 0;
        }
        return DEFAULT_MAGOCOIN_BALANCE;
    } catch (err) {
        console.error('[Magocoin] Failed to get Magocoins:', err);
        return 0;
    }
}

/**
 * Lắng nghe thay đổi Magocoin theo real-time.
 */
export function subscribeToMagocoins(email: string | null | undefined, callback: (balance: number) => void) {
    if (!email) {
        callback(DEFAULT_MAGOCOIN_BALANCE);
        return () => { };
    }
    
    const docRef = getCoinDocRef(email);
    return onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            callback(Number(snap.data()?.balance) || 0);
        } else {
            callback(DEFAULT_MAGOCOIN_BALANCE);
        }
    }, (err) => {
        console.warn('[Magocoin] Listener error:', err);
        callback(DEFAULT_MAGOCOIN_BALANCE);
    });
}

/**
 * Cộng thêm hoặc trừ Mago coin cho user.
 * Dùng amount dương để cộng, amount âm để trừ.
 */
export async function updateMagocoins(email: string, amount: number): Promise<void> {
    if (!email || amount === 0) return;
    try {
        const docRef = getCoinDocRef(email);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            await updateDoc(docRef, {
                balance: increment(amount),
                updatedAt: new Date().toISOString()
            });
        } else {
            // Nếu user chưa có mốc Magocoin nào -> Khởi tạo
            await setDoc(docRef, {
                email: email.toLowerCase(),
                balance: Math.max(DEFAULT_MAGOCOIN_BALANCE + amount, 0),
                updatedAt: new Date().toISOString()
            });
        }
        } catch (err) {
            console.error('[Magocoin] Failed to update Magocoins:', err);
            throw err; // Rethrow so the UI can show the actual error
        }
}

/**
 * ==========================================
 * GIFTCODE & LEADERBOARD SYSTEM (ADMIN)
 * ==========================================
 */

export async function createGiftcode(code: string, amount: number, maxUses: number, expiresAt?: string): Promise<void> {
    const docRef = doc(db, 'mago_giftcodes', code.trim().toUpperCase());
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        throw new Error('Mã giftcode này đã tồn tại!');
    }

    await setDoc(docRef, {
        code: code.trim().toUpperCase(),
        amount,
        maxUses,
        currentUses: 0,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt || null,
        createdBy: auth.currentUser?.email || 'admin'
    });
}

export async function deleteGiftcode(code: string): Promise<void> {
    await deleteDoc(doc(db, 'mago_giftcodes', code.toUpperCase()));
}

export async function getAllGiftcodes(): Promise<GiftcodeData[]> {
    const q = query(collection(db, 'mago_giftcodes'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as GiftcodeData);
}

export async function redeemGiftcodeTransaction(email: string, codeStr: string): Promise<{ success: boolean; amount?: number; error?: string }> {
    if (!email) return { success: false, error: 'Vui lòng đăng nhập' };
    const cleanCode = codeStr.trim().toUpperCase();
    if (!cleanCode) return { success: false, error: 'Mã không hợp lệ' };

    try {
        const result = await runTransaction(db, async (transaction) => {
            const codeRef = doc(db, 'mago_giftcodes', cleanCode);
            const userCoinRef = getCoinDocRef(email);
            
            const codeSnap = await transaction.get(codeRef);
            if (!codeSnap.exists()) {
                throw new Error('Mã giftcode không tồn tại!');
            }
            const codeData = codeSnap.data() as GiftcodeData;
            
            // Check limitations
            if (codeData.currentUses >= codeData.maxUses) {
                throw new Error('Mã giftcode này đã hết lượt sử dụng!');
            }
            if (codeData.expiresAt && new Date() > new Date(codeData.expiresAt)) {
                throw new Error('Mã giftcode này đã hết hạn!');
            }

            const userSnap = await transaction.get(userCoinRef);
            let userRedeemed: string[] = [];
            let currentBalance = DEFAULT_MAGOCOIN_BALANCE;
            
            if (userSnap.exists()) {
                const userData = userSnap.data() as MagocoinData;
                userRedeemed = userData.redeemedCodes || [];
                currentBalance = userData.balance || 0;
            }

            if (userRedeemed.includes(cleanCode)) {
                throw new Error('Bạn đã sử dụng mã này rồi!');
            }

            // Updates
            transaction.update(codeRef, {
                currentUses: increment(1)
            });

            const updatedUser = {
                email: email.toLowerCase(),
                balance: currentBalance + codeData.amount,
                redeemedCodes: [...userRedeemed, cleanCode],
                updatedAt: new Date().toISOString()
            };

            if (userSnap.exists()) {
                transaction.update(userCoinRef, updatedUser);
            } else {
                transaction.set(userCoinRef, updatedUser);
            }

            // Logs
            const docRef = doc(collection(db, 'mago_giftcode_history'));
            transaction.set(docRef, {
                code: cleanCode,
                amount: codeData.amount,
                redeemedBy: email.toLowerCase(),
                timestamp: new Date().toISOString()
            });

            return codeData.amount;
        });

        return { success: true, amount: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Lỗi hệ thống khi nhập mã' };
    }
}

export async function getMagocoinLeaderboard(maxLimit = 50): Promise<MagocoinData[]> {
    const q = query(
        collection(db, MAGOCOIN_COLLECTION),
        orderBy('balance', 'desc'),
        firestoreLimit(maxLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MagocoinData);
}

export async function getGiftcodeHistory(limitCount = 100): Promise<GiftcodeHistoryData[]> {
    const q = query(
        collection(db, 'mago_giftcode_history'),
        orderBy('timestamp', 'desc'),
        firestoreLimit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as GiftcodeHistoryData));
}
