/**
 * GATEKEEPER.JS - HỆ THỐNG BẢO VỆ TẬP TRUNG (FINAL VERSION)
 * Tính năng: 
 * 1. Đăng nhập Google & Whitelist Check.
 * 2. Chống đăng nhập cùng lúc (Session Management).
 * 3. Phân quyền Admin/User dựa trên chuỗi role (VD: "admin/user").
 * 4. Tự động cập nhật quyền & đá session theo thời gian thực.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================
// 1. CẤU HÌNH FIREBASE
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyDWhaSOppY0WawN1h9g0bib-UomFNQO1PM",
    authDomain: "studystationlogin.firebaseapp.com",
    projectId: "studystationlogin",
    storageBucket: "studystationlogin.firebasestorage.app",
    messagingSenderId: "966986507430",
    appId: "1:966986507430:web:443c18747bd9a4dfa88067"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ============================================================
// 2. CONSTANTS & STORAGE HELPERS
// ============================================================

const ENTRY_TOKEN_KEY = 'gatekeeper_entry_token'; // Token để đảm bảo user đi từ trang login
const USER_ROLE_KEY = 'gatekeeper_user_role';     // Lưu role hiện tại
const SESSION_ID_KEY = 'gatekeeper_session_id';   // Session ID duy nhất của tab này
const DEFAULT_ROLE = 'user';

// --- Helper: Quản lý Entry Token (Chống vào thẳng link mà không login) ---
function setEntryToken() {
    try { 
        const token = { ts: Date.now(), val: Math.random().toString(36).slice(2) };
        sessionStorage.setItem(ENTRY_TOKEN_KEY, JSON.stringify(token)); 
    } catch {}
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
    try { sessionStorage.setItem(USER_ROLE_KEY, role || DEFAULT_ROLE); } catch {}
}

function clearStorage() {
    try {
        sessionStorage.removeItem(ENTRY_TOKEN_KEY);
        sessionStorage.removeItem(USER_ROLE_KEY);
        localStorage.removeItem(SESSION_ID_KEY);
    } catch {}
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

    onAuthStateChanged(auth, async (user) => {
        // Reset role tạm thời để tránh cached sai
        if (!user) {
            handleNotLoggedIn(isProtected, loadingEl);
            return;
        }

        // --- NGƯỜI DÙNG ĐÃ ĐĂNG NHẬP FIREBASE ---
        try {
            // 1. Kiểm tra Whitelist & Lấy dữ liệu
            const userRef = doc(db, 'allowed_users', user.email);
            const docSnap = await getDoc(userRef);

            if (!docSnap.exists()) {
                throw new Error("Email của bạn không nằm trong danh sách cho phép (Whitelist).");
            }

            const userData = docSnap.data();
            const serverSession = userData.current_session_id;
            const serverRole = userData.role || DEFAULT_ROLE;

            // Lưu Role mới nhất vào Session
            setUserRole(serverRole);

            // 2. Xử lý theo từng trang
            if (mode === 'login') {
                // --- TRANG LOGIN ---
                // Tạo session mới -> Update Firestore -> Redirect vào trong
                const newSessionID = Date.now().toString();
                
                await updateDoc(userRef, {
                    current_session_id: newSessionID,
                    last_login: new Date().toISOString()
                });

                localStorage.setItem(SESSION_ID_KEY, newSessionID);
                setEntryToken(); // Cấp vé vào cửa
                
                // Chuyển hướng
                window.location.href = toUrl('content/index.html');

            } else if (isProtected) {
                // --- TRANG NỘI DUNG ---
                
                // A. Kiểm tra Entry Token (ngăn vào bằng cách paste link trực tiếp mà chưa qua login)
                // Lưu ý: Nếu user refresh trang (F5), token có thể mất hoặc hết hạn. 
                // Có thể bỏ qua check này nếu muốn cho phép F5 thoải mái, nhưng check session ID là bắt buộc.
                // Ở đây ta cho phép F5 bằng cách check Session ID là chủ yếu.

                // B. Kiểm tra Session ID (Chống đá)
                const localSession = localStorage.getItem(SESSION_ID_KEY);
                
                if (serverSession !== localSession) {
                    throw new Error("Tài khoản đã đăng nhập ở nơi khác.");
                }

                // C. Thiết lập Real-time Listener (Giám sát liên tục)
                setupRealtimeMonitor(userRef, localSession);

                // D. Mở khóa giao diện
                if (loadingEl) {
                    // Fade out hiệu ứng loading
                    loadingEl.style.opacity = '0';
                    setTimeout(() => { 
                        loadingEl.style.display = 'none'; 
                        document.body.style.overflow = ''; 
                    }, 500);
                }
            }

        } catch (error) {
            console.error("Gatekeeper Check Failed:", error);
            handleAuthError(error, isProtected);
        }
    });
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
    signOut(auth);
    clearStorage();

    if (isProtected) {
        alert("Lỗi xác thực: " + error.message);
        window.location.href = toUrl('index.html');
    } else {
        showErrorUI(error.message);
    }
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

// Giám sát thời gian thực: Session & Role
function setupRealtimeMonitor(userRef, currentLocalSession) {
    onSnapshot(userRef, (snap) => {
        if (!snap.exists()) return; // User bị xóa khỏi whitelist

        const data = snap.data();
        
        // 1. Check Session (Chống đá)
        if (data.current_session_id !== currentLocalSession) {
            alert("⚠️ Phát hiện đăng nhập mới!\n\nTài khoản của bạn vừa đăng nhập ở thiết bị khác. Phiên này sẽ kết thúc.");
            logoutUser(); // Tự động logout và chuyển về trang chủ
            return;
        }

        // 2. Check Role Update (Cập nhật quyền ngay lập tức)
        const newRole = data.role || DEFAULT_ROLE;
        const oldRole = sessionStorage.getItem(USER_ROLE_KEY);
        
        if (newRole !== oldRole) {
            console.log("Role updated from server:", newRole);
            setUserRole(newRole);
            // Reload nhẹ để UI cập nhật theo quyền mới
            // Hoặc có thể dispatch CustomEvent để frontend tự xử lý mà không cần reload
            window.location.reload(); 
        }
    });
}
