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
import { getFirestore, doc, getDoc, updateDoc, onSnapshot, collection, getDocs, addDoc, deleteDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================
// 1. CẤU HÌNH FIREBASE
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyBdSnR-z6CJWzDH-WxdG-0rNX58srJrb8A",
    authDomain: "studystation-auth.firebaseapp.com",
    projectId: "studystation-auth",
    storageBucket: "studystation-auth.firebasestorage.app",
    messagingSenderId: "293717187040",
    appId: "1:293717187040:web:8bca14e98046b1c98cb385"
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
                    last_login: new Date().toISOString(),
                    display_name: user.displayName || '',
                    photo_url: user.photoURL || '',
                    login_count: increment(1)
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

// ============================================================
// 6. FIRESTORE HELPERS (For Admin Panel)
// ============================================================

/**
 * Export Firestore instance và các helper functions cho Admin Panel
 */
export { db, collection, getDocs, addDoc, deleteDoc, setDoc, doc };

/**
 * Lấy tất cả exams từ Firestore
 */
export async function getAllExams() {
    const examsCol = collection(db, 'exams');
    const snapshot = await getDocs(examsCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Lấy exams theo subject
 */
export async function getExamsBySubject(subjectId) {
    const exams = await getAllExams();
    return exams.filter(exam => exam.subjectId === subjectId);
}

/**
 * Thêm exam mới với ID có cấu trúc: {subjectId}_{timestamp}_{randomCode}
 * Ví dụ: bio_20251207_a1b2c3
 * Hoặc sử dụng customId nếu được cung cấp
 */
export async function createExam(examData, customId = null) {
    let examId;

    // Use custom ID if provided and valid, otherwise auto-generate
    if (customId && /^[a-zA-Z0-9_-]+$/.test(customId)) {
        examId = customId;
    } else {
        // Generate structured ID
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        const randomCode = Math.random().toString(36).substring(2, 8); // 6 chars
        examId = `${examData.subjectId}_${dateStr}_${randomCode}`;
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
 */
export async function deleteEtestExam(examId) {
    const examRef = doc(db, 'etest_exams', examId);
    await deleteDoc(examRef);
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
// 9. ALLOWED USERS CRUD (Super-Admin Only)
// ============================================================

/**
 * Lấy tất cả allowed_users (Super-Admin only)
 * Document ID = email, có field role (ví dụ: "user", "admin", "super-admin")
 */
export async function getAllAllowedUsers() {
    if (!checkIsSuperAdmin()) {
        throw new Error('Không có quyền truy cập. Chỉ Super-Admin mới có thể xem danh sách người dùng.');
    }
    const usersCol = collection(db, 'allowed_users');
    const snapshot = await getDocs(usersCol);
    return snapshot.docs.map(doc => ({ id: doc.id, email: doc.id, ...doc.data() }));
}

/**
 * Thêm user mới vào allowed_users (Super-Admin only)
 * @param {string} email - Email của user (sẽ dùng làm document ID)
 * @param {string} role - Role của user (ví dụ: "user", "admin", "super-admin")
 */
export async function addAllowedUser(email, role = 'user') {
    if (!checkIsSuperAdmin()) {
        throw new Error('Không có quyền. Chỉ Super-Admin mới có thể thêm người dùng.');
    }
    if (!email || !email.includes('@')) {
        throw new Error('Email không hợp lệ.');
    }
    const userRef = doc(db, 'allowed_users', email);
    await setDoc(userRef, {
        role: role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
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
 * Xóa user khỏi allowed_users (Super-Admin only)
 * @param {string} email - Email của user cần xóa
 */
export async function deleteAllowedUser(email) {
    if (!checkIsSuperAdmin()) {
        throw new Error('Không có quyền. Chỉ Super-Admin mới có thể xóa người dùng.');
    }
    const userRef = doc(db, 'allowed_users', email);
    await deleteDoc(userRef);
}
