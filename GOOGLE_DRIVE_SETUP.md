# Hướng Dẫn Cài Đặt Google Drive Video Upload

## Bước 1: Tạo Project trên Google Cloud Console

1. Truy cập: https://console.cloud.google.com/
2. Đăng nhập bằng tài khoản Google của bạn (tài khoản sẽ lưu video)
3. Nhấn **"Select a project"** → **"New Project"**
4. Đặt tên project: `StudyStation Video Upload`
5. Nhấn **Create**

## Bước 2: Bật APIs cần thiết

1. Trong Google Cloud Console, vào **APIs & Services** → **Library**
2. Tìm và BẬT các API sau:
   - **Google Drive API** - Để upload và quản lý file
   - **Google Picker API** - Để chọn/upload file từ giao diện

## Bước 3: Tạo OAuth 2.0 Credentials

1. Vào **APIs & Services** → **Credentials**
2. Nhấn **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Nếu chưa configure, nhấn **"Configure Consent Screen"**:
   - User Type: **External**
   - App name: `StudyStation`
   - User support email: email của bạn
   - Developer contact: email của bạn
   - Nhấn **Save and Continue** (bỏ qua Scopes, Test users)
4. Quay lại **Credentials** → **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
5. Application type: **Web application**
6. Name: `StudyStation Web Client`
7. **Authorized JavaScript origins**: Thêm các URL sau:
   - `http://localhost` (để test local)
   - `http://127.0.0.1`
   - `https://your-domain.com` (domain thực của bạn)
8. Nhấn **Create**
9. **Copy lại Client ID** (dạng: `xxxxx.apps.googleusercontent.com`)

## Bước 4: Tạo API Key

1. Vào **APIs & Services** → **Credentials**
2. Nhấn **"+ CREATE CREDENTIALS"** → **"API Key"**
3. Copy API Key
4. Nhấn **"Edit API key"** để giới hạn:
   - Application restrictions: **HTTP referrers**
   - Website restrictions: Thêm domain của bạn
   - API restrictions: **Restrict key** → Chọn `Google Drive API`, `Google Picker API`

## Bước 5: Tạo Folder trên Google Drive

1. Mở Google Drive của bạn
2. Tạo folder mới tên: `StudyStation Videos`
3. Click phải vào folder → **Get shareable link** hoặc **Share**
4. Đặt quyền: **Anyone with the link can view**
5. Copy **Folder ID** từ URL:
   - URL dạng: `https://drive.google.com/drive/folders/FOLDER_ID`
   - Copy phần `FOLDER_ID`

## Bước 6: Cập nhật Config trong Code

Mở file `content/admin/practice/google-drive-config.js` và thay thế:

```javascript
const GOOGLE_DRIVE_CONFIG = {
    CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com', // Từ bước 3
    API_KEY: 'YOUR_API_KEY', // Từ bước 4
    FOLDER_ID: 'YOUR_FOLDER_ID', // Từ bước 5
    APP_ID: 'YOUR_PROJECT_NUMBER', // Từ Google Cloud Console → Dashboard
};
```

## Bước 7: Test

1. Mở Admin Panel → Practice
2. Chỉnh sửa một đề thi
3. Tại phần "Lời giải" của bất kỳ câu hỏi nào
4. Nhấn nút **"📤 Upload Video"**
5. Đăng nhập Google khi được yêu cầu
6. Chọn file video để upload

## Lưu ý

- **File size**: Google Drive cho phép upload file lên đến 5TB, nhưng nên giới hạn video dưới 500MB để load nhanh
- **Định dạng**: Hỗ trợ MP4, MOV, AVI, WebM
- **Bảo mật**: Client ID và API Key có thể public (chúng chỉ xác định app, không phải credentials nhạy cảm)
- **OAuth**: Mỗi lần upload, bạn cần đăng nhập Google để xác thực
