# StudyStation Agent Map

Tài liệu này là bản đồ kỹ thuật và sản phẩm của StudyStation để hỗ trợ vibe coding nhanh, đúng ngữ cảnh và ít phá vỡ hệ thống.

## 1. Bức tranh tổng thể

- Đây là web app học tập đa module, viết bằng React 19 + Vite + TypeScript, dùng Firebase cho auth + dữ liệu, Cloudflare Pages để host frontend và chạy serverless functions, GitHub là nguồn lưu trữ code/deploy source of truth.
- Ứng dụng xoay quanh một shell chung: người dùng đăng nhập, được gán vai trò qua whitelist, sau đó đi vào các module học tập như Practice, E-test, Vocab, Schedule, Statistics và Mago AI.
- Toàn hệ thống được tổ chức theo hướng:
  - `pages/` = màn hình và flow UI
  - `services/` = truy cập Firebase / logic data
  - `contexts/` = trạng thái toàn cục như auth, theme, UI
  - `components/` = UI tái sử dụng + hub nổi + dialog admin
  - `functions/` = Cloudflare Pages Functions để giấu secret và làm proxy
- Frontend là trung tâm. Không có backend truyền thống luôn chạy cùng site. Thư mục `backend/` là FastAPI phụ trợ/legacy, không phải luồng deploy chính của Cloudflare Pages.

## 2. Stack và hạ tầng

### Frontend

- React 19, React Router 7, TypeScript, Vite
- TailwindCSS + CSS custom trong `src/index.css`
- Lazy loading cho hầu hết pages để giảm bundle ban đầu
- Alias `@` trỏ tới `src/`

### Auth và dữ liệu

- Firebase Auth: đăng nhập Google là flow chính, ngoài ra `auth.service.ts` còn có đăng nhập username/password kiểu `username@studystation.site`
- Firestore: dữ liệu học tập, whitelist, logs, exam metadata, exam content, vocab, etest, notifications, magocoin, giftcode, training data cho Mago
- Realtime Database: presence online và social/chat data của FloatingHub

### Hosting và server-side

- Cloudflare Pages host bản build `dist`
- Cloudflare Pages Functions xử lý:
  - `/api/ai/generate` = proxy Gemini/Workers AI fallback
  - `/api/ai/health-check` = kiểm tra tình trạng key AI
  - `/api/media/upload` = upload ảnh lên ImgBB
- `wrangler.toml` có binding `AI`, nghĩa là Cloudflare Workers AI đã được cấu hình sẵn làm phương án fallback

### Deploy flow hợp lý

1. Dev push code lên GitHub
2. Cloudflare Pages lấy code từ GitHub để build/deploy frontend
3. Cloudflare Functions chạy cùng domain Pages
4. Frontend đọc/ghi Firebase trực tiếp theo rules

## 3. Cấu trúc thư mục quan trọng

### Root

- `package.json`: script dev/build/lint/typecheck/test
- `vite.config.ts`: alias `@`, test config, manual chunks, strip Gemini key ở production build
- `wrangler.toml`: cấu hình Cloudflare Pages/Workers AI
- `firestore.rules`, `database.rules.json`: security rules cho Firebase
- `firebase.json`: map rules files

### `src/`

- `App.tsx`: gốc của toàn bộ route tree
- `main.tsx`: bootstrap React
- `index.css`: theme tokens, global styles, Tailwind layers
- `config/firebase.ts`: init Firebase app/auth/firestore/rtdb + offline persistence
- `contexts/`: Auth, Theme, UI
- `services/`: data layer theo module
- `pages/`: các màn hình chính và admin
- `components/layout/`: shell app, route protection
- `components/admin/`: dialog import/chỉnh sửa dành cho giáo viên/admin
- `components/ui/`: Button, Dialog, Toast, Spinner, Latex, FormattedText...
- `components/FloatingHub.tsx`: hub nổi đa chức năng xuyên app

### `functions/`

- `api/ai/*.ts`: AI proxy qua Cloudflare
- `api/media/upload.ts`: media upload proxy

### `backend/`

- FastAPI để trích xuất PDF/DOCX/TXT và upload ảnh
- Hiện không thấy frontend chính gọi trực tiếp `backend/main.py`
- Xem đây như công cụ phụ hoặc phần legacy hơn là runtime chính

## 4. Shell ứng dụng và route tree

### Provider chain

`BrowserRouter -> AuthProvider -> ThemeProvider -> ToastProvider -> UIProvider -> Routes`

Ý nghĩa:

- `AuthProvider`: xác định user, role, whitelist, session, presence
- `ThemeProvider`: quản lý màu accent, font, background, dark mode, spacing
- `ToastProvider`: thông báo toàn app
- `UIProvider`: trạng thái liên quan tới lúc đang thi và việc mở Mago/FloatingHub

### Route chính

- `/login`: đăng nhập
- `/access-denied`: màn hình cho guest gửi access request
- `/`: dashboard
- `/practice`, `/practice/history`, `/practice/:examId`
- `/schedule`
- `/statistics`
- `/etest`, `/etest/:examId`
- `/vocab`
- `/mago`
- `/admin/*`: toàn bộ khu vực giáo viên/admin

### Layout split

- `/mago` là protected route riêng, không dùng `AppLayout`
- Các route còn lại đi qua `AppLayout`
- `AppLayout` đổi UI shell theo ngữ cảnh:
  - admin route: header quản trị
  - dashboard/schedule: full-screen soft UI
  - sub-pages: header trắng/glass
- `FloatingHub` gần như hiện xuyên suốt, trừ khi đang thi và auto-hide được bật

## 5. Auth, role và access control

### Cách hoạt động

- Đăng nhập thành công mới chỉ xác thực Firebase Auth
- Quyền truy cập thật sự dựa trên document `allowed_users/{email}`
- `checkWhitelist()` quyết định user là:
  - user / teacher / admin / boss / super-admin...
  - hoặc `guest` nếu không có trong whitelist
- Guest bị chặn hầu hết route và được đưa tới `/access-denied`

### Những thứ AuthProvider còn làm thêm

- lưu role vào sessionStorage
- tạo entry token
- đăng ký session desktop/mobile
- bật presence vào Realtime Database
- sync profile vào `users` và `allowed_users`

### Điểm cần nhớ

- Có phân tầng quyền:
  - logged-in
  - whitelist user
  - teacher
  - admin
  - super-admin / boss
- `ProtectedRoute` đang kiểm tra theo role string chứ không có enum cứng
- Khi sửa logic quyền, phải soi đồng thời:
  - `AuthContext.tsx`
  - `auth.service.ts`
  - `firestore.rules`
  - các admin page có chặn UI riêng

## 6. Các module sản phẩm

### 6.1 Dashboard

- Là menu điều hướng trung tâm của app
- Hiển thị lịch thi đếm ngược hardcoded theo mốc thời gian
- Điều hướng tới Practice, Schedule, Vocab, E-test, Mago
- Có một ô “Tài Liệu” đang để `soon`

### 6.2 Practice

Đây là module lớn nhất và là lõi học tập kiểu đề thi.

#### Màn hình danh sách

- Chọn môn trước, sau đó xem danh sách đề
- Hỗ trợ:
  - lọc theo subject
  - tìm kiếm
  - chia theo `customFolder`
  - hiển thị high score
  - ẩn/hiện đề đặc biệt theo `allowedEmails`

#### Màn hình làm bài

- Tải đề qua `getExamContent(examId)`
- Đề có 3 part:
  - `part1`: trắc nghiệm A/B/C/D
  - `part2`: đúng/sai theo sub-question a/b/c/d
  - `part3`: trả lời ngắn
- Hỗ trợ:
  - timer
  - xáo câu/xáo đáp án
  - practice mode làm từng câu
  - split-screen cho đề tiếng Anh có passage/group
  - mobile TOC
  - answer sheet
  - history theo từng đề
  - result review chi tiết
- Khi nộp bài:
  - log activity
  - tăng `attemptCount`
  - lưu `practice_history`
  - thưởng Magocoin theo điểm

#### Mối liên kết quan trọng

- `PracticeHome` đọc metadata từ `exams`
- `PracticeExam` ghép metadata từ `exams` với nội dung từ `exam_contents`
- `Statistics` đọc lại `practice_history`
- `AdminPractice` và `EditExamPage` là nguồn tạo/chỉnh dữ liệu cho module này

### 6.3 E-test

- Dành riêng cho reading tiếng Anh dạng passage + question set
- Cấu trúc dữ liệu tách riêng khỏi Practice
- `EtestHome` list các bài đọc
- `EtestExam` có:
  - timer
  - chia section/passage
  - view mode exam/optimized
  - chấm điểm sau submit
  - log activity

#### Khác Practice ở đâu

- E-test đơn giản hơn, không có practice history sâu như Practice
- Dữ liệu nằm hết trong `etest_exams`
- Tập trung vào reading comprehension thay vì đề đa môn nhiều part

### 6.4 Vocabulary / Flashcards

- `VocabPage` là module học thẻ rất giàu state
- Có 3 kiểu học chính:
  - flashcard vuốt trái/phải
  - matching game
  - learn mode kiểu quiz nhiều lựa chọn
- Có filter:
  - search
  - subject
  - tag/category
  - progress
  - sort

#### Cách lưu tiến độ

- Tiến độ “đã học” một từ được lưu localStorage theo set (`vocab_learned_<id>`)
- Phiên học hoàn thành được lưu Firestore qua `vocab_sessions`
- Vì vậy module này dùng cả local state + localStorage + Firestore cùng lúc

#### Mối liên kết quan trọng

- subject filter tái dùng `getSubjects()` từ exam service
- thống kê vocab được đưa vào `Statistics`
- hoàn thành session có thưởng Magocoin

### 6.5 Schedule

- Màn hình hiển thị thời khóa biểu theo bảng tuần
- Dữ liệu chỉ là một document `schedules/main`
- `useSchedule()` subscribe realtime Firestore
- AdminSchedule là nơi chỉnh dữ liệu này

### 6.6 Statistics

- Gộp dữ liệu từ:
  - `practice_history`
  - `vocab_sessions`
  - `user_activity_logs`
- Hiển thị productivity, xu hướng, so sánh theo môn, thói quen học theo giờ
- Đây là module “aggregation”, nghĩa là sửa format log ở nơi khác có thể ảnh hưởng trực tiếp tới Statistics

### 6.7 Mago AI

Đây là module AI/social lớn thứ hai sau Practice.

#### Năng lực chính

- chat với Mago
- upload ảnh để hỏi
- dùng AI generate response
- tiêu Magocoin khi chat
- redeem giftcode
- chèn tham chiếu câu hỏi/đề vào prompt
- chế độ “Dạy Mago” cho boss/super-admin
- lưu tri thức vào `mago_training`

#### Hạ tầng AI

- Ở production: frontend gọi `/api/ai/generate`, Cloudflare Function giữ key phía server
- Ở local: có thể gọi Gemini trực tiếp bằng env key, nhưng có fallback qua proxy
- Nếu Gemini bị geo-block hoặc lỗi model, proxy có fallback sang Workers AI

#### Mối liên kết quan trọng

- `MagoChatPage` dùng:
  - `chat.service.ts`
  - `ai.service.ts`
  - `magocoin.service.ts`
  - `image.service.ts`
  - `exam.service.ts`
  - `auth.service.ts`
- Đây là nơi giao nhau giữa social, AI, media upload, coin economy và dữ liệu đề thi

### 6.8 FloatingHub

FloatingHub là “mini operating system” gắn xuyên toàn app.

#### Chức năng chính

- chat bạn bè / group
- chat nhanh với Mago
- pomodoro
- notes
- music embed
- theme settings

#### Vì sao nó quan trọng

- Nó xuất hiện ở hầu hết mọi page
- Nó dùng lại rất nhiều service của Mago/chat/theme/auth
- UIContext có thể ép mở/ẩn hub khi đang làm bài
- Nếu sửa hub, phải cẩn thận vì ảnh hưởng toàn hệ thống chứ không chỉ 1 page

### 6.9 Khu vực Admin

Admin là backoffice quản lý gần như toàn bộ dữ liệu sản phẩm.

#### Các phân hệ

- `AdminDashboard`: overview số lượng đề/người dùng/activity/API health
- `AdminPractice`: CRUD đề thi, import JSON, smart import, thư mục
- `EditExamPage`: chỉnh chi tiết đề, part1/2/3, question group, special access
- `AdminEtest`: CRUD E-test
- `AdminVocab`: CRUD vocab set, import flashcard
- `AdminSchedule`: sửa thời khóa biểu
- `AdminNotifications`: CRUD thông báo
- `AdminStudents`: whitelist, role, class, blacklist, activity tracking
- `AdminTeachers`: tài khoản giáo viên + assigned classes
- `AdminAccessRequests`: duyệt/từ chối yêu cầu truy cập
- `AdminMago`: giftcode, leaderboard, history Magocoin

#### Luồng admin đáng chú ý

- Đề thi đặc biệt:
  - bật `isSpecial`
  - chỉ người trong `allowedEmails` mới thấy
  - có thể chọn theo class hoặc manual
- Smart import:
  - dùng AI để parse nội dung thành JSON
  - có logic xử lý LaTeX, hình ảnh, DOCX/PDF

## 7. Data model thực tế trong Firebase

### Firestore collections

#### Auth / user management

- `allowed_users`: whitelist + role + classes + assignedClasses + session info
- `users`: profile sync cơ bản
- `access_requests`: yêu cầu truy cập từ guest
- `blacklist`: danh sách chặn
- `whitelist_logs`: audit log thao tác whitelist
- `user_activity_logs`: log hành vi người dùng

#### Practice

- `exams`: metadata của đề
- `exam_contents`: nội dung chi tiết part1/2/3/group
- `practice_logs`: log attempt
- `practice_history`: kết quả chấm điểm từng user
- `feedbacks/{examId}/comments`: feedback theo đề

#### E-test / Vocab / Schedule / Notifications

- `etest_exams`
- `vocab_sets`
- `vocab_sessions`
- `schedules`
- `notifications`

#### Chat / AI / Mago

- `chats/{ownerEmail}/convos/{partnerKey}`
- `group_chats`
- `mago_training`
- `user_magocoins`
- `mago_giftcodes`
- `mago_giftcode_history`
- `unfriend_logs`

### Realtime Database nodes

- `presence/*`: ai đang online
- `hub/friends/*`: social graph của hub
- `hub/mago_chats/*`: lịch sử chat Mago trên RTDB side

## 8. Sự tương đồng, điểm giống nhau và mối liên kết giữa các phần

### Tương đồng về kiến trúc

- Gần như mọi module đều theo mẫu:
  - Page gọi service
  - Service nói chuyện với Firebase
  - Toast/Spinner/Dialog dùng component chung
- Hầu hết màn hình lớn đều:
  - load dữ liệu trong `useEffect`
  - có trạng thái `loading` + `error`
  - log activity qua `logUserActivity`

### Tương đồng về UX

- Dùng soft UI / glassmorphism nhất quán
- Header, card, button, rounded corners giữ cùng ngôn ngữ thiết kế
- `ThemeContext` làm màu accent và background lan sang nhiều màn

### Liên kết dữ liệu

- Practice, Vocab và Mago đều tạo/tiêu Magocoin
- Practice và Vocab đều đổ số liệu sang Statistics
- Auth/presence ảnh hưởng AppLayout, admin dashboard, FloatingHub, tracking
- Admin là nơi sinh dữ liệu cho hầu hết module học tập

### Liên kết logic mạnh nhất

- `AuthContext` <-> `auth.service.ts` <-> Firestore rules
- `PracticeExam` <-> `exam.service.ts` <-> `EditExamPage`
- `MagoChatPage` <-> `chat.service.ts` + `ai.service.ts` + `magocoin.service.ts`
- `FloatingHub` <-> `ThemeContext` + `chat.service.ts` + `magocoin.service.ts`
- `Statistics` <-> `exam.service.ts` + `vocab-stats.service.ts` + `auth.service.ts`

## 9. Các file phải đọc trước khi sửa từng khu vực

### Nếu sửa routing hoặc shell

- `src/App.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/ProtectedRoute.tsx`

### Nếu sửa quyền truy cập

- `src/contexts/AuthContext.tsx`
- `src/services/auth.service.ts`
- `firestore.rules`
- `database.rules.json`

### Nếu sửa Practice

- `src/pages/practice/PracticeHome.tsx`
- `src/pages/practice/PracticeExam.tsx`
- `src/services/exam.service.ts`
- `src/pages/admin/AdminPractice.tsx`
- `src/pages/admin/EditExamPage.tsx`

### Nếu sửa E-test

- `src/pages/etest/EtestHome.tsx`
- `src/pages/etest/EtestExam.tsx`
- `src/services/etest.service.ts`
- `src/pages/admin/AdminEtest.tsx`

### Nếu sửa Vocab

- `src/pages/vocab/VocabPage.tsx`
- `src/services/vocab.service.ts`
- `src/services/vocab-stats.service.ts`
- `src/pages/admin/AdminVocab.tsx`

### Nếu sửa Mago / AI / social

- `src/pages/mago/MagoChatPage.tsx`
- `src/components/FloatingHub.tsx`
- `src/services/chat.service.ts`
- `src/services/ai.service.ts`
- `src/services/magocoin.service.ts`
- `functions/api/ai/generate.ts`
- `functions/api/media/upload.ts`

### Nếu sửa theme / trải nghiệm xuyên app

- `src/contexts/ThemeContext.tsx`
- `src/contexts/UIContext.tsx`
- `src/index.css`

## 10. Quy ước ngầm cần nhớ khi vibe coding

- Practice exam hiện tách metadata và content thành 2 collection: đừng chỉ sửa `exams` mà quên `exam_contents`
- Special exam phụ thuộc cả `isSpecial` lẫn `allowedEmails`
- Guest logic không chỉ là UI; còn bị chặn bởi route guard và Firestore rules
- Vocab progress không nằm hoàn toàn trên server; một phần ở localStorage
- FloatingHub không phải widget phụ, nó là cross-cutting feature
- Mago production không nên gọi Gemini trực tiếp từ client
- Nếu thêm trường mới vào dữ liệu, hãy kiểm tra:
  - types
  - service read/write
  - admin editor
  - page hiển thị
  - statistics/logs nếu liên quan

## 11. Scripts làm việc

- `npm run dev`: chạy Vite + Cloudflare Pages dev proxy
- `npm run build`: type check project references + build Vite
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run deploy`: build rồi deploy Pages

## 12. Rủi ro và nợ kỹ thuật hiện thấy

- Có dấu hiệu logic lớn đặt trực tiếp trong page component, đặc biệt ở `PracticeExam`, `VocabPage`, `FloatingHub`, `MagoChatPage`; khi refactor nên tách dần thành hooks/subcomponents
- Có code/flow legacy song song:
  - backend FastAPI
  - client-side import bằng `mammoth` + `pdfjs`
- Có secret/hardcoded key trong một số chỗ import/backend legacy; về lâu dài nên chuyển hoàn toàn sang env/server-side proxy, không nhân rộng pattern này
- Chat/rules đang khá “mở” ở một số path để tiện vận hành; nếu siết bảo mật phải kiểm thử kỹ social features

## 13. Chiến lược sửa code an toàn

### Khi thêm tính năng mới

- Ưu tiên bám theo pattern `page -> service -> Firebase`
- Nếu là tính năng xuyên app, cân nhắc `context` hoặc `FloatingHub`
- Nếu là AI/media/secret, ưu tiên làm ở Cloudflare Function thay vì client

### Khi sửa dữ liệu

- Kiểm tra type trong `src/types/index.ts`
- Kiểm tra service CRUD
- Kiểm tra admin page chỉnh dữ liệu
- Kiểm tra page đọc dữ liệu
- Kiểm tra rules nếu là collection mới hoặc field nhạy cảm

### Khi sửa UI

- Xem `AppLayout` và `ThemeContext` trước để không phá consistency
- Tận dụng `Button`, `Dialog`, `Spinner`, `Toast`, `LatexContent`, `FormattedText`

## 14. Tóm tắt một câu

StudyStation là một nền tảng học tập đa module với React frontend làm trung tâm, Firebase làm data/auth layer, Cloudflare Pages làm hosting + secret proxy layer, và mọi tính năng lớn đều kết nối với nhau qua ba trục chính: quyền truy cập, dữ liệu học tập, và hệ sinh thái Mago/FloatingHub.
