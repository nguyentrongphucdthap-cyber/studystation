rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Hàm này ĐỌC role (chuỗi kép) của người dùng đang yêu cầu
    function getRoleString() {
      // Dùng getAfter để đọc dữ liệu mới nhất
      return get(/databases/$(database)/documents/allowed_users/$(request.auth.token.email)).data.role;
    }

    // Hàm kiểm tra xem người dùng có vai trò 'admin' (chuỗi chứa 'admin')
    function isAdmin() {
      // Tách chuỗi role (ví dụ: 'admin/user') và kiểm tra xem có 'admin' không
      return getRoleString().split('/').hasAny(['admin']);
    }

    match /allowed_users/{email} {
      
      function isLoggedIn() {
        return request.auth != null;
      }
      
      // 1. CHÍNH CHỦ được ĐỌC
      allow read: if isLoggedIn() && request.auth.token.email == email;

      // 2. CHÍNH CHỦ được SỬA (để update Session ID) HOẶC là ADMIN
      allow update: if (isLoggedIn() && request.auth.token.email == email) || (isLoggedIn() && isAdmin());

      // 3. Cấm tạo mới hoặc XÓA
      allow create, delete: if false;
    }
  }
}
