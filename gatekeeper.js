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
    // onAuthStateChanged sẽ tự động xử lý việc chuyển hướng sau khi đăng xuất
}

/**
 * HÀM KHỞI TẠO BẢO VỆ (QUAN TRỌNG NHẤT)
 * @param {string} type - 'login' (cho trang chủ) hoặc 'protected' (cho trang nội dung)
 */
export function initGatekeeper(type = 'protected') {
    // Ngay lập tức ẩn nội dung để chống bị xem trộm
    if (type === 'protected') {
        document.body.style.visibility = 'hidden';
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
                    window.location.href = 'content/index.html';
                } else if (type === 'protected') {
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

                    // Mọi thứ OK -> Hiển thị lại nội dung
                    document.body.style.visibility = 'visible';
                }
            } catch (error) {
                console.error("Gatekeeper Error:", error);
                alert(error.message);
                document.body.innerHTML = '<h1>Lỗi xác thực. Đang chuyển hướng...</h1>';
                await signOut(auth);
                setTimeout(() => { window.location.href = "/index.html"; }, 2000);
            }
        } else {
            // === CHƯA LOGIN ===
            if (type === 'protected') {
                // Xóa trắng nội dung và chuyển hướng về trang login
                document.body.innerHTML = '';
                window.location.href = "/index.html";
            } else {
                // Ở trang login, chỉ cần đảm bảo nội dung được hiển thị
                document.body.style.visibility = 'visible';
            }
        }
    });
}
