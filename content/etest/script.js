// ============================================================================
// E-TEST APPLICATION - Study Station
// Complete rewrite with Firebase integration and improved code structure
// ============================================================================

// --- TEXT TOOLS MODULE ---
// Handles text highlighting and note-taking functionality
const textTools = {
    // Use getters to avoid null pointer errors when script loads before DOM
    get menu() { return document.getElementById('text-selection-menu'); },
    get actionMenu() { return document.getElementById('highlight-action-menu'); },
    get noteEditor() { return document.getElementById('note-editor'); },
    get noteInput() { return document.getElementById('note-input'); },
    currentSelection: null,
    tempRange: null,
    activeHighlightSpan: null,

    init() {
        document.addEventListener('mouseup', (e) => this.handleSelection(e));
        document.addEventListener('mousedown', (e) => {
            if (this.menu && !this.menu.contains(e.target) &&
                this.actionMenu && !this.actionMenu.contains(e.target) &&
                this.noteEditor && !this.noteEditor.contains(e.target)) {
                this.hideMenu();
                this.hideActionMenu();
            }
        });
    },

    handleSelection(e) {
        if ((this.menu && this.menu.contains(e.target)) || (this.actionMenu && this.actionMenu.contains(e.target))) return;
        const passageContainer = document.querySelector('.passage-content');
        if (!passageContainer) return;

        const selection = window.getSelection();
        if (selection.toString().trim().length > 0 && passageContainer.contains(selection.anchorNode)) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            this.currentSelection = range;
            this.showMenu(rect.left + rect.width / 2, rect.top - 10);
        } else if (this.noteEditor && !this.noteEditor.contains(e.target)) {
            this.hideMenu();
        }
    },

    showMenu(x, y) {
        this.hideActionMenu();
        if (!this.menu) return;
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y - 50}px`;
        this.menu.classList.remove('hidden');
        this.menu.classList.add('animate-pop');
    },

    hideMenu() {
        if (!this.menu) return;
        this.menu.classList.add('hidden');
        this.menu.classList.remove('animate-pop');
    },

    showActionMenu(x, y, span) {
        this.hideMenu();
        this.activeHighlightSpan = span;
        if (!this.actionMenu) return;
        this.actionMenu.style.left = `${x}px`;
        this.actionMenu.style.top = `${y - 45}px`;
        this.actionMenu.classList.remove('hidden');
        this.actionMenu.classList.add('animate-pop');
    },

    hideActionMenu() {
        if (!this.actionMenu) return;
        this.actionMenu.classList.add('hidden');
        this.activeHighlightSpan = null;
    },

    highlight(color) {
        if (!this.currentSelection) return;
        const span = document.createElement('span');
        span.className = `hl-${color} cursor-pointer rounded-sm px-0.5 transition-colors hover:brightness-95 highlight-item border-b-2 border-transparent hover:border-black/10`;
        span.onclick = (e) => {
            e.stopPropagation();
            const rect = span.getBoundingClientRect();
            this.showActionMenu(rect.left + rect.width / 2, rect.top, span);
        };
        try {
            this.currentSelection.surroundContents(span);
            window.getSelection().removeAllRanges();
            this.hideMenu();
        } catch (e) {
            alert("Vui lòng chọn văn bản nằm trong cùng một đoạn.");
        }
    },

    deleteHighlight() {
        if (this.activeHighlightSpan) {
            const span = this.activeHighlightSpan;
            const parent = span.parentNode;
            while (span.firstChild) parent.insertBefore(span.firstChild, span);
            parent.removeChild(span);
            this.hideActionMenu();
        }
    },

    openNoteInput() {
        if (!this.currentSelection) return;
        this.tempRange = this.currentSelection;
        const rect = this.tempRange.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        let leftPos = (rect.left + rect.width / 2) - 144;
        if (leftPos + 288 > viewportWidth) leftPos = viewportWidth - 300;
        if (leftPos < 10) leftPos = 10;
        this.noteEditor.style.left = `${leftPos}px`;
        this.noteEditor.style.top = `${rect.top + rect.height + 10}px`;
        this.noteEditor.classList.remove('hidden');
        this.noteInput.value = "";
        this.noteInput.focus();
        this.hideMenu();
    },

    closeNoteInput() {
        this.noteEditor.classList.add('hidden');
    },

    applyNote() {
        const text = this.noteInput.value.trim();
        if (!text || !this.tempRange) {
            this.closeNoteInput();
            return;
        }
        const originalText = this.tempRange.toString();
        const span = document.createElement('span');
        span.className = 'user-note hover:bg-blue-100 transition-colors';
        span.textContent = text;
        span.dataset.original = originalText;
        span.dataset.note = text;
        span.title = "Click để quản lý";
        span.onclick = (e) => {
            e.stopPropagation();
            this.manageNote(span);
        };
        try {
            this.tempRange.deleteContents();
            this.tempRange.insertNode(span);
        } catch (e) {
            alert("Lỗi khi chèn ghi chú.");
        }
        this.closeNoteInput();
        window.getSelection().removeAllRanges();
    },

    manageNote(span) {
        if (span.classList.contains('reverted')) {
            if (confirm("Hiển thị lại ghi chú của bạn?")) {
                span.textContent = span.dataset.note;
                span.classList.remove('reverted', 'line-through', 'opacity-70', 'decoration-slate-500');
                span.classList.add('user-note');
            }
        } else {
            const choice = prompt("Chọn thao tác:\n1. Hoàn tác (Hiện văn bản gốc)\n2. Xóa ghi chú vĩnh viễn", "1");
            if (choice === "1") {
                span.textContent = span.dataset.original;
                span.classList.add('reverted', 'line-through', 'opacity-70', 'decoration-slate-500');
                span.classList.remove('user-note');
            } else if (choice === "2") {
                const textNode = document.createTextNode(span.dataset.original);
                span.parentNode.replaceChild(textNode, span);
            }
        }
    }
};

// ============================================================================
// MAIN E-TEST APPLICATION
// ============================================================================
const app = {
    // --- State Management ---
    data: null,
    currentSectionIndex: 0,
    answers: {},
    timer: null,
    settingsOpen: false,
    questionToSectionMap: {},
    autoAdvanceTimeout: null,
    isReviewMode: false,
    reviewFilter: 'all',
    activeMobileTab: 'passage',

    // --- Firebase Data ---
    firebaseExams: [],
    firebaseLoaded: false,

    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    async init() {
        console.log('[E-test] Initializing application...');
        this.loadSettings();
        textTools.init();
        await this.loadExamsFromFirebase();
        this.goHome();
        this.setupOutsideClick();
        console.log('[E-test] Application initialized successfully');
    },

    async loadExamsFromFirebase() {
        try {
            if (window.firebaseEtest && typeof window.firebaseEtest.getAllEtestExams === 'function') {
                console.log('[E-test] Loading exams from Firebase...');
                const exams = await window.firebaseEtest.getAllEtestExams();
                this.firebaseExams = Array.isArray(exams) ? exams : [];
                this.firebaseLoaded = true;
                console.log('[E-test] Successfully loaded', this.firebaseExams.length, 'exams from Firebase');
            } else {
                console.warn('[E-test] Firebase API not available');
                this.firebaseExams = [];
                this.firebaseLoaded = false;
            }
        } catch (error) {
            console.error('[E-test] Failed to load exams from Firebase:', error);
            this.firebaseExams = [];
            this.firebaseLoaded = false;
        }
    },

    // ========================================================================
    // SETTINGS & UI CONTROLS
    // ========================================================================
    setupOutsideClick() {
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('settings-panel');
            const btn = document.getElementById('btn-settings');
            if (this.settingsOpen && !panel.contains(e.target) && !btn.contains(e.target)) {
                this.toggleSettings(e);
            }
        });
    },

    loadSettings() {
        const fs = localStorage.getItem('fontSize') || 16;
        this.setFontSize(fs);
        const rangeInput = document.querySelector('input[type="range"]');
        if (rangeInput) rangeInput.value = fs;
        if (localStorage.getItem('theme') === 'dark') {
            document.documentElement.classList.add('dark');
        }
    },

    toggleSettings(e) {
        if (e) e.stopPropagation();
        this.settingsOpen = !this.settingsOpen;
        const panel = document.getElementById('settings-panel');
        panel.classList.toggle('hidden', !this.settingsOpen);
        if (this.settingsOpen) panel.classList.add('animate-pop');
    },

    toggleDarkMode() {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    },

    setFontSize(val) {
        document.documentElement.style.setProperty('--content-size', `${val}px`);
        const fontSizeDisplay = document.getElementById('font-size-val');
        if (fontSizeDisplay) fontSizeDisplay.innerText = `${val}px`;
        localStorage.setItem('fontSize', val);
    },

    setLineHeight(val) {
        document.documentElement.style.setProperty('--line-height', val);
        const lineHeightDisplay = document.getElementById('line-height-val');
        if (lineHeightDisplay) lineHeightDisplay.innerText = val;
    },

    // ========================================================================
    // NAVIGATION
    // ========================================================================
    goHome() {
        clearInterval(this.timer);
        this.isReviewMode = false;
        document.body.classList.remove('review-mode');
        this.hideExamUI();
        const tpl = document.getElementById('tpl-home');
        if (tpl) {
            document.getElementById('app-container').innerHTML = tpl.innerHTML;
        }
    },

    hideExamUI() {
        const elements = [
            'exam-timer',
            'section-progress',
            'btn-submit',
            'bottom-nav',
            'review-filters',
            'btn-close-review'
        ];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
    },

    // ========================================================================
    // EXAM LIST DISPLAY
    // ========================================================================
    showExamList(type) {
        let exams = [];

        // Load from Firebase only - no fallback to hard-coded data
        if (this.firebaseLoaded && this.firebaseExams.length > 0) {
            exams = this.firebaseExams
                .filter(ex => ex.examType === type)
                .map(ex => ({
                    id: ex.id,
                    title: ex.title || 'Đề thi không tên',
                    // Firebase stores time in minutes, display in minutes
                    duration: `${ex.time || 45} phút`,
                    count: this.countQuestions(ex.sections)
                }));
        }

        let html = `
            <div class="max-w-4xl mx-auto px-4 py-6 lg:py-10 animate-fade-in">
                <button onclick="app.goHome()" class="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 font-medium transition-colors">
                    <i class="ph-bold ph-arrow-left"></i> Quay lại
                </button>
                <h2 class="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mb-6">Chọn đề thi</h2>
                <div class="space-y-4">
        `;

        if (exams.length === 0) {
            html += `
                <div class="text-center py-16">
                    <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <i class="ph-bold ph-files text-3xl text-slate-400"></i>
                    </div>
                    <p class="text-slate-500 dark:text-slate-400 text-lg">Chưa có đề thi nào</p>
                    <p class="text-slate-400 dark:text-slate-500 text-sm mt-2">Hãy tạo đề thi mới từ trang Admin</p>
                </div>
            `;
        } else {
            exams.forEach(ex => {
                html += `
                    <div onclick="app.startExam('${ex.id}')" 
                         class="bg-white dark:bg-slate-800 p-5 lg:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                        <div class="flex justify-between items-center">
                            <div>
                                <h3 class="font-bold text-base lg:text-lg text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    ${ex.title}
                                </h3>
                                <div class="flex items-center gap-3 mt-2 text-xs lg:text-sm text-slate-500 dark:text-slate-400">
                                    <span class="flex items-center gap-1">
                                        <i class="ph-fill ph-clock"></i> ${ex.duration}
                                    </span>
                                    <span class="flex items-center gap-1">
                                        <i class="ph-fill ph-list-numbers"></i> ${ex.count} câu
                                    </span>
                                </div>
                            </div>
                            <div class="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <i class="ph-bold ph-caret-right"></i>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div></div>`;
        document.getElementById('app-container').innerHTML = html;
    },

    // Helper function to count questions across sections
    countQuestions(sections) {
        if (!Array.isArray(sections)) return 0;
        return sections.reduce((sum, s) => sum + (Array.isArray(s.questions) ? s.questions.length : 0), 0);
    },

    // ========================================================================
    // START EXAM
    // ========================================================================
    startExam(id) {
        let examData = null;

        // Find exam in Firebase data
        if (this.firebaseLoaded && this.firebaseExams.length > 0) {
            const firebaseExam = this.firebaseExams.find(ex => ex.id === id);
            if (firebaseExam) {
                examData = {
                    title: firebaseExam.title || 'Đề thi',
                    // IMPORTANT: Firebase stores time in MINUTES, timer needs SECONDS
                    time: (firebaseExam.time || 45) * 60,
                    sections: this.normalizeExamSections(firebaseExam.sections)
                };
            }
        }

        // Check if exam was found
        if (!examData) {
            console.error('[E-test] Exam not found:', id);
            alert('Không tìm thấy đề thi. Vui lòng thử lại.');
            this.goHome();
            return;
        }

        // Set exam data and reset state
        this.data = examData;
        this.answers = {};
        this.currentSectionIndex = 0;
        this.isReviewMode = false;
        document.body.classList.remove('review-mode');

        // Build question to section mapping
        this.questionToSectionMap = {};
        let totalQs = 0;
        this.data.sections.forEach((sec, idx) => {
            sec.questions.forEach(q => {
                this.questionToSectionMap[q.id] = idx;
                totalQs++;
            });
        });

        // Show exam UI elements
        this.showExamUI(totalQs);

        // Start timer and render
        this.startTimer(this.data.time);
        this.renderSection();
        this.renderGlobalBottomNav();
    },

    // Normalize sections from Firebase format to display format
    normalizeExamSections(sections) {
        if (!Array.isArray(sections)) return [];
        return sections.map(s => ({
            title: s.title || 'Section',
            type: s.type || 'multiple_choice',
            content: s.content || '',
            questions: this.normalizeQuestions(s.questions)
        }));
    },

    // Normalize questions from Firebase format
    normalizeQuestions(questions) {
        if (!Array.isArray(questions)) return [];
        return questions.map(q => ({
            id: q.id,
            text: q.text || '',
            instruction: q.instruction || '',
            options: Array.isArray(q.options) ? q.options : [],
            ans: q.ans || 'A'
        }));
    },

    showExamUI(totalQuestions) {
        const sectionProgress = document.getElementById('section-progress');
        const examTimer = document.getElementById('exam-timer');
        const btnSubmit = document.getElementById('btn-submit');
        const bottomNav = document.getElementById('bottom-nav');
        const totalCountEl = document.getElementById('total-count');

        if (sectionProgress) {
            sectionProgress.classList.remove('hidden');
            sectionProgress.classList.add('flex');
        }
        if (examTimer) examTimer.classList.remove('hidden');
        if (btnSubmit) btnSubmit.classList.remove('hidden');
        if (bottomNav) {
            bottomNav.classList.remove('hidden');
            bottomNav.classList.add('flex');
        }
        if (totalCountEl) totalCountEl.innerText = totalQuestions;
    },

    // ========================================================================
    // TIMER
    // ========================================================================
    startTimer(seconds) {
        const el = document.getElementById('timer-display');
        if (!el) return;

        let remaining = seconds;
        const updateDisplay = () => {
            const m = Math.floor(remaining / 60).toString().padStart(2, '0');
            const s = (remaining % 60).toString().padStart(2, '0');
            el.innerText = `${m}:${s}`;
        };

        updateDisplay(); // Show initial time

        this.timer = setInterval(() => {
            remaining--;
            updateDisplay();
            if (remaining <= 0) {
                clearInterval(this.timer);
                this.openSubmitModal();
            }
        }, 1000);
    },

    // ========================================================================
    // MOBILE SPLIT VIEW
    // ========================================================================
    toggleMobileSplitTab(tab) {
        this.activeMobileTab = tab;
        const left = document.getElementById('left-pane');
        const right = document.getElementById('right-pane');
        const btnPassage = document.getElementById('tab-btn-passage');
        const btnQuestion = document.getElementById('tab-btn-question');

        if (!left || !right) return;

        if (tab === 'passage') {
            left.classList.remove('hidden');
            left.classList.add('block');
            right.classList.add('hidden');
            right.classList.remove('block');
            if (btnPassage) btnPassage.classList.add('mobile-tab-active');
            if (btnQuestion) btnQuestion.classList.remove('mobile-tab-active');
        } else {
            left.classList.add('hidden');
            left.classList.remove('block');
            right.classList.remove('hidden');
            right.classList.add('block');
            if (btnPassage) btnPassage.classList.remove('mobile-tab-active');
            if (btnQuestion) btnQuestion.classList.add('mobile-tab-active');
        }
    },

    // ========================================================================
    // SECTION RENDERING
    // ========================================================================
    renderSection() {
        const section = this.data.sections[this.currentSectionIndex];
        const sectionTitleDisplay = document.getElementById('section-title-display');
        if (sectionTitleDisplay) {
            sectionTitleDisplay.innerText = `Phần ${this.currentSectionIndex + 1}: ${section.title}`;
        }

        let html = '';

        if (section.type === 'reading' || section.type === 'gap_fill') {
            html = this.renderSplitView(section);
        } else {
            html = this.renderSimpleView(section);
        }

        document.getElementById('app-container').innerHTML = html;

        // Initialize split view if applicable
        if (section.type === 'reading' || section.type === 'gap_fill') {
            this.activeMobileTab = 'passage';
            this.toggleMobileSplitTab('passage');
            this.initResizer();
        }

        // Re-render MathJax if available
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise();
        }
    },

    renderSplitView(section) {
        const mobileTabs = `
            <div class="flex lg:hidden sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 w-full">
                <button id="tab-btn-passage" onclick="app.toggleMobileSplitTab('passage')" 
                        class="flex-1 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 mobile-tab-active transition-all">
                    Đoạn văn
                </button>
                <button id="tab-btn-question" onclick="app.toggleMobileSplitTab('question')" 
                        class="flex-1 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 transition-all">
                    Câu hỏi (${section.questions.length})
                </button>
            </div>
        `;

        return `
            <div class="h-full flex flex-col animate-fade-in" id="split-container">
                ${mobileTabs}
                <div class="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                    <!-- Left Pane: Passage -->
                    <div class="w-full lg:w-1/2 h-full overflow-y-auto custom-scroll bg-white dark:bg-slate-800 p-4 lg:p-8 passage-content relative shadow-inner block" id="left-pane">
                        <div class="dynamic-text text-justify prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 pb-20 lg:pb-0">
                            ${section.content}
                        </div>
                        <div class="mt-8 text-center text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700 lg:hidden">
                            (Chuyển tab để xem câu hỏi)
                        </div>
                    </div>
                    
                    <!-- Resizer (Desktop Only) -->
                    <div class="resizer hidden lg:flex" id="drag-handle"></div>
                    
                    <!-- Right Pane: Questions -->
                    <div class="w-full lg:flex-1 h-full overflow-y-auto custom-scroll bg-slate-50 dark:bg-slate-900 p-4 lg:p-8 pb-24 hidden lg:block" id="right-pane">
                        <div class="max-w-2xl mx-auto space-y-4 lg:space-y-6">
                            ${this.renderQuestionsWithInstructions(section.questions)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderSimpleView(section) {
        return `
            <div class="h-full overflow-y-auto custom-scroll bg-slate-50 dark:bg-slate-900 p-4 lg:p-8 pb-24 animate-fade-in">
                <div class="max-w-3xl mx-auto space-y-4 lg:space-y-6">
                    ${this.renderQuestionsWithInstructions(section.questions)}
                </div>
            </div>
        `;
    },

    initResizer() {
        const resizer = document.getElementById('drag-handle');
        const leftPane = document.getElementById('left-pane');
        const container = document.getElementById('split-container');
        if (!resizer || !leftPane || !container) return;

        let isResizing = false;

        resizer.addEventListener('mousedown', () => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const containerRect = container.getBoundingClientRect();
            const newWidth = e.clientX - containerRect.left;
            if (newWidth > containerRect.width * 0.2 && newWidth < containerRect.width * 0.8) {
                leftPane.style.width = `${(newWidth / containerRect.width) * 100}%`;
            }
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });
    },

    // Helper: Render questions with instruction headers
    renderQuestionsWithInstructions(questions) {
        let html = '';
        let lastInstruction = null;

        questions.forEach(q => {
            // Render instruction header if it changes and is not empty
            if (q.instruction && q.instruction.trim() !== '' && q.instruction !== lastInstruction) {
                // Add separator if not the first item
                if (html !== '') {
                    html += `<div class="w-full h-px bg-slate-200 dark:bg-slate-700 my-8 flex items-center justify-center relative">
                        <span class="bg-slate-50 dark:bg-slate-900 px-4 text-xs text-slate-400 font-medium tracking-wider uppercase">Phần tiếp theo</span>
                    </div>`;
                }

                html += `
                    <div class="bg-indigo-50/80 dark:bg-indigo-900/20 border-l-[6px] border-indigo-500 pl-4 py-1 pr-4 rounded-r-xl mb-6 mt-8 lg:mt-10 backdrop-blur-sm first:mt-0 shadow-sm">
                        <div class="flex items-start gap-3">
                            <span class="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300 mt-0.5 shrink-0">
                                <i class="ph-bold ph-info text-sm"></i>
                            </span>
                            <div>
                                <h4 class="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Yêu cầu</h4>
                                <p class="text-sm lg:text-base font-semibold text-indigo-900 dark:text-indigo-100 leading-relaxed">
                                    ${q.instruction}
                                </p>
                            </div>
                        </div>
                    </div>
                `;
                lastInstruction = q.instruction;
            } else if (!q.instruction || q.instruction.trim() === '') {
                // Reset lastInstruction if current question has no instruction, 
                // to ensure next valid instruction is rendered even if same as previous non-adjacent one (edge case)
                // But typically instructions are grouped. 
                // If we want "no instruction" to break the group, we set to null.
                // Let's assume blank instruction means "continue previous" OR "no instruction".
                // For now, let's treat blank as "no instruction" effectively, but not clearing state could be safer for grouping.
                // Actually, if a question has NO instruction, we probably shouldn't show a header. 
                // If it follows a question WITH instruction, we might assume it belongs to the same group IF we were inferring.
                // But here we are explicit. If q.instruction is missing, do nothing.
            }

            html += this.renderQuestionCard(q);
        });

        return html;
    },

    // ========================================================================
    // QUESTION CARD RENDERING
    // ========================================================================
    renderQuestionCard(q) {
        const saved = this.answers[q.id];
        let cardClass = "";
        let statusIcon = "";
        let explanation = "";
        let shouldHide = false;

        if (this.isReviewMode) {
            const isCorrect = saved === q.ans;
            if (this.reviewFilter === 'correct' && !isCorrect) shouldHide = true;
            if (this.reviewFilter === 'incorrect' && isCorrect) shouldHide = true;
            if (shouldHide) return '';

            if (isCorrect) {
                cardClass = "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10";
                statusIcon = `<i class="ph-fill ph-check-circle text-green-500 text-lg lg:text-xl"></i>`;
            } else {
                cardClass = "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10";
                statusIcon = `<i class="ph-fill ph-x-circle text-red-500 text-lg lg:text-xl"></i>`;
            }
            explanation = `
                <div class="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs lg:text-sm">
                    <span class="font-bold text-slate-700 dark:text-slate-300">Đáp án:</span> 
                    <span class="text-green-600 font-bold">${q.ans}</span>
                </div>
            `;
        }

        const optionsHtml = q.options.map(opt => {
            const val = opt.charAt(0);
            const isChecked = saved === val;
            let optionClass = "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700";
            let circleClass = "border-slate-300 dark:border-slate-500 text-slate-500 dark:text-slate-400";

            if (this.isReviewMode) {
                if (val === q.ans) {
                    optionClass = "correct-option border-green-500";
                    circleClass = "bg-green-600 border-green-600 text-white";
                } else if (isChecked && val !== q.ans) {
                    optionClass = "wrong-option border-red-500";
                    circleClass = "bg-red-500 border-red-500 text-white";
                } else {
                    optionClass = "opacity-50";
                }
            }

            const checkedAttr = isChecked ? 'checked' : '';
            const disabledAttr = this.isReviewMode ? 'disabled' : '';

            return `
                <label class="cursor-pointer group relative ${this.isReviewMode ? 'cursor-default' : ''}">
                    <input type="radio" name="q${q.id}" value="${val}" ${checkedAttr} ${disabledAttr}
                        class="peer sr-only option-radio" onchange="app.saveAnswer(${q.id}, '${val}')">
            <div class="p-3 lg:p-3.5 rounded-xl border transition-all duration-200 flex items-center gap-3 shadow-sm ${optionClass}">
                <span class="option-circle w-5 h-5 lg:w-6 lg:h-6 rounded-full border-2 flex items-center justify-center text-[9px] lg:text-[10px] font-bold transition-all duration-200 ${circleClass}">
                    ${val}
                </span>
                <span class="text-xs lg:text-sm font-medium text-slate-700 dark:text-slate-300">
                    ${opt.substring(3)}
                </span>
            </div>
        </label>
`;
        }).join('');

        return `
            <div class="bg-white dark:bg-slate-800 p-4 lg:p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200 dark:border-slate-700 dynamic-text group/card ${cardClass}" id="q-${q.id}">
                <div class="flex justify-between items-start mb-3 lg:mb-4">
                    <div class="flex gap-3 lg:gap-4">
                        <span class="flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs lg:text-sm shadow-sm">
                            ${q.id}
                        </span>
                        <div class="font-medium pt-1 text-slate-800 dark:text-slate-200 leading-relaxed">
                            ${q.text}
                        </div>
                    </div>
                    ${statusIcon}
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3 pl-0 lg:pl-12">
                    ${optionsHtml}
                </div>
                ${explanation}
            </div>
    `;
    },

    // ========================================================================
    // BOTTOM NAVIGATION
    // ========================================================================
    renderGlobalBottomNav() {
        const container = document.getElementById('question-bubbles');
        if (!container) return;

        let html = '';
        this.data.sections.forEach(section => {
            section.questions.forEach(q => {
                const isDone = this.answers[q.id];
                const isCorrect = isDone === q.ans;
                let bubbleClass = "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500";

                if (this.isReviewMode) {
                    if (isCorrect) {
                        bubbleClass = "bg-green-500 border-green-500 text-white";
                    } else if (isDone) {
                        bubbleClass = "bg-red-500 border-red-500 text-white";
                    } else {
                        bubbleClass = "bg-slate-300 dark:bg-slate-700 border-transparent text-slate-500";
                    }
                } else {
                    if (isDone) {
                        bubbleClass = "bg-blue-600 text-white border-blue-600 scale-105 shadow-md";
                    }
                }

                html += `
                    <button id="bubble-${q.id}" onclick="app.jumpToQuestion(${q.id})"
                        class="flex-shrink-0 w-8 h-8 lg:w-9 lg:h-9 rounded-full border ${bubbleClass} text-[10px] lg:text-xs font-bold transition-all duration-200 shadow-sm hover:shadow-md active:scale-95">
                        ${q.id}
                    </button>
    `;
            });
        });
        container.innerHTML = html;
    },

    // ========================================================================
    // ANSWER HANDLING
    // ========================================================================
    saveAnswer(qid, val) {
        if (this.isReviewMode) return;
        this.answers[qid] = val;
        this.renderGlobalBottomNav();
        const completedCount = document.getElementById('completed-count');
        if (completedCount) completedCount.innerText = Object.keys(this.answers).length;
        this.checkAutoAdvance();
    },

    checkAutoAdvance() {
        if (this.autoAdvanceTimeout) clearTimeout(this.autoAdvanceTimeout);
        const currentSection = this.data.sections[this.currentSectionIndex];
        const allAnswered = currentSection.questions.every(q => this.answers[q.id]);
        if (allAnswered && this.currentSectionIndex < this.data.sections.length - 1) {
            this.autoAdvanceTimeout = setTimeout(() => {
                this.nextSection();
            }, 2000);
        }
    },

    // ========================================================================
    // SECTION NAVIGATION
    // ========================================================================
    nextSection() {
        if (this.currentSectionIndex < this.data.sections.length - 1) {
            this.currentSectionIndex++;
            this.renderSection();
        }
    },

    prevSection() {
        if (this.currentSectionIndex > 0) {
            this.currentSectionIndex--;
            this.renderSection();
        }
    },

    jumpToQuestion(qid) {
        const targetSectionIdx = this.questionToSectionMap[qid];

        // On mobile & in split view, switch to question tab
        if (window.innerWidth < 1024) {
            const targetSection = this.data.sections[targetSectionIdx];
            if (targetSection && (targetSection.type === 'reading' || targetSection.type === 'gap_fill')) {
                this.activeMobileTab = 'question';
            }
        }

        if (targetSectionIdx !== this.currentSectionIndex) {
            this.currentSectionIndex = targetSectionIdx;
            this.renderSection();
            if (this.activeMobileTab === 'question') this.toggleMobileSplitTab('question');
            setTimeout(() => this.scrollToQ(qid), 100);
        } else {
            if (this.activeMobileTab === 'question') this.toggleMobileSplitTab('question');
            this.scrollToQ(qid);
        }
    },

    scrollToQ(qid) {
        const el = document.getElementById(`q-${qid}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-blue-400');
            setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 2000);
        }
    },

    // ========================================================================
    // SUBMIT & RESULTS
    // ========================================================================
    openSubmitModal() {
        const modal = document.getElementById('submit-modal-overlay');
        if (!modal) return;
        modal.classList.remove('hidden');

        const answeredCount = document.getElementById('modal-answered-count');
        const totalCount = document.getElementById('modal-total-count');

        if (answeredCount) answeredCount.innerText = Object.keys(this.answers).length;
        if (totalCount) {
            let total = 0;
            this.data.sections.forEach(s => total += s.questions.length);
            totalCount.innerText = total;
        }
    },

    closeSubmitModal() {
        const modal = document.getElementById('submit-modal-overlay');
        if (modal) modal.classList.add('hidden');
    },

    confirmSubmit() {
        this.closeSubmitModal();
        clearInterval(this.timer);

        let correctCount = 0;
        let totalCount = 0;
        this.data.sections.forEach(s => {
            s.questions.forEach(q => {
                totalCount++;
                if (this.answers[q.id] === q.ans) correctCount++;
            });
        });

        const score = ((correctCount / totalCount) * 10).toFixed(2);
        const skipped = totalCount - Object.keys(this.answers).length;
        const wrong = totalCount - correctCount - skipped;

        this.hideExamUI();
        const tpl = document.getElementById('tpl-result');
        if (tpl) {
            document.getElementById('app-container').innerHTML = tpl.innerHTML;
        }

        const resultScore = document.getElementById('result-score');
        const resultCorrect = document.getElementById('result-correct');
        const resultWrong = document.getElementById('result-wrong');
        const resultSkipped = document.getElementById('result-skipped');

        if (resultScore) resultScore.innerText = score;
        if (resultCorrect) resultCorrect.innerText = correctCount;
        if (resultWrong) resultWrong.innerText = wrong;
        if (resultSkipped) resultSkipped.innerText = skipped;
    },

    // ========================================================================
    // REVIEW MODE
    // ========================================================================
    reviewExam() {
        this.isReviewMode = true;
        this.reviewFilter = 'all';
        document.body.classList.add('review-mode');

        // Hide exam controls, show review controls
        const examTimer = document.getElementById('exam-timer');
        const btnSubmit = document.getElementById('btn-submit');
        const sectionProgress = document.getElementById('section-progress');
        const reviewFilters = document.getElementById('review-filters');
        const btnCloseReview = document.getElementById('btn-close-review');
        const bottomNav = document.getElementById('bottom-nav');

        if (examTimer) examTimer.classList.add('hidden');
        if (btnSubmit) btnSubmit.classList.add('hidden');
        if (sectionProgress) sectionProgress.classList.add('hidden');
        if (reviewFilters) {
            reviewFilters.classList.remove('hidden');
            reviewFilters.classList.add('flex');
        }
        if (btnCloseReview) btnCloseReview.classList.remove('hidden');
        if (bottomNav) {
            bottomNav.classList.remove('hidden');
            bottomNav.classList.add('flex');
        }

        this.currentSectionIndex = 0;
        this.renderSection();
        this.renderGlobalBottomNav();
    },

    setReviewFilter(filter) {
        this.reviewFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-blue-600', 'text-white');
            btn.classList.add('text-slate-500');
            const btnText = btn.innerText.toLowerCase();
            const shouldActivate =
                (filter === 'all' && btnText.includes('tất cả')) ||
                (filter === 'correct' && btnText.includes('đúng')) ||
                (filter === 'incorrect' && btnText.includes('sai'));
            if (shouldActivate) {
                btn.classList.add('active');
                btn.classList.remove('text-slate-500');
            }
        });
        this.renderSection();
    }
};

// ============================================================================
// EXPOSE APP GLOBALLY
// This is needed because module scripts in index.html can't access local variables
// ============================================================================
window.app = app;
