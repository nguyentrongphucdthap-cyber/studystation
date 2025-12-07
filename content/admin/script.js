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
    getSubjects
} from "../../gatekeeper.js";

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

    // Editor
    editorEmpty: document.getElementById('editor-empty'),
    editorForm: document.getElementById('editor-form'),
    editorTitle: document.getElementById('editor-title'),
    btnDelete: document.getElementById('btn-delete'),
    btnCancel: document.getElementById('btn-cancel'),
    btnSave: document.getElementById('btn-save'),

    // Form fields
    examSubject: document.getElementById('exam-subject'),
    examTime: document.getElementById('exam-time'),
    examTitle: document.getElementById('exam-title'),

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

    // Toast
    toastContainer: document.getElementById('toast-container')
};

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
    refs.btnCancel.addEventListener('click', hideEditor);
    refs.btnSave.addEventListener('click', saveExam);
    refs.btnDelete.addEventListener('click', () => refs.deleteModal.classList.remove('hidden'));
    refs.btnCancelDelete.addEventListener('click', () => refs.deleteModal.classList.add('hidden'));
    refs.btnConfirmDelete.addEventListener('click', confirmDeleteExam);

    refs.btnAddPart1.addEventListener('click', () => addQuestion(1));
    refs.btnAddPart2.addEventListener('click', () => addQuestion(2));
    refs.btnAddPart3.addEventListener('click', () => addQuestion(3));
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

        const exam = state.exams.find(e => e.id === examId);
        if (exam) {
            refs.examSubject.value = exam.subjectId || '';
            refs.examTime.value = exam.time || '';
            refs.examTitle.value = exam.title || '';

            renderQuestionsPart1(exam.part1 || []);
            renderQuestionsPart2(exam.part2 || []);
            renderQuestionsPart3(exam.part3 || []);
        }
    } else {
        // Creating new
        refs.editorTitle.textContent = 'Tạo bài thi mới';
        refs.btnDelete.classList.add('hidden');

        refs.examSubject.value = '';
        refs.examTime.value = '50';
        refs.examTitle.value = '';

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

function renderQuestionsPart1(questions) {
    if (questions.length === 0) {
        refs.part1Questions.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Chưa có câu hỏi nào</p>';
    } else {
        refs.part1Questions.innerHTML = questions.map((q, idx) => createPart1QuestionHTML(q, idx)).join('');
        bindQuestionEvents(1);
    }
    refs.part1Count.textContent = `${questions.length} câu`;
}

function renderQuestionsPart2(questions) {
    if (questions.length === 0) {
        refs.part2Questions.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Chưa có câu hỏi nào</p>';
    } else {
        refs.part2Questions.innerHTML = questions.map((q, idx) => createPart2QuestionHTML(q, idx)).join('');
        bindQuestionEvents(2);
    }
    refs.part2Count.textContent = `${questions.length} câu`;
}

function renderQuestionsPart3(questions) {
    if (questions.length === 0) {
        refs.part3Questions.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Chưa có câu hỏi nào</p>';
    } else {
        refs.part3Questions.innerHTML = questions.map((q, idx) => createPart3QuestionHTML(q, idx)).join('');
        bindQuestionEvents(3);
    }
    refs.part3Count.textContent = `${questions.length} câu`;
}

function createPart1QuestionHTML(q, idx) {
    return `
        <div class="question-block border border-gray-200 rounded-lg p-4 bg-gray-50" data-idx="${idx}">
            <div class="flex items-start justify-between gap-2 mb-3">
                <span class="w-7 h-7 bg-blue-600 text-white text-xs font-bold rounded flex items-center justify-center shrink-0">${q.id || idx + 1}</span>
                <button type="button" class="btn-remove-question text-gray-400 hover:text-red-500 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
            <div class="space-y-3">
                <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Nội dung câu hỏi</label>
                    <textarea class="q-text w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" rows="2" placeholder="Nhập nội dung câu hỏi...">${q.text || ''}</textarea>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    ${(q.options || ['', '', '', '']).map((opt, i) => `
                        <div class="flex items-center gap-2">
                            <input type="radio" name="correct-${idx}" value="${i}" ${q.correct === i ? 'checked' : ''} class="q-correct shrink-0">
                            <input type="text" class="q-option flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Đáp án ${String.fromCharCode(65 + i)}" value="${opt || ''}">
                        </div>
                    `).join('')}
                </div>
                <p class="text-xs text-gray-400">* Chọn radio để đánh dấu đáp án đúng</p>
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
                <div class="space-y-2">
                    ${subQuestions.map((sub, i) => `
                        <div class="flex items-center gap-2 sub-question" data-sub-id="${sub.id}">
                            <span class="text-xs font-bold text-indigo-600 w-4">${sub.id})</span>
                            <input type="text" class="sq-text flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nội dung mệnh đề ${sub.id}" value="${sub.text || ''}">
                            <select class="sq-correct px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="true" ${sub.correct === true ? 'selected' : ''}>Đúng</option>
                                <option value="false" ${sub.correct === false ? 'selected' : ''}>Sai</option>
                            </select>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function createPart3QuestionHTML(q, idx) {
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
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Đáp án đúng</label>
                    <input type="text" class="q-correct w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="VD: 123, -5.5, ABC" value="${q.correct || ''}">
                </div>
            </div>
        </div>
    `;
}

function bindQuestionEvents(part) {
    const container = part === 1 ? refs.part1Questions : part === 2 ? refs.part2Questions : refs.part3Questions;

    container.querySelectorAll('.btn-remove-question').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const block = e.target.closest('.question-block');
            block.remove();
            updateQuestionIds(part);
            updateQuestionCount(part);
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

    // Collect Part 1
    const part1 = [];
    refs.part1Questions.querySelectorAll('.question-block').forEach((block, idx) => {
        const text = block.querySelector('.q-text').value.trim();
        const options = Array.from(block.querySelectorAll('.q-option')).map(i => i.value.trim());
        const correctRadio = block.querySelector('.q-correct:checked');
        const correct = correctRadio ? parseInt(correctRadio.value) : 0;

        part1.push({ id: idx + 1, text, options, correct });
    });

    // Collect Part 2
    const part2 = [];
    refs.part2Questions.querySelectorAll('.question-block').forEach((block, idx) => {
        const text = block.querySelector('.q-text').value.trim();
        const subQuestions = [];
        block.querySelectorAll('.sub-question').forEach(sq => {
            const subId = sq.dataset.subId;
            const subText = sq.querySelector('.sq-text').value.trim();
            const subCorrect = sq.querySelector('.sq-correct').value === 'true';
            subQuestions.push({ id: subId, text: subText, correct: subCorrect });
        });

        part2.push({ id: idx + 1, text, subQuestions });
    });

    // Collect Part 3
    const part3 = [];
    refs.part3Questions.querySelectorAll('.question-block').forEach((block, idx) => {
        const text = block.querySelector('.q-text').value.trim();
        const correct = block.querySelector('.q-correct').value.trim();

        part3.push({ id: idx + 1, text, correct });
    });

    return { subjectId, time, title, part1, part2, part3 };
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
            // Create new
            const newId = await createExam(data);
            state.currentExamId = newId;
            showToast('Đã tạo bài thi mới thành công');
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
// START
// ============================================================

init();
