# 📚 Hướng Dẫn Định Dạng JSON cho StudyStation

## Tổng Quan

Website StudyStation hỗ trợ import bài thi từ file JSON với 3 loại câu hỏi:
- **Part 1**: Trắc nghiệm (Multiple Choice)
- **Part 2**: Đúng/Sai (True/False) 
- **Part 3**: Trả lời ngắn (Short Answer)

---

## Cấu Trúc File JSON

```json
{
  "subjectId": "toan",
  "title": "Đề thi Toán học kỳ 1",
  "time": 50,
  "part1": [...],
  "part2": [...],
  "part3": [...]
}
```

| Trường | Mô tả | Giá trị |
|--------|-------|---------|
| `subjectId` | Mã môn học | `toan`, `ly`, `hoa`, `sinh`, `van`, `su`, `dia`, `anh` |
| `title` | Tên bài thi | Chuỗi ký tự |
| `time` | Thời gian làm bài (phút) | Số nguyên |

---

## Part 1: Câu Hỏi Trắc Nghiệm

```json
{
  "id": 1,
  "text": "Giá trị của biểu thức $2^3 + 3^2$ bằng bao nhiêu?",
  "image": "https://example.com/hinh-cau-1.png",
  "options": ["15", "17", "11", "14"],
  "correct": 1
}
```

| Trường | Mô tả |
|--------|-------|
| `id` | Số thứ tự câu hỏi (bắt đầu từ 1) |
| `text` | Nội dung câu hỏi (hỗ trợ MathJax: `$...$`) |
| `image` | **(Tùy chọn)** URL hình ảnh minh họa |
| `options` | Mảng 4 đáp án [A, B, C, D] |
| `correct` | Vị trí đáp án đúng: 0=A, 1=B, 2=C, 3=D |

### Ví dụ hoàn chỉnh:
```json
"part1": [
  {
    "id": 1,
    "text": "Nghiệm của phương trình $x^2 - 4 = 0$ là:",
    "options": ["x = 2", "x = -2", "x = ±2", "Vô nghiệm"],
    "correct": 2
  },
  {
    "id": 2,
    "text": "Công thức hóa học của nước là:",
    "options": ["$\\ce{CO2}$", "$\\ce{H2O}$", "$\\ce{NaCl}$", "$\\ce{O2}$"],
    "correct": 1
  }
]
```

---

## Part 2: Câu Hỏi Đúng/Sai

```json
{
  "id": 1,
  "text": "Cho hàm số $f(x) = x^2 - 4x + 3$. Xét các mệnh đề sau:",
  "subQuestions": [
    { "id": "a", "text": "Hàm số có 2 nghiệm", "correct": true },
    { "id": "b", "text": "Tổng 2 nghiệm bằng 4", "correct": true },
    { "id": "c", "text": "Tích 2 nghiệm bằng 4", "correct": false },
    { "id": "d", "text": "Hàm số có đỉnh tại x = 2", "correct": true }
  ]
}
```

| Trường | Mô tả |
|--------|-------|
| `id` | Số thứ tự câu hỏi chính |
| `text` | Đề bài chung cho các mệnh đề |
| `image` | **(Tùy chọn)** URL hình ảnh minh họa |
| `subQuestions` | Mảng các mệnh đề con |
| `subQuestions[].id` | Ký tự mệnh đề: "a", "b", "c", "d" |
| `subQuestions[].text` | Nội dung mệnh đề |
| `subQuestions[].correct` | `true` = Đúng, `false` = Sai |

### Ví dụ hoàn chỉnh:
```json
"part2": [
  {
    "id": 1,
    "text": "Xét tính đúng sai của các mệnh đề về phản ứng hóa học:",
    "subQuestions": [
      { "id": "a", "text": "$\\ce{2H2 + O2 -> 2H2O}$ là phản ứng oxi hóa khử", "correct": true },
      { "id": "b", "text": "Phản ứng trên thu nhiệt", "correct": false },
      { "id": "c", "text": "$\\ce{H2}$ là chất khử", "correct": true },
      { "id": "d", "text": "$\\ce{O2}$ là chất oxi hóa", "correct": true }
    ]
  }
]
```

---

## Part 3: Câu Hỏi Trả Lời Ngắn

```json
{
  "id": 1,
  "text": "Tính giá trị của biểu thức: $\\sqrt{16} + \\sqrt{9}$",
  "correct": "7"
}
```

| Trường | Mô tả |
|--------|-------|
| `id` | Số thứ tự câu hỏi |
| `text` | Nội dung câu hỏi |
| `image` | **(Tùy chọn)** URL hình ảnh minh họa |
| `correct` | Đáp án đúng (chuỗi ký tự, so sánh không phân biệt hoa/thường) |

### Ví dụ hoàn chỉnh:
```json
"part3": [
  {
    "id": 1,
    "text": "Tìm x biết: $2x + 5 = 11$. Kết quả: x = ?",
    "correct": "3"
  },
  {
    "id": 2,
    "text": "Nguyên tử khối của nguyên tố Natri (Na) là bao nhiêu?",
    "correct": "23"
  }
]
```

---

## Công Thức MathJax

### Cơ bản
| Ký hiệu | JSON | Hiển thị |
|---------|------|----------|
| Phân số | `$\\frac{a}{b}$` | a/b |
| Lũy thừa | `$x^{2}$` | x² |
| Chỉ số dưới | `$x_{n}$` | xₙ |
| Căn bậc 2 | `$\\sqrt{x}$` | √x |
| Căn bậc n | `$\\sqrt[n]{x}$` | ⁿ√x |

### Giới hạn (Limit)
| Ký hiệu | JSON |
|---------|------|
| lim f(x) khi x→a | `$\\lim_{x \\to a} f(x)$` |
| lim x→+∞ | `$\\lim_{x \\to +\\infty}$` |
| lim x→-∞ | `$\\lim_{x \\to -\\infty}$` |
| lim x→0⁺ | `$\\lim_{x \\to 0^{+}}$` |
| lim x→0⁻ | `$\\lim_{x \\to 0^{-}}$` |

### Đạo hàm (Derivative)
| Ký hiệu | JSON |
|---------|------|
| f'(x) | `$f'(x)$` hoặc `$f^{\\prime}(x)$` |
| f''(x) | `$f''(x)$` |
| dy/dx | `$\\frac{dy}{dx}$` |
| d²y/dx² | `$\\frac{d^2y}{dx^2}$` |
| y' | `$y'$` |
| y'' | `$y''$` |

### Nguyên hàm & Tích phân (Integral)
| Ký hiệu | JSON |
|---------|------|
| Nguyên hàm | `$\\int f(x)\\,dx$` |
| Tích phân xác định | `$\\int_{a}^{b} f(x)\\,dx$` |
| Tích phân từ 0 đến +∞ | `$\\int_{0}^{+\\infty}$` |

### Tổng & Tích (Sum & Product)
| Ký hiệu | JSON |
|---------|------|
| Tổng Σ | `$\\sum_{i=1}^{n} a_i$` |
| Tích Π | `$\\prod_{i=1}^{n} a_i$` |

### Logarithm & Mũ
| Ký hiệu | JSON |
|---------|------|
| log cơ số a | `$\\log_{a} x$` |
| ln (log tự nhiên) | `$\\ln x$` |
| lg (log cơ số 10) | `$\\lg x$` hoặc `$\\log_{10} x$` |
| e^x | `$e^{x}$` |

### Lượng giác (Trigonometry)
| Ký hiệu | JSON |
|---------|------|
| sin, cos, tan | `$\\sin x$`, `$\\cos x$`, `$\\tan x$` |
| cot | `$\\cot x$` |
| sin² x | `$\\sin^{2} x$` |
| arcsin, arccos | `$\\arcsin x$`, `$\\arccos x$` |

### Vector & Ma trận
| Ký hiệu | JSON |
|---------|------|
| Vector a | `$\\vec{a}$` hoặc `$\\overrightarrow{AB}$` |
| Độ dài vector | `$|\\vec{a}|$` hoặc `$\\|\\vec{a}\\|$` |
| Ma trận 2x2 | `$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$` |
| Định thức | `$\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}$` |

### Ký hiệu đặc biệt
| Ký hiệu | JSON | Mô tả |
|---------|------|-------|
| ≤, ≥ | `$\\leq$`, `$\\geq$` | nhỏ hơn/lớn hơn hoặc bằng |
| ≠ | `$\\neq$` | khác |
| ± | `$\\pm$` | cộng trừ |
| ∞ | `$\\infty$` | vô cực |
| → | `$\\to$` hoặc `$\\rightarrow$` | mũi tên |
| ∈, ∉ | `$\\in$`, `$\\notin$` | thuộc/không thuộc |
| ⊂ | `$\\subset$` | tập con |
| ∪, ∩ | `$\\cup$`, `$\\cap$` | hợp/giao |
| ∅ | `$\\emptyset$` | tập rỗng |
| ∀, ∃ | `$\\forall$`, `$\\exists$` | với mọi/tồn tại |
| ℕ, ℤ, ℚ, ℝ | `$\\mathbb{N}$`, `$\\mathbb{Z}$`, `$\\mathbb{Q}$`, `$\\mathbb{R}$` | tập số |

### Công thức Hóa học
| Ký hiệu | JSON |
|---------|------|
| H₂O | `$\\ce{H2O}$` |
| H₂SO₄ | `$\\ce{H2SO4}$` |
| Phản ứng | `$\\ce{2H2 + O2 -> 2H2O}$` |
| Ion | `$\\ce{Ca^{2+}}$`, `$\\ce{SO4^{2-}}$` |


### Công thức Sinh học (Di truyền)
| Ký hiệu | JSON | Lưu ý |
|---------|------|-------|
| ♀ (Cái) | `$\\venus$` | Dùng thay cho `\\female` (nếu dùng `\\female` hệ thống sẽ tự chuyển đổi) |
| ♂ (Đực) | `$\\mars$` | Dùng thay cho `\\male` (nếu dùng `\\male` hệ thống sẽ tự chuyển đổi) |
| Phép lai | `$\\times$` | Dùng dấu nhân chéo |
| Kiểu gen | `$X^{A}X^{a}$` | Superscript |
| Thế hệ | `$F_{1}$`, `$G_{P}$` | Subscript |

---

## File Mẫu Hoàn Chỉnh

```json
{
  "subjectId": "toan",
  "title": "Đề kiểm tra Toán 12 - Chương 1",
  "time": 45,
  "part1": [
    {
      "id": 1,
      "text": "Giá trị lớn nhất của hàm số $y = -x^2 + 4x - 3$ là:",
      "options": ["1", "2", "3", "4"],
      "correct": 0
    }
  ],
  "part2": [
    {
      "id": 1,
      "text": "Xét các mệnh đề sau về hàm số $y = x^3 - 3x$:",
      "subQuestions": [
        { "id": "a", "text": "Hàm số có 2 cực trị", "correct": true },
        { "id": "b", "text": "Điểm cực đại là (1, -2)", "correct": false },
        { "id": "c", "text": "Hàm số đồng biến trên $(-\\infty, -1)$", "correct": true },
        { "id": "d", "text": "Giá trị cực tiểu bằng -2", "correct": true }
      ]
    }
  ],
  "part3": [
    {
      "id": 1,
      "text": "Tính $\\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2}$",
      "correct": "4"
    }
  ]
}
```

---

## Lưu Ý Quan Trọng

> [!WARNING]
> - Các `id` trong mỗi part phải **liên tục từ 1**
> - `correct` trong part1 là **số** (0-3), không phải chuỗi
> - `correct` trong part2 là **boolean** (`true`/`false`)
> - `correct` trong part3 là **chuỗi**

> [!TIP]
> - Sử dụng công cụ JSON validator online để kiểm tra cú pháp trước khi import
> - Escape ký tự đặc biệt: `\\` thay vì `\` trong MathJax
