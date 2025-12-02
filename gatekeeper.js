/**
 * GATEKEEPER.JS - HỆ THỐNG BẢO VỆ TẬP TRUNG
 * Tác dụng: Quản lý đăng nhập, whitelist, và chống đá session.
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

// --- CÁC HÀM HỖ TRỢ ---

// Hàm đăng nhập (Dùng cho trang Login)
export async function loginWithGoogle() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed:", error);
        alert("Lỗi đăng nhập: " + error.message);
    }
}

// Hàm đăng xuất (Dùng cho mọi trang)
export async function logoutUser() {
    await signOut(auth);
    window.location.href = "/index.html"; // Luôn đá về trang chủ
}

/**
 * HÀM KHỞI TẠO BẢO VỆ (QUAN TRỌNG NHẤT)
 * @param {string} type - 'login' (cho trang chủ) hoặc 'protected' (cho trang nội dung)
 */
export function initGatekeeper(type = 'protected') {
    console.log(`🛡️ Gatekeeper đang bảo vệ trang: [${type}]`);
    
    // Tìm màn hình loading để ẩn/hiện
    const loadingEl = document.getElementById('view-loading') || document.getElementById('loading-screen');
    const contentEl = (type === 'login') ? document.getElementById('view-login') : document.body;

    // Mặc định ẩn nội dung
    if(contentEl && type === 'protected') contentEl.style.display = 'none';
    if(loadingEl) loadingEl.style.display = 'flex';

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // === NGƯỜI DÙNG ĐÃ LOGIN ===
            try {
                const userRef = doc(db, 'allowed_users', user.email);
                const docSnap = await getDoc(userRef);

                // 1. Check Whitelist
                if (!docSnap.exists()) {
                    throw new Error("Email không nằm trong Whitelist.");
                }

                // 2. Logic riêng cho từng loại trang
                if (type === 'login') {
                    // Nếu đang ở trang Login mà đã login rồi -> Tạo Session mới & Chuyển trang
                    const newSession = Date.now().toString();
                    await updateDoc(userRef, { 
                        current_session_id: newSession,
                        last_login: new Date().toISOString()
                    });
                    localStorage.setItem('my_session_id', newSession);
                    
                    // Chuyển hướng vào trong
                    window.location.href = 'content/index.html'; 
                } 
                else if (type === 'protected') {
                    // Nếu đang ở trang nội dung -> Check Session xem có hợp lệ không
                    const serverSession = docSnap.data().current_session_id;
                    const localSession = localStorage.getItem('my_session_id');

                    if (serverSession !== localSession) {
                        throw new Error("Phiên đăng nhập không hợp lệ (Bị đá).");
                    }

                    // OK -> Mở cửa hiển thị nội dung
                    if(loadingEl) loadingEl.style.display = 'none';
                    if(contentEl) contentEl.style.display = 'block';

                    // 3. KÍCH HOẠT RA-ĐA (REALTIME LISTENER)
                    onSnapshot(userRef, (snap) => {
                        const currentData = snap.data();
                        const currentLocal = localStorage.getItem('my_session_id');
                        
                        if (currentData.current_session_id !== currentLocal) {
                            alert("Tài khoản đang được sử dụng ở nơi khác!");
                            signOut(auth).then(() => window.location.href = "/index.html");
                        }
                    });
                }

            } catch (error) {
                console.error("Gatekeeper Error:", error);
                await signOut(auth);
                alert(error.message);
                if (type === 'protected') window.location.href = "/index.html";
            }
        } else {
            // === CHƯA LOGIN ===
            if (type === 'protected') {
                // Nếu đang cố vào trang bảo mật -> Đá về Login
                window.location.href = "/index.html";
            } else {
                // Nếu đang ở trang Login -> Hiển thị nút đăng nhập
                if(loadingEl) loadingEl.style.display = 'none';
                if(contentEl) contentEl.classList.remove('hidden');
            }
        }
    });
}
