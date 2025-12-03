/**
 * GATEKEEPER.JS - HỆ THỐNG BẢO VỆ TẬP TRUNG (PHIÊN BẢN NÂNG CẤP)
 * Tác dụng: Quản lý đăng nhập, whitelist, và chống đá session.
 * Lỗ hổng bảo mật đã được vá.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================
// 1. CẤU HÌNH (BẠN CHỈ CẦN DÁN CONFIG 1 LẦN DUY NHẤT Ở ĐÂY)
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyDWhaSOppY0WawN1h9g0bib-UomFNQO1PM",
    authDomain: "studystationlogin.firebaseapp.com",
    projectId: "studystationlogin",
    storageBucket: "studystationlogin.firebasestorage.app",
    messagingSenderId: "966986507430",
    appId: "1:966986507430:web:443c18747bd9a4dfa88067"
};
// ============================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const ENTRY_TOKEN_KEY = 'gatekeeper_entry';
function setEntryToken() {
    try { sessionStorage.setItem(ENTRY_TOKEN_KEY, JSON.stringify({ ts: Date.now(), r: Math.random().toString(36).slice(2) })); } catch {}
}
function clearEntryToken() {
    try { sessionStorage.removeItem(ENTRY_TOKEN_KEY); } catch {}
}
function hasValidEntryToken(maxAgeMs = 300000) {
    try {
        const raw = sessionStorage.getItem(ENTRY_TOKEN_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        return typeof data?.ts === 'number' && (Date.now() - data.ts) <= maxAgeMs;
    } catch { return false; }
}

function getProjectRoot() {
    try {
        const parts = location.pathname.split('/').filter(Boolean);
        return parts.length ? `/${parts[0]}/` : '/';
    } catch { return '/'; }
}

function toProjectUrl(relPath) {
    const root = getProjectRoot();
    const clean = String(relPath || '').replace(/^\/+/, '');
    return root + clean;
}

function getGaId() {
    try {
        const v = window.__GA_MEASUREMENT_ID;
        if (typeof v === 'string' && v.trim()) return v.trim();
        const m = document.querySelector('meta[name="ga-measurement-id"]');
        const c = m && m.content ? m.content.trim() : '';
        return c;
    } catch { return ''; }
}

function initAnalytics() {
    const id = getGaId();
    if (!id) return;
    if (!window.dataLayer) window.dataLayer = [];
    if (!window.gtag) window.gtag = function(){window.dataLayer.push(arguments);};
    const existing = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    if (!existing) {
        const s = document.createElement('script');
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
        document.head.appendChild(s);
    }
    window.gtag('js', new Date());
    window.gtag('config', id, { send_page_view: true });
}

// --- CÁC HÀM HỖ TRỢ ---

// Hàm đăng nhập (Dùng cho trang Login)
export async function loginWithGoogle() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed:", error);
        const el = document.getElementById('loginError');
        if (el) {
            el.textContent = error.message || 'Không thể đăng nhập. Vui lòng thử lại.';
            el.style.display = 'block';
        }
    }
}

// Hàm đăng xuất (Dùng cho mọi trang)
export async function logoutUser() {
    await signOut(auth);
    clearEntryToken();
    // onAuthStateChanged sẽ tự động xử lý việc chuyển hướng sau khi đăng xuất
}

/**
 * HÀM KHỞI TẠO BẢO VỆ (QUAN TRỌNG NHẤT)
 * @param {string} type - 'login' (cho trang chủ) hoặc 'protected' (cho trang nội dung)
 */
export function initGatekeeper(type = 'protected') {
    initAnalytics();
    const isProtected = type === 'protected' || type === 'protected_page';
    const loadingEl = document.getElementById('gatekeeper-loading');

    if (isProtected) {
        if (loadingEl) {
            document.body.style.visibility = 'visible';
            loadingEl.style.display = 'flex';
        } else {
            document.body.style.visibility = 'hidden';
        }
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // === NGƯỜI DÙNG ĐÃ LOGIN ===
            try {
                const userRef = doc(db, 'allowed_users', user.email);
                const docSnap = await getDoc(userRef);

                if (!docSnap.exists()) {
                    throw new Error("Email không nằm trong Whitelist. Vui lòng liên hệ quản trị viên.");
                }

                const serverSession = docSnap.data().current_session_id;

                if (type === 'login') {
                    // Nếu ở trang login, tạo session mới và chuyển hướng
                    const newSession = Date.now().toString();
                    await updateDoc(userRef, { 
                        current_session_id: newSession,
                        last_login: new Date().toISOString()
                    });
                    localStorage.setItem('my_session_id', newSession);
                    setEntryToken();
                    window.location.href = toProjectUrl('content/index.html');
                } else if (isProtected) {
                    if (!hasValidEntryToken()) {
                        window.location.href = toProjectUrl('index.html');
                        return;
                    }
                    // Nếu ở trang được bảo vệ, xác thực session
                    const localSession = localStorage.getItem('my_session_id');
                    if (serverSession !== localSession) {
                        throw new Error("Phiên đăng nhập không hợp lệ. Có thể bạn đã đăng nhập ở nơi khác.");
                    }

                    // Kích hoạt listener để phát hiện đăng nhập từ nơi khác
                    onSnapshot(userRef, (snap) => {
                        if (snap.data().current_session_id !== localStorage.getItem('my_session_id')) {
                            alert("Tài khoản đang được sử dụng ở nơi khác! Bạn sẽ bị đăng xuất.");
                            signOut(auth);
                        }
                    });

                    if (loadingEl) {
                        loadingEl.style.display = 'none';
                    }
                    document.body.style.visibility = 'visible';
                }
            } catch (error) {
                console.error("Gatekeeper Error:", error);
                await signOut(auth);
                if (type === 'login') {
                    const el = document.getElementById('loginError');
                    const vLogin = document.getElementById('view-login');
                    const vLoading = document.getElementById('view-loading');
                    const vRedirect = document.getElementById('view-redirect');
                    if (vLoading) vLoading.classList.add('hidden');
                    if (vRedirect) vRedirect.classList.add('hidden');
                    if (vLogin) vLogin.classList.remove('hidden');
                    if (el) { el.textContent = error.message || 'Bạn chưa được cấp quyền truy cập.'; el.style.display = 'block'; }
                } else {
                    document.body.innerHTML = '<h1>Lỗi xác thực. Đang chuyển hướng...</h1>';
                    setTimeout(() => { window.location.href = toProjectUrl('index.html'); }, 2000);
                }
            }
        } else {
            // === CHƯA LOGIN ===
            if (isProtected) {
                // Xóa trắng nội dung và chuyển hướng về trang login
                document.body.innerHTML = '';
                window.location.href = toProjectUrl('index.html');
            } else {
                // Ở trang login, chỉ cần đảm bảo nội dung được hiển thị
                document.body.style.visibility = 'visible';
                const vLogin = document.getElementById('view-login');
                const vLoading = document.getElementById('view-loading');
                const vRedirect = document.getElementById('view-redirect');
                if (vLoading) vLoading.classList.add('hidden');
                if (vRedirect) vRedirect.classList.add('hidden');
                if (vLogin) vLogin.classList.remove('hidden');
            }
        }
    });
}
