# Hướng dẫn tạo file JSON cho E-test

E-test là module thi tiếng Anh, hỗ trợ 3 dạng bài: **Trắc nghiệm**, **Đọc hiểu**, và **Điền từ**.

---

## Cấu trúc JSON cơ bản

```json
{
  "title": "Tên bài thi",
  "time": 45,
  "sections": [
    {
      "title": "Tên section",
      "type": "multiple_choice | reading | gap_fill",
      "content": "HTML passage (chỉ cho reading/gap_fill)",
      "questions": [...]
    }
  ]
}
```

---

## 1. Trắc nghiệm đơn thuần (`multiple_choice`)

```json
{
  "title": "Từ vựng Chủ đề 1: Life Stories",
  "time": 45,
  "sections": [
    {
      "title": "Vocabulary Questions",
      "type": "multiple_choice",
      "questions": [
        {
          "id": 1,
          "text": "Charles Dickens <b>transformed</b> his childhood hardships into novels.",
          "options": ["A. transformed", "B. transported", "C. translated", "D. deviated"],
          "ans": "A"
        },
        {
          "id": 2,
          "text": "She has often been critical <b>of</b> journalists.",
          "options": ["A. about", "B. for", "C. in", "D. of"],
          "ans": "D"
        }
      ]
    }
  ]
}
```

---

## 2. Đọc hiểu (`reading`)

```json
{
  "title": "Đọc hiểu Chủ đề 1",
  "time": 45,
  "sections": [
    {
      "title": "Nguyen Tat Thanh's Journey",
      "type": "reading",
      "content": "<h3 class=\"font-bold mb-3 text-lg\">Nguyen Tat Thanh's Historic Odyssey</h3><p>Exactly 110 years ago, the young <b>Nguyen Tat Thanh</b> embarked on his historic odyssey from <b>Nha Rong Wharf</b>. [I] His burning ambition: to seek a path for liberating his homeland. [II] The 1919 Paris Peace Conference was pivotal. [III] He delivered the \"Petition from the People of An Nam.\" [IV]</p>",
      "questions": [
        {
          "id": 1,
          "text": "Why did Nguyen Tat Thanh choose <b>Nha Rong Wharf</b>?",
          "options": [
            "A. It linked Saigon to international shipping routes",
            "B. It offered clandestine passage",
            "C. It lay beyond French reach",
            "D. It was recommended by revolutionaries"
          ],
          "ans": "A"
        },
        {
          "id": 2,
          "text": "Where would 'His search led him to the French Socialist Party...' fit?",
          "options": ["A. [I]", "B. [II]", "C. [III]", "D. [IV]"],
          "ans": "C"
        }
      ]
    }
  ]
}
```

**Lưu ý passage:**
- Dùng `[I]`, `[II]`, `[III]`, `[IV]` làm điểm chèn câu
- Hỗ trợ `<h3>`, `<p>`, `<b>`, `<i>`, `<u>`

---

## 3. Điền từ (`gap_fill`)

```json
{
  "title": "Điền từ Chủ đề 1",
  "time": 30,
  "sections": [
    {
      "title": "Marie Curie",
      "type": "gap_fill",
      "content": "<h3 class=\"font-bold mb-3 text-lg\">Marie Curie</h3><p><b>Marie Curie</b>, born in Warsaw in 1867, overcame discrimination to <span class=\"bg-blue-100 px-2 rounded font-bold text-blue-600 mx-1\">(1)</span> her dream. She became a <span class=\"bg-blue-100 px-2 rounded font-bold text-blue-600 mx-1\">(2)</span> in radioactivity. Her work exposed her <span class=\"bg-blue-100 px-2 rounded font-bold text-blue-600 mx-1\">(3)</span> toxic levels of radiation.</p>",
      "questions": [
        {"id": 1, "text": "Question 1:", "options": ["A. chase", "B. run after", "C. pursue", "D. track"], "ans": "C"},
        {"id": 2, "text": "Question 2:", "options": ["A. housekeeper", "B. pioneer", "C. discoverer", "D. breadwinner"], "ans": "B"},
        {"id": 3, "text": "Question 3:", "options": ["A. for", "B. with", "C. of", "D. to"], "ans": "D"}
      ]
    }
  ]
}
```

**Marker chỗ trống:**
```html
<span class="bg-blue-100 px-2 rounded font-bold text-blue-600 mx-1">(số)</span>
```

---

## 4. Bài thi nhiều sections

```json
{
  "title": "TOEIC Practice Test 1",
  "time": 90,
  "sections": [
    {
      "title": "Part 1: Vocabulary",
      "type": "multiple_choice",
      "questions": [
        {"id": 1, "text": "...", "options": ["A.", "B.", "C.", "D."], "ans": "A"}
      ]
    },
    {
      "title": "Part 2: Reading Passage 1",
      "type": "reading",
      "content": "<p>Passage content...</p>",
      "questions": [
        {"id": 2, "text": "...", "options": ["A.", "B.", "C.", "D."], "ans": "B"}
      ]
    },
    {
      "title": "Part 3: Fill in the Blanks",
      "type": "gap_fill",
      "content": "<p>Text with (1), (2)...</p>",
      "questions": [
        {"id": 3, "text": "Question 3:", "options": ["A.", "B.", "C.", "D."], "ans": "C"}
      ]
    }
  ]
}
```

---

## Quy tắc quan trọng

| Field | Bắt buộc | Mô tả |
|-------|----------|-------|
| `title` | ✅ | Tiêu đề bài thi |
| `time` | ✅ | Thời gian (phút) |
| `sections` | ✅ | Mảng các section |
| `sections[].type` | ✅ | `multiple_choice`, `reading`, `gap_fill` |
| `sections[].content` | Với reading/gap_fill | HTML passage |
| `questions[].id` | ✅ | Số thứ tự (liên tục từ 1) |
| `questions[].ans` | ✅ | Đáp án: A, B, C, hoặc D |

---

## Import vào Admin

1. Mở **Admin → E-test**
2. Click **Import JSON**
3. Chọn file `.json`
4. Bài thi được tạo tự động
