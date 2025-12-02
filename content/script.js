document.addEventListener('DOMContentLoaded', () => {
    // --- Hằng số và Biến ---
    const pages = document.querySelectorAll('.page-content');
    
    // Trang 1: Menu
    const menuCards = document.querySelectorAll('.menu-card');
    
    // Trang 2: Chọn môn
    const backToMenuButtons = document.querySelectorAll('.back-to-menu-btn');
    const subjectCards = document.querySelectorAll('.subject-card[data-subject]');
    
    // Trang 3: Danh sách thi
    const backToSubjectsButton = document.getElementById('back-to-subjects');
    const subjectTitleEl = document.getElementById('subject-title');
    const testListUl = document.getElementById('test-list-ul');
    
    // Trang 4: Coming Soon (không cần biến)
    
    // Trang 5: Làm bài thi
    const testPage = document.getElementById('test-page');
    const backToTestListButton = document.getElementById('back-to-test-list');
    const testTitleEl = document.getElementById('test-title');
    const loadingIndicator = document.getElementById('loading-indicator');
    const quizContainer = document.getElementById('quiz-container');
    const submitTestBtn = document.getElementById('submit-test-btn');
    
    // Trang 6: Kết quả
    const resultsPage = document.getElementById('results-page');
    const backToTestListFromResultsButton = document.getElementById('back-to-test-list-from-results');
    const resultsTitleEl = document.getElementById('results-title');
    const scoreContainer = document.getElementById('score-container');
    const reviewContainer = document.getElementById('review-container');

    // Biến trạng thái
    let currentSubjectName = '';
    let currentTestName = '';
    let currentQuizData = []; // Lưu trữ dữ liệu câu hỏi hiện tại

    // --- API và Dữ liệu ---

    // 1. System prompt cho việc tạo câu hỏi (Main)
    const systemPrompt = `Bạn là một trợ lý giáo dục chuyên nghiệp, chuyên tạo ra các câu hỏi trắc nghiệm chất lượng cao cho học sinh.

QUY TẮC:
1.  Luôn luôn trả lời bằng tiếng Việt.
2.  Tạo chính xác 5 câu hỏi trắc nghiệm.
3.  Mỗi câu hỏi phải có 4 lựa chọn (A, B, C, D).
4.  Chỉ có MỘT đáp án đúng.
5.  Các lựa chọn phải hợp lý và có tính thử thách.
6.  Không được thêm bất kỳ lời giải thích hay lời nói nào ngoài định dạng JSON đã yêu cầu.
7.  Giá trị của "answer" phải khớp chính xác (bao gồm cả dấu chấm) với một trong các lựa chọn trong mảng "options".`;

    // 2. System prompt cho Gatekeeper (MỚI THÊM)
    const gatekeeperSystemPrompt = `Bạn là một AI kiểm duyệt nội dung giáo dục (Gatekeeper).
Nhiệm vụ: Xác định xem chủ đề được yêu cầu có an toàn, không vi phạm đạo đức, và phù hợp cho học sinh phổ thông hay không.
Trả về JSON với:
- "valid": true (nếu phù hợp) hoặc false (nếu vi phạm/nhạy cảm).
- "reason": Lý do ngắn gọn bằng tiếng Việt.`;
    
    // Dữ liệu giả lập cho các bài thi
    const testData = {
        'vat-li': ['Đề thi thử THPT QG 2024 - Mã 101', 'Kiểm tra 15 phút - Chương 1: Dao động cơ', 'Đề thi cuối kỳ 1', 'Tổng hợp lý thuyết Sóng ánh sáng'],
        'sinh-hoc': ['Đề thi THPT QG 2023 - Mã 202', 'Bài tập Di truyền học Mendel', 'Hệ sinh thái và Môi trường', 'Tiến hóa'],
        'tin-hoc': ['Giải thuật cơ bản (Sorting)', 'Cấu trúc dữ liệu và giải thuật (Nâng cao)', 'Luyện tập Python (Cơ bản)', 'Đề thi Olympic Tin học 30/4'],
        'lich-su': ['Chiến tranh thế giới thứ 2', 'Lịch sử Việt Nam (1945-1954)', 'Các cuộc cách mạng tư sản', 'Chiến tranh lạnh']
    };

    // --- Hàm Điều Hướng ---

    // Hàm hiển thị trang
    function showPage(pageId) {
        pages.forEach(page => {
            page.classList.remove('active');
        });
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            // Cuộn lên đầu trang
            window.scrollTo(0, 0);
        }
    }

    // --- Hàm Gọi API (Gemini) ---

    /**
     * Gọi API Gemini với xử lý retry và backoff.
     */
    async function callGeminiAPI(systemPrompt, userQuery, jsonSchema) {
        const apiKey = ""; // Canvas sẽ tự động cung cấp
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: jsonSchema,
                temperature: 0.7, 
            }
        };
        
        const maxRetries = 3;
        let baseDelay = 1000; 

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                    const jsonText = result.candidates[0].content.parts[0].text;
                    return JSON.parse(jsonText);
                } else {
                    console.error("Phản hồi API không hợp lệ:", result);
                    throw new Error("Không nhận được nội dung hợp lệ từ API.");
                }

            } catch (error) {
                console.error(`Lỗi API (lần ${attempt}/${maxRetries}):`, error.message);
                if (attempt === maxRetries) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, baseDelay));
                baseDelay *= 2;
            }
        }
    }

    // --- MỚI THÊM: Hàm Gatekeeper ---
    /**
     * Kiểm tra tính hợp lệ của chủ đề trước khi tạo câu hỏi.
     */
    async function callGatekeeper(topic) {
        const schema = {
            type: "OBJECT",
            properties: {
                valid: { type: "BOOLEAN" },
                reason: { type: "STRING" }
            },
            required: ["valid", "reason"]
        };

        const query = `Kiểm tra chủ đề: "${topic}"`;
        
        // Sử dụng lại hàm callGeminiAPI nhưng với prompt và schema khác
        return await callGeminiAPI(gatekeeperSystemPrompt, query, schema);
    }

    // --- Hàm Xử Lý Bài Thi ---

    /**
     * Bắt đầu quá trình tạo bài thi.
     */
    async function generateTest(subjectName, testName) {
        // Hiển thị trạng thái tải
        loadingIndicator.style.display = 'flex';
        loadingIndicator.querySelector('p').textContent = "Đang kiểm duyệt chủ đề..."; // Cập nhật text loading
        
        quizContainer.innerHTML = ''; 
        quizContainer.style.display = 'none';
        submitTestBtn.style.display = 'none';

        // Định nghĩa JSON schema cho câu hỏi (Main)
        const schema = {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    question: { type: "STRING" },
                    options: {
                        type: "ARRAY",
                        items: { type: "STRING" }
                    },
                    answer: { type: "STRING" }
                },
                required: ["question", "options", "answer"]
            }
        };

        try {
            // --- BƯỚC 1: GỌI GATEKEEPER (MỚI) ---
            const gatekeeperResult = await callGatekeeper(testName);
            
            if (!gatekeeperResult.valid) {
                // Nếu chủ đề không hợp lệ
                alert(`Cảnh báo: Chủ đề này không phù hợp.\nLý do: ${gatekeeperResult.reason}`);
                // Quay lại trang danh sách
                showPage('test-list');
                return; // Dừng hàm tại đây
            }

            // --- BƯỚC 2: TẠO CÂU HỎI (Nếu Gatekeeper thông qua) ---
            loadingIndicator.querySelector('p').textContent = "Đang tạo câu hỏi..."; // Cập nhật text loading
            
            const userQuery = `Tạo 5 câu hỏi trắc nghiệm tiếng Việt về chủ đề: "${testName}" của môn "${subjectName}".`;
            const quizData = await callGeminiAPI(systemPrompt, userQuery, schema);
            
            if (!quizData || !Array.isArray(quizData) || quizData.length === 0) {
                 throw new Error("Dữ liệu quiz trả về không hợp lệ.");
            }

            // Lưu dữ liệu và hiển thị quiz
            currentQuizData = quizData;
            displayQuiz(quizData);

            // Ẩn tải và hiển thị nội dung
            loadingIndicator.style.display = 'none';
            quizContainer.style.display = 'block';
            submitTestBtn.style.display = 'block';

        } catch (error) {
            console.error("Không thể tạo bài thi:", error);
            loadingIndicator.style.display = 'none';
            quizContainer.style.display = 'block'; // Hiện container để hiện lỗi
            quizContainer.innerHTML = `<p class="text-red-600 text-center font-semibold mt-4">Đã xảy ra lỗi khi tạo đề thi.<br>${error.message}</p>`;
        }
    }

    /**
     * Hiển thị các câu hỏi quiz lên giao diện.
     */
    function displayQuiz(quizData) {
        quizContainer.innerHTML = ''; 
        quizData.forEach((item, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'quiz-question';
            questionDiv.dataset.correctAnswer = item.answer;

            const questionText = document.createElement('p');
            questionText.className = 'question-text';
            questionText.textContent = `Câu ${index + 1}: ${item.question}`;
            
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-container';

            item.options.forEach((option) => {
                const label = document.createElement('label');
                const radioInput = document.createElement('input');
                radioInput.type = 'radio';
                radioInput.name = `question-${index}`;
                radioInput.value = option;
                
                const optionText = document.createElement('span');
                optionText.textContent = option;
                
                label.appendChild(radioInput);
                label.appendChild(optionText);
                optionsContainer.appendChild(label);
            });

            questionDiv.appendChild(questionText);
            questionDiv.appendChild(optionsContainer);
            quizContainer.appendChild(questionDiv);
        });
    }

    // --- Hàm Xử Lý Kết Quả ---

    function calculateResults() {
        const questionElements = quizContainer.querySelectorAll('.quiz-question');
        let score = 0;
        
        reviewContainer.innerHTML = '';
        resultsTitleEl.textContent = `Kết quả: ${currentTestName}`;

        questionElements.forEach((questionEl, index) => {
            const selectedInput = questionEl.querySelector(`input[name="question-${index}"]:checked`);
            const userAnswer = selectedInput ? selectedInput.value : null;
            const correctAnswer = questionEl.dataset.correctAnswer;
            
            const isCorrect = (userAnswer === correctAnswer);
            if (isCorrect) {
                score++;
            }

            displayReview(index, questionEl, userAnswer, correctAnswer, isCorrect);
        });
        
        scoreContainer.textContent = `Điểm của bạn: ${score} / ${questionElements.length}`;
        showPage('results-page');
    }

    function displayReview(index, questionEl, userAnswer, correctAnswer, isCorrect) {
        const reviewItem = document.createElement('div');
        reviewItem.className = `review-item ${isCorrect ? 'correct' : 'incorrect'}`;
        
        const questionText = questionEl.querySelector('.question-text').textContent;
        reviewItem.innerHTML = `<p class="question-text">${questionText}</p>`;
        
        const feedbackText = document.createElement('div');
        feedbackText.className = 'feedback-text';
        
        if (isCorrect) {
            feedbackText.innerHTML = `<p class="correct-answer">Bạn đã trả lời đúng!</p>
                                  <p>Đáp án: ${correctAnswer}</p>`;
        } else {
            feedbackText.innerHTML = `<p class="incorrect-answer">Bạn đã trả lời sai!</p>
                                  <p>Bạn chọn: ${userAnswer || 'Không chọn'}</p>
                                  <p class="correct-answer">Đáp án đúng: ${correctAnswer}</p>`;
        }
        
        reviewItem.appendChild(feedbackText);
        reviewContainer.appendChild(reviewItem);
    }

    // --- Gán Sự Kiện ---

    // Trang 1: Menu -> Trang 2
    menuCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = card.dataset.target;
            showPage(targetId);
        });
    });

    // Trang 2: Chọn môn -> Trang 3
    subjectCards.forEach(card => {
        card.addEventListener('click', () => {
            const subjectKey = card.dataset.subject;
            currentSubjectName = card.dataset.subjectName;

            subjectTitleEl.textContent = `Các bài thi môn ${currentSubjectName}`;
            testListUl.innerHTML = '';
            
            const tests = testData[subjectKey] || [];
            
            if (tests.length > 0) {
                tests.forEach(testName => {
                    const li = document.createElement('li');
                    li.className = 'flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors duration-300 gap-4';
                    li.innerHTML = `
                        <span class="text-base md:text-lg text-gray-700">${testName}</span>
                        <button class="start-test-btn text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5 transition-colors duration-300 w-full sm:w-auto">
                            Bắt đầu
                        </button>
                    `;
                    li.querySelector('.start-test-btn').dataset.testName = testName;
                    testListUl.appendChild(li);
                });
            } else {
                testListUl.innerHTML = '<li class="text-gray-500">Chưa có bài thi nào cho môn học này.</li>';
            }

            showPage('test-list');
        });
    });
    
    // Trang 3: Danh sách thi -> Trang 5 (Làm bài)
    testListUl.addEventListener('click', (e) => {
        if (e.target.classList.contains('start-test-btn')) {
            currentTestName = e.target.dataset.testName;
            testTitleEl.textContent = currentTestName;
            showPage('test-page');
            generateTest(currentSubjectName, currentTestName);
        }
    });

    // Nút Nộp bài
    submitTestBtn.addEventListener('click', calculateResults);

    // --- Các Nút Quay Lại ---
    backToMenuButtons.forEach(button => {
        button.addEventListener('click', () => {
            showPage('menu-cards');
        });
    });

    backToSubjectsButton.addEventListener('click', () => {
        showPage('on-thi-main');
    });
    
    backToTestListButton.addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn thoát? Mọi tiến trình làm bài sẽ bị mất.')) {
            showPage('test-list');
            currentQuizData = [];
        }
    });

    backToTestListFromResultsButton.addEventListener('click', () => {
        showPage('test-list');
    });

    // --- Khởi động ---
    showPage('menu-cards');
});
