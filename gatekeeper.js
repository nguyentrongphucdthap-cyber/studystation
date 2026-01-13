/**
 * GATEKEEPER.JS - HỆ THỐNG BẢO VỆ TẬP TRUNG (VERSION v3)
 * Tính năng: 
 * 1. Đăng nhập Google & Whitelist Check.
 * 2. Cho phép đăng nhập cùng tài khoản trên nhiều thiết bị KHÁC LOẠI.
 * 3. Cho phép 1 desktop + 1 mobile cùng lúc (không cho 2 desktop hoặc 2 mobile).
 * 4. Khi bị kick, chỉ redirect về login, KHÔNG logout tài khoản.
 * 5. Phân quyền Admin/User dựa trên chuỗi role (VD: "admin/user").
 * 6. Tự động cập nhật quyền & xử lý offline tốt hơn.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    updateDoc,
    onSnapshot,
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    setDoc,
    increment,
    query,
    where,
    enableIndexedDbPersistence,
    CACHE_SIZE_UNLIMITED,
    getDocsFromCache,
    getDocFromCache
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDatabase, ref, set, onValue, onDisconnect, serverTimestamp, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ============================================================
// 1. CẤU HÌNH FIREBASE
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyBdSnR-z6CJWzDH-WxdG-0rNX58srJrb8A",
    authDomain: "studystation-auth.firebaseapp.com",
    databaseURL: "https://studystation-auth-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "studystation-auth",
    storageBucket: "studystation-auth.firebasestorage.app",
    messagingSenderId: "293717187040",
    appId: "1:293717187040:web:8bca14e98046b1c98cb385"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app); // Realtime Database for presence
const provider = new GoogleAuthProvider();

// ============================================================
// 1.5 ENABLE FIRESTORE OFFLINE PERSISTENCE
// ============================================================
// Bật offline persistence để tăng tốc độ load:
// - Lần đầu: Fetch từ network → Cache vào IndexedDB
// - Lần sau: Trả về cached data NGAY LẬP TỨC → Sync với server trong background
// - Hoạt động offline
// - Tự động quản lý cache (không cần code thủ công)
enableIndexedDbPersistence(db, { forceOwnership: false })
    .then(() => {
        console.log('[Firebase] Offline persistence enabled - faster loading!');
    })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            // Có thể xảy ra khi mở nhiều tab
            console.warn('[Firebase] Persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
            // Browser không hỗ trợ
            console.warn('[Firebase] Persistence not supported in this browser');
        } else {
            console.warn('[Firebase] Persistence error:', err);
        }
    });

// ============================================================
// 2. CONSTANTS & STORAGE HELPERS
// ============================================================

const ENTRY_TOKEN_KEY = 'gatekeeper_entry_token'; // Token để đảm bảo user đi từ trang login
const USER_ROLE_KEY = 'gatekeeper_user_role';     // Lưu role hiện tại
const SESSION_ID_KEY = 'gatekeeper_session_id';   // Session ID duy nhất của tab này
const DEVICE_TYPE_KEY = 'gatekeeper_device_type'; // Loại thiết bị (desktop/mobile)
const DEFAULT_ROLE = 'user';

// --- Helper: Detect Device Type ---
// Phân loại thành 2 nhóm: "desktop" và "mobile"
// PC/Laptop/Mac = desktop, iOS/Android/Tablet = mobile
function getDeviceType() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;

    // Check for mobile devices
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);

    // Check for tablet specifically (still considered mobile for our purposes)
    const isTablet = /ipad|tablet|playbook|silk/i.test(ua);

    return (isMobile || isTablet) ? 'mobile' : 'desktop';
}

// Lấy device type đã lưu hoặc detect mới
function getCurrentDeviceType() {
    let deviceType = localStorage.getItem(DEVICE_TYPE_KEY);
    if (!deviceType) {
        deviceType = getDeviceType();
        localStorage.setItem(DEVICE_TYPE_KEY, deviceType);
    }
    return deviceType;
}

// --- Helper: Quản lý Entry Token (Chống vào thẳng link mà không login) ---
function setEntryToken() {
    try {
        const token = { ts: Date.now(), val: Math.random().toString(36).slice(2) };
        sessionStorage.setItem(ENTRY_TOKEN_KEY, JSON.stringify(token));
    } catch { }
}

function hasValidEntryToken(maxAgeMs = 300000) { // Token có hạn 5 phút
    try {
        const raw = sessionStorage.getItem(ENTRY_TOKEN_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        return typeof data?.ts === 'number' && (Date.now() - data.ts) <= maxAgeMs;
    } catch { return false; }
}

// --- Helper: Quản lý Role ---
function setUserRole(role) {
    try { sessionStorage.setItem(USER_ROLE_KEY, role || DEFAULT_ROLE); } catch { }
}

function clearStorage() {
    try {
        sessionStorage.removeItem(ENTRY_TOKEN_KEY);
        sessionStorage.removeItem(USER_ROLE_KEY);
        localStorage.removeItem(SESSION_ID_KEY);
        localStorage.removeItem(DEVICE_TYPE_KEY);
    } catch { }
}

// --- Helper: Điều hướng URL ---
function getProjectRoot() {
    try {
        const parts = location.pathname.split('/').filter(Boolean);
        // Logic: Nếu đang ở /content/subfolder/ file thì root là /content/
        // Nếu file cấu trúc đơn giản, trả về root domain
        return parts.length > 0 && parts[0] === 'content' ? '/' : '/';
    } catch { return '/'; }
}

function toUrl(path) {
    // Xử lý đường dẫn tương đối để chạy đúng trên cả localhost và hosting
    // Giả sử gatekeeper nằm cùng cấp với index.html gốc
    return path.startsWith('/') ? path : '/' + path;
}

// ============================================================
// 3. CÁC HÀM EXPORT CHO FRONTEND
// ============================================================

/**
 * Đăng nhập bằng Google Popup
 */
export async function loginWithGoogle() {
    try {
        await signInWithPopup(auth, provider);
        // Sau khi popup đóng, onAuthStateChanged sẽ tự chạy logic tiếp theo
    } catch (error) {
        console.error("Login Error:", error);
        showErrorUI(error.message || 'Đăng nhập thất bại.');
    }
}

/**
 * Đăng xuất an toàn
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        clearStorage();
        window.location.href = toUrl('index.html');
    } catch (e) {
        console.error("Logout Error:", e);
    }
}

/**
 * Lắng nghe thay đổi User (dùng để update UI tên, avatar...)
 */
export function onUserChange(cb) {
    return onAuthStateChanged(auth, (user) => {
        if (typeof cb === 'function') cb(user);
    });
}

/**
 * Lấy Role hiện tại từ SessionStorage
 * @returns {string} Ví dụ: "admin/user" hoặc "user"
 */
export function getCurrentUserRole() {
    try { return sessionStorage.getItem(USER_ROLE_KEY) || DEFAULT_ROLE; } catch { return DEFAULT_ROLE; }
}

/**
 * Kiểm tra xem User có quyền Admin không
 * Logic: Role string chứa từ khóa "admin" (không phân biệt hoa thường)
 * @returns {boolean}
 */
export function checkIsAdmin() {
    const role = getCurrentUserRole().toLowerCase();
    return role.includes('admin');
}

/**
 * Kiểm tra xem User có quyền Super-Admin không
 * Logic: Role string chứa từ khóa "super-admin" (không phân biệt hoa thường)
 * Super-admin có toàn bộ quyền admin + quyền quản lý học sinh
 * @returns {boolean}
 */
export function checkIsSuperAdmin() {
    const role = getCurrentUserRole().toLowerCase();
    return role.includes('super-admin');
}

/**
 * Kiểm tra xem User có phải là Khách (Guest - Không có trong Whitelist) không
 * @returns {boolean}
 */
export function checkIsGuest() {
    return getCurrentUserRole() === 'guest';
}

// ============================================================
// 4. LOGIC CỐT LÕI (INIT GATEKEEPER)
// ============================================================

/**
 * Khởi tạo Gatekeeper
 * @param {string} mode - 'login' (trang chủ) hoặc 'protected' (trang nội dung)
 */
export function initGatekeeper(mode = 'protected') {
    const isProtected = mode === 'protected';
    const loadingEl = document.getElementById('gatekeeper-loading');

    // Hiển thị loading ngay lập tức nếu là trang bảo vệ
    if (isProtected && loadingEl) {
        loadingEl.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Chặn cuộn khi đang load
    }

    // --- EARLY UNLOCK OPTIMIZATION ---
    // Nếu có session local, mở khóa UI NGAY LẬP TỨC trước khi đợi onAuthStateChanged
    // Điều này cho phép Practice load từ cache trong khi auth đang xử lý
    const localSession = localStorage.getItem(SESSION_ID_KEY);
    let earlyUnlocked = false;

    if (isProtected && localSession && loadingEl) {
        // Đợi 200ms cho UI render, rồi unlock nếu auth chưa xong
        setTimeout(() => {
            if (loadingEl.style.display !== 'none') {
                console.log('[Gatekeeper] Early unlock: Session exists, unlocking before auth completes');
                unlockUI(loadingEl);
                earlyUnlocked = true;
            }
        }, 200);
    }

    onAuthStateChanged(auth, async (user) => {
        // Reset role tạm thời để tránh cached sai
        if (!user) {
            handleNotLoggedIn(isProtected, loadingEl);
            return;
        }

        // --- OPTIMISTIC UI UNLOCK (Fix slow load on mobile) ---
        // Nếu là trang bảo vệ và đã có session local, mở khóa giao diện ngay lập tức
        // để Practice module có thể load từ cache mà không cần đợi whitelist check (slow network)
        // Việc kiểm tra whitelist và session sẽ chạy ngầm sau đó.
        let unlocked = false;
        const localSession = localStorage.getItem(SESSION_ID_KEY);
        if (isProtected && localSession && loadingEl && loadingEl.style.display !== 'none') {
            console.log('[Gatekeeper] Optimistic unlock for standard user');
            unlockUI(loadingEl);
            unlocked = true;
            // Start presence immediately too
            startPresence();
        }

        // --- NGƯỜI DÙNG ĐÃ ĐĂNG NHẬP FIREBASE ---
        try {
            // Sync user profile to 'users' collection (for Guest/Whitelist directory)
            syncUserProfile(user);

            // 1. Kiểm tra Whitelist & Lấy dữ liệu
            const userRef = doc(db, 'allowed_users', user.email);
            let docSnap;

            try {
                docSnap = await getDoc(userRef);
            } catch (fetchError) {
                // Xử lý lỗi offline - không đá user ra
                if (fetchError.message?.includes('offline') || fetchError.code === 'unavailable') {
                    console.warn('[Gatekeeper] Offline mode - allowing cached access');
                    // Nếu đã có session local, cho phép tiếp tục
                    const localSession = localStorage.getItem(SESSION_ID_KEY);
                    if (localSession && isProtected && !unlocked) {
                        unlockUI(loadingEl);
                        startPresence();
                        return;
                    }
                }
                throw fetchError;
            }

            if (!docSnap.exists()) {
                console.log('[Gatekeeper] User not in whitelist. Activating Guest Mode.');
                setUserRole('guest');

                // --- GUEST MODE LOGIC ---
                // Guests don't have a Firestore doc, so we SKIP session tracking/updates.
                // We just check if they are on a RESTRICTED page.

                const currentPath = window.location.pathname;

                // List of RESTRICTED paths for guests
                // Only Practice (`/practice/`), Dashboard (`/content/index.html`), and Login (`/index.html`) are allowed.
                // Everything else (Vocab, Etest, Admin) is BLOCKED.
                const isRestricted =
                    currentPath.includes('/vocab/') ||
                    currentPath.includes('/etest/') ||
                    currentPath.includes('/admin/') ||
                    // Also block direct project member pages if needed, but keeping it simple for now
                    (currentPath.includes('/content/') && !currentPath.includes('practice') && !currentPath.includes('index.html'));

                if (mode === 'login') {
                    // Determine where to send them (Dashboard)
                    setEntryToken();
                    window.location.href = toUrl('content/index.html');
                    return;
                }

                if (isRestricted) {
                    console.warn('[Gatekeeper] Guest attempted to access restricted page. Redirecting...');
                    // Use custom dialog if available, else alert
                    await showSafeAlert('Tính năng này chỉ dành cho tài khoản thành viên.\nBạn đang sử dụng quyền Khách (Guest).');
                    window.location.href = toUrl('content/index.html');
                    return;
                }

                // If on allowed page (Dashboard or Practice), let them pass
                if (isProtected) {
                    unlockUI(loadingEl);
                    startPresence(); // Optional: Track guest presence? Sure.
                }
                return; // Stop further processing (don't run session update logic below)
            }

            const userData = docSnap.data();
            const serverSession = userData.current_session_id;
            const serverRole = userData.role || DEFAULT_ROLE;

            // Lưu Role mới nhất vào Session
            setUserRole(serverRole);

            // 2. Xử lý theo từng trang
            if (mode === 'login') {
                // --- TRANG LOGIN ---
                // V3: Lưu session theo device type (desktop/mobile)
                // Cho phép 1 desktop + 1 mobile cùng lúc, nhưng không cho 2 cùng loại
                const newSessionID = Date.now().toString();
                const deviceType = getCurrentDeviceType();

                // Cấu trúc sessions mới: { desktop: "timestamp", mobile: "timestamp" }
                const sessionsUpdate = {};
                sessionsUpdate[`sessions.${deviceType}`] = newSessionID;

                await updateDoc(userRef, {
                    ...sessionsUpdate,
                    current_session_id: newSessionID, // Giữ lại để tương thích ngược
                    last_login: new Date().toISOString(),
                    last_device_type: deviceType,
                    display_name: user.displayName || '',
                    photo_url: user.photoURL || '',
                    login_count: increment(1)
                });

                localStorage.setItem(SESSION_ID_KEY, newSessionID);
                localStorage.setItem(DEVICE_TYPE_KEY, deviceType);
                setEntryToken(); // Cấp vé vào cửa

                // Chuyển hướng
                window.location.href = toUrl('content/index.html');

            } else if (isProtected) {
                // --- TRANG NỘI DUNG ---
                // V3: Cho phép 1 desktop + 1 mobile cùng lúc
                // Chỉ kick nếu có session MỚI HƠN trên CÙNG LOẠI thiết bị

                const localSession = localStorage.getItem(SESSION_ID_KEY);
                const deviceType = getCurrentDeviceType();

                // Lấy session từ server theo device type
                const sessions = userData.sessions || {};
                const serverSessionForDevice = sessions[deviceType];

                // Nếu chưa có local session, sync từ server
                if (!localSession) {
                    if (serverSessionForDevice) {
                        localStorage.setItem(SESSION_ID_KEY, serverSessionForDevice);
                    } else if (serverSession) {
                        // Fallback: dùng current_session_id cũ
                        localStorage.setItem(SESSION_ID_KEY, serverSession);
                    }
                }

                // Thiết lập Real-time Listener để giám sát đăng nhập mới
                // V3: Chỉ kick nếu có session MỚI HƠN trên CÙNG LOẠI thiết bị
                setupRealtimeMonitor(userRef, localStorage.getItem(SESSION_ID_KEY), deviceType);

                // Mở khóa giao diện (nếu chưa mở optimistic)
                if (!unlocked) {
                    unlockUI(loadingEl);
                    // Tự động bắt đầu Presence Tracking
                    startPresence();
                }
            }

        } catch (error) {
            console.error("Gatekeeper Check Failed:", error);
            handleAuthError(error, isProtected);
        }
    });
}

// Helper: Mở khóa giao diện
function unlockUI(loadingEl) {
    if (loadingEl) {
        loadingEl.style.opacity = '0';
        setTimeout(() => {
            loadingEl.style.display = 'none';
            document.body.style.overflow = '';
        }, 500);
    }
}

// ============================================================
// 5. CÁC HÀM XỬ LÝ PHỤ TRỢ (INTERNAL)
// ============================================================

function handleNotLoggedIn(isProtected, loadingEl) {
    clearStorage();
    if (isProtected) {
        // Nếu là trang bảo vệ mà chưa login -> Đá về trang chủ
        window.location.href = toUrl('index.html');
    } else {
        // Nếu là trang login -> Hiển thị form login
        const vLogin = document.getElementById('view-login');
        const vLoading = document.getElementById('view-loading');

        if (vLoading) vLoading.classList.add('hidden');
        if (vLogin) vLogin.classList.remove('hidden');
    }
}

function handleAuthError(error, isProtected) {
    // Xử lý đặc biệt cho lỗi offline - không đá user, không auto-reload
    const isOfflineError = error.message?.includes('offline') ||
        error.message?.includes('network') ||
        error.code === 'unavailable';

    if (isOfflineError) {
        console.warn('[Gatekeeper] Offline error detected, continuing with cached data');
        // Hiển thị thông báo nhẹ nhàng, KHÔNG AUTO-RELOAD để tránh vòng lặp
        const loadingEl = document.getElementById('gatekeeper-loading');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div style="text-align:center;padding:20px">
                    <div style="font-size:48px;margin-bottom:16px">📶</div>
                    <div style="font-weight:600;font-size:18px;margin-bottom:8px">Kết nối không ổn định</div>
                    <div style="color:#94a3b8;font-size:14px;margin-bottom:16px">Đang sử dụng dữ liệu đã lưu</div>
                    <button onclick="location.reload()" style="background:#2563eb;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer">Tải lại trang</button>
                </div>
            `;
            loadingEl.style.display = 'flex';
        }
        // KHÔNG AUTO-RELOAD - để user tự quyết định
        return;
    }

    signOut(auth);
    clearStorage();

    if (isProtected) {
        showSafeAlert("Lỗi xác thực: " + error.message).then(() => {
            window.location.href = toUrl('index.html');
        });
    } else {
        showErrorUI(error.message);
    }
}

function showSafeAlert(msg) {
    return new Promise((resolve) => {
        if (window.customDialog && typeof window.customDialog.alert === 'function') {
            window.customDialog.alert('Thông báo', msg).then(resolve);
        } else {
            // Fallback beautiful modal
            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center';
            div.innerHTML = `
                <div style="background:white;padding:24px;border-radius:16px;max-width:90%;width:340px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);text-align:center;font-family:system-ui,-apple-system,sans-serif">
                    <div style="width:48px;height:48px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
                        <svg style="width:24px;height:24px;color:#ef4444" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    </div>
                    <h3 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1e293b">Thông báo</h3>
                    <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.5">${msg}</p>
                    <button id="safe-alert-btn" style="width:100%;background:#2563eb;color:white;border:none;padding:12px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;transition:background 0.2s">Đã hiểu</button>
                </div>
            `;
            document.body.appendChild(div);
            // Handle click
            const btn = div.querySelector('#safe-alert-btn');
            const cleanup = () => { div.remove(); resolve(); };
            btn.onclick = cleanup;
        }
    });
}

function showErrorUI(msg) {
    const el = document.getElementById('loginError');
    const vLoading = document.getElementById('view-loading');
    const vLogin = document.getElementById('view-login');

    if (vLoading) vLoading.classList.add('hidden');
    if (vLogin) vLogin.classList.remove('hidden');

    if (el) {
        el.textContent = msg;
        el.style.display = 'block';
    } else {
        alert(msg);
    }
}

// Hiển thị modal đẹp khi bị kick session
function showSessionKickModal(deviceType) {
    const deviceName = deviceType === 'desktop' ? 'máy tính' : 'điện thoại';

    // Tạo modal HTML
    const modalHTML = `
        <div id="session-kick-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            padding: 1rem;
        ">
            <div style="
                background: white;
                border-radius: 1.5rem;
                max-width: 400px;
                width: 100%;
                overflow: hidden;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                animation: modalEnter 0.3s ease-out;
            ">
                <style>
                    @keyframes modalEnter {
                        from { opacity: 0; transform: scale(0.95) translateY(20px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                </style>
                
                <!-- Icon -->
                <div style="display: flex; justify-content: center; padding-top: 2rem; padding-bottom: 0.5rem;">
                    <div style="
                        width: 5rem;
                        height: 5rem;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #fef3c7, #fde68a);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <svg style="width: 2.5rem; height: 2.5rem; color: #f59e0b;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                    </div>
                </div>
                
                <!-- Content -->
                <div style="padding: 1rem 1.5rem; text-align: center;">
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin-bottom: 0.5rem;">
                        Phát hiện đăng nhập mới
                    </h3>
                    <p style="color: #64748b; font-size: 0.875rem; line-height: 1.5;">
                        Tài khoản của bạn vừa đăng nhập trên <strong style="color: #0284c7;">${deviceName}</strong> khác. 
                        Phiên làm việc này sẽ tạm dừng.
                    </p>
                </div>
                
                <!-- Action -->
                <div style="padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0;">
                    <button onclick="window.location.href='${toUrl('index.html')}'" style="
                        width: 100%;
                        padding: 0.875rem 1rem;
                        background: linear-gradient(135deg, #2563eb, #4f46e5);
                        color: white;
                        font-weight: 700;
                        font-size: 0.9375rem;
                        border: none;
                        border-radius: 0.75rem;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.5rem;
                        box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.3);
                        transition: all 0.2s;
                    " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                        <svg style="width: 1.25rem; height: 1.25rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                        </svg>
                        Đăng nhập lại
                    </button>
                </div>
            </div>
        </div>
    `;

    // Thêm modal vào body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Giám sát thời gian thực: Session & Role
// V3: Chỉ kick nếu có session MỚI HƠN trên CÙNG LOẠI thiết bị
// Cho phép: 1 desktop + 1 mobile cùng lúc
// Không cho phép: 2 desktop hoặc 2 mobile cùng lúc
// V4: Thêm debounce cho role change để tránh reload liên tục
let roleChangeDebounceTimer = null;
let lastKnownRole = null;
let isExamInProgress = false; // Flag để ngăn reload khi đang làm bài

// Expose function để Practice module có thể set flag
export function setExamInProgress(inProgress) {
    isExamInProgress = inProgress;
    console.log('[Gatekeeper] Exam in progress:', inProgress);
}

function setupRealtimeMonitor(userRef, currentLocalSession, currentDeviceType) {
    // Initialize lastKnownRole
    lastKnownRole = sessionStorage.getItem(USER_ROLE_KEY);

    onSnapshot(userRef, (snap) => {
        if (!snap.exists()) return; // User bị xóa khỏi whitelist

        const data = snap.data();
        const sessions = data.sessions || {};

        // Lấy session của CÙNG LOẠI thiết bị từ server
        const serverSessionForDevice = sessions[currentDeviceType];

        // Fallback: nếu chưa có sessions mới, dùng current_session_id cũ
        const serverSession = serverSessionForDevice || data.current_session_id;

        // 1. Check Session - Chỉ kick nếu có session MỚI HƠN trên CÙNG LOẠI thiết bị
        if (serverSession && currentLocalSession) {
            const serverTime = parseInt(serverSession, 10);
            const localTime = parseInt(currentLocalSession, 10);

            // Chỉ kick nếu có đăng nhập MỚI HƠN trên CÙNG LOẠI thiết bị
            // VÀ không đang làm bài thi
            if (!isNaN(serverTime) && !isNaN(localTime) && serverTime > localTime) {
                // Nếu đang làm bài thi, không kick ngay lập tức
                if (isExamInProgress) {
                    console.log('[Gatekeeper] Session change detected but exam in progress, deferring kick');
                    return;
                }

                console.log('[Gatekeeper] Newer session detected on same device type:', {
                    deviceType: currentDeviceType,
                    serverTime,
                    localTime
                });

                // KHÔNG logout (không xóa tài khoản), chỉ kick ra trang login
                // User vẫn đăng nhập, chỉ bị chặn sử dụng ở tab này

                // Hiển thị modal đẹp thay vì alert()
                showSessionKickModal(currentDeviceType);

                // Chỉ xóa session local, không logout Firebase
                localStorage.removeItem(SESSION_ID_KEY);
                sessionStorage.removeItem(ENTRY_TOKEN_KEY);

                return;
            }
        }

        // 2. Check Role Update với DEBOUNCE để tránh reload liên tục
        const newRole = data.role || DEFAULT_ROLE;
        const currentStoredRole = sessionStorage.getItem(USER_ROLE_KEY);

        // Chỉ xử lý nếu role thực sự thay đổi VÀ khác với lần cuối check
        if (newRole !== currentStoredRole && newRole !== lastKnownRole) {
            console.log('[Gatekeeper] Role change detected:', { old: currentStoredRole, new: newRole, lastKnown: lastKnownRole });

            // Update lastKnownRole để tránh trigger lại
            lastKnownRole = newRole;
            setUserRole(newRole);

            // Nếu đang làm bài thi, KHÔNG reload
            if (isExamInProgress) {
                console.log('[Gatekeeper] Role changed but exam in progress, skipping reload');
                return;
            }

            // Debounce reload - chỉ reload sau 2 giây nếu không có thay đổi mới
            if (roleChangeDebounceTimer) {
                clearTimeout(roleChangeDebounceTimer);
            }

            roleChangeDebounceTimer = setTimeout(() => {
                // Double-check role still different before reload
                const finalCheck = sessionStorage.getItem(USER_ROLE_KEY);
                if (finalCheck !== currentStoredRole && !isExamInProgress) {
                    console.log('[Gatekeeper] Role change confirmed, reloading page');
                    window.location.reload();
                } else {
                    console.log('[Gatekeeper] Role change cancelled (reverted or exam started)');
                }
            }, 2000); // 2 second debounce
        }
    }, (error) => {
        // Xử lý lỗi realtime listener (offline) - KHÔNG LOG SPAM
        if (!error.message?.includes('offline')) {
            console.warn('[Gatekeeper] Realtime listener error:', error.message);
        }
        // Không làm gì cả - user vẫn được dùng bình thường
    });
}

// ============================================================
// 6. FIRESTORE HELPERS (For Admin Panel)
// ============================================================

/**
 * Export Firestore instance và các helper functions cho Admin Panel
 */
export { db, collection, getDocs, addDoc, deleteDoc, setDoc, doc, getDoc };

// Cache for exam content to avoid re-fetching
const examContentCache = new Map();

// Cache for exam list (metadata only)
let examListCache = null;
let examListCacheTime = 0;
const EXAM_LIST_CACHE_DURATION = 300000; // 5 minutes - reduces Firebase calls while keeping data fresh

/**
 * Kiểm tra Firebase đã sẵn sàng chưa
 */
export function isFirebaseReady() {
    return auth.currentUser !== null;
}

/**
 * Lấy tất cả exams từ Firestore (CHỈ METADATA - không part1/part2/part3)
 * CACHE-FIRST STRATEGY:
 * 1. Đọc từ IndexedDB cache trước (nhanh)
 * 2. Nếu cache miss → fetch từ server
 * 3. Background sync để cập nhật cache
 */
export async function getAllExams() {
    // Check memory cache first (fastest)
    if (examListCache && (Date.now() - examListCacheTime < EXAM_LIST_CACHE_DURATION)) {
        console.log('[Firebase] Returning memory-cached exam list');
        return examListCache;
    }

    const examsCol = collection(db, 'exams');

    // Helper: Parse snapshot to exam list
    const parseSnapshot = (snapshot) => {
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                subjectId: data.subjectId,
                title: data.title,
                time: data.time || 50,
                examCode: data.examCode || '',
                createdAt: data.createdAt || '',
                author: data.author || '',
                attemptCount: data.attemptCount || 0,
                tags: data.tags || []
            };
        });
    };

    try {
        // Try to get from IndexedDB cache first (FAST - usually < 50ms)
        console.log('[Firebase] Trying IndexedDB cache first...');
        const cachedSnapshot = await getDocsFromCache(examsCol);

        if (!cachedSnapshot.empty) {
            const exams = parseSnapshot(cachedSnapshot);
            console.log('[Firebase] ⚡ Loaded', exams.length, 'exams from IndexedDB cache (instant)');

            // Update memory cache
            examListCache = exams;
            examListCacheTime = Date.now();

            // Background sync: fetch from server to update cache (non-blocking)
            getDocs(examsCol).then(serverSnapshot => {
                const serverExams = parseSnapshot(serverSnapshot);
                if (serverExams.length !== exams.length) {
                    console.log('[Firebase] Background sync updated exam list:', serverExams.length, 'exams');
                    examListCache = serverExams;
                    examListCacheTime = Date.now();
                }
            }).catch(() => {
                // Silent fail for background sync
            });

            return exams;
        }
    } catch (cacheErr) {
        // Cache miss or error - fall through to network fetch
        console.log('[Firebase] Cache miss, fetching from server...');
    }

    // Fetch from server (slower - usually 200-500ms)
    console.log('[Firebase] Fetching exam list from server...');
    const snapshot = await getDocs(examsCol);
    const exams = parseSnapshot(snapshot);

    // Update memory cache
    examListCache = exams;
    examListCacheTime = Date.now();
    console.log('[Firebase] Fetched and cached', exams.length, 'exams from server');

    return exams;
}

/**
 * Xóa cache exam list (gọi khi cần refresh)
 */
export function clearExamListCache() {
    examListCache = null;
    examListCacheTime = 0;
    console.log('[Firebase] Exam list cache cleared');
}

/**
 * Lấy TẤT CẢ exams với FULL DATA (bao gồm part1/part2/part3)
 * CHỈ DÙNG CHO ADMIN PANEL - không cache vì data lớn
 */
export async function getAllExamsFull() {
    console.log('[Firebase] Fetching FULL exam data for admin...');
    const examsCol = collection(db, 'exams');
    const snapshot = await getDocs(examsCol);

    const exams = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data  // Include everything: part1, part2, part3, etc.
        };
    });

    console.log('[Firebase] Fetched', exams.length, 'exams with full data');
    return exams;
}

/**
 * Lấy metadata của tất cả exams (KHÔNG bao gồm part1/part2/part3)
 * Sử dụng cho việc hiển thị danh sách - load nhanh hơn nhiều
 */
export async function getAllExamsMetadata() {
    // Reuse getAllExams since it now only returns metadata
    return getAllExams();
}

/**
 * Lấy nội dung chi tiết của 1 exam (lazy loading)
 * CACHE-FIRST STRATEGY:
 * 1. Check memory cache (fastest)
 * 2. Try IndexedDB cache (fast - ~50ms)
 * 3. Fetch from server (slower - 200-500ms)
 */
export async function getExamContent(examId) {
    // 1. Check memory cache first (instant)
    if (examContentCache.has(examId)) {
        console.log('[Firebase] ⚡ Returning memory-cached content for exam:', examId);
        return examContentCache.get(examId);
    }

    const examRef = doc(db, 'exams', examId);

    // Helper: Parse doc to content
    const parseDoc = (examSnap) => {
        if (!examSnap.exists()) return null;
        const data = examSnap.data();
        return {
            id: examId,
            title: data.title,
            time: data.time,
            part1: data.part1 || [],
            part2: data.part2 || [],
            part3: data.part3 || []
        };
    };

    // 2. Try IndexedDB cache (fast)
    try {
        console.log('[Firebase] Trying IndexedDB cache for exam:', examId);
        const cachedSnap = await getDocFromCache(examRef);

        if (cachedSnap.exists()) {
            const content = parseDoc(cachedSnap);
            console.log('[Firebase] ⚡ Loaded exam from IndexedDB cache:', examId);

            // Update memory cache
            examContentCache.set(examId, content);

            return content;
        }
    } catch (cacheErr) {
        // Cache miss - fall through to network
        console.log('[Firebase] Cache miss for exam:', examId);
    }

    // 3. Fetch from server
    const TIMEOUT_MS = 8000; // 8 seconds timeout

    try {
        console.log('[Firebase] Fetching exam content from server:', examId);

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Network timeout')), TIMEOUT_MS);
        });

        const examSnap = await Promise.race([getDoc(examRef), timeoutPromise]);
        const content = parseDoc(examSnap);

        if (content) {
            // Cache in memory
            examContentCache.set(examId, content);
            console.log('[Firebase] Cached exam content in memory:', examId);
        }

        return content;

    } catch (err) {
        console.error('[Firebase] Failed to fetch exam content:', err.message);
        throw new Error('Không thể tải nội dung bài thi. Vui lòng thử lại.');
    }
}

/**
 * Xóa cache nội dung bài thi (memory only)
 * Gọi khi cần force refresh hoặc khi admin thay đổi đề thi
 */
export function clearExamContentCache(examId = null) {
    if (examId) {
        // Clear specific exam
        examContentCache.delete(examId);
        console.log('[Firebase] Cleared memory cache for exam:', examId);
    } else {
        // Clear all exam content caches
        examContentCache.clear();
        console.log('[Firebase] Cleared all exam content memory caches');
    }
}

/**
 * Dọn dẹp localStorage cũ (xóa cache cũ từ phiên bản trước)
 * Chỉ chạy 1 lần khi khởi động app
 */
export function cleanupExpiredCaches() {
    try {
        // Xóa các cache localStorage cũ từ phiên bản trước (prefix: ss_exam_)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('ss_exam_') || key.startsWith('studyStation_examCache'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        if (keysToRemove.length > 0) {
            console.log('[Firebase] Cleaned up', keysToRemove.length, 'legacy cache items');
        }
    } catch (e) {
        // Ignore - not critical
    }
}

/**
 * Lấy exams theo subject
 */
export async function getExamsBySubject(subjectId) {
    const exams = await getAllExams();
    return exams.filter(exam => exam.subjectId === subjectId);
}

/**
 * Thêm exam mới với ID có cấu trúc: {subjectId}-{XXX}
 * Ví dụ: vatli-001, toan-012, sinhhoc-023
 * XXX là số thứ tự 3 chữ số, tự động tăng dựa trên số lượng exam hiện có
 * Hoặc sử dụng customId nếu được cung cấp
 * 
 * @param {Object} examData - Dữ liệu bài thi
 * @param {string} examData.subjectId - ID môn học
 * @param {string} examData.title - Tiêu đề bài thi
 * @param {number} examData.time - Thời gian làm bài (phút)
 * @param {string} [examData.author] - Người tạo đề
 * @param {string[]} [examData.tags] - Mảng các tags của bài thi
 * @param {Array} examData.part1 - Câu hỏi trắc nghiệm
 * @param {Array} examData.part2 - Câu hỏi đúng/sai
 * @param {Array} examData.part3 - Câu hỏi trả lời ngắn
 * @param {string|null} customId - ID tùy chỉnh (tuỳ chọn)
 * @returns {Promise<string>} - ID của exam đã tạo
 */
export async function createExam(examData, customId = null) {
    let examId;

    // Use custom ID if provided and valid, otherwise auto-generate
    if (customId && /^[a-zA-Z0-9_-]+$/.test(customId)) {
        examId = customId;
    } else {
        // Count existing exams for this subject to determine next number
        const subjectId = examData.subjectId || 'exam';
        const examsCol = collection(db, 'exams');
        const snapshot = await getDocs(examsCol);

        // Find the highest number for this subject
        let maxNumber = 0;
        snapshot.docs.forEach(doc => {
            const id = doc.id;
            // Match pattern like "subjectId-XXX" where XXX is a number
            const pattern = new RegExp(`^${subjectId}-(\\d+)$`);
            const match = id.match(pattern);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNumber) maxNumber = num;
            }
        });

        // Next number, padded to 3 digits
        const nextNumber = String(maxNumber + 1).padStart(3, '0');
        examId = `${subjectId}-${nextNumber}`;
    }

    // Generate exam code from title (for display)
    const examCode = generateExamCode(examData.title);
    const now = new Date();

    const examRef = doc(db, 'exams', examId);
    await setDoc(examRef, {
        ...examData,
        examCode: examCode,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    });
    return examId;
}

/**
 * Generate exam code from title
 * E.g., "Đề thi THPT QG 2025 - Mã 001" -> "THPTQG2025_001"
 */
function generateExamCode(title) {
    if (!title) return 'EXAM_' + Date.now();
    return title
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-zA-Z0-9]/g, '_') // Replace special chars
        .replace(/_+/g, '_') // Remove multiple underscores
        .replace(/^_|_$/g, '') // Trim underscores
        .toUpperCase()
        .substring(0, 30);
}

/**
 * Cập nhật exam
 * 
 * @param {string} examId - ID của exam cần cập nhật
 * @param {Object} examData - Dữ liệu cập nhật (có thể partial)
 * @param {string} [examData.title] - Tiêu đề bài thi
 * @param {number} [examData.time] - Thời gian làm bài (phút)
 * @param {string} [examData.author] - Người tạo đề
 * @param {string[]} [examData.tags] - Mảng các tags của bài thi
 * @param {Array} [examData.part1] - Câu hỏi trắc nghiệm
 * @param {Array} [examData.part2] - Câu hỏi đúng/sai
 * @param {Array} [examData.part3] - Câu hỏi trả lời ngắn
 * @returns {Promise<void>}
 */
export async function updateExam(examId, examData) {
    const examRef = doc(db, 'exams', examId);
    await setDoc(examRef, {
        ...examData,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Xóa exam
 */
export async function deleteExam(examId) {
    const examRef = doc(db, 'exams', examId);
    await deleteDoc(examRef);
}

// ============================================================
// 6b. PRACTICE LOGGING (Collection: practice_logs)
// ============================================================

/**
 * Log khi user bắt đầu làm bài thi
 * Lưu vào collection practice_logs và tăng attemptCount trong exam
 * @param {string} examId - ID của bài thi
 * @param {string} examTitle - Tên bài thi
 * @param {string} subjectId - ID môn học
 * @param {string} mode - Chế độ làm bài: 'classic' hoặc 'stepbystep'
 * @param {number} durationSeconds - Thời gian làm bài (giây), optional - sẽ được cập nhật khi nộp bài
 */
export async function logPracticeAttempt(examId, examTitle, subjectId, mode = 'classic', durationSeconds = null) {
    console.log('[logPracticeAttempt] Starting...', { examId, examTitle, subjectId, mode });
    try {
        const user = auth.currentUser;
        if (!user) {
            console.warn('[logPracticeAttempt] No user logged in');
            return;
        }
        console.log('[logPracticeAttempt] User:', user.email);

        // 1. Lưu log vào collection practice_logs
        console.log('[logPracticeAttempt] Step 1: Adding to practice_logs...');
        const logsCol = collection(db, 'practice_logs');
        const logData = {
            examId: examId,
            examTitle: examTitle,
            subjectId: subjectId || '',
            userEmail: user.email,
            userName: user.displayName || user.email.split('@')[0],
            mode: mode, // 'classic' hoặc 'stepbystep'
            timestamp: new Date().toISOString()
        };

        // Thêm durationSeconds nếu có
        if (durationSeconds !== null) {
            logData.durationSeconds = durationSeconds;
        }

        await addDoc(logsCol, logData);
        console.log('[logPracticeAttempt] Step 1: SUCCESS - Log added');

        // 2. Tăng attemptCount trong exam document
        console.log('[logPracticeAttempt] Step 2: Updating attemptCount for exam:', examId);
        const examRef = doc(db, 'exams', examId);
        await updateDoc(examRef, {
            attemptCount: increment(1)
        });
        console.log('[logPracticeAttempt] Step 2: SUCCESS - attemptCount incremented');

        console.log('[logPracticeAttempt] COMPLETED for:', examTitle);
    } catch (error) {
        console.error('[logPracticeAttempt] FAILED:', error.code, error.message);
        // Không throw error để không ảnh hưởng đến trải nghiệm làm bài
    }
}

/**
 * Lấy tất cả practice logs (Super-Admin: tất cả, Admin: của mình + học sinh họ thêm)
 * @returns {Promise<Array>} - Danh sách logs
 */
export async function getAllPracticeLogs() {
    const isSuperAdminUser = checkIsSuperAdmin();
    const isAdminUser = checkIsAdmin();

    console.log('[getAllPracticeLogs] isSuperAdmin:', isSuperAdminUser, 'isAdmin:', isAdminUser);

    if (!isSuperAdminUser && !isAdminUser) {
        throw new Error('Không có quyền truy cập. Cần quyền Admin để xem Practice Logs.');
    }

    const logsCol = collection(db, 'practice_logs');
    const snapshot = await getDocs(logsCol);
    let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log('[getAllPracticeLogs] Total logs in DB:', logs.length);

    // Nếu là Admin (không phải Super-Admin), lọc lấy logs của mình + học sinh họ thêm
    if (!isSuperAdminUser && isAdminUser) {
        const currentEmail = auth.currentUser?.email?.toLowerCase();
        if (!currentEmail) return [];

        console.log('[getAllPracticeLogs] Admin email:', currentEmail);

        // Lấy danh sách học sinh mà admin này đã thêm
        const usersCol = collection(db, 'allowed_users');
        const usersSnapshot = await getDocs(usersCol);
        const myStudentEmails = usersSnapshot.docs
            .filter(doc => {
                const addedBy = doc.data().addedBy?.toLowerCase();
                return addedBy === currentEmail;
            })
            .map(doc => doc.id.toLowerCase()); // doc.id là email

        // Thêm email của chính admin vào danh sách để họ xem được logs của mình
        const allowedEmails = [...myStudentEmails, currentEmail];

        console.log('[getAllPracticeLogs] Allowed emails (students + self):', allowedEmails);

        // Lọc logs
        logs = logs.filter(log => {
            const logEmail = log.userEmail?.toLowerCase();
            return allowedEmails.includes(logEmail);
        });

        console.log('[getAllPracticeLogs] Filtered logs count:', logs.length);
    }

    // Sắp xếp theo thời gian mới nhất
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return logs;
}

/**
 * Lưu kết quả làm bài Practice
 * @param {Object} result - Kết quả bài thi
 * @returns {Promise<string>} - ID của document đã lưu
 */
export async function savePracticeResult(result) {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.warn('[savePracticeResult] No user logged in');
            return null;
        }

        const historyCol = collection(db, 'practice_history');
        const docRef = await addDoc(historyCol, {
            examId: result.examId,
            examTitle: result.examTitle,
            subjectId: result.subjectId,
            userEmail: user.email,
            userName: user.displayName || user.email.split('@')[0],
            userId: user.uid,
            score: result.score,
            correctCount: result.correctCount,
            totalQuestions: result.totalQuestions,
            durationSeconds: result.durationSeconds,
            answers: result.answers || {},
            examData: result.examData || null, // Lưu data đề thi để xem lại
            timestamp: new Date().toISOString()
        });

        console.log('[savePracticeResult] Result saved with ID:', docRef.id);

        // Cập nhật practice_logs với điểm số nếu có log tương ứng
        // Tìm log gần nhất của user cho exam này và cập nhật điểm
        try {
            const logsCol = collection(db, 'practice_logs');
            const q = query(logsCol,
                where('examId', '==', result.examId),
                where('userEmail', '==', user.email)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                // Lấy log mới nhất (sắp xếp theo timestamp)
                const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                const latestLog = logs[0];

                // Chỉ cập nhật nếu log chưa có điểm
                if (latestLog && !latestLog.score) {
                    await updateDoc(doc(db, 'practice_logs', latestLog.id), {
                        score: result.score,
                        correctCount: result.correctCount,
                        totalQuestions: result.totalQuestions,
                        durationSeconds: result.durationSeconds
                    });
                    console.log('[savePracticeResult] Updated practice_log with score');
                }
            }
        } catch (e) {
            console.warn('[savePracticeResult] Could not update practice_log:', e);
        }

        return docRef.id;
    } catch (error) {
        console.error('[savePracticeResult] FAILED:', error);
        return null;
    }
}

/**
 * Lấy lịch sử làm bài của người dùng hiện tại cho một bài thi cụ thể
 * @param {string} examId - ID của bài thi
 * @returns {Promise<Array>} - Danh sách lịch sử
 */
export async function getPracticeHistory(examId) {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.warn('[getPracticeHistory] No user logged in');
            return [];
        }

        const historyCol = collection(db, 'practice_history');
        const q = query(historyCol,
            where('examId', '==', examId),
            where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sắp xếp theo thời gian mới nhất
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return history;
    } catch (error) {
        console.error('[getPracticeHistory] FAILED:', error);
        return [];
    }
}

/**
 * Lấy điểm cao nhất của tất cả bài thi cho người dùng hiện tại
 * CACHE-FIRST STRATEGY để load nhanh hơn
 * @returns {Promise<Object>} - Object với examId làm key và { highestScore, attemptCount } làm value
 */

// Memory cache for highest scores
let highestScoresCache = null;
let highestScoresCacheTime = 0;
const HIGHEST_SCORES_CACHE_DURATION = 60000; // 1 minute memory cache

export async function getHighestScores() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.warn('[getHighestScores] No user logged in');
            return {};
        }

        // 1. Check memory cache first (instant)
        if (highestScoresCache && (Date.now() - highestScoresCacheTime < HIGHEST_SCORES_CACHE_DURATION)) {
            console.log('[getHighestScores] ⚡ Returning memory-cached scores');
            return highestScoresCache;
        }

        const historyCol = collection(db, 'practice_history');
        const q = query(historyCol, where('userId', '==', user.uid));

        // Helper: Parse snapshot to scores
        const parseSnapshot = (snapshot) => {
            const scores = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const examId = data.examId;
                const score = data.score || 0;

                if (!scores[examId]) {
                    scores[examId] = {
                        highestScore: score,
                        attemptCount: 1
                    };
                } else {
                    if (score > scores[examId].highestScore) {
                        scores[examId].highestScore = score;
                    }
                    scores[examId].attemptCount++;
                }
            });
            return scores;
        };

        // 2. Try IndexedDB cache first (fast)
        try {
            console.log('[getHighestScores] Trying IndexedDB cache...');
            const cachedSnapshot = await getDocsFromCache(q);

            if (!cachedSnapshot.empty) {
                const scores = parseSnapshot(cachedSnapshot);
                console.log('[getHighestScores] ⚡ Loaded scores from IndexedDB cache for', Object.keys(scores).length, 'exams');

                // Update memory cache
                highestScoresCache = scores;
                highestScoresCacheTime = Date.now();

                // Background sync: fetch from server (non-blocking)
                getDocs(q).then(serverSnapshot => {
                    const serverScores = parseSnapshot(serverSnapshot);
                    if (Object.keys(serverScores).length !== Object.keys(scores).length) {
                        console.log('[getHighestScores] Background sync updated scores');
                        highestScoresCache = serverScores;
                        highestScoresCacheTime = Date.now();
                    }
                }).catch(() => {
                    // Silent fail for background sync
                });

                return scores;
            }
        } catch (cacheErr) {
            // Cache miss - fall through to network
            console.log('[getHighestScores] Cache miss, fetching from server...');
        }

        // 3. Fetch from server
        console.log('[getHighestScores] Fetching from server...');
        const snapshot = await getDocs(q);
        const scores = parseSnapshot(snapshot);

        // Update memory cache
        highestScoresCache = scores;
        highestScoresCacheTime = Date.now();
        console.log('[getHighestScores] Loaded scores for', Object.keys(scores).length, 'exams from server');

        return scores;
    } catch (error) {
        console.error('[getHighestScores] FAILED:', error);
        return {};
    }
}

/**
 * Xóa cache highest scores (gọi sau khi submit bài thi)
 */
export function clearHighestScoresCache() {
    highestScoresCache = null;
    highestScoresCacheTime = 0;
    console.log('[getHighestScores] Cache cleared');
}

/**
 * Lấy danh sách subjects (hardcoded for now)
 */
export function getSubjects() {
    return [
        {
            id: 'math',
            name: 'Toán',
            color: 'text-red-600',
            bg: 'bg-red-50 dark:bg-red-900/30',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>'
        },
        {
            id: 'chem',
            name: 'Hóa học',
            color: 'text-cyan-600',
            bg: 'bg-cyan-50 dark:bg-cyan-900/30',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>'
        },
        {
            id: 'bio',
            name: 'Sinh học',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50 dark:bg-emerald-900/30',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 12c0-4.418 3.582-8 8-8s8 3.582 8 8" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 12c0 4.418-3.582 8-8 8s-8-3.582-8-8" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4v16" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 4v16" /></svg>'
        },
        {
            id: 'history',
            name: 'Lịch sử',
            color: 'text-orange-600',
            bg: 'bg-orange-50 dark:bg-orange-900/30',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
        },
        {
            id: 'info',
            name: 'Tin học',
            color: 'text-purple-600',
            bg: 'bg-purple-50 dark:bg-purple-900/30',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>'
        },
        {
            id: 'physics',
            name: 'Vật lí',
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-900/30',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>'
        }
    ];
}

// ============================================================
// 7. E-TEST CRUD (Collection: etest_exams)
// ============================================================

/**
 * Lấy tất cả E-test exams từ Firestore
 */
export async function getAllEtestExams() {
    const examsCol = collection(db, 'etest_exams');
    const snapshot = await getDocs(examsCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Tạo E-test exam mới
 */
export async function createEtestExam(examData, customId = null) {
    let examId;
    if (customId && /^[a-zA-Z0-9_-]+$/.test(customId)) {
        examId = customId;
    } else {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomCode = Math.random().toString(36).substring(2, 8);
        examId = `etest_${examData.subjectId}_${dateStr}_${randomCode}`;
    }

    const examRef = doc(db, 'etest_exams', examId);
    await setDoc(examRef, {
        ...examData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    return examId;
}

/**
 * Cập nhật E-test exam
 */
export async function updateEtestExam(examId, examData) {
    const examRef = doc(db, 'etest_exams', examId);
    await setDoc(examRef, {
        ...examData,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Xóa E-test exam
 * Note: Firebase deleteDoc doesn't throw on permission denied, so we verify after
 */
export async function deleteEtestExam(examId) {
    console.log('[deleteEtestExam] Deleting exam:', examId);
    if (!examId) {
        throw new Error('examId không hợp lệ');
    }

    const examRef = doc(db, 'etest_exams', examId);

    // Execute delete
    await deleteDoc(examRef);

    // Wait a moment for Firestore to sync
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify the document was actually deleted
    const checkDoc = await getDoc(examRef);
    if (checkDoc.exists()) {
        console.error('[deleteEtestExam] Document still exists after delete - permission denied by Firestore rules');
        throw new Error('Không có quyền xóa. Hãy kiểm tra Firestore Security Rules.');
    }

    console.log('[deleteEtestExam] Verified deleted:', examId);
}

// ============================================================
// 8. VOCAB CRUD (Collection: vocab_sets)
// ============================================================

/**
 * Lấy tất cả Vocab sets từ Firestore
 */
export async function getAllVocabSets() {
    const vocabCol = collection(db, 'vocab_sets');
    const snapshot = await getDocs(vocabCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Tạo Vocab set mới
 */
export async function createVocabSet(vocabData, customId = null) {
    let vocabId;
    if (customId && /^[a-zA-Z0-9_-]+$/.test(customId)) {
        vocabId = customId;
    } else {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomCode = Math.random().toString(36).substring(2, 8);
        vocabId = `vocab_${dateStr}_${randomCode}`;
    }

    const vocabRef = doc(db, 'vocab_sets', vocabId);
    await setDoc(vocabRef, {
        ...vocabData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    return vocabId;
}

/**
 * Cập nhật Vocab set
 */
export async function updateVocabSet(vocabId, vocabData) {
    const vocabRef = doc(db, 'vocab_sets', vocabId);
    await setDoc(vocabRef, {
        ...vocabData,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Xóa Vocab set
 */
export async function deleteVocabSet(vocabId) {
    const vocabRef = doc(db, 'vocab_sets', vocabId);
    await deleteDoc(vocabRef);
}

// ============================================================
// 9. ALLOWED USERS CRUD (Admin + Super-Admin)
// ============================================================

/**
 * Helper: Get current user email from Firebase Auth
 */
function getCurrentUserEmail() {
    return auth.currentUser?.email || 'unknown';
}

/**
 * Helper: Log whitelist action to Firestore
 */
async function logWhitelistAction(action, targetEmail, targetRole) {
    try {
        const logsCol = collection(db, 'whitelist_logs');
        await addDoc(logsCol, {
            action: action,
            target_email: targetEmail,
            target_role: targetRole || 'user',
            performed_by: getCurrentUserEmail(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Failed to log whitelist action:', error);
    }
}

/**
 * Lấy tất cả allowed_users (Admin hoặc Super-Admin)
 * Document ID = email, có field role (ví dụ: "user", "admin", "super-admin")
 */
export async function getAllAllowedUsers() {
    if (!checkIsAdmin()) {
        throw new Error('Không có quyền truy cập. Cần quyền Admin để xem danh sách người dùng.');
    }

    const currentEmail = getCurrentUserEmail();
    const usersCol = collection(db, 'allowed_users');
    const snapshot = await getDocs(usersCol);
    let users = snapshot.docs.map(doc => ({ id: doc.id, email: doc.id, ...doc.data() }));

    // Nếu KHÔNG phải Super-Admin, chỉ trả về user do chính mình thêm
    if (!checkIsSuperAdmin()) {
        users = users.filter(user => user.addedBy === currentEmail);
    }

    return users;
}

/**
 * Thêm user mới vào allowed_users (Admin hoặc Super-Admin)
 * - Admin chỉ được thêm với role = 'user'
 * - Super-Admin được thêm với bất kỳ role nào
 * @param {string} email - Email của user (sẽ dùng làm document ID)
 * @param {string} role - Role của user (ví dụ: "user", "admin", "super-admin")
 */
export async function addAllowedUser(email, role = 'user') {
    if (!checkIsAdmin()) {
        throw new Error('Không có quyền. Cần quyền Admin để thêm người dùng.');
    }

    // Admin (không phải Super-Admin) chỉ được thêm user với role = 'user'
    if (!checkIsSuperAdmin() && role !== 'user') {
        role = 'user'; // Force role = user cho Admin
    }

    if (!email || !email.includes('@')) {
        throw new Error('Email không hợp lệ.');
    }

    const currentEmail = getCurrentUserEmail();
    const userRef = doc(db, 'allowed_users', email);
    await setDoc(userRef, {
        role: role,
        addedBy: currentEmail, // Lưu lại ai đã thêm user này
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    // Log action
    await logWhitelistAction('add', email, role);

    return email;
}

/**
 * Cập nhật thông tin user (Super-Admin only)
 * @param {string} email - Email của user (document ID)
 * @param {object} userData - Dữ liệu cần cập nhật (ví dụ: { role: 'admin', name: '...' })
 */
export async function updateAllowedUser(email, userData) {
    if (!checkIsSuperAdmin()) {
        throw new Error('Không có quyền. Chỉ Super-Admin mới có thể cập nhật thông tin người dùng.');
    }
    const userRef = doc(db, 'allowed_users', email);
    await setDoc(userRef, {
        ...userData,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Cập nhật user role (Super-Admin only)
 * @param {string} email - Email của user
 * @param {string} newRole - Role mới (ví dụ: "user", "admin", "super-admin")
 */
export async function updateUserRole(email, newRole) {
    if (!checkIsSuperAdmin()) {
        throw new Error('Không có quyền. Chỉ Super-Admin mới có thể thay đổi quyền người dùng.');
    }
    const userRef = doc(db, 'allowed_users', email);
    await setDoc(userRef, {
        role: newRole,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Xóa user khỏi allowed_users (Admin hoặc Super-Admin)
 * @param {string} email - Email của user cần xóa
 */
export async function deleteAllowedUser(email) {
    if (!checkIsAdmin()) {
        throw new Error('Không có quyền. Cần quyền Admin để xóa người dùng.');
    }

    const currentEmail = getCurrentUserEmail();
    const userRef = doc(db, 'allowed_users', email);

    // Get user data before delete
    let targetRole = 'user';
    let addedBy = null;
    try {
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            targetRole = userData.role || 'user';
            addedBy = userData.addedBy || null;
        }
    } catch (e) { /* ignore */ }

    // Admin (không phải Super-Admin) chỉ được xóa user do chính họ thêm
    if (!checkIsSuperAdmin() && addedBy !== currentEmail) {
        throw new Error('Bạn chỉ có thể xóa người dùng do chính bạn thêm.');
    }

    await deleteDoc(userRef);

    // Log action
    await logWhitelistAction('delete', email, targetRole);
}

/**
 * Lấy lịch sử whitelist logs (Admin hoặc Super-Admin)
 * @param {number} limit - Số lượng logs tối đa (mặc định 50)
 */
export async function getWhitelistLogs(limit = 50) {
    if (!checkIsAdmin()) {
        throw new Error('Không có quyền truy cập logs.');
    }

    const currentEmail = getCurrentUserEmail();
    const logsCol = collection(db, 'whitelist_logs');
    const snapshot = await getDocs(logsCol);

    // Get all logs
    let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Nếu KHÔNG phải Super-Admin, chỉ trả về logs do chính mình thực hiện
    if (!checkIsSuperAdmin()) {
        logs = logs.filter(log => log.performed_by === currentEmail);
    }

    // Sort by timestamp descending and limit
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return logs.slice(0, limit);
}

// ============================================================
// 10. USER ACTIVITY LOGS (Track user module access)
// ============================================================

/**
 * Log khi user truy cập một module
 * @param {string} moduleName - Tên module (VD: 'practice', 'etest', 'vocab', 'flashcard')
 * @param {string} moduleLabel - Label hiển thị (VD: 'Bài Thi', 'E-test')
 */
export async function logUserActivity(moduleName, moduleLabel = '') {
    const user = auth.currentUser;
    if (!user) return; // Không log nếu chưa đăng nhập

    try {
        const logsCol = collection(db, 'user_activity_logs');
        await addDoc(logsCol, {
            userId: user.uid,
            userEmail: user.email,
            userName: user.displayName || user.email.split('@')[0],
            userAvatar: user.photoURL || '',
            module: moduleName,
            moduleLabel: moduleLabel || moduleName,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent.substring(0, 150)
        });
    } catch (error) {
        console.error('Failed to log user activity:', error);
        // Không throw error để không ảnh hưởng UX
    }
}

/**
 * Lấy danh sách activity logs (Admin only)
 * @param {number} limit - Số lượng logs tối đa (mặc định 100)
 * @returns {Promise<Array>} - Mảng các activity log
 */
export async function getUserActivityLogs(limit = 100) {
    if (!checkIsAdmin()) {
        throw new Error('Không có quyền truy cập activity logs.');
    }

    const currentEmail = getCurrentUserEmail();
    const logsCol = collection(db, 'user_activity_logs');
    const snapshot = await getDocs(logsCol);

    // Get all logs
    let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Nếu KHÔNG phải Super-Admin, chỉ trả về logs của user do mình thêm
    if (!checkIsSuperAdmin()) {
        // Lấy danh sách user do admin này thêm
        const usersCol = collection(db, 'allowed_users');
        const usersSnapshot = await getDocs(usersCol);
        const myUsers = usersSnapshot.docs
            .filter(doc => doc.data().addedBy === currentEmail)
            .map(doc => doc.id); // email là doc ID

        logs = logs.filter(log => myUsers.includes(log.userEmail));
    }

    // Sort by timestamp descending and limit
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return logs.slice(0, limit);
}

/**
 * Lấy thống kê activity (Admin only)
 * @returns {Promise<Object>} - Thống kê gồm: totalAccess, moduleStats, recentUsers
 */
export async function getActivityStats() {
    if (!checkIsAdmin()) {
        throw new Error('Không có quyền truy cập thống kê.');
    }

    const logs = await getUserActivityLogs(500);

    // Thống kê theo module
    const moduleStats = {};
    logs.forEach(log => {
        const mod = log.module || 'unknown';
        if (!moduleStats[mod]) {
            moduleStats[mod] = { count: 0, label: log.moduleLabel || mod };
        }
        moduleStats[mod].count++;
    });

    // Thống kê theo user (unique users)
    const uniqueUsers = new Set(logs.map(log => log.userEmail));

    // Recent unique users (last 10)
    const seenUsers = new Set();
    const recentUsers = [];
    for (const log of logs) {
        if (!seenUsers.has(log.userEmail) && recentUsers.length < 10) {
            seenUsers.add(log.userEmail);
            recentUsers.push({
                email: log.userEmail,
                name: log.userName,
                avatar: log.userAvatar,
                lastModule: log.moduleLabel || log.module,
                lastAccess: log.timestamp
            });
        }
    }

    return {
        totalAccess: logs.length,
        uniqueUsers: uniqueUsers.size,
        moduleStats: moduleStats,
        recentUsers: recentUsers
    };
}

// ============================================================
// 11. NOTIFICATIONS CRUD
// ============================================================

/**
 * Lấy tất cả thông báo (Public - không cần quyền đặc biệt)
 * Sắp xếp theo createdAt mới nhất
 */
export async function getAllNotifications() {
    const notifCol = collection(db, 'notifications');
    const snapshot = await getDocs(notifCol);
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort by createdAt descending
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return notifications;
}

/**
 * Tạo thông báo mới (Admin only)
 * @param {object} data - { title, content, author, category, isNew }
 * category: 'update' | 'remove' | 'edit' | 'fix' | 'new' | 'info'
 */
export async function createNotification(data) {
    if (!checkIsAdmin()) {
        throw new Error('Không có quyền. Cần quyền Admin để tạo thông báo.');
    }
    const notifCol = collection(db, 'notifications');
    const docRef = await addDoc(notifCol, {
        title: data.title || '',
        content: data.content || '',
        author: data.author || '',
        category: data.category || 'info',
        isNew: data.isNew !== undefined ? data.isNew : true,
        createdAt: new Date().toISOString()
    });
    return docRef.id;
}

/**
 * Cập nhật thông báo (Admin only)
 * @param {string} notifId - ID của thông báo
 * @param {object} data - Dữ liệu cần cập nhật
 */
export async function updateNotification(notifId, data) {
    if (!checkIsAdmin()) {
        throw new Error('Không có quyền. Cần quyền Admin để cập nhật thông báo.');
    }
    const notifRef = doc(db, 'notifications', notifId);
    await setDoc(notifRef, {
        ...data,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Xóa thông báo (Admin only)
 * @param {string} notifId - ID của thông báo cần xóa
 */
export async function deleteNotification(notifId) {
    if (!checkIsAdmin()) {
        throw new Error('Không có quyền. Cần quyền Admin để xóa thông báo.');
    }
    const notifRef = doc(db, 'notifications', notifId);
    await deleteDoc(notifRef);
}

// ============================================================
// 10. EXAM FEEDBACK SYSTEM
// ============================================================

/**
 * Get all feedbacks for an exam
 * @param {string} examId - ID of the exam
 * @returns {Promise<Array>} - Array of feedback objects
 */
export async function getExamFeedbacks(examId) {
    const feedbacksCol = collection(db, 'feedbacks', examId, 'comments');
    const snapshot = await getDocs(feedbacksCol);
    const feedbacks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    // Sort by createdAt descending (newest first)
    feedbacks.sort((a, b) => {
        if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
        return 0;
    });
    return feedbacks;
}

/**
 * Add a new feedback comment
 * @param {string} examId - ID of the exam
 * @param {string} content - Comment content (max 256 chars)
 * @returns {Promise<string>} - ID of the new comment
 */
export async function addFeedback(examId, content) {
    const user = auth.currentUser;
    if (!user) throw new Error('Bạn cần đăng nhập để bình luận.');

    if (!content || content.trim().length === 0) {
        throw new Error('Nội dung bình luận không được để trống.');
    }
    if (content.length > 256) {
        throw new Error('Bình luận tối đa 256 ký tự.');
    }

    const feedbacksCol = collection(db, 'feedbacks', examId, 'comments');
    const docRef = await addDoc(feedbacksCol, {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email.split('@')[0],
        userAvatar: user.photoURL || '',
        content: content.trim(),
        createdAt: new Date().toISOString(),
        isFixed: false,
        fixedBy: null,
        fixedAt: null,
        replies: []
    });
    return docRef.id;
}

/**
 * Add a reply to a feedback comment
 * @param {string} examId - ID of the exam
 * @param {string} commentId - ID of the parent comment
 * @param {string} content - Reply content (max 256 chars)
 */
export async function addReply(examId, commentId, content) {
    const user = auth.currentUser;
    if (!user) throw new Error('Bạn cần đăng nhập để trả lời.');

    if (!content || content.trim().length === 0) {
        throw new Error('Nội dung trả lời không được để trống.');
    }
    if (content.length > 256) {
        throw new Error('Trả lời tối đa 256 ký tự.');
    }

    const commentRef = doc(db, 'feedbacks', examId, 'comments', commentId);
    const commentSnap = await getDoc(commentRef);

    if (!commentSnap.exists()) {
        throw new Error('Bình luận không tồn tại.');
    }

    const currentReplies = commentSnap.data().replies || [];
    const newReply = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email.split('@')[0],
        userAvatar: user.photoURL || '',
        content: content.trim(),
        createdAt: new Date().toISOString()
    };

    await updateDoc(commentRef, {
        replies: [...currentReplies, newReply]
    });
}

/**
 * Delete a feedback comment (user's own or admin)
 * @param {string} examId - ID of the exam
 * @param {string} commentId - ID of the comment to delete
 */
export async function deleteFeedback(examId, commentId) {
    const user = auth.currentUser;
    if (!user) throw new Error('Bạn cần đăng nhập.');

    const commentRef = doc(db, 'feedbacks', examId, 'comments', commentId);
    const commentSnap = await getDoc(commentRef);

    if (!commentSnap.exists()) {
        throw new Error('Bình luận không tồn tại.');
    }

    const commentData = commentSnap.data();

    // Allow delete if user is admin OR is the comment owner
    if (!checkIsAdmin() && commentData.userId !== user.uid) {
        throw new Error('Bạn chỉ có thể xóa bình luận của mình.');
    }

    await deleteDoc(commentRef);
}

/**
 * Mark a feedback as fixed (Admin only)
 * @param {string} examId - ID of the exam
 * @param {string} commentId - ID of the comment to mark
 */
export async function markFeedbackFixed(examId, commentId) {
    if (!checkIsAdmin()) {
        throw new Error('Cần quyền Admin để đánh dấu đã sửa.');
    }

    const user = auth.currentUser;
    const commentRef = doc(db, 'feedbacks', examId, 'comments', commentId);

    await updateDoc(commentRef, {
        isFixed: true,
        fixedBy: user.email,
        fixedAt: new Date().toISOString()
    });
}

/**
 * Get current user info for feedback display
 * @returns {object|null} - User info or null if not logged in
 */
export function getCurrentUserInfo() {
    const user = auth.currentUser;
    if (!user) return null;
    return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL || ''
    };
}

// ============================================================
// 11. PRESENCE TRACKING (Online Users) - Using Firebase Realtime Database
// ============================================================
// This uses Firebase RTDB for accurate presence tracking with onDisconnect()
// which automatically removes the user when they close the tab/browser or lose connection.

let presenceRef = null;
let connectedRef = null;
let unsubscribeConnected = null;

/**
 * Start presence tracking using Firebase Realtime Database
 * Uses onDisconnect() for automatic cleanup when client goes offline
 */
export async function startPresence() {
    const user = auth.currentUser;
    if (!user) {
        console.log('[Presence] No user, skipping presence tracking');
        return;
    }

    // Prevent duplicate listeners if already started
    if (presenceRef) {
        console.log('[Presence] Already tracking, skipping duplicate start');
        return;
    }

    console.log('[Presence] Starting presence tracking for:', user.email);

    try {
        // Reference to this user's presence in RTDB
        presenceRef = ref(rtdb, `presence/${user.uid}`);

        // Reference to .info/connected to detect connection state
        connectedRef = ref(rtdb, '.info/connected');

        // Listen for connection state changes
        unsubscribeConnected = onValue(connectedRef, async (snapshot) => {
            console.log('[Presence] Connection state:', snapshot.val());
            if (snapshot.val() === true) {
                // We're connected (or reconnected)
                console.log('[Presence] Connected! Setting up onDisconnect and presence data...');

                // Set up onDisconnect FIRST - this will run on server when client disconnects
                await onDisconnect(presenceRef).remove();

                // Now set our presence data
                await set(presenceRef, {
                    oderId: user.uid,
                    userEmail: user.email,
                    userName: user.displayName || user.email.split('@')[0],
                    lastSeen: new Date().toISOString(),
                    connectedAt: new Date().toISOString(),
                    userAgent: navigator.userAgent.substring(0, 100)
                });

                console.log('[Presence] Presence data set successfully!');
            }
        });

        // Also update lastSeen periodically for "last activity" tracking
        // This is optional but useful to see if user is actively using the app
        startHeartbeat();

    } catch (e) {
        console.error('[Presence] Start failed:', e);
    }
}

// Heartbeat to update lastSeen (doesn't affect online status, just activity)
let heartbeatInterval = null;

function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(async () => {
        const user = auth.currentUser;
        if (user && presenceRef) {
            try {
                await set(presenceRef, {
                    oderId: user.uid,
                    userEmail: user.email,
                    userName: user.displayName || user.email.split('@')[0],
                    lastSeen: new Date().toISOString(),
                    userAgent: navigator.userAgent.substring(0, 100)
                });
            } catch (e) {
                // Ignore heartbeat errors
            }
        }
    }, 60000); // Every 60 seconds for activity tracking
}

/**
 * Stop presence tracking - call this on logout
 */
export async function stopPresence() {
    // Clear heartbeat
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    // Unsubscribe from connection listener
    if (unsubscribeConnected) {
        unsubscribeConnected();
        unsubscribeConnected = null;
    }

    // Remove presence from RTDB
    if (presenceRef) {
        try {
            await remove(presenceRef);
        } catch (e) {
            // Ignore errors on cleanup
        }
        presenceRef = null;
    }
}

/**
 * Get count of online users from Realtime Database
 * @returns {Promise<number>} - Number of online users
 */
export async function getOnlineUsersCount() {
    try {
        const presenceListRef = ref(rtdb, 'presence');
        const snapshot = await get(presenceListRef);

        if (!snapshot.exists()) return 0;

        return Object.keys(snapshot.val()).length;
    } catch (e) {
        console.warn('Failed to get online users count:', e);
        return 0;
    }
}

/**
 * Subscribe to online users count updates (real-time from RTDB)
 * @param {function} callback - Function to call with updated count
 * @returns {function} - Unsubscribe function
 */
export function subscribeToOnlineUsers(callback) {
    const presenceListRef = ref(rtdb, 'presence');

    const unsubscribe = onValue(presenceListRef, (snapshot) => {
        if (!snapshot.exists()) {
            callback(0);
            return;
        }
        callback(Object.keys(snapshot.val()).length);
    });

    // Return unsubscribe function
    return unsubscribe;
}

/**
 * Clean up old presence records - NOT NEEDED with RTDB onDisconnect
 * Keeping for backwards compatibility but it's a no-op now
 */
export async function cleanupOldPresence() {
    // No longer needed - onDisconnect handles this automatically
    console.log('cleanupOldPresence: Using RTDB onDisconnect, cleanup is automatic');
}

/**
 * Get list of online users with details from Realtime Database
 * @returns {Promise<Array>} - Array of online user objects
 */
export async function getOnlineUsersList() {
    try {
        const presenceListRef = ref(rtdb, 'presence');
        const snapshot = await get(presenceListRef);

        if (!snapshot.exists()) return [];

        const data = snapshot.val();
        const onlineUsers = Object.entries(data).map(([oderId, userData]) => ({
            oderId: userData.oderId || oderId,
            email: userData.userEmail || '',
            name: userData.userName || userData.userEmail?.split('@')[0] || 'Unknown',
            lastSeen: userData.lastSeen,
            connectedAt: userData.connectedAt,
            userAgent: userData.userAgent || ''
        }));

        // Sort by name
        onlineUsers.sort((a, b) => a.name.localeCompare(b.name));

        return onlineUsers;
    } catch (e) {
        console.warn('Failed to get online users list:', e);
        return [];
    }
}

/**
 * Subscribe to online users list updates (real-time from RTDB)
 * @param {function} callback - Function to call with updated list
 * @returns {function} - Unsubscribe function
 */
export function subscribeToOnlineUsersList(callback) {
    const presenceListRef = ref(rtdb, 'presence');

    const unsubscribe = onValue(presenceListRef, (snapshot) => {
        if (!snapshot.exists()) {
            callback([]);
            return;
        }

        const data = snapshot.val();
        const onlineUsers = Object.entries(data).map(([oderId, userData]) => ({
            oderId: userData.oderId || oderId,
            email: userData.userEmail || '',
            name: userData.userName || userData.userEmail?.split('@')[0] || 'Unknown',
            lastSeen: userData.lastSeen,
            connectedAt: userData.connectedAt,
            userAgent: userData.userAgent || ''
        }));

        // Sort by name
        onlineUsers.sort((a, b) => a.name.localeCompare(b.name));

        callback(onlineUsers);
    });

    // Return unsubscribe function
    return unsubscribe;
}

/**
 * Sync user profile to 'users' collection
 * @param {object} user - Firebase Auth User
 */
async function syncUserProfile(user) {
    if (!user) return;
    try {
        const userRef = doc(db, 'users', user.email);
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || '',
            lastLogin: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.warn('[Gatekeeper] Failed to sync user profile:', e);
    }
}

// ============================================================
// 12. SPECIAL LETTER FEATURE CONTROL
// ============================================================

/**
 * Lấy trạng thái bật/tắt tính năng lá thư đặc biệt
 * @returns {Promise<boolean>} - true nếu bật, false nếu tắt
 */
export async function getSpecialLetterEnabled() {
    try {
        const settingsRef = doc(db, 'settings', 'special_letter');
        const snap = await getDoc(settingsRef);

        if (snap.exists()) {
            return snap.data().enabled !== false; // Default true
        }
        return true; // Default: enabled
    } catch (e) {
        console.warn('[Gatekeeper] Failed to get special letter status:', e);
        return true; // Default: enabled on error
    }
}

/**
 * Cập nhật trạng thái bật/tắt tính năng lá thư đặc biệt (Chỉ Super-Admin)
 * @param {boolean} enabled - true để bật, false để tắt
 * @returns {Promise<boolean>} - true nếu thành công
 */
export async function setSpecialLetterEnabled(enabled) {
    try {
        if (!checkIsSuperAdmin()) {
            console.warn('[Gatekeeper] Only Super-Admin can change special letter status');
            return false;
        }

        const settingsRef = doc(db, 'settings', 'special_letter');
        await setDoc(settingsRef, {
            enabled: enabled,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.currentUser?.email || 'unknown'
        }, { merge: true });

        console.log('[Gatekeeper] Special letter status updated:', enabled);
        return true;
    } catch (e) {
        console.error('[Gatekeeper] Failed to set special letter status:', e);
        return false;
    }
}
