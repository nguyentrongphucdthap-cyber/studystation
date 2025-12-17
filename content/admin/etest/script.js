/**
 * E-TEST ADMIN MODULE - Script for managing E-test exams with dynamic sections
 * Features:
 * 1. Dynamic sections (reading, gap_fill, multiple_choice)
 * 2. Passage editor for reading/gap_fill
 * 3. Questions with continuous IDs across sections
 */

import {
    initGatekeeper,
    checkIsAdmin,
    onUserChange,
    getAllEtestExams,
    createEtestExam,
    updateEtestExam,
    deleteEtestExam,
    startPresence
} from "../../../gatekeeper.js";

// ============================================================
// STATE
// ============================================================

const state = {
    exams: [],
    subjects: [],
    currentExamId: null,
    sections: [], // Array of section objects
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
    examType: document.getElementById('exam-type'),
    examTime: document.getElementById('exam-time'),
    examTitle: document.getElementById('exam-title'),
    examCustomId: document.getElementById('exam-custom-id'),

    // Sections
    sectionsContainer: document.getElementById('sections-container'),
    btnAddSection: document.getElementById('btn-add-section'),
    totalQuestions: document.getElementById('total-questions'),

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

initGatekeeper('protected');

onUserChange(async (user) => {
    if (!user) return;

    setTimeout(async () => {
        if (!checkIsAdmin()) {
            refs.accessDenied.classList.remove('hidden');
            return;
        }

        refs.adminEmail.textContent = user.email;
        refs.mainContent.classList.remove('hidden');

        startPresence();

        await init();
    }, 500);
});

async function init() {
    await loadExams();
    bindEvents();
}

// ============================================================
// LOAD EXAMS
// ============================================================



// ============================================================
// LOAD EXAMS
// ============================================================

async function loadExams() {
    refs.examList.innerHTML = `
        <div class="p-8 text-center text-gray-400">
            <div class="w-12 h-12 border-2 border-gray-200 border-t-purple-500 rounded-full spinner mx-auto mb-3"></div>
            <p>Đang tải danh sách...</p>
        </div>
    `;

    try {
        state.exams = await getAllEtestExams();
        renderExamList();
    } catch (error) {
        console.error('Error loading exams:', error);
        refs.examList.innerHTML = `<div class="p-8 text-center text-red-500">Lỗi: ${error.message}</div>`;
    }
}

function renderExamList() {
    let filtered = state.exams;

    if (filtered.length === 0) {
        refs.examList.innerHTML = `
            <div class="p-8 text-center text-gray-400">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                </svg>
                <p>Chưa có E-test nào</p>
            </div>
        `;
        return;
    }

    refs.examList.innerHTML = filtered.map(exam => {
        const subject = state.subjects.find(s => s.id === exam.subjectId);
        const totalQ = countTotalQuestions(exam);
        const isSelected = exam.id === state.currentExamId;

        return `
            <div class="exam-item p-4 border-b border-gray-100 cursor-pointer hover:bg-purple-50 transition-colors ${isSelected ? 'bg-purple-50 border-l-4 border-l-purple-500' : ''}"
                data-id="${exam.id}">
                <div class="font-semibold text-gray-800 mb-1 line-clamp-1">${exam.title || 'Không tiêu đề'}</div>
                <div class="flex items-center gap-2 text-xs text-gray-500">
                    <span class="px-1.5 py-0.5 bg-gray-100 rounded">${subject?.name || exam.subjectId}</span>
                    <span>•</span>
                    <span>${totalQ} câu</span>
                    <span>•</span>
                    <span>${exam.time || 45} phút</span>
                </div>
            </div>
        `;
    }).join('');

    // Bind click events
    refs.examList.querySelectorAll('.exam-item').forEach(item => {
        item.addEventListener('click', () => showEditor(item.dataset.id));
    });
}

function countTotalQuestions(exam) {
    if (!exam.sections) return 0;
    return exam.sections.reduce((total, sec) => {
        return total + (sec.questions?.length || 0);
    }, 0);
}

// ============================================================
// SHOW EDITOR
// ============================================================

function showEditor(examId = null) {
    state.currentExamId = examId;

    refs.editorEmpty.classList.add('hidden');
    refs.editorForm.classList.remove('hidden');

    if (examId) {
        // Edit existing
        const exam = state.exams.find(e => e.id === examId);
        if (!exam) return;

        refs.editorTitle.textContent = 'Chỉnh sửa E-test';
        refs.examType.value = exam.examType || 'thpt';
        refs.examTime.value = exam.time || 45;
        refs.examTitle.value = exam.title || '';
        refs.examCustomId.value = exam.id || '';
        refs.examCustomId.disabled = true;

        // Load sections with answer normalization
        state.sections = exam.sections ? JSON.parse(JSON.stringify(exam.sections)).map(section => {
            // Generate section ID if missing
            if (!section.id) {
                section.id = 'sec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            }

            // Normalize questions
            if (section.questions) {
                section.questions = section.questions.map(q => {
                    // Normalize answer: handle correctAnswer alias and prefix (e.g., "A." -> "A")
                    let answer = q.ans || q.correctAnswer || q.answer || '';
                    if (typeof answer === 'string') {
                        answer = answer.trim().toUpperCase().replace(/[.\s]/g, '').charAt(0);
                        if (['A', 'B', 'C', 'D'].includes(answer)) {
                            q.ans = answer;
                        }
                    }
                    return q;
                });
            }
            return section;
        }) : [];

        refs.btnDelete.classList.remove('hidden');
        refs.btnExport.classList.remove('hidden');
    } else {
        // Create new
        refs.editorTitle.textContent = 'Tạo E-test mới';
        refs.examType.value = 'thpt';
        refs.examTime.value = 45;
        refs.examTitle.value = '';
        refs.examCustomId.value = '';
        refs.examCustomId.disabled = false;

        state.sections = [];

        refs.btnDelete.classList.add('hidden');
        refs.btnExport.classList.add('hidden');
    }

    renderSections();
    renderExamList();
}

function hideEditor() {
    refs.editorEmpty.classList.remove('hidden');
    refs.editorForm.classList.add('hidden');
    state.currentExamId = null;
    state.sections = [];
    renderExamList();
}

// ============================================================
// SECTIONS MANAGEMENT
// ============================================================

function addSection() {
    const newSection = {
        id: 'sec-' + Date.now(),
        title: '',
        type: 'multiple_choice',
        content: '',
        questions: []
    };
    state.sections.push(newSection);
    renderSections();
}

function removeSection(sectionId) {
    if (!confirm('Xóa section này và tất cả câu hỏi bên trong?')) return;
    state.sections = state.sections.filter(s => s.id !== sectionId);
    renderSections();
}

function updateSection(sectionId, field, value) {
    const section = state.sections.find(s => s.id === sectionId);
    if (section) {
        section[field] = value;
        if (field === 'type') {
            renderSections(); // Re-render to show/hide passage editor
        }
    }
}

function renderSections() {
    if (state.sections.length === 0) {
        refs.sectionsContainer.innerHTML = `
            <div class="p-8 border-2 border-dashed border-gray-200 rounded-xl text-center text-gray-400">
                <svg class="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>Chưa có section nào. Nhấn "Thêm Section" để bắt đầu.</p>
            </div>
        `;
        updateTotalQuestions();
        return;
    }

    refs.sectionsContainer.innerHTML = state.sections.map((section, index) => {
        const typeColors = {
            'multiple_choice': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100' },
            'reading': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100' },
            'gap_fill': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100' }
        };
        const colors = typeColors[section.type] || typeColors.multiple_choice;
        const showPassage = section.type === 'reading' || section.type === 'gap_fill';

        return `
            <div class="section-card border ${colors.border} rounded-xl overflow-hidden" data-id="${section.id}">
                <!-- Section Header -->
                <div class="${colors.bg} px-4 py-3 border-b ${colors.border}">
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex items-center gap-3 flex-1">
                            <div class="w-8 h-8 ${colors.badge} ${colors.text} rounded-lg flex items-center justify-center font-bold text-sm">
                                ${index + 1}
                            </div>
                            <input type="text" value="${section.title || ''}" placeholder="Tên section..."
                                class="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                onchange="window.updateSection('${section.id}', 'title', this.value)">
                        </div>
                        <div class="flex items-center gap-2">
                            <select class="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                onchange="window.updateSection('${section.id}', 'type', this.value)">
                                <option value="multiple_choice" ${section.type === 'multiple_choice' ? 'selected' : ''}>Trắc nghiệm</option>
                                <option value="reading" ${section.type === 'reading' ? 'selected' : ''}>Đọc hiểu</option>
                                <option value="gap_fill" ${section.type === 'gap_fill' ? 'selected' : ''}>Điền từ</option>
                            </select>
                            <button onclick="window.removeSection('${section.id}')"
                                class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Xóa section">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Passage Editor (for reading/gap_fill) -->
                ${showPassage ? `
                <div class="p-4 border-b border-gray-100 bg-white">
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Đoạn văn (HTML)
                        <span class="font-normal text-gray-400">- Hỗ trợ &lt;h3&gt;, &lt;p&gt;, &lt;b&gt;, &lt;i&gt;, &lt;u&gt;</span>
                    </label>
                    <textarea class="passage-editor w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="<h3>Tiêu đề</h3><p>Nội dung đoạn văn...</p>"
                        onchange="window.updateSection('${section.id}', 'content', this.value)">${section.content || ''}</textarea>
                </div>
                ` : ''}

                <!-- Questions -->
                <div class="p-4 bg-white">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-sm font-semibold text-gray-700">
                            Câu hỏi <span class="${colors.text}">(${section.questions?.length || 0})</span>
                        </span>
                        <button onclick="window.addQuestion('${section.id}')"
                            class="px-2 py-1 ${colors.badge} ${colors.text} text-xs font-semibold rounded-lg hover:opacity-80 transition-opacity flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                            </svg>
                            Thêm
                        </button>
                    </div>
                    <div class="questions-list space-y-2" id="questions-${section.id}">
                        ${renderQuestions(section)}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    updateTotalQuestions();
}

function renderQuestions(section) {
    if (!section.questions || section.questions.length === 0) {
        return '<p class="text-gray-400 text-sm text-center py-4">Chưa có câu hỏi</p>';
    }

    return section.questions.map((q, qIndex) => `
        <div class="question-row p-3 border border-gray-100 rounded-lg bg-white shadow-sm transition-all hover:shadow-md" data-qindex="${qIndex}">
            <div class="flex items-start gap-3">
                <span class="w-8 h-8 bg-purple-100 text-purple-700 rounded-lg text-sm font-bold flex items-center justify-center shrink-0 mt-1 shadow-sm border border-purple-200">
                    ${q.id || qIndex + 1}
                </span>
                <div class="flex-1 space-y-3">
                    <!-- Instruction Field (New) -->
                    <div class="flex gap-2">
                        <div class="relative flex-1">
                            <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                <span class="text-gray-400 text-xs">📌</span>
                            </div>
                            <input type="text" value="${escapeHtml(q.instruction || '')}" placeholder="Yêu cầu (Instruction) - Chọn từ đồng nghĩa, trái nghĩa..."
                                class="w-full pl-8 pr-3 py-1.5 border border-yellow-200 bg-yellow-50 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:bg-white outline-none transition-all placeholder-gray-400 text-gray-700 font-medium"
                                onchange="window.updateQuestion('${section.id}', ${qIndex}, 'instruction', this.value)">
                        </div>
                        <button onclick="window.copyInstructionDown('${section.id}', ${qIndex})"
                            class="px-2.5 py-1.5 bg-gray-100 hover:bg-yellow-100 text-gray-500 hover:text-yellow-700 border border-gray-200 hover:border-yellow-300 rounded-lg transition-all flex items-center justify-center" 
                            title="Áp dụng yêu cầu này cho các câu bên dưới">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
                        </button>
                    </div>

                    <input type="text" value="${escapeHtml(q.text || '')}" placeholder="Nội dung câu hỏi..."
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        onchange="window.updateQuestion('${section.id}', ${qIndex}, 'text', this.value)">

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${['A', 'B', 'C', 'D'].map(opt => `
                            <div class="flex items-center gap-2 group">
                                <div class="relative flex items-center justify-center w-8 h-8">
                                    <input type="radio" name="ans-${section.id}-${qIndex}" value="${opt}" 
                                        ${q.ans === opt ? 'checked' : ''}
                                        onchange="window.updateQuestion('${section.id}', ${qIndex}, 'ans', '${opt}')"
                                        class="peer sr-only">
                                    <div class="w-6 h-6 border-2 border-gray-300 rounded-full peer-checked:border-purple-600 peer-checked:bg-purple-600 transition-all"></div>
                                    <span class="absolute text-xs font-bold text-gray-400 peer-checked:text-white pointer-events-none">${opt}</span>
                                </div>
                                <input type="text" value="${escapeHtml(getOptionText(q.options, opt))}" 
                                    placeholder="Đáp án ${opt}"
                                    class="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none group-hover:border-purple-200 transition-colors"
                                    onchange="window.updateOption('${section.id}', ${qIndex}, '${opt}', this.value)">
                            </div>
                        `).join('')}
                    </div>
                </div>
                <button onclick="window.removeQuestion('${section.id}', ${qIndex})"
                    class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0" title="Xóa câu hỏi">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function getOptionText(options, letter) {
    if (!options || !Array.isArray(options)) return '';

    // First try to find option with prefix like "A." or "A "
    const opt = options.find(o => o.startsWith(letter + '.') || o.startsWith(letter + ' '));
    if (opt) {
        return opt.substring(2).trim();
    }

    // Fallback: if no prefix found, use array index
    const letterIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
    if (letterIndex >= 0 && letterIndex < options.length) {
        const rawOpt = options[letterIndex];
        // Check if it has prefix, if yes remove it, if not return as is
        if (rawOpt.match(/^[A-D][.\s]/)) {
            return rawOpt.substring(2).trim();
        }
        return rawOpt;
    }
    return '';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// QUESTIONS MANAGEMENT
// ============================================================

function addQuestion(sectionId) {
    const section = state.sections.find(s => s.id === sectionId);
    if (!section) return;

    if (!section.questions) section.questions = [];

    // Calculate continuous ID
    let nextId = 1;
    state.sections.forEach(sec => {
        if (sec.questions) {
            sec.questions.forEach(q => {
                if (q.id >= nextId) nextId = q.id + 1;
            });
        }
    });

    // Auto-fill instruction from previous question
    let lastInstruction = '';
    if (section.questions.length > 0) {
        lastInstruction = section.questions[section.questions.length - 1].instruction || '';
    }

    section.questions.push({
        id: nextId,
        text: '',
        instruction: lastInstruction,
        options: ['A. ', 'B. ', 'C. ', 'D. '],
        ans: 'A'
    });

    renderSections();
}

function removeQuestion(sectionId, qIndex) {
    const section = state.sections.find(s => s.id === sectionId);
    if (!section || !section.questions) return;

    section.questions.splice(qIndex, 1);

    // Recalculate IDs
    recalculateQuestionIds();
    renderSections();
}

function updateQuestion(sectionId, qIndex, field, value) {
    const section = state.sections.find(s => s.id === sectionId);
    if (!section || !section.questions) return;

    section.questions[qIndex][field] = value;
}

function updateOption(sectionId, qIndex, letter, value) {
    const section = state.sections.find(s => s.id === sectionId);
    if (!section || !section.questions) return;

    const q = section.questions[qIndex];
    if (!q.options) q.options = ['A. ', 'B. ', 'C. ', 'D. '];

    const optIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
    if (optIndex >= 0) {
        q.options[optIndex] = `${letter}. ${value}`;
    }
}

function copyInstructionDown(sectionId, startIndex) {
    const section = state.sections.find(s => s.id === sectionId);
    if (!section || !section.questions) return;

    const sourceInstruction = section.questions[startIndex].instruction;
    if (!sourceInstruction) return;

    if (!confirm(`Bạn có chắc muốn áp dụng yêu cầu "${sourceInstruction}" cho TOÀN BỘ các câu hỏi phía dưới không?`)) return;

    let count = 0;
    for (let i = startIndex + 1; i < section.questions.length; i++) {
        section.questions[i].instruction = sourceInstruction;
        count++;
    }

    renderSections();
    showToast(`Đã cập nhật ${count} câu hỏi`);
}

// Expose to window
window.addQuestion = addQuestion;
window.removeQuestion = removeQuestion;
window.updateQuestion = updateQuestion;
window.updateOption = updateOption;
window.copyInstructionDown = copyInstructionDown;
window.removeSection = removeSection;
window.updateSection = updateSection;
window.addSection = addSection;

function recalculateQuestionIds() {
    let id = 1;
    state.sections.forEach(section => {
        if (section.questions) {
            section.questions.forEach(q => {
                q.id = id++;
            });
        }
    });
}

function updateTotalQuestions() {
    let total = 0;
    state.sections.forEach(sec => {
        total += sec.questions?.length || 0;
    });
    refs.totalQuestions.textContent = total;
}

// ============================================================
// SAVE EXAM
// ============================================================

async function saveExam() {
    const examType = refs.examType?.value || 'thpt';
    const title = refs.examTitle.value.trim();
    const time = parseInt(refs.examTime.value) || 45;
    const customId = refs.examCustomId.value.trim();

    if (!title) {
        showToast('Vui lòng nhập tiêu đề', 'error');
        return;
    }

    // Recalculate IDs before save
    recalculateQuestionIds();

    const examData = {
        examType,
        title,
        time,
        sections: state.sections.map(sec => ({
            title: sec.title || '',
            type: sec.type || 'multiple_choice',
            content: sec.content || '',
            questions: sec.questions || []
        })),
        updatedAt: new Date().toISOString()
    };

    try {
        if (state.currentExamId) {
            // Update
            await updateEtestExam(state.currentExamId, examData);
            showToast('Đã cập nhật E-test');
        } else {
            // Create
            examData.createdAt = new Date().toISOString();
            const newId = await createEtestExam(examData, customId || null);
            state.currentExamId = newId;
            showToast('Đã tạo E-test mới');
        }

        await loadExams();
        showEditor(state.currentExamId);
    } catch (error) {
        console.error('Save error:', error);
        showToast('Lỗi khi lưu: ' + error.message, 'error');
    }
}

// ============================================================
// DELETE EXAM
// ============================================================

function showDeleteModal() {
    console.log('[Delete Modal] Opening modal, currentExamId:', state.currentExamId);
    if (!refs.deleteModal) {
        console.error('[Delete Modal] Modal element not found!');
        return;
    }
    refs.deleteModal.classList.remove('hidden');
}

function hideDeleteModal() {
    refs.deleteModal.classList.add('hidden');
}

async function confirmDelete() {
    console.log('[Delete] Starting delete, currentExamId:', state.currentExamId);

    if (!state.currentExamId) {
        console.error('[Delete] No exam selected!');
        showToast('Không có bài thi nào được chọn', 'error');
        return;
    }

    try {
        console.log('[Delete] Calling deleteEtestExam...');
        await deleteEtestExam(state.currentExamId);
        console.log('[Delete] Successfully deleted');
        showToast('Đã xóa E-test');
        hideDeleteModal();
        hideEditor();
        await loadExams();
    } catch (error) {
        console.error('[Delete] Error:', error);
        showToast('Lỗi khi xóa: ' + error.message, 'error');
    }
}

// ============================================================
// EXPORT
// ============================================================

function exportExam() {
    const exam = state.exams.find(e => e.id === state.currentExamId);
    if (!exam) return;

    const data = JSON.stringify(exam, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etest-${exam.id || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất file JSON');
}

// ============================================================
// IMPORT
// ============================================================

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.title) {
            showToast('File JSON không hợp lệ', 'error');
            return;
        }

        // Create new exam from import
        data.createdAt = new Date().toISOString();
        data.updatedAt = new Date().toISOString();

        const newId = await createEtestExam(data);
        showToast('Đã import E-test');

        await loadExams();
        showEditor(newId);
    } catch (error) {
        console.error('Import error:', error);
        showToast('Lỗi import: ' + error.message, 'error');
    } finally {
        e.target.value = '';
    }
}

// ============================================================
// BIND EVENTS
// ============================================================

function bindEvents() {
    // New exam buttons
    refs.btnNewExam?.addEventListener('click', () => showEditor(null));
    refs.btnNewExamEmpty?.addEventListener('click', () => showEditor(null));

    // Editor buttons
    refs.btnCancel?.addEventListener('click', hideEditor);
    refs.btnSave?.addEventListener('click', saveExam);
    refs.btnDelete?.addEventListener('click', showDeleteModal);
    refs.btnExport?.addEventListener('click', exportExam);

    // Section
    refs.btnAddSection?.addEventListener('click', addSection);

    // Modal
    refs.btnCancelDelete?.addEventListener('click', hideDeleteModal);
    refs.btnConfirmDelete?.addEventListener('click', confirmDelete);

    // Filter
    refs.subjectFilter?.addEventListener('change', renderExamList);

    // Import
    refs.importFile?.addEventListener('change', handleImport);

    // Text Import
    refs.btnImportText?.addEventListener('click', showTextImportModal);
    refs.btnParseText?.addEventListener('click', parseTextImport);
    refs.btnCancelTextImport?.addEventListener('click', hideTextImportModal);
    refs.btnConfirmTextImport?.addEventListener('click', confirmTextImport);
}

// ============================================================
// TEXT IMPORT FUNCTIONS
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
        const sectionCount = data.sections ? data.sections.length : 0;
        const questionCount = data.sections ? data.sections.reduce((sum, s) => sum + (s.questions?.length || 0), 0) : 0;

        refs.textImportPreviewContent.innerHTML = `
            <div class="space-y-1">
                <p><strong>Tiêu đề:</strong> ${data.title}</p>
                <p><strong>Loại:</strong> ${data.examType || 'Không xác định'}</p>
                <p><strong>Thời gian:</strong> ${data.time || 0} phút</p>
                <p><strong>Số phần:</strong> ${sectionCount}</p>
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

        const newId = await createEtestExam(textImportData);
        showToast(`Đã import thành công E-test: ${textImportData.title}`);
        hideTextImportModal();
        await loadExams();
        showEditor(newId);

    } catch (error) {
        console.error('Error importing E-test:', error);
        refs.textImportError.textContent = 'Lỗi import: ' + error.message;
        refs.textImportError.classList.remove('hidden');
    } finally {
        refs.btnConfirmTextImport.disabled = false;
        refs.btnConfirmTextImport.textContent = 'Import';
    }
}

// ============================================================
// EXPOSE FUNCTIONS TO WINDOW (for inline handlers)
// ============================================================

window.updateSection = updateSection;
window.removeSection = removeSection;
window.addQuestion = addQuestion;
window.removeQuestion = removeQuestion;
window.updateQuestion = updateQuestion;
window.updateOption = updateOption;
