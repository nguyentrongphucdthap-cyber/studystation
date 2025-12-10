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
    deleteEtestExam
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
    examSubject: document.getElementById('exam-subject'),
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
        refs.examSubject.value = exam.subjectId || '';
        refs.examTime.value = exam.time || 45;
        refs.examTitle.value = exam.title || '';
        refs.examCustomId.value = exam.id || '';
        refs.examCustomId.disabled = true;

        // Load sections
        state.sections = exam.sections ? JSON.parse(JSON.stringify(exam.sections)) : [];

        refs.btnDelete.classList.remove('hidden');
        refs.btnExport.classList.remove('hidden');
    } else {
        // Create new
        refs.editorTitle.textContent = 'Tạo E-test mới';
        refs.examSubject.value = '';
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
        <div class="question-row p-3 border border-gray-100 rounded-lg" data-qindex="${qIndex}">
            <div class="flex items-start gap-3">
                <span class="w-6 h-6 bg-purple-100 text-purple-700 rounded text-xs font-bold flex items-center justify-center shrink-0 mt-1">
                    ${q.id || qIndex + 1}
                </span>
                <div class="flex-1 space-y-2">
                    <input type="text" value="${escapeHtml(q.text || '')}" placeholder="Nội dung câu hỏi..."
                        class="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        onchange="window.updateQuestion('${section.id}', ${qIndex}, 'text', this.value)">
                    <div class="grid grid-cols-2 gap-2">
                        ${['A', 'B', 'C', 'D'].map(opt => `
                            <div class="flex items-center gap-1">
                                <input type="radio" name="ans-${section.id}-${qIndex}" value="${opt}" 
                                    ${q.ans === opt ? 'checked' : ''}
                                    onchange="window.updateQuestion('${section.id}', ${qIndex}, 'ans', '${opt}')"
                                    class="w-4 h-4 text-purple-600">
                                <input type="text" value="${escapeHtml(getOptionText(q.options, opt))}" 
                                    placeholder="${opt}."
                                    class="flex-1 px-2 py-1 border border-gray-200 rounded text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                                    onchange="window.updateOption('${section.id}', ${qIndex}, '${opt}', this.value)">
                            </div>
                        `).join('')}
                    </div>
                </div>
                <button onclick="window.removeQuestion('${section.id}', ${qIndex})"
                    class="p-1 text-red-400 hover:text-red-600 transition-colors shrink-0" title="Xóa câu hỏi">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function getOptionText(options, letter) {
    if (!options) return '';
    const opt = options.find(o => o.startsWith(letter + '.') || o.startsWith(letter + ' '));
    return opt ? opt.substring(2).trim() : '';
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

    section.questions.push({
        id: nextId,
        text: '',
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
    const subjectId = refs.examSubject?.value || 'english';
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
        subjectId,
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
    refs.deleteModal.classList.remove('hidden');
}

function hideDeleteModal() {
    refs.deleteModal.classList.add('hidden');
}

async function confirmDelete() {
    if (!state.currentExamId) return;

    try {
        await deleteEtestExam(state.currentExamId);
        showToast('Đã xóa E-test');
        hideDeleteModal();
        hideEditor();
        await loadExams();
    } catch (error) {
        console.error('Delete error:', error);
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
