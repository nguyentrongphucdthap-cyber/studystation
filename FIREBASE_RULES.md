rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    function isLoggedIn() {
      return request.auth != null;
    }
    
    function isInWhitelist() {
      return isLoggedIn() && 
             exists(/databases/$(database)/documents/allowed_users/$(request.auth.token.email));
    }
    
    function getUserRole() {
      return get(/databases/$(database)/documents/allowed_users/$(request.auth.token.email)).data.role;
    }
    
    function isAdmin() {
      return isInWhitelist() && 
             (getUserRole().matches('.*admin.*') || getUserRole().matches('.*super-admin.*'));
    }
    
    function isSuperAdmin() {
      return isInWhitelist() && getUserRole().matches('.*super-admin.*');
    }
    
    // ============================================
    // ALLOWED USERS (Whitelist)
    // Session Management v3: Cho phép 1 desktop + 1 mobile cùng lúc
    // - User chỉ được update document của chính mình
    // - User được phép update: sessions, current_session_id, last_login, last_device_type, display_name, photo_url, login_count
    // - Role chỉ được Super-Admin update
    // ============================================
    
    match /allowed_users/{email} {
      // Đọc: User đọc của mình, Admin đọc tất cả
      allow read: if isLoggedIn() && (request.auth.token.email == email || isAdmin());
      
      // Update: User update của mình (session, profile), Super-Admin update tất cả (kể cả role)
      // User thường CHỈ được update các field: sessions, current_session_id, last_login, last_device_type, display_name, photo_url, login_count
      allow update: if isLoggedIn() && (
        // Super-Admin có thể update tất cả
        isSuperAdmin() ||
        // User chỉ update document của chính mình VÀ không thay đổi các field bảo vệ
        (request.auth.token.email == email && 
         !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'addedBy', 'createdAt']))
      );
      
      // Tạo/Xóa: Chỉ Admin
      allow create, delete: if isAdmin();
    }
    
    // ============================================
    // WHITELIST LOGS
    // ============================================
    
    match /whitelist_logs/{logId} {
      allow read, write: if isAdmin();
    }
    
    // ============================================
    // USER ACTIVITY LOGS (Dashboard tracking)
    // ============================================
    
    match /user_activity_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isLoggedIn() && 
                       request.resource.data.userEmail == request.auth.token.email;
      allow update, delete: if false;
    }
    
    // ============================================
    // NOTIFICATIONS
    // Fields: title, content, author, category, isNew, createdAt, updatedAt
    // category: 'update' | 'remove' | 'edit' | 'fix' | 'new' | 'info'
    // ============================================
    
    match /notifications/{notifId} {
      allow read: if isLoggedIn();
      allow write: if isAdmin();
    }
    
    // ============================================
    // PRACTICE EXAMS
    // Fields: subjectId, title, time, customId, author, tags[], 
    //         part1[], part2[], part3[], createdAt, attemptCount
    // ============================================
    
    match /exams/{examId} {
      allow read: if isLoggedIn();
      // Admin có thể tạo, xóa, update toàn bộ (bao gồm tags)
      allow create, delete: if isAdmin();
      // Update: Admin có thể update tất cả, User thường chỉ được update attemptCount
      allow update: if isAdmin() || 
        (isLoggedIn() && 
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['attemptCount']));
    }
    
    // ============================================
    // E-TEST EXAMS (Restricted to Whitelist)
    // ============================================
    
    match /etest_exams/{examId} {
      allow read: if isInWhitelist();
      allow write: if isAdmin();
    }
    
    // ============================================
    // VOCAB SETS (Restricted to Whitelist)
    // ============================================
    
    match /vocab_sets/{setId} {
      allow read: if isInWhitelist();
      allow write: if isAdmin();
    }
    
    // ============================================
    // USER DATA
    // ============================================
    
    match /user_data/{userId} {
      allow read, write: if isLoggedIn() && request.auth.uid == userId;
    }
    
    match /user_data/{userId}/{subcollection=**} {
      allow read, write: if isLoggedIn() && request.auth.uid == userId;
    }

    // ============================================
    // ALL USERS DIRECTORY (Guests + Whitelisted)
    // ============================================
    
    match /users/{email} {
      allow read: if isLoggedIn();
      allow write: if isLoggedIn() && request.auth.token.email == email;
    }
    
    // ============================================
    // PRACTICE LOGS
    // Lưu thông tin khi user bắt đầu làm bài
    // Fields: examId, examTitle, subjectId, userEmail, userName, 
    //         mode ('classic'/'stepbystep'), timestamp, durationSeconds (optional)
    // ============================================
    
    // Helper: Kiểm tra admin đã thêm user này
    function isAddedByCurrentAdmin(userEmail) {
      return get(/databases/$(database)/documents/allowed_users/$(userEmail)).data.addedBy == request.auth.token.email;
    }
    
    match /practice_logs/{logId} {
      // Admin đọc tất cả (việc lọc theo addedBy được thực hiện phía client)
      allow read: if isAdmin();
      // Logged-in user có thể tạo log (khi bắt đầu làm bài)
      allow create: if isLoggedIn();
      // Cho phép cập nhật điểm số sau khi nộp bài (chỉ các field score-related)
      allow update: if isLoggedIn() && 
        request.resource.data.userEmail == request.auth.token.email &&
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['score', 'correctCount', 'totalQuestions', 'durationSeconds']);
      // Không cho phép delete
      allow delete: if false;
    }
    
    // ============================================
    // PRACTICE HISTORY
    // Lưu kết quả làm bài chi tiết để xem lại
    // Fields: examId, examTitle, subjectId, userEmail, userName, userId,
    //         score, correctCount, totalQuestions, durationSeconds, answers,
    //         examData, timestamp, mode ('classic'/'stepbystep'), skippedCount (optional)
    // ============================================
    
    match /practice_history/{historyId} {
      // User đọc lịch sử của mình, Admin đọc tất cả (lọc client-side)
      allow read: if isLoggedIn() && (
        resource.data.userId == request.auth.uid || 
        isAdmin()
      );
      // User có thể tạo lịch sử làm bài của mình
      allow create: if isLoggedIn() && 
        request.resource.data.userId == request.auth.uid &&
        request.resource.data.userEmail == request.auth.token.email;
      // Không cho phép update/delete
      allow update, delete: if false;
    }
    
    // ============================================
    // EXAM FEEDBACKS
    // ============================================
    
    match /feedbacks/{examId}/comments/{commentId} {
      allow read: if isLoggedIn();
      allow create: if isLoggedIn();
      allow update: if isLoggedIn() && 
        (request.auth.uid == resource.data.userId || isAdmin());
      allow delete: if isLoggedIn() && 
        (request.auth.uid == resource.data.userId || isAdmin());
    }
  }
}

// ============================================
// REALTIME DATABASE RULES (presence)
// ============================================

// {
//   "rules": {
//     "presence": {
//       // Bất kỳ user nào đã đăng nhập đều có thể ghi vào danh sách presence
//       // Bao gồm cả Guest (chưa có trong whitelist) vẫn được tính là online
//       ".read": "auth != null",
//       ".write": "auth != null"
//     }
//   }
// }
