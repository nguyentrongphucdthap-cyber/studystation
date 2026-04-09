# Deploy StudyStation lên Cloudflare Pages

## 📋 Yêu cầu
- Tài khoản [Cloudflare](https://dash.cloudflare.com/sign-up)
- Repository GitHub chứa code
- Node.js 18+

---

## 🚀 Cách 1: Deploy qua Cloudflare Dashboard (Khuyến nghị)

### Bước 1: Kết nối GitHub Repository

1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Vào **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. Chọn repository `studystation22`, branch `main`

### Bước 2: Cấu hình Build

| Cài đặt | Giá trị |
|---------|---------|
| **Framework preset** | None |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` |
| **Node.js version** | 18 (hoặc 20) |

### Bướcnvironment Var 3: Thêm Eiables

Vào **Settings → Environment Variables** và thêm:

| Variable | Value |
|----------|-------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyBd...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `study-station-f1e39.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | `https://study-station-f1e39-default-rtdb...` |
| `VITE_FIREBASE_PROJECT_ID` | `study-station-f1e39` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `study-station-f1e39.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `573499638498` |
| `VITE_FIREBASE_APP_ID` | `1:573499638498:web:4bbd3e58e233c75b75c8a1` |

> ⚠️ `VITE_` prefix bắt buộc để Vite inject vào client bundle.

### Bước 4: Deploy

Click **Save and Deploy** → đợi 1-2 phút.

---

## 🚀 Cách 2: Deploy qua CLI

```bash
# Cài Wrangler (nếu chưa có)
npm install -g wrangler

# Đăng nhập
wrangler login

# Build + Deploy
npm run deploy
```

Hoặc tách riêng:
```bash
npm run build
npx wrangler pages deploy dist --project-name=studystation
```

---

## 🌐 Custom Domain (studystation.site)

1. Vào project Pages → **Custom domains** tab
2. Click **Set up a custom domain** → nhập `studystation.site`
3. Nếu domain ở Cloudflare: tự động cấu hình
4. Nếu domain ở nơi khác: thêm CNAME record `@ → studystation.pages.dev`

---

## 🔧 Sau khi Deploy

### Firebase Console → Authorized domains
Thêm các domain mới:
- `studystation.pages.dev`
- `studystation.site`
- `*.studystation.pages.dev` (preview deployments)

### Test SPA routing
Navigate trực tiếp đến `/practice` hoặc `/admin` → phải load đúng (không 404).
Nếu 404: kiểm tra file `_redirects` trong `dist/`.

---

## 📦 NPM Scripts

| Script | Lệnh | Mô tả |
|--------|-------|-------|
| `npm run dev` | `vite` | Dev server (port 5173) |
| `npm run build` | `tsc -b && vite build` | Build production |
| `npm run preview` | `vite preview` | Preview build locally |
| `npm run typecheck` | `tsc --noEmit` | Type check |
| `npm run deploy` | Build + Wrangler deploy | Deploy lên Cloudflare |
| `npm run preview:cf` | `wrangler pages dev dist` | Preview với Cloudflare locally |

---

## ❓ Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| 404 trên subpage | Kiểm tra `_redirects` có `/* /index.html 200` |
| CORS Error Firebase | Thêm domain vào Firebase Authorized domains |
| Cache cũ | Cloudflare Dashboard → Purge cache |
| Build fail | Check env vars có `VITE_` prefix |
