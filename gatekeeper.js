// File: gatekeeper.js
// Đây là file bảo vệ dùng chung cho toàn bộ website

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 1. CẤU HÌNH (Dán Config thật của bạn vào đây 1 lần duy nhất) ---
const firebaseConfig = {
    apiKey: "AIzaSyDWhaSOppY0WawN1h9g0bib-UomFNQO1PM",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 2. HÀM BẢO VỆ (Export để các trang khác dùng) ---
export function initGatekeeper() {
    console.log("Gatekeeper đang hoạt động...");

    // Tự động tìm màn hình loading (nếu trang con có tạo)
    const loader = document.getElementById('loading-overlay'); 

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Kiểm tra Whitelist
                const userRef = doc(db, 'allowed_users', user.email);
                const docSnap = await getDoc(userRef);

                if (!docSnap.exists()) {
                    throw new Error("Không có quyền truy cập (Not Whitelisted)");
                }

                // Kiểm tra Session (Chống đăng nhập nhiều nơi)
                // Lấy Session ID hiện tại trong máy
                const localSession = localStorage.getItem('my_session_id');
                
                // Lấy Session ID trên Server
                const serverSession = docSnap.data().current_session_id;

                // So sánh (Nếu null thì bỏ qua check lần đầu, nhưng tốt nhất là nên check chặt)
                if (serverSession && serverSession !== localSession) {
                     throw new Error("Session không hợp lệ hoặc đã đăng nhập nơi khác.");
                }

                // === THÀNH CÔNG: MỞ CỬA ===
                // 1. Ẩn màn hình loading (nếu có)
                if(loader) loader.style.display = 'none';
                
                // 2. Hiện nội dung chính
                document.body.style.display = 'block'; 
                
                // 3. Theo dõi realtime (để đá ra nếu máy khác đăng nhập)
                onSnapshot(userRef, (snap) => {
                     if(snap.exists() && snap.data().current_session_id !== localSession) {
                         alert("Tài khoản đang được dùng ở nơi khác!");
                         window.location.href = "/index.html"; // Về trang chủ/login
                     }
                });

            } catch (error) {
                console.error("Bị chặn:", error);
                alert("Bạn không có quyền truy cập trang này: " + error.message);
                window.location.href = "/index.html"; // Đá về trang login gốc
            }
        } else {
            // Chưa đăng nhập -> Đá về trang login gốc
            // Lưu lại trang hiện tại để login xong quay lại (Optional)
            sessionStorage.setItem('redirect_to', window.location.href);
            window.location.href = "/index.html"; 
        }
    });
}

// Hàm hỗ trợ đăng xuất dùng chung
export function logout() {
    signOut(auth).then(() => {
        window.location.href = "/index.html";
    });
}
