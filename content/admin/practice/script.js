/**
 * ADMIN PANEL - Script for managing exams
 * Features:
 * 1. CRUD operations for exams stored in Firebase
 * 2. Question type builders (Part 1, 2, 3)
 * 3. Admin access control
 */

import {
    initGatekeeper,
    checkIsAdmin,
    onUserChange,
    getAllExams,
    createExam,
    updateExam,
    deleteExam,
    getSubjects,
    startPresence
} from "../../../gatekeeper.js";

// ============================================================
// IMGBB API CONFIGURATION
// ============================================================

const IMGBB_API_KEY = '999dc07ec98454c5d4c95740354153fc'; // Replace with your ImgBB API key

/**
 * Upload image to ImgBB and return the URL
 * @param {File} file - Image file to upload
 * @returns {Promise<string>} - URL of uploaded image
 */
async function uploadImageToImgBB(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function (e) {
            try {
                // Get base64 data (remove data:image/xxx;base64, prefix)
                const base64Data = e.target.result.split(',')[1];

                const formData = new FormData();
                formData.append('key', IMGBB_API_KEY);
                formData.append('image', base64Data);
                formData.append('name', file.name.replace(/\.[^/.]+$/, '')); // Remove extension

                const response = await fetch('https://api.imgbb.com/1/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                if (data.success) {
                    resolve(data.data.display_url);
                } else {
                    reject(new Error(data.error?.message || 'Upload failed'));
                }
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// ============================================================
// STATE
// ============================================================

const state = {
    exams: [],
    subjects: [],
    currentExamId: null, // null = creating new, string = editing existing
    isLoading: false
};

// ============================================================
// DOM REFERENCES
// ============================================================

const refs = {
    mainContent: document.getElementById('main-content'),
    accessDenied: document.getElementById('access-denied'),
    adminEmail: document.getElementById('admin-email'),

    // List
    subjectFilter: document.getElementById('subject-filter'),
    examList: document.getElementById('exam-list'),
    btnNewExam: document.getElementById('btn-new-exam'),
    btnNewExamEmpty: document.getElementById('btn-new-exam-empty'),
    importFile: document.getElementById('import-file'),

    // Editor
    editorEmpty: document.getElementById('editor-empty'),
    editorForm: document.getElementById('editor-form'),
    editorTitle: document.getElementById('editor-title'),
    btnExport: document.getElementById('btn-export'),
    btnDelete: document.getElementById('btn-delete'),
    btnCancel: document.getElementById('btn-cancel'),
    btnSave: document.getElementById('btn-save'),

    // Form fields
    examSubject: document.getElementById('exam-subject'),
    examTime: document.getElementById('exam-time'),
    examTitle: document.getElementById('exam-title'),
    examCustomId: document.getElementById('exam-custom-id'),
    examAuthor: document.getElementById('exam-author'),

    // Question containers
    part1Questions: document.getElementById('part1-questions'),
    part2Questions: document.getElementById('part2-questions'),
    part3Questions: document.getElementById('part3-questions'),
    part1Count: document.getElementById('part1-count'),
    part2Count: document.getElementById('part2-count'),
    part3Count: document.getElementById('part3-count'),

    // Add buttons
    btnAddPart1: document.getElementById('btn-add-part1'),
    btnAddPart2: document.getElementById('btn-add-part2'),
    btnAddPart3: document.getElementById('btn-add-part3'),

    // Modal
    deleteModal: document.getElementById('delete-modal'),
    btnCancelDelete: document.getElementById('btn-cancel-delete'),
    btnConfirmDelete: document.getElementById('btn-confirm-delete'),

    // Text Import Modal
    btnImportText: document.getElementById('btn-import-text'),
    textImportModal: document.getElementById('text-import-modal'),
    textImportInput: document.getElementById('text-import-input'),
    textImportPreview: document.getElementById('text-import-preview'),
    textImportPreviewContent: document.getElementById('text-import-preview-content'),
    textImportError: document.getElementById('text-import-error'),
    btnParseText: document.getElementById('btn-parse-text'),
    btnCancelTextImport: document.getElementById('btn-cancel-text-import'),
    btnConfirmTextImport: document.getElementById('btn-confirm-text-import'),

    // Toast
    toastContainer: document.getElementById('toast-container')
};

// Text import state
let textImportData = null;

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
    toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 toast-enter max-w-sm`;
    toast.innerHTML = `
        <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${type === 'success'
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>'
            : type === 'error'
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'}
        </svg>
        <span class="font-medium text-sm">${message}</span>
    `;
    refs.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================
// INITIALIZATION
// ============================================================

async function init() {
    initGatekeeper('protected');

    onUserChange(async (user) => {
        if (!user) return;

        // Check admin access
        setTimeout(() => {
            if (!checkIsAdmin()) {
                refs.accessDenied.classList.remove('hidden');
                return;
            }

            refs.adminEmail.textContent = user.email;
            refs.mainContent.classList.remove('hidden');

            startPresence();

            loadSubjects();
            loadExams();
            bindEvents();
        }, 500);
    });
}

function loadSubjects() {
    state.subjects = getSubjects();

    // Populate filter dropdown
    refs.subjectFilter.innerHTML = '<option value="">Tất cả môn học</option>';
    state.subjects.forEach(sub => {
        refs.subjectFilter.innerHTML += `<option value="${sub.id}">${sub.name}</option>`;
    });

    // Populate editor dropdown
    refs.examSubject.innerHTML = '<option value="">Chọn môn học</option>';
    state.subjects.forEach(sub => {
        refs.examSubject.innerHTML += `<option value="${sub.id}">${sub.name}</option>`;
    });
}

async function loadExams() {
    try {
        state.exams = await getAllExams();
        renderExamList();
    } catch (error) {
        console.error('Failed to load exams:', error);
        showToast('Không thể tải danh sách bài thi', 'error');
        refs.examList.innerHTML = `
            <div class="p-8 text-center text-red-500">
                <p class="font-medium">Lỗi tải dữ liệu</p>
                <p class="text-sm text-gray-400 mt-1">${error.message}</p>
            </div>
        `;
    }
}

function bindEvents() {
    refs.subjectFilter.addEventListener('change', renderExamList);
    refs.btnNewExam.addEventListener('click', () => showEditor(null));
    if (refs.btnNewExamEmpty) refs.btnNewExamEmpty.addEventListener('click', () => showEditor(null));
    refs.btnCancel.addEventListener('click', hideEditor);
    refs.btnSave.addEventListener('click', saveExam);
    refs.btnDelete.addEventListener('click', () => refs.deleteModal.classList.remove('hidden'));
    refs.btnCancelDelete.addEventListener('click', () => refs.deleteModal.classList.add('hidden'));
    refs.btnConfirmDelete.addEventListener('click', confirmDeleteExam);

    refs.btnAddPart1.addEventListener('click', () => addQuestion(1));
    refs.btnAddPart2.addEventListener('click', () => addQuestion(2));
    refs.btnAddPart3.addEventListener('click', () => addQuestion(3));

    // Import/Export
    if (refs.importFile) refs.importFile.addEventListener('change', handleFileImport);
    if (refs.btnExport) refs.btnExport.addEventListener('click', handleExport);

    // Import triggers from empty state
    document.querySelectorAll('.import-file-trigger').forEach(input => {
        input.addEventListener('change', handleFileImport);
    });

    // Raw Text Import
    const btnParseRawText = document.getElementById('btn-parse-raw-text');
    const btnClearRawText = document.getElementById('btn-clear-raw-text');
    if (btnParseRawText) btnParseRawText.addEventListener('click', handleRawTextParse);
    if (btnClearRawText) btnClearRawText.addEventListener('click', handleRawTextClear);

    // Text Import Modal
    if (refs.btnImportText) refs.btnImportText.addEventListener('click', showTextImportModal);
    if (refs.btnParseText) refs.btnParseText.addEventListener('click', parseTextImport);
    if (refs.btnCancelTextImport) refs.btnCancelTextImport.addEventListener('click', hideTextImportModal);
    if (refs.btnConfirmTextImport) refs.btnConfirmTextImport.addEventListener('click', confirmTextImport);
}

// ============================================================
// TEXT IMPORT MODAL FUNCTIONS
// ============================================================

function showTextImportModal() {
    refs.textImportInput.value = '';
    refs.textImportPreview.classList.add('hidden');
    refs.textImportError.classList.add('hidden');
    refs.btnConfirmTextImport.disabled = true;
    textImportData = null;
    refs.textImportModal.classList.remove('hidden');
}

function hideTextImportModal() {
    refs.textImportModal.classList.add('hidden');
    textImportData = null;
}

function parseTextImport() {
    const text = refs.textImportInput.value.trim();
    if (!text) {
        refs.textImportError.textContent = 'Vui lòng nhập JSON';
        refs.textImportError.classList.remove('hidden');
        return;
    }

    refs.textImportError.classList.add('hidden');
    refs.textImportPreview.classList.add('hidden');
    refs.btnConfirmTextImport.disabled = true;

    try {
        const data = JSON.parse(text);

        // Validate basic structure
        if (!data.title) {
            refs.textImportError.textContent = 'Thiếu trường "title"';
            refs.textImportError.classList.remove('hidden');
            return;
        }

        textImportData = data;

        // Show preview
        const partCount = (data.part1?.length || 0) + (data.part2?.length || 0) + (data.part3?.length || 0);
        const parts = data.parts || [];
        const questionCount = partCount || parts.reduce((sum, p) => sum + (p.questions?.length || 0), 0);

        refs.textImportPreviewContent.innerHTML = `
            <div class="space-y-1">
                <p><strong>Tiêu đề:</strong> ${data.title}</p>
                <p><strong>Môn:</strong> ${data.subject || 'Không xác định'}</p>
                <p><strong>Thời gian:</strong> ${data.time || 0} phút</p>
                <p><strong>Số câu hỏi:</strong> ${questionCount}</p>
            </div>
        `;
        refs.textImportPreview.classList.remove('hidden');
        refs.btnConfirmTextImport.disabled = false;

    } catch (err) {
        refs.textImportError.textContent = 'JSON không hợp lệ: ' + err.message;
        refs.textImportError.classList.remove('hidden');
    }
}

async function confirmTextImport() {
    if (!textImportData) return;

    try {
        refs.btnConfirmTextImport.disabled = true;
        refs.btnConfirmTextImport.textContent = 'Đang import...';

        const newId = await createExam(textImportData);
        showToast(`Đã import thành công: ${textImportData.title}`);
        hideTextImportModal();
        await loadExams();
        renderExamList();

    } catch (error) {
        console.error('Error importing exam:', error);
        refs.textImportError.textContent = 'Lỗi import: ' + error.message;
        refs.textImportError.classList.remove('hidden');
    } finally {
        refs.btnConfirmTextImport.disabled = false;
        refs.btnConfirmTextImport.textContent = 'Import';
    }
}

// ============================================================
// RAW TEXT IMPORT (OCR)
// ============================================================

/**
 * Handle raw text parse - convert paste text to questions
 */
function handleRawTextParse() {
    const rawTextInput = document.getElementById('raw-text-input');
    if (!rawTextInput) return;

    const rawText = rawTextInput.value.trim();
    if (!rawText) {
        showToast('Vui lòng nhập văn bản để phân tích', 'error');
        return;
    }

    try {
        // Parse raw text into questions
        const questions = parseRawTextToQuestions(rawText);

        if (questions.part1.length === 0 && questions.part2.length === 0 && questions.part3.length === 0) {
            showToast('Không tìm thấy câu hỏi nào trong văn bản', 'error');
            return;
        }

        // Merge with existing questions
        state.currentExam.part1 = [...state.currentExam.part1, ...questions.part1];
        state.currentExam.part2 = [...state.currentExam.part2, ...questions.part2];
        state.currentExam.part3 = [...state.currentExam.part3, ...questions.part3];

        // Re-render questions
        renderQuestionsPart1(state.currentExam.part1);
        renderQuestionsPart2(state.currentExam.part2);
        renderQuestionsPart3(state.currentExam.part3);

        // Clear input
        rawTextInput.value = '';

        const totalAdded = questions.part1.length + questions.part2.length + questions.part3.length;
        showToast(`Đã thêm ${totalAdded} câu hỏi từ văn bản`);

    } catch (error) {
        console.error('Raw text parse failed:', error);
        showToast('Lỗi phân tích văn bản: ' + error.message, 'error');
    }
}

/**
 * Parse raw text into structured questions
 */
function parseRawTextToQuestions(text) {
    const result = { part1: [], part2: [], part3: [] };

    // Split by question pattern (Câu 1, Câu 2, etc.)
    const questionBlocks = text.split(/(?=Câu\s*\d+[.:]\s*)/i);

    for (const block of questionBlocks) {
        if (!block.trim()) continue;

        // Extract question content
        const questionMatch = block.match(/Câu\s*\d+[.:]\s*([\s\S]*)/i);
        if (!questionMatch) continue;

        let content = questionMatch[1].trim();

        // Check for multiple choice (A. B. C. D.)
        if (/[A-D]\.\s*\S/i.test(content)) {
            const q = parseMultipleChoice(content);
            if (q) result.part1.push(q);
        }
        // Check for true/false (a) b) c) d))
        else if (/[a-d]\)\s*\S/i.test(content)) {
            const q = parseTrueFalse(content);
            if (q) result.part2.push(q);
        }
        // Otherwise short answer
        else {
            const q = parseShortAnswer(content);
            if (q) result.part3.push(q);
        }
    }

    return result;
}

/**
 * Parse multiple choice question  */
function parseMultipleChoice(content) {
    // Extract Explanation if exists
    let explanationText = '';
    const expMatch = content.match(/(?:Lời giải|Giải thích|Hướng dẫn)[:\.]?\s*([\s\S]*)$/i);
    if (expMatch) {
        explanationText = expMatch[1].trim();
        content = content.replace(expMatch[0], '').trim();
    }

    // Split into question and options
    const parts = content.split(/(?=[A-D]\.)/i);
    const questionText = parts[0]?.trim() || '';

    const options = [];
    let correctAnswer = '';

    // Extract each option
    for (let i = 1; i < parts.length && i <= 4; i++) {
        const optMatch = parts[i].match(/([A-D])\.\s*([\s\S]*)/i);
        if (optMatch) {
            let optText = optMatch[2].trim();
            // Check for correct answer marker inside option
            if (/\(đúng\)|✓|correct/i.test(optText)) {
                correctAnswer = optMatch[1].toUpperCase();
                optText = optText.replace(/\(đúng\)|✓|correct/gi, '').trim();
            }
            options.push(optText);
        }
    }

    // Check for answer at end (Đáp án: A) if not found in options
    if (!correctAnswer) {
        const answerMatch = content.match(/Đáp án[:\s]*([A-D])/i);
        if (answerMatch) {
            correctAnswer = answerMatch[1].toUpperCase();
        }
    }

    // Map A->0, B->1. Default to 0 (A) if not found
    const correctMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

    return {
        id: Date.now() + Math.random(),
        text: convertMathChemSymbols(questionText),
        options: [
            convertMathChemSymbols(options[0] || ''),
            convertMathChemSymbols(options[1] || ''),
            convertMathChemSymbols(options[2] || ''),
            convertMathChemSymbols(options[3] || '')
        ],
        correct: correctMap[correctAnswer] ?? 0,
        explanation: explanationText ? { text: convertMathChemSymbols(explanationText) } : null
    };
}

/**
 * Parse true/false question
 */
function parseTrueFalse(content) {
    // Extract Explanation
    let explanationText = '';
    const expMatch = content.match(/(?:Lời giải|Giải thích|Hướng dẫn)[:\.]?\s*([\s\S]*)$/i);
    if (expMatch) {
        explanationText = expMatch[1].trim();
        content = content.replace(expMatch[0], '').trim();
    }

    // Split into question and statements
    const parts = content.split(/(?=[a-d]\))/i);
    const questionText = parts[0]?.trim() || '';

    const subQuestions = [];
    const validIds = ['a', 'b', 'c', 'd'];

    // Extract each statement
    let idx = 0;
    for (let i = 1; i < parts.length && i <= 4; i++) {
        const stMatch = parts[i].match(/([a-d])\)\s*([\s\S]*)/i);
        if (stMatch) {
            let stText = stMatch[2].trim();
            let isCorrect = false;

            // Check for correct marker
            if (/\(đúng\)|✓|Đ\b/i.test(stText)) {
                isCorrect = true;
                stText = stText.replace(/\s*\(đúng\)|\s*✓|\s*Đ\b/gi, '').trim();
            }

            subQuestions.push({
                id: validIds[idx],
                text: convertMathChemSymbols(stText),
                correct: isCorrect
            });
            idx++;
        }
    }

    // Ensure 4 subquestions
    while (subQuestions.length < 4) {
        subQuestions.push({ id: validIds[subQuestions.length], text: '', correct: false });
    }

    return {
        id: Date.now() + Math.random(),
        text: convertMathChemSymbols(questionText),
        subQuestions: subQuestions,
        explanation: explanationText ? { text: convertMathChemSymbols(explanationText) } : null
    };
}

/**
 * Parse short answer question
 */
function parseShortAnswer(content) {
    let answer = '';
    let explanationText = '';
    let question = content;

    // Extract Explanation
    const expMatch = content.match(/(?:Lời giải|Giải thích|Hướng dẫn)[:\.]?\s*([\s\S]*)$/i);
    if (expMatch) {
        explanationText = expMatch[1].trim();
        content = content.replace(expMatch[0], '').trim();
        question = content;
    }

    // Extract answer if present
    const answerMatch = content.match(/Đáp án[:\s]*([\s\S]*?)(?:$|(?=\n\n))/i);
    if (answerMatch) {
        answer = answerMatch[1].trim();
        question = content.replace(answerMatch[0], '').trim();
    }

    return {
        id: Date.now() + Math.random(),
        text: convertMathChemSymbols(question),
        correct: convertMathChemSymbols(answer),
        explanation: explanationText ? { text: convertMathChemSymbols(explanationText) } : null
    };
}

/**
 * Handle clear raw text input
 */
function handleRawTextClear() {
    const rawTextInput = document.getElementById('raw-text-input');
    if (rawTextInput) {
        rawTextInput.value = '';
        showToast('Đã xóa văn bản');
    }
}

// ============================================================
// RENDER EXAM LIST
// ============================================================

function renderExamList() {
    const filter = refs.subjectFilter.value;
    const exams = filter
        ? state.exams.filter(e => e.subjectId === filter)
        : state.exams;

    if (exams.length === 0) {
        refs.examList.innerHTML = `
            <div class="p-8 text-center text-gray-400">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p class="font-medium">Chưa có bài thi nào</p>
                <p class="text-sm mt-1">Nhấn "Thêm" để tạo bài thi mới</p>
            </div>
        `;
        return;
    }

    refs.examList.innerHTML = exams.map(exam => {
        const subject = state.subjects.find(s => s.id === exam.subjectId);
        const totalQuestions = (exam.part1?.length || 0) + (exam.part2?.length || 0) + (exam.part3?.length || 0);
        const isActive = exam.id === state.currentExamId;

        return `
            <div class="exam-item p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}" data-id="${exam.id}">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-gray-800 truncate">${exam.title || 'Chưa đặt tên'}</h4>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            <span class="text-xs px-2 py-0.5 rounded-full ${subject?.bg || 'bg-gray-100'} ${subject?.color || 'text-gray-600'}">${subject?.name || 'Chưa chọn môn'}</span>
                            <span class="text-xs text-gray-400">${exam.time || 0} phút</span>
                            <span class="text-xs text-gray-400">•</span>
                            <span class="text-xs text-gray-400">${totalQuestions} câu</span>
                        </div>
                    </div>
                    <svg class="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </div>
            </div>
        `;
    }).join('');

    // Bind click events
    refs.examList.querySelectorAll('.exam-item').forEach(item => {
        item.addEventListener('click', () => {
            const examId = item.dataset.id;
            showEditor(examId);
        });
    });
}

// ============================================================
// EDITOR
// ============================================================

function showEditor(examId) {
    state.currentExamId = examId;

    refs.editorEmpty.classList.add('hidden');
    refs.editorForm.classList.remove('hidden');

    if (examId) {
        // Editing existing
        refs.editorTitle.textContent = 'Chỉnh sửa bài thi';
        refs.btnDelete.classList.remove('hidden');
        if (refs.btnExport) refs.btnExport.classList.remove('hidden');

        const exam = state.exams.find(e => e.id === examId);
        if (exam) {
            refs.examSubject.value = exam.subjectId || '';
            refs.examTime.value = exam.time || '';
            refs.examTitle.value = exam.title || '';
            if (refs.examCustomId) {
                refs.examCustomId.value = examId;
                refs.examCustomId.disabled = true; // Cannot change ID of existing exam
            }
            if (refs.examAuthor) {
                refs.examAuthor.value = exam.author || '';
            }

            // Normalize part1 correct answers (convert letter to number if needed)
            const letterToNumber = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
            const normalizedPart1 = (exam.part1 || []).map(q => {
                const normalized = { ...q };
                if (normalized.correct !== undefined && normalized.correct !== null) {
                    if (typeof normalized.correct === 'string') {
                        const letter = normalized.correct.toUpperCase().trim();
                        normalized.correct = letterToNumber[letter] ?? (parseInt(letter) || 0);
                    }
                } else {
                    normalized.correct = 0;
                }
                return normalized;
            });

            renderQuestionsPart1(normalizedPart1);
            renderQuestionsPart2(exam.part2 || []);
            renderQuestionsPart3(exam.part3 || []);
        }
    } else {
        // Creating new
        refs.editorTitle.textContent = 'Tạo bài thi mới';
        refs.btnDelete.classList.add('hidden');
        if (refs.btnExport) refs.btnExport.classList.add('hidden');

        refs.examSubject.value = '';
        refs.examTime.value = '50';
        refs.examTitle.value = '';
        if (refs.examCustomId) {
            refs.examCustomId.value = '';
            refs.examCustomId.disabled = false; // Can set custom ID for new exam
        }
        if (refs.examAuthor) {
            refs.examAuthor.value = '';
        }

        renderQuestionsPart1([]);
        renderQuestionsPart2([]);
        renderQuestionsPart3([]);
    }

    renderExamList();
}

function hideEditor() {
    state.currentExamId = null;
    refs.editorEmpty.classList.remove('hidden');
    refs.editorForm.classList.add('hidden');
    renderExamList();
}

// ============================================================
// QUESTION RENDERING
// ============================================================

/**
 * Trigger MathJax to render math/chemistry symbols
 */
function renderMath() {
    if (window.MathJax && window.MathJax.typesetPromise) {
        try {
            window.MathJax.typesetPromise().catch(err => {
                console.warn('MathJax render error:', err);
            });
        } catch (err) {
            console.warn('MathJax error:', err);
        }
    }
}

/**
 * Escape special characters for safe use in HTML attributes (e.g., value="...")
 * This prevents breaking HTML structure when content contains quotes.
 */
function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderQuestionsPart1(questions) {
    if (questions.length === 0) {
        refs.part1Questions.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Chưa có câu hỏi nào</p>';
    } else {
        refs.part1Questions.innerHTML = questions.map((q, idx) => createPart1QuestionHTML(q, idx)).join('');
        bindQuestionEvents(1);
    }
    refs.part1Count.textContent = `${questions.length} câu`;
    renderMath();
}

function renderQuestionsPart2(questions) {
    if (questions.length === 0) {
        refs.part2Questions.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Chưa có câu hỏi nào</p>';
    } else {
        refs.part2Questions.innerHTML = questions.map((q, idx) => createPart2QuestionHTML(q, idx)).join('');
        bindQuestionEvents(2);
    }
    refs.part2Count.textContent = `${questions.length} câu`;
    renderMath();
}

function renderQuestionsPart3(questions) {
    if (questions.length === 0) {
        refs.part3Questions.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Chưa có câu hỏi nào</p>';
    } else {
        refs.part3Questions.innerHTML = questions.map((q, idx) => createPart3QuestionHTML(q, idx)).join('');
        bindQuestionEvents(3);
    }
    refs.part3Count.textContent = `${questions.length} câu`;
    renderMath();
}

function createPart1QuestionHTML(q, idx) {
    const options = q.options || ['', '', '', ''];

    // Handle correct answer - support both number (0,1,2,3) and letter (A,B,C,D) formats
    let correctIdx = 0;
    if (q.correct !== undefined && q.correct !== null) {
        if (typeof q.correct === 'number') {
            correctIdx = q.correct;
        } else if (typeof q.correct === 'string') {
            // Convert letter to number: A=0, B=1, C=2, D=3
            const letter = q.correct.toUpperCase().trim();
            if (letter === 'A') correctIdx = 0;
            else if (letter === 'B') correctIdx = 1;
            else if (letter === 'C') correctIdx = 2;
            else if (letter === 'D') correctIdx = 3;
            else correctIdx = parseInt(letter) || 0;
        }
    }

    const imageUrl = q.image || '';
    const explanation = q.explanation || {};
    // Use unique question ID for radio button name to prevent conflicts
    const uniqueQId = q.id || `q${Date.now()}_${idx}`;

    return `
        <div class="question-block border border-gray-200 rounded-xl p-4 bg-white shadow-sm" data-idx="${idx}" data-qid="${uniqueQId}">
            <div class="flex items-center justify-between gap-2 mb-4">
                <div class="flex items-center gap-2">
                    <span class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-bold rounded-lg flex items-center justify-center shadow-sm">C${q.id || idx + 1}</span>
                    <span class="text-xs text-gray-400 font-medium">Trắc nghiệm</span>
                </div>
                <button type="button" class="btn-remove-question p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-semibold text-gray-600 mb-2 block">📝 Nội dung câu hỏi</label>
                    <textarea class="q-text w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none bg-gray-50 focus:bg-white transition-colors" rows="2" placeholder="Nhập nội dung câu hỏi...">${q.text || ''}</textarea>
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-600 mb-2 block">🖼️ Hình ảnh câu hỏi</label>
                    <div class="flex gap-2">
                        <input type="text" class="q-image flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors" placeholder="URL hình ảnh hoặc upload..." value="${imageUrl}">
                        <input type="file" class="q-image-file hidden" accept="image/*">
                        <button type="button" class="btn-upload-image px-3 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors flex items-center gap-1.5">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                            Upload
                        </button>
                    </div>
                    <div class="q-image-preview mt-2 ${imageUrl ? '' : 'hidden'}">
                        ${imageUrl ? `<img src="${imageUrl}" class="max-h-32 rounded-lg border border-gray-200" onerror="this.parentElement.classList.add('hidden')">` : ''}
                    </div>
                    <div class="q-image-loading hidden mt-2 flex items-center gap-2 text-purple-600 text-sm">
                        <div class="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full spinner"></div>
                        Đang upload...
                    </div>
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-600 mb-2 block">🎯 Các đáp án <span class="text-blue-500">(Click để chọn đáp án đúng)</span></label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${options.map((opt, i) => `
                            <label class="option-card cursor-pointer group">
                                <input type="radio" name="correct-${uniqueQId}" value="${i}" ${correctIdx === i ? 'checked' : ''} class="q-correct sr-only">
                                <div class="option-content flex items-center gap-3 p-3 border-2 rounded-xl transition-all ${correctIdx === i ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'}">
                                    <span class="option-badge w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${correctIdx === i ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600'}">${String.fromCharCode(65 + i)}</span>
                                    <input type="text" class="q-option flex-1 bg-transparent border-0 text-sm focus:ring-0 outline-none placeholder-gray-400" placeholder="Nhập đáp án ${String.fromCharCode(65 + i)}..." value="${escapeAttr(opt)}" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()">
                                    <svg class="option-check w-5 h-5 text-emerald-500 shrink-0 ${correctIdx === i ? '' : 'hidden'}" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <!-- Explanation Section -->
                <div class="border-t border-gray-100 pt-4 mt-4">
                    <details class="group">
                        <summary class="cursor-pointer text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                            💡 Lời giải (tùy chọn)
                            <svg class="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                        </summary>
                        <div class="mt-3 space-y-3 pl-1">
                            <div>
                                <label class="text-xs text-gray-500 mb-1 block">📝 Lời giải văn bản</label>
                                <textarea class="q-explanation-text w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none" rows="3" placeholder="Nhập lời giải chi tiết...">${explanation.text || ''}</textarea>
                            </div>
                            <div>
                                <label class="text-xs text-gray-500 mb-1 block">🖼️ Hình ảnh lời giải</label>
                                <div class="flex gap-2">
                                    <input type="text" class="q-explanation-image flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="URL hình ảnh lời giải..." value="${explanation.image || ''}">
                                    <input type="file" class="q-explanation-image-file hidden" accept="image/*">
                                    <button type="button" class="btn-upload-explanation-image px-3 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                                        Upload
                                    </button>
                                </div>
                                <div class="q-explanation-image-preview mt-2 ${explanation.image ? '' : 'hidden'}">
                                    ${explanation.image ? `<img src="${explanation.image}" class="max-h-24 rounded-lg border border-gray-200">` : ''}
                                </div>
                                <div class="q-explanation-image-loading hidden mt-2 flex items-center gap-2 text-orange-600 text-sm">
                                    <div class="w-4 h-4 border-2 border-orange-200 border-t-orange-600 rounded-full spinner"></div>
                                    Đang upload...
                                </div>
                            </div>
                            <div>
                                <label class="text-xs text-gray-500 mb-1 block">🎬 Video lời giải (YouTube hoặc Google Drive)</label>
                                <div class="flex gap-2">
                                    <input type="text" class="q-explanation-video flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="https://youtube.com/... hoặc https://drive.google.com/..." value="${explanation.video || ''}">
                                    <input type="file" class="q-explanation-video-file hidden" accept="video/*">
                                    <button type="button" class="btn-upload-video px-3 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1" title="Upload video lên Google Drive">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                        Upload
                                    </button>
                                </div>
                                <div class="q-video-preview mt-2 ${explanation.video ? '' : 'hidden'}">
                                    ${explanation.video ? `<p class="text-xs text-green-600">✓ Video đã được thêm</p>` : ''}
                                </div>
                                <div class="q-video-loading hidden mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <div class="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full spinner"></div>
                                    <span class="q-video-progress">Đang upload...</span>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    `;
}

function createPart2QuestionHTML(q, idx) {
    const subQuestions = q.subQuestions || [
        { id: 'a', text: '', correct: true },
        { id: 'b', text: '', correct: false },
        { id: 'c', text: '', correct: true },
        { id: 'd', text: '', correct: false }
    ];
    const imageUrl = q.image || '';
    const explanation = q.explanation || {};

    return `
        <div class="question-block border border-gray-200 rounded-lg p-4 bg-gray-50" data-idx="${idx}">
            <div class="flex items-start justify-between gap-2 mb-3">
                <span class="w-7 h-7 bg-indigo-600 text-white text-xs font-bold rounded flex items-center justify-center shrink-0">${q.id || idx + 1}</span>
                <button type="button" class="btn-remove-question text-gray-400 hover:text-red-500 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
            <div class="space-y-3">
                <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Nội dung câu hỏi chính (tùy chọn)</label>
                    <textarea class="q-text w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" rows="2" placeholder="Mô tả hoặc đề dẫn...">${q.text || ''}</textarea>
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">🖼️ Hình ảnh</label>
                    <div class="flex gap-2">
                        <input type="text" class="q-image flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="URL hình ảnh hoặc upload..." value="${imageUrl}">
                        <input type="file" class="q-image-file hidden" accept="image/*">
                        <button type="button" class="btn-upload-image px-3 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1.5">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                            Upload
                        </button>
                    </div>
                    <div class="q-image-preview mt-2 ${imageUrl ? '' : 'hidden'}">
                        ${imageUrl ? `<img src="${imageUrl}" class="max-h-32 rounded-lg border border-gray-200" onerror="this.parentElement.classList.add('hidden')">` : ''}
                    </div>
                    <div class="q-image-loading hidden mt-2 flex items-center gap-2 text-purple-600 text-sm">
                        <div class="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full spinner"></div>
                        Đang upload...
                    </div>
                </div>
                <div class="space-y-2">
                    ${subQuestions.map((sub, i) => `
                        <div class="flex items-center gap-2 sub-question" data-sub-id="${sub.id}">
                            <span class="text-xs font-bold text-indigo-600 w-4">${sub.id})</span>
                            <input type="text" class="sq-text flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nội dung mệnh đề ${sub.id}" value="${escapeAttr(sub.text)}">
                            <select class="sq-correct px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="true" ${sub.correct === true ? 'selected' : ''}>Đúng</option>
                                <option value="false" ${sub.correct === false ? 'selected' : ''}>Sai</option>
                            </select>
                        </div>
                    `).join('')}
                </div>
                <!-- Explanation Section -->
                <div class="border-t border-gray-200 pt-3 mt-3">
                    <details class="group">
                        <summary class="cursor-pointer text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-2">
                            💡 Lời giải (tùy chọn)
                            <svg class="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                        </summary>
                        <div class="mt-3 space-y-3">
                            <div>
                                <label class="text-xs text-gray-500 mb-1 block">📝 Lời giải văn bản</label>
                                <textarea class="q-explanation-text w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none" rows="3" placeholder="Nhập lời giải chi tiết...">${explanation.text || ''}</textarea>
                            </div>
                            <div>
                                <label class="text-xs text-gray-500 mb-1 block">🖼️ Hình ảnh lời giải</label>
                                <div class="flex gap-2">
                                    <input type="text" class="q-explanation-image flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="URL hình ảnh lời giải..." value="${explanation.image || ''}">
                                    <input type="file" class="q-explanation-image-file hidden" accept="image/*">
                                    <button type="button" class="btn-upload-explanation-image px-3 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                                        Upload
                                    </button>
                                </div>
                                <div class="q-explanation-image-preview mt-2 ${explanation.image ? '' : 'hidden'}">
                                    ${explanation.image ? `<img src="${explanation.image}" class="max-h-24 rounded-lg border border-gray-200">` : ''}
                                </div>
                                <div class="q-explanation-image-loading hidden mt-2 flex items-center gap-2 text-orange-600 text-sm">
                                    <div class="w-4 h-4 border-2 border-orange-200 border-t-orange-600 rounded-full spinner"></div>
                                    Đang upload...
                                </div>
                            </div>
                            <div>
                                <label class="text-xs text-gray-500 mb-1 block">🎬 Video lời giải (YouTube hoặc Google Drive)</label>
                                <div class="flex gap-2">
                                    <input type="text" class="q-explanation-video flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="https://youtube.com/... hoặc https://drive.google.com/..." value="${explanation.video || ''}">
                                    <input type="file" class="q-explanation-video-file hidden" accept="video/*">
                                    <button type="button" class="btn-upload-video px-3 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1" title="Upload video lên Google Drive">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                        Upload
                                    </button>
                                </div>
                                <div class="q-video-preview mt-2 ${explanation.video ? '' : 'hidden'}">
                                    ${explanation.video ? `<p class="text-xs text-green-600">✓ Video đã được thêm</p>` : ''}
                                </div>
                                <div class="q-video-loading hidden mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <div class="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full spinner"></div>
                                    <span class="q-video-progress">Đang upload...</span>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    `;
}

function createPart3QuestionHTML(q, idx) {
    const imageUrl = q.image || '';
    const explanation = q.explanation || {};
    return `
        <div class="question-block border border-gray-200 rounded-lg p-4 bg-gray-50" data-idx="${idx}">
            <div class="flex items-start justify-between gap-2 mb-3">
                <span class="w-7 h-7 bg-emerald-600 text-white text-xs font-bold rounded flex items-center justify-center shrink-0">${q.id || idx + 1}</span>
                <button type="button" class="btn-remove-question text-gray-400 hover:text-red-500 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
            <div class="space-y-3">
                <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Nội dung câu hỏi</label>
                    <textarea class="q-text w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" rows="2" placeholder="Nhập nội dung câu hỏi...">${q.text || ''}</textarea>
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">🖼️ Hình ảnh</label>
                    <div class="flex gap-2">
                        <input type="text" class="q-image flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="URL hình ảnh hoặc upload..." value="${imageUrl}">
                        <input type="file" class="q-image-file hidden" accept="image/*">
                        <button type="button" class="btn-upload-image px-3 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1.5">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                            Upload
                        </button>
                    </div>
                    <div class="q-image-preview mt-2 ${imageUrl ? '' : 'hidden'}">
                        ${imageUrl ? `<img src="${imageUrl}" class="max-h-32 rounded-lg border border-gray-200" onerror="this.parentElement.classList.add('hidden')">` : ''}
                    </div>
                    <div class="q-image-loading hidden mt-2 flex items-center gap-2 text-purple-600 text-sm">
                        <div class="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full spinner"></div>
                        Đang upload...
                    </div>
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Đáp án đúng</label>
                    <input type="text" class="q-correct w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="VD: 123, -5.5, ABC" value="${escapeAttr(q.correct)}">
                </div>
                <!-- Explanation Section -->
                <div class="border-t border-gray-200 pt-3 mt-3">
                    <details class="group">
                        <summary class="cursor-pointer text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-2">
                            💡 Lời giải (tùy chọn)
                            <svg class="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                        </summary>
                        <div class="mt-3 space-y-3">
                            <div>
                                <label class="text-xs text-gray-500 mb-1 block">📝 Lời giải văn bản</label>
                                <textarea class="q-explanation-text w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none" rows="3" placeholder="Nhập lời giải chi tiết...">${explanation.text || ''}</textarea>
                            </div>
                            <div>
                                <label class="text-xs text-gray-500 mb-1 block">🖼️ Hình ảnh lời giải</label>
                                <div class="flex gap-2">
                                    <input type="text" class="q-explanation-image flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="URL hình ảnh lời giải..." value="${explanation.image || ''}">
                                    <input type="file" class="q-explanation-image-file hidden" accept="image/*">
                                    <button type="button" class="btn-upload-explanation-image px-3 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                                        Upload
                                    </button>
                                </div>
                                <div class="q-explanation-image-preview mt-2 ${explanation.image ? '' : 'hidden'}">
                                    ${explanation.image ? `<img src="${explanation.image}" class="max-h-24 rounded-lg border border-gray-200">` : ''}
                                </div>
                                <div class="q-explanation-image-loading hidden mt-2 flex items-center gap-2 text-orange-600 text-sm">
                                    <div class="w-4 h-4 border-2 border-orange-200 border-t-orange-600 rounded-full spinner"></div>
                                    Đang upload...
                                </div>
                            </div>
                            <div>
                                <label class="text-xs text-gray-500 mb-1 block">🎬 Video lời giải (YouTube hoặc Google Drive)</label>
                                <div class="flex gap-2">
                                    <input type="text" class="q-explanation-video flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="https://youtube.com/... hoặc https://drive.google.com/..." value="${explanation.video || ''}">
                                    <input type="file" class="q-explanation-video-file hidden" accept="video/*">
                                    <button type="button" class="btn-upload-video px-3 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1" title="Upload video lên Google Drive">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                        Upload
                                    </button>
                                </div>
                                <div class="q-video-preview mt-2 ${explanation.video ? '' : 'hidden'}">
                                    ${explanation.video ? `<p class="text-xs text-green-600">✓ Video đã được thêm</p>` : ''}
                                </div>
                                <div class="q-video-loading hidden mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <div class="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full spinner"></div>
                                    <span class="q-video-progress">Đang upload...</span>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    `;
}

function bindQuestionEvents(part) {
    const container = part === 1 ? refs.part1Questions : part === 2 ? refs.part2Questions : refs.part3Questions;

    // Remove handlers
    container.querySelectorAll('.btn-remove-question').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const block = e.target.closest('.question-block');
            block.remove();
            updateQuestionIds(part);
            updateQuestionCount(part);
        });
    });

    // Part 1 Radio handlers for visual update
    if (part === 1) {
        container.querySelectorAll('.q-correct').forEach(radio => {
            radio.addEventListener('change', (e) => {
                try {
                    const checkedRadio = e.target;
                    const questionBlock = checkedRadio.closest('.question-block');
                    if (!questionBlock) return;

                    // Reset all options in this question
                    questionBlock.querySelectorAll('.option-content').forEach(card => {
                        if (!card) return;
                        card.classList.remove('border-emerald-500', 'bg-emerald-50');
                        card.classList.add('border-gray-200', 'hover:border-blue-300', 'hover:bg-blue-50');

                        const badge = card.querySelector('.option-badge');
                        if (badge) {
                            badge.classList.remove('bg-emerald-500', 'text-white');
                            badge.classList.add('bg-gray-100', 'text-gray-600', 'group-hover:bg-blue-100', 'group-hover:text-blue-600');
                        }

                        const check = card.querySelector('.option-check');
                        if (check) check.classList.add('hidden');
                    });

                    // Set selected option
                    const optionCard = checkedRadio.closest('.option-card');
                    if (!optionCard) return;

                    const selectedCard = optionCard.querySelector('.option-content');
                    if (!selectedCard) return;

                    selectedCard.classList.remove('border-gray-200', 'hover:border-blue-300', 'hover:bg-blue-50');
                    selectedCard.classList.add('border-emerald-500', 'bg-emerald-50');

                    const selectedBadge = selectedCard.querySelector('.option-badge');
                    if (selectedBadge) {
                        selectedBadge.classList.remove('bg-gray-100', 'text-gray-600', 'group-hover:bg-blue-100', 'group-hover:text-blue-600');
                        selectedBadge.classList.add('bg-emerald-500', 'text-white');
                    }

                    const selectedCheck = selectedCard.querySelector('.option-check');
                    if (selectedCheck) selectedCheck.classList.remove('hidden');
                } catch (err) {
                    console.error('Error in radio change handler:', err);
                }
            });
        });
    }

    // Image upload handlers for all parts
    container.querySelectorAll('.btn-upload-image').forEach(btn => {
        btn.addEventListener('click', () => {
            const block = btn.closest('.question-block');
            const fileInput = block.querySelector('.q-image-file');
            fileInput.click();
        });
    });

    container.querySelectorAll('.q-image-file').forEach(input => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('image/')) {
                showToast('Vui lòng chọn file hình ảnh', 'error');
                return;
            }

            // Validate file size (max 32MB for ImgBB)
            if (file.size > 32 * 1024 * 1024) {
                showToast('File quá lớn (tối đa 32MB)', 'error');
                return;
            }

            const block = input.closest('.question-block');
            const urlInput = block.querySelector('.q-image');
            const previewContainer = block.querySelector('.q-image-preview');
            const loadingContainer = block.querySelector('.q-image-loading');
            const uploadBtn = block.querySelector('.btn-upload-image');

            // Show loading state
            loadingContainer.classList.remove('hidden');
            uploadBtn.disabled = true;
            uploadBtn.classList.add('opacity-50', 'cursor-not-allowed');

            try {
                const imageUrl = await uploadImageToImgBB(file);

                // Update URL input
                urlInput.value = imageUrl;

                // Update preview
                previewContainer.innerHTML = `<img src="${imageUrl}" class="max-h-32 rounded-lg border border-gray-200">`;
                previewContainer.classList.remove('hidden');

                showToast('Upload thành công!');
            } catch (error) {
                console.error('Upload failed:', error);
                showToast('Upload thất bại: ' + error.message, 'error');
            } finally {
                // Hide loading state
                loadingContainer.classList.add('hidden');
                uploadBtn.disabled = false;
                uploadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                input.value = ''; // Reset file input
            }
        });
    });

    // Update preview when URL is manually entered
    container.querySelectorAll('.q-image').forEach(input => {
        input.addEventListener('change', (e) => {
            const block = input.closest('.question-block');
            const previewContainer = block.querySelector('.q-image-preview');
            const url = e.target.value.trim();

            if (url) {
                previewContainer.innerHTML = `<img src="${url}" class="max-h-32 rounded-lg border border-gray-200" onerror="this.parentElement.classList.add('hidden')">`;
                previewContainer.classList.remove('hidden');
            } else {
                previewContainer.classList.add('hidden');
                previewContainer.innerHTML = '';
            }
        });
    });

    // Explanation image upload handlers
    container.querySelectorAll('.btn-upload-explanation-image').forEach(btn => {
        btn.addEventListener('click', () => {
            const block = btn.closest('.question-block');
            const fileInput = block.querySelector('.q-explanation-image-file');
            if (fileInput) fileInput.click();
        });
    });

    container.querySelectorAll('.q-explanation-image-file').forEach(input => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                showToast('Vui lòng chọn file hình ảnh', 'error');
                return;
            }

            if (file.size > 32 * 1024 * 1024) {
                showToast('File quá lớn (tối đa 32MB)', 'error');
                return;
            }

            const block = input.closest('.question-block');
            const urlInput = block.querySelector('.q-explanation-image');
            const previewContainer = block.querySelector('.q-explanation-image-preview');
            const loadingContainer = block.querySelector('.q-explanation-image-loading');
            const uploadBtn = block.querySelector('.btn-upload-explanation-image');

            // Show loading state
            if (loadingContainer) loadingContainer.classList.remove('hidden');
            uploadBtn.disabled = true;
            uploadBtn.classList.add('opacity-50', 'cursor-not-allowed');

            try {
                const imageUrl = await uploadImageToImgBB(file);
                urlInput.value = imageUrl;
                previewContainer.innerHTML = `<img src="${imageUrl}" class="max-h-24 rounded-lg border border-gray-200">`;
                previewContainer.classList.remove('hidden');
                showToast('Upload ảnh lời giải thành công!');
            } catch (error) {
                console.error('Upload failed:', error);
                showToast('Upload thất bại: ' + error.message, 'error');
            } finally {
                // Hide loading state
                if (loadingContainer) loadingContainer.classList.add('hidden');
                uploadBtn.disabled = false;
                uploadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                input.value = '';
            }
        });
    });

    // Update explanation image preview when URL is manually entered
    container.querySelectorAll('.q-explanation-image').forEach(input => {
        input.addEventListener('change', (e) => {
            const block = input.closest('.question-block');
            const previewContainer = block.querySelector('.q-explanation-image-preview');
            const url = e.target.value.trim();

            if (url) {
                previewContainer.innerHTML = `<img src="${url}" class="max-h-24 rounded-lg border border-gray-200" onerror="this.parentElement.classList.add('hidden')">`;
                previewContainer.classList.remove('hidden');
            } else {
                previewContainer.classList.add('hidden');
                previewContainer.innerHTML = '';
            }
        });
    });

    // Video upload handlers (Google Drive)
    container.querySelectorAll('.btn-upload-video').forEach(btn => {
        btn.addEventListener('click', async () => {
            // Check if Google Drive is configured
            if (!window.googleDriveUploader) {
                showToast('Google Drive chưa được cấu hình. Vui lòng xem file GOOGLE_DRIVE_SETUP.md', 'error');
                return;
            }

            if (!window.googleDriveUploader.isConfigured()) {
                showToast('Vui lòng cấu hình Google Drive API trong file google-drive-config.js', 'error');
                return;
            }

            const block = btn.closest('.question-block');
            const fileInput = block.querySelector('.q-explanation-video-file');
            fileInput.click();
        });
    });

    container.querySelectorAll('.q-explanation-video-file').forEach(input => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('video/')) {
                showToast('Vui lòng chọn file video', 'error');
                return;
            }

            // Validate file size (max 500MB)
            const maxSize = 500 * 1024 * 1024;
            if (file.size > maxSize) {
                showToast('File quá lớn (tối đa 500MB)', 'error');
                return;
            }

            const block = input.closest('.question-block');
            const urlInput = block.querySelector('.q-explanation-video');
            const previewContainer = block.querySelector('.q-video-preview');
            const loadingContainer = block.querySelector('.q-video-loading');
            const progressSpan = loadingContainer?.querySelector('.q-video-progress');
            const uploadBtn = block.querySelector('.btn-upload-video');

            // Show loading state
            if (loadingContainer) loadingContainer.classList.remove('hidden');
            uploadBtn.disabled = true;
            uploadBtn.classList.add('opacity-50', 'cursor-not-allowed');

            try {
                // Upload to Google Drive
                const result = await window.googleDriveUploader.uploadVideo(file, (percent) => {
                    if (progressSpan) {
                        progressSpan.textContent = `Đang upload... ${percent}%`;
                    }
                });

                // Set the video link
                urlInput.value = result.link;

                // Update preview
                if (previewContainer) {
                    previewContainer.innerHTML = `<p class="text-xs text-green-600">✓ Video đã được upload: ${file.name}</p>`;
                    previewContainer.classList.remove('hidden');
                }

                showToast('Upload video thành công!');
            } catch (error) {
                console.error('Video upload failed:', error);
                showToast('Upload thất bại: ' + error.message, 'error');
            } finally {
                // Hide loading state
                if (loadingContainer) loadingContainer.classList.add('hidden');
                uploadBtn.disabled = false;
                uploadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                input.value = ''; // Reset file input
            }
        });
    });

    // Update video preview when URL is manually entered
    container.querySelectorAll('.q-explanation-video').forEach(input => {
        input.addEventListener('change', (e) => {
            const block = input.closest('.question-block');
            const previewContainer = block.querySelector('.q-video-preview');
            const url = e.target.value.trim();

            if (previewContainer) {
                if (url) {
                    previewContainer.innerHTML = `<p class="text-xs text-green-600">✓ Video đã được thêm</p>`;
                    previewContainer.classList.remove('hidden');
                } else {
                    previewContainer.classList.add('hidden');
                    previewContainer.innerHTML = '';
                }
            }
        });
    });
}

function addQuestion(part) {
    const container = part === 1 ? refs.part1Questions : part === 2 ? refs.part2Questions : refs.part3Questions;
    const count = container.querySelectorAll('.question-block').length;

    // Clear empty message if present
    if (count === 0) {
        container.innerHTML = '';
    }

    const newQ = part === 1
        ? { id: count + 1, text: '', options: ['', '', '', ''], correct: 0 }
        : part === 2
            ? {
                id: count + 1, text: '', subQuestions: [
                    { id: 'a', text: '', correct: true },
                    { id: 'b', text: '', correct: false },
                    { id: 'c', text: '', correct: true },
                    { id: 'd', text: '', correct: false }
                ]
            }
            : { id: count + 1, text: '', correct: '' };

    const html = part === 1
        ? createPart1QuestionHTML(newQ, count)
        : part === 2
            ? createPart2QuestionHTML(newQ, count)
            : createPart3QuestionHTML(newQ, count);

    container.insertAdjacentHTML('beforeend', html);
    bindQuestionEvents(part);
    updateQuestionCount(part);

    // Scroll to new question
    container.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateQuestionIds(part) {
    const container = part === 1 ? refs.part1Questions : part === 2 ? refs.part2Questions : refs.part3Questions;
    container.querySelectorAll('.question-block').forEach((block, idx) => {
        block.dataset.idx = idx;
        const badge = block.querySelector('span');
        if (badge) badge.textContent = idx + 1;
    });
}

function updateQuestionCount(part) {
    const container = part === 1 ? refs.part1Questions : part === 2 ? refs.part2Questions : refs.part3Questions;
    const countEl = part === 1 ? refs.part1Count : part === 2 ? refs.part2Count : refs.part3Count;
    const count = container.querySelectorAll('.question-block').length;
    countEl.textContent = `${count} câu`;
}

// ============================================================
// SAVE & DELETE
// ============================================================

function collectFormData() {
    // Basic info
    const subjectId = refs.examSubject.value;
    const time = parseInt(refs.examTime.value) || 50;
    const title = refs.examTitle.value.trim();
    const customId = refs.examCustomId?.value?.trim() || '';
    const author = refs.examAuthor?.value?.trim() || '';

    // Helper to collect explanation data
    const collectExplanation = (block) => {
        const text = block.querySelector('.q-explanation-text')?.value?.trim() || '';
        const image = block.querySelector('.q-explanation-image')?.value?.trim() || '';
        const video = block.querySelector('.q-explanation-video')?.value?.trim() || '';

        // Only return explanation object if at least one field has content
        if (text || image || video) {
            const explanation = {};
            if (text) explanation.text = text;
            if (image) explanation.image = image;
            if (video) explanation.video = video;
            return explanation;
        }
        return null;
    };

    // Collect Part 1
    const part1 = [];
    refs.part1Questions.querySelectorAll('.question-block').forEach((block, idx) => {
        const text = block.querySelector('.q-text').value.trim();
        const image = block.querySelector('.q-image')?.value?.trim() || '';
        const options = Array.from(block.querySelectorAll('.q-option')).map(i => i.value.trim());
        const correctRadio = block.querySelector('.q-correct:checked');
        const correct = correctRadio ? parseInt(correctRadio.value) : 0;

        const q = { id: idx + 1, text, options, correct };
        if (image) q.image = image;

        const explanation = collectExplanation(block);
        if (explanation) q.explanation = explanation;

        part1.push(q);
    });

    // Collect Part 2
    const part2 = [];
    refs.part2Questions.querySelectorAll('.question-block').forEach((block, idx) => {
        const text = block.querySelector('.q-text').value.trim();
        const image = block.querySelector('.q-image')?.value?.trim() || '';
        const subQuestions = [];
        block.querySelectorAll('.sub-question').forEach(sq => {
            const subId = sq.dataset.subId;
            const subText = sq.querySelector('.sq-text').value.trim();
            const subCorrect = sq.querySelector('.sq-correct').value === 'true';
            subQuestions.push({ id: subId, text: subText, correct: subCorrect });
        });

        const q = { id: idx + 1, text, subQuestions };
        if (image) q.image = image;

        const explanation = collectExplanation(block);
        if (explanation) q.explanation = explanation;

        part2.push(q);
    });

    // Collect Part 3
    const part3 = [];
    refs.part3Questions.querySelectorAll('.question-block').forEach((block, idx) => {
        const text = block.querySelector('.q-text').value.trim();
        const image = block.querySelector('.q-image')?.value?.trim() || '';
        const correct = block.querySelector('.q-correct').value.trim();

        const q = { id: idx + 1, text, correct };
        if (image) q.image = image;

        const explanation = collectExplanation(block);
        if (explanation) q.explanation = explanation;

        part3.push(q);
    });

    return { subjectId, time, title, customId, author, part1, part2, part3 };
}

async function saveExam() {
    const data = collectFormData();

    // Validation
    if (!data.subjectId) {
        showToast('Vui lòng chọn môn học', 'error');
        refs.examSubject.focus();
        return;
    }
    if (!data.title) {
        showToast('Vui lòng nhập tiêu đề bài thi', 'error');
        refs.examTitle.focus();
        return;
    }

    refs.btnSave.disabled = true;
    refs.btnSave.innerHTML = '<svg class="w-4 h-4 spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="4" stroke-dasharray="31.416" stroke-dashoffset="10"/></svg> Đang lưu...';

    try {
        if (state.currentExamId) {
            // Update existing
            await updateExam(state.currentExamId, data);
            showToast('Đã cập nhật bài thi thành công');
        } else {
            // Create new (with optional custom ID)
            const newId = await createExam(data, data.customId);
            state.currentExamId = newId;
            refs.examCustomId.value = newId; // Show the actual ID used
            showToast(`Đã tạo bài thi mới với ID: ${newId}`);
        }

        await loadExams();
        renderExamList();

    } catch (error) {
        console.error('Save failed:', error);
        showToast('Lỗi khi lưu bài thi: ' + error.message, 'error');
    } finally {
        refs.btnSave.disabled = false;
        refs.btnSave.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Lưu';
    }
}

async function confirmDeleteExam() {
    if (!state.currentExamId) return;

    refs.deleteModal.classList.add('hidden');

    try {
        await deleteExam(state.currentExamId);
        showToast('Đã xóa bài thi thành công');
        hideEditor();
        await loadExams();
    } catch (error) {
        console.error('Delete failed:', error);
        showToast('Lỗi khi xóa bài thi: ' + error.message, 'error');
    }
}

// ============================================================
// IMPORT / EXPORT (JSON ONLY)
// ============================================================

/**
 * Handle file import - supports JSON files only
 */
async function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const fileExt = fileName.split('.').pop();

    // Only support JSON
    if (fileExt !== 'json') {
        showToast(`Chỉ hỗ trợ import file .json`, 'error');
        e.target.value = '';
        return;
    }

    handleJsonImport(file);
    e.target.value = '';
}

/**
 * Handle JSON file import
 */
async function handleJsonImport(file) {
    try {
        const text = await file.text();
        const examData = JSON.parse(text);

        // Validate structure
        if (!examData.subjectId && !examData.title) {
            showToast('File JSON không hợp lệ: thiếu subjectId hoặc title', 'error');
            return;
        }

        // Ask for subject if not provided
        if (!examData.subjectId) {
            const subjectId = await selectSubjectDialog();
            if (!subjectId) return;
            examData.subjectId = subjectId;
        }

        // Set title from filename if not provided
        if (!examData.title) {
            examData.title = file.name.replace(/\.[^/.]+$/, '');
        }

        // Ensure parts exist
        examData.part1 = examData.part1 || [];
        examData.part2 = examData.part2 || [];
        examData.part3 = examData.part3 || [];

        // Normalize part1 correct answers (convert letter to number if needed)
        const letterToNumber = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
        examData.part1 = examData.part1.map(q => {
            if (q.correct !== undefined && q.correct !== null) {
                if (typeof q.correct === 'string') {
                    const letter = q.correct.toUpperCase().trim();
                    q.correct = letterToNumber[letter] ?? (parseInt(letter) || 0);
                }
            } else {
                q.correct = 0;
            }
            return q;
        });

        // Create exam in Firebase
        const newId = await createExam(examData);
        await loadExams();
        showEditor(newId);

        const totalQ = examData.part1.length + examData.part2.length + examData.part3.length;
        showToast(`Đã import thành công: ${totalQ} câu hỏi`);

    } catch (error) {
        console.error('JSON Import failed:', error);
        showToast('Lỗi đọc file JSON: ' + error.message, 'error');
    }
}


/**
 * Finalize a question - determine type and clean up
 */
function finalizeQuestion(q, list) {
    // Remove common stop words/phrases
    const stopWords = [/Lời giải.*/is, /Hướng dẫn.*/is, /Giải thích.*/is, /Đáp án chi tiết.*/is];
    stopWords.forEach(regex => {
        q.text = q.text.split(regex)[0];
    });
    q.text = q.text.replace(/^(?:Câu|Bài|Question)\s*\d+[:.\)]\s*/i, '').trim();

    // Remove duplicate options (same key)
    let uniqueOptsMap = new Map();
    q.rawOptions.forEach(opt => {
        const normalizedKey = opt.key.toUpperCase();
        if (!uniqueOptsMap.has(normalizedKey)) {
            uniqueOptsMap.set(normalizedKey, opt);
        }
    });
    const uniqueRawOptions = Array.from(uniqueOptsMap.values());

    // Determine question type
    if (uniqueRawOptions.length >= 3) {
        const firstKey = uniqueRawOptions[0].key;

        if (firstKey === firstKey.toUpperCase() && isNaN(firstKey)) {
            // Uppercase letters (A, B, C, D) = Multiple Choice
            q.type = 'MC';
            const stdLabels = ['A', 'B', 'C', 'D'];
            q.options = uniqueRawOptions.slice(0, 4).map((opt, i) => ({
                key: stdLabels[i],
                text: opt.text.trim()
            }));
        } else {
            // Lowercase letters (a, b, c, d) = True/False
            q.type = 'TF';
            q.options = uniqueRawOptions.map(opt => ({
                key: opt.key.toLowerCase(),
                text: opt.text.trim()
            }));
        }

        // Remove trailing option text from question
        q.text = q.text.replace(/(\n|^)[A-Da-d][\.\)]\s*$/, '').trim();
    } else if (uniqueRawOptions.length >= 2) {
        // 2 options with lowercase = True/False
        const firstKey = uniqueRawOptions[0].key;
        if (firstKey === firstKey.toLowerCase()) {
            q.type = 'TF';
            q.options = uniqueRawOptions.map(opt => ({
                key: opt.key.toLowerCase(),
                text: opt.text.trim()
            }));
        } else {
            q.type = 'SA';
            q.options = []; // Ensure options is always an array
        }
    } else {
        q.type = 'SA';
        q.options = []; // Ensure options is always an array
    }

    list.push(q);
}

/**
 * Detect answer keys from text content
 */
function detectAnswerKeys(fullText, questions) {
    const keys = {};

    // Pattern 1: Answer table at end (e.g., "1.A  2.B  3.C")
    const keyTableMatch = fullText.match(/(?:Bảng đáp án|Đáp án trắc nghiệm|KEY|ĐÁP ÁN)([\s\S]*)/i);
    if (keyTableMatch) {
        const matches = [...keyTableMatch[1].matchAll(/(\d+)[\.\s\:\-]*([A-D])/gi)];
        matches.forEach(m => {
            const qNum = parseInt(m[1]);
            if (!keys[qNum]) {
                keys[qNum] = m[2].toUpperCase();
            }
        });
    }

    // Pattern 2: Inline "Đáp án: X" 
    const inlineMatches = [...fullText.matchAll(/Câu\s*(\d+)[^]*?(?:Đáp án|ĐA|Chọn)[:\s]*([A-D])/gi)];
    inlineMatches.forEach(m => {
        const qNum = parseInt(m[1]);
        if (!keys[qNum]) {
            keys[qNum] = m[2].toUpperCase();
        }
    });

    // Pattern 3: True/False answers (a.Đ b.S or a)Đúng b)Sai)
    questions.forEach(q => {
        if (q.type === 'TF') {
            const combinedText = q.text + ' ' + (q.options || []).map(o => o.text).join(' ');
            const tfMatches = [...combinedText.matchAll(/([a-d])[\.\)]\s*(Đ|S|Đúng|Sai)/gi)];
            if (tfMatches.length > 0) {
                if (!keys[q.id]) keys[q.id] = {};
                tfMatches.forEach(m => {
                    keys[q.id][m[1].toLowerCase()] = m[2].toLowerCase().startsWith('đ');
                });
            }
        }

        // Pattern 4: Short answer with answer
        if (q.type === 'SA') {
            const saMatch = q.text.match(/(?:Đáp án|ĐS|Kết quả|DS)[\s\:\.]*([\d\.\,\-]+)/i);
            if (saMatch) {
                keys[q.id] = saMatch[1];
            }
        }
    });

    return keys;
}

/**
 * Convert math and chemistry symbols to LaTeX format
 */
function convertMathChemSymbols(text) {
    let result = text;

    // Trigonometry (sin, cos, tan, cot) -> \sin, \cos...
    result = result.replace(/(^|[^\\a-zA-Z])\b(sin|cos|tan|cot)\b/g, '$1\\\\$2');

    // Vectors
    result = result.replace(/\bvec\s+([a-z])\b/g, '$\\vec{$1}$'); // vec u
    result = result.replace(/\bvecto\s+([A-Z]{2})\b/gi, '$\\overrightarrow{$1}$'); // vecto AB

    // Angles
    result = result.replace(/\bgóc\s+([A-Z]{3})\b/gi, '$\\widehat{$1}$'); // góc ABC
    result = result.replace(/\b([A-Z]{3})\^\b/g, '$\\widehat{$1}$'); // ABC^

    // Superscripts: x^2 -> $x^{2}$
    result = result.replace(/([a-zA-Z])\^(\d+)/g, '$$$1^{$2}$$');

    // Subscripts: x_1 -> $x_{1}$
    result = result.replace(/([a-zA-Z])_(\d+)/g, '$$$1_{$2}$$');

    // Common chemistry formulas
    const chemFormulas = ['H2O', 'CO2', 'H2SO4', 'HNO3', 'HCl', 'NaOH', 'KOH', 'NaCl', 'KCl',
        'CaCO3', 'NaHCO3', 'NH3', 'CH4', 'C2H5OH', 'Fe2O3', 'CuSO4',
        'H3PO4', 'Ca(OH)2', 'Mg(OH)2', 'Al2O3', 'Fe3O4', 'O2', 'N2', 'Cl2', 'H2'];
    chemFormulas.forEach(formula => {
        // Avoid replacing inside existing latex commands or long words
        const regex = new RegExp(`\\b${formula}\\b`, 'g');
        result = result.replace(regex, `$\\ce{${formula}}$`);
    });

    // Fractions: 1/2 -> $\frac{1}{2}$
    result = result.replace(/(\d+)\s*\/\s*(\d+)/g, '$\\frac{$1}{$2}$');

    // Square roots
    result = result.replace(/(?:sqrt|căn)\s*\(([^)]+)\)/gi, '$\\sqrt{$1}$');
    result = result.replace(/√(\d+)/g, '$\\sqrt{$1}$');

    // Math symbols
    const symbolMap = {
        '≤': '$\\leq$', '≥': '$\\geq$', '≠': '$\\neq$', '±': '$\\pm$',
        '→': '$\\rightarrow$', '←': '$\\leftarrow$', '↔': '$\\leftrightarrow$',
        '∞': '$\\infty$', '∈': '$\\in$', '∉': '$\\notin$',
        '⊂': '$\\subset$', '∪': '$\\cup$', '∩': '$\\cap$',
        '∑': '$\\sum$', '∏': '$\\prod$', '∫': '$\\int$',
        'π': '$\\pi$', 'α': '$\\alpha$', 'β': '$\\beta$', 'γ': '$\\gamma$',
        'δ': '$\\delta$', 'θ': '$\\theta$', 'λ': '$\\lambda$', 'ω': '$\\omega$'
    };
    Object.entries(symbolMap).forEach(([sym, latex]) => {
        result = result.split(sym).join(latex);
    });

    return result;
}


















































/**
 * Show subject selection dialog
 */
function selectSubjectDialog() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <h3 class="text-lg font-bold text-gray-800 mb-4">Chọn môn học</h3>
                <p class="text-gray-500 text-sm mb-4">AI không thể xác định môn học. Vui lòng chọn:</p>
                <select id="subject-select-dialog" class="w-full px-3 py-2 border border-gray-200 rounded-lg mb-4">
                    ${state.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
                <div class="flex gap-3">
                    <button id="dialog-cancel" class="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50">Hủy</button>
                    <button id="dialog-confirm" class="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">Xác nhận</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#dialog-cancel').onclick = () => {
            modal.remove();
            resolve(null);
        };

        modal.querySelector('#dialog-confirm').onclick = () => {
            const value = modal.querySelector('#subject-select-dialog').value;
            modal.remove();
            resolve(value);
        };
    });
}

/**
 * Handle export current exam to JSON
 */
function handleExport() {
    if (!state.currentExamId) {
        showToast('Chưa chọn bài thi để xuất', 'error');
        return;
    }

    const exam = state.exams.find(e => e.id === state.currentExamId);
    if (!exam) {
        showToast('Không tìm thấy bài thi', 'error');
        return;
    }

    // Create export data (exclude Firebase-specific fields)
    const exportData = {
        subjectId: exam.subjectId,
        title: exam.title,
        time: exam.time,
        part1: exam.part1 || [],
        part2: exam.part2 || [],
        part3: exam.part3 || []
    };

    // Generate filename
    const slug = (exam.title || 'exam')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50);
    const filename = `${exam.subjectId}_${slug}.json`;

    // Download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Đã xuất: ${filename}`);
}

// ============================================================
// START APPLICATION
// ============================================================
init();
