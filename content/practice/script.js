// --- Tailwind Configuration ---
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                question: ['"Be Vietnam Pro"', 'sans-serif'],
            },
            colors: {
                primary: '#2563eb',
                secondary: '#475569',
                background: '#f8fafc',
                correct: '#10b981', // Emerald 500
                wrong: '#ef4444',   // Red 500
            },
            boxShadow: {
                'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                'glow': '0 0 15px rgba(37, 99, 235, 0.2)',
            }
        }
    }
}

// --- Music Feature ---
const DEFAULT_MUSIC_TRACKS = [
    { url: 'https://www.youtube.com/watch?v=JdqL89ZZwFw', title: 'Quiet - Lofi Hip Hop Summer', author: 'LOFI KEEP YOU SAFE' },
    { url: 'https://www.youtube.com/watch?v=PLLRRXURicM&list=RDPLLRRXURicM&start_radio=1', title: 'Japan Coastal Vibes', author: 'Calm City' },
    { url: 'https://www.youtube.com/watch?v=08oD5oJb6Rk&list=RD08oD5oJb6Rk&start_radio=1', title: 'Peaceful Medieval Celtic', author: 'Olde World Melodies' },
    { url: 'https://www.youtube.com/watch?v=VRcPypm6YWo&list=RDVRcPypm6YWo&start_radio=1', title: 'Deep Focus | Calm Ambient', author: 'Deep Focus Sphere – Focus, Relax & Study Music' },
    { url: 'https://www.youtube.com/watch?v=0w80F8FffQ4&list=RD0w80F8FffQ4&start_radio=1', title: 'Zero Distractions', author: 'Cosmic Hippo' },
    { url: 'https://www.youtube.com/watch?v=RG2IK8oRZNA', title: 'ADHD Relief Music', author: 'Greenred Productions - Relaxing Music' },
    { url: 'https://www.youtube.com/watch?v=JdqL89ZZwFw', title: 'Quiet - Lofi Hip Hop Summer', author: 'LOFI KEEP YOU SAFE' },
    { url: 'https://www.youtube.com/watch?v=OkNo_N85em0&list=RDOkNo_N85em0&start_radio=1', title: 'some peace for hard nights...', author: 'Drift Away Ambience' },
    { url: 'https://www.youtube.com/watch?v=gUbNlN_SqpE&list=RDgUbNlN_SqpE&start_radio=1', title: 'Seaside Coffee', author: 'Healing Me' },
    { url: 'https://www.youtube.com/watch?v=lriMaWESbuU&list=RDlriMaWESbuU&start_radio=1', title: 'pluggnb instrumental mix', author: 'geekum' },
    { url: 'https://www.youtube.com/watch?v=WPni755-Krg&list=RDWPni755-Krg&start_radio=1&t=83s', title: 'Study Music Alpha Waves', author: '☯161' },
    { url: 'https://www.youtube.com/watch?v=qQzf-xzZO7M&list=RDqQzf-xzZO7M&start_radio=1', title: 'Exam Study Music', author: 'Study Sonic Focus' },
    { url: 'https://www.youtube.com/watch?v=yIQd2Ya0Ziw', title: 'Rainstorm Sounds for Relaxing', author: 'Calm' },
    { url: 'https://www.youtube.com/watch?v=mPZkdNFkNps', title: 'Rain Sound On Window with Thunder Sounds', author: 'Relaxing Ambience ASMR' }
];
const MUSIC_STORAGE_KEY = 'studyStation_musicTracks';

const musicPlayer = {
    baseTracks: [],
    customTracks: [],
    tracks: [],
    currentIndex: 0,
    refs: {},
    player: null,
    playerReady: false,
    apiReady: false,
    pendingActions: [],
    isPanelVisible: false,
    isPlaying: false,
    miniForced: false,

    init() {
        this.refs = {
            panel: document.getElementById('music-panel'),
            toggleBtn: document.getElementById('music-toggle-btn'),
            hideBtn: document.getElementById('music-hide-btn'),
            stopBtn: document.getElementById('music-stop-btn'),
            prevBtn: document.getElementById('music-prev-btn'),
            nextBtn: document.getElementById('music-next-btn'),
            playBtn: document.getElementById('music-play-btn'),
            volumeInput: document.getElementById('music-volume'),
            volumeLabel: document.getElementById('music-volume-label'),
            trackList: document.getElementById('music-track-list'),
            currentTitle: document.getElementById('music-current-title'),
            currentSource: document.getElementById('music-current-source'),
            addForm: document.getElementById('music-add-form'),
            addInput: document.getElementById('music-link-input'),
            feedback: document.getElementById('music-feedback'),
            resetBtn: document.getElementById('music-reset-btn'),
            placeholder: document.getElementById('music-player-placeholder'),
            badge: document.getElementById('music-badge'),
            overlay: document.getElementById('music-overlay'),
            mini: document.getElementById('music-mini-player'),
            miniPlay: document.getElementById('music-mini-play'),
            miniTitle: document.getElementById('music-mini-title'),
            miniOpen: document.getElementById('music-mini-open'),
            miniClose: document.getElementById('music-mini-close')
        };

        if (!this.refs.panel) return;

        this.baseTracks = DEFAULT_MUSIC_TRACKS.map(track => this.enrichTrack(track)).filter(Boolean);
        this.customTracks = this.loadCustomTracks().map(track => this.enrichTrack(track)).filter(Boolean);
        this.tracks = [...this.baseTracks, ...this.customTracks];

        this.bindEvents();
        this.renderTrackList();
        this.updateCurrentTrackInfo();
    },

    bindEvents() {
        this.refs.toggleBtn?.addEventListener('click', () => this.togglePanel());
        this.refs.hideBtn?.addEventListener('click', () => this.hidePanel());
        this.refs.stopBtn?.addEventListener('click', () => {
            this.stopPlayback();
            if (this.refs.panel) this.refs.panel.classList.add('hidden');
            this.isPanelVisible = false;
            this.refs.overlay?.classList.add('hidden');
        });
        this.refs.prevBtn?.addEventListener('click', () => this.previousTrack());
        this.refs.nextBtn?.addEventListener('click', () => this.nextTrack());
        this.refs.playBtn?.addEventListener('click', () => this.togglePlayPause());
        this.refs.volumeInput?.addEventListener('input', (e) => this.setVolume(parseInt(e.target.value, 10)));
        this.refs.addForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const value = this.refs.addInput.value.trim();
            if (!value) {
                this.displayFeedback('Hãy dán link YouTube trước khi thêm.', 'error');
                return;
            }
            this.handleAddTrack(value);
        });
        this.refs.resetBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.customTracks = [];
            this.saveCustomTracks();
            this.rebuildTrackList();
            this.displayFeedback('Đã khôi phục danh sách mặc định.', 'success');
        });
        this.refs.miniPlay?.addEventListener('click', () => this.togglePlayPause());
        this.refs.miniOpen?.addEventListener('click', () => this.togglePanel(true));
        this.refs.miniClose?.addEventListener('click', () => {
            this.stopPlayback();
            this.hideMiniPlayer();
        });
        this.refs.overlay?.addEventListener('click', () => this.hidePanel());
    },

    enrichTrack(track) {
        if (!track) return null;
        const existingUrl = track.url || (track.videoId ? `https://www.youtube.com/watch?v=${track.videoId}` : '');
        const videoId = track.videoId || this.extractVideoId(existingUrl || '');
        if (!videoId) return null;
        const url = existingUrl || `https://www.youtube.com/watch?v=${videoId}`;
        return { ...track, videoId, url };
    },

    showMiniPlayer(force = false) {
        if (!this.refs.mini) return;
        if (force) this.miniForced = true;
        if (!force && !this.isPlaying) return;
        this.updateMiniInfo();
        this.refs.mini.classList.remove('hidden');
    },

    hideMiniPlayer() {
        if (!this.refs.mini) return;
        this.refs.mini.classList.add('hidden');
        this.miniForced = false;
    },

    updateMiniInfo() {
        if (!this.refs.miniTitle) return;
        const track = this.tracks[this.currentIndex];
        this.refs.miniTitle.textContent = track ? track.title : 'Chưa chọn bài hát';
        this.updateMiniPlayButton();
    },

    updateMiniPlayButton() {
        if (!this.refs.miniPlay) return;
        this.refs.miniPlay.innerHTML = this.isPlaying
            ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>`;
    },

    togglePanel(force) {
        if (!this.refs.panel) return;
        const shouldShow = typeof force === 'boolean' ? force : this.refs.panel.classList.contains('hidden');
        if (shouldShow) {
            this.refs.panel.classList.remove('hidden');
            this.isPanelVisible = true;
            this.refs.overlay?.classList.remove('hidden');
            this.hideMiniPlayer();
        } else {
            this.refs.panel.classList.add('hidden');
            this.isPanelVisible = false;
            this.refs.overlay?.classList.add('hidden');
            this.showMiniPlayer(true);
        }
    },

    hidePanel() {
        if (!this.refs.panel) return;
        this.refs.panel.classList.add('hidden');
        this.isPanelVisible = false;
        this.refs.overlay?.classList.add('hidden');
        this.showMiniPlayer(true);
    },

    loadCustomTracks() {
        try {
            const saved = localStorage.getItem(MUSIC_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.warn('Không thể đọc danh sách nhạc đã lưu.', error);
            return [];
        }
    },

    saveCustomTracks() {
        try {
            localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(this.customTracks));
        } catch (error) {
            console.warn('Không thể lưu danh sách nhạc.', error);
        }
    },

    renderTrackList() {
        if (!this.refs.trackList) return;
        this.refs.trackList.innerHTML = '';
        if (!this.tracks.length) {
            this.refs.trackList.innerHTML = '<p class="text-sm text-slate-500 dark:text-slate-400">Chưa có bài hát nào.</p>';
            return;
        }
        this.tracks.forEach((track, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `w-full text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm hover:border-blue-400 dark:hover:border-blue-400 transition-colors ${index === this.currentIndex ? 'bg-blue-50 dark:bg-slate-800 border-blue-300 dark:border-blue-500 text-blue-700 dark:text-blue-200' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`;
            button.innerHTML = `<div class="font-semibold truncate">${track.title}</div><p class="text-xs text-slate-400 dark:text-slate-500 truncate">${track.author || 'YouTube'}</p>`;
            button.addEventListener('click', () => {
                this.currentIndex = index;
                this.updateCurrentTrackInfo();
                this.renderTrackList();
                this.playTrack(true);
                this.togglePanel(true);
            });
            this.refs.trackList.appendChild(button);
        });
    },

    updateCurrentTrackInfo() {
        const track = this.tracks[this.currentIndex];
        if (track) {
            if (this.refs.currentTitle) this.refs.currentTitle.textContent = track.title;
            if (this.refs.currentSource) this.refs.currentSource.textContent = track.author || 'YouTube';
        } else {
            if (this.refs.currentTitle) this.refs.currentTitle.textContent = 'Chưa chọn bài hát';
            if (this.refs.currentSource) this.refs.currentSource.textContent = 'Thêm bài hát để bắt đầu';
        }
        this.updateMiniInfo();
    },

    previousTrack() {
        if (!this.tracks.length) return;
        this.currentIndex = (this.currentIndex - 1 + this.tracks.length) % this.tracks.length;
        this.updateCurrentTrackInfo();
        this.renderTrackList();
        this.playTrack(true);
    },

    nextTrack() {
        if (!this.tracks.length) return;
        this.currentIndex = (this.currentIndex + 1) % this.tracks.length;
        this.updateCurrentTrackInfo();
        this.renderTrackList();
        this.playTrack(true);
    },

    togglePlayPause() {
        if (!this.playerReady) {
            this.playTrack(true);
            return;
        }
        const state = this.player.getPlayerState();
        if (state === window.YT?.PlayerState?.PLAYING) {
            this.player.pauseVideo();
        } else {
            this.player.playVideo();
        }
    },

    playTrack(autoPlay = false) {
        const track = this.tracks[this.currentIndex];
        if (!track) return;
        this.updateCurrentTrackInfo();
        this.renderTrackList();
        this.ensurePlayerReady(() => {
            if (autoPlay) {
                this.player.loadVideoById(track.videoId);
            } else {
                this.player.cueVideoById(track.videoId);
            }
            if (autoPlay) this.player.playVideo();
        });
    },

    stopPlayback() {
        if (!this.playerReady) return;
        this.player.stopVideo();
        this.setPlayingState(false);
        this.hideMiniPlayer();
    },

    setPlayingState(isPlaying) {
        this.isPlaying = isPlaying;
        if (this.refs.playBtn) {
            this.refs.playBtn.innerHTML = isPlaying
                ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg><span>Tạm dừng</span>`
                : `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg><span>Phát</span>`;
        }
        if (this.refs.badge) {
            this.refs.badge.classList.toggle('hidden', !isPlaying);
        }
        this.updateMiniPlayButton();
        if (isPlaying) {
            if (!this.isPanelVisible) this.showMiniPlayer();
        } else if (!this.miniForced) {
            this.hideMiniPlayer();
        }
    },

    setVolume(value) {
        if (this.refs.volumeLabel) this.refs.volumeLabel.textContent = `${value}%`;
        const applyVolume = () => {
            this.player.setVolume(value);
        };
        if (this.playerReady) applyVolume();
        else this.pendingActions.push(applyVolume);
    },

    handleAddTrack(url) {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            this.displayFeedback('Link YouTube không hợp lệ.', 'error');
            return;
        }
        this.displayFeedback('Đang lấy thông tin bài hát...', 'info');
        this.fetchVideoMeta(videoId)
            .then(meta => {
                const newTrack = this.enrichTrack({
                    videoId,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    title: meta.title || `Video ${videoId}`,
                    author: meta.author || 'YouTube'
                });
                if (this.tracks.find(t => t.videoId === videoId)) {
                    this.displayFeedback('Bài hát đã có trong danh sách.', 'error');
                    return;
                }
                if (newTrack) this.customTracks.push(newTrack);
                this.saveCustomTracks();
                this.rebuildTrackList(videoId);
                this.refs.addInput.value = '';
                this.displayFeedback('Đã thêm vào danh sách và phát ngay.', 'success');
                this.playTrack(true);
                this.togglePanel(true);
            })
            .catch(() => {
                this.displayFeedback('Không thể lấy thông tin bài hát. Vẫn sẽ thêm link.', 'info');
                const fallbackTrack = this.enrichTrack({
                    videoId,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    title: `Video ${videoId}`,
                    author: 'YouTube'
                });
                if (fallbackTrack) this.customTracks.push(fallbackTrack);
                this.saveCustomTracks();
                this.rebuildTrackList(videoId);
                this.refs.addInput.value = '';
                this.playTrack(true);
            });
    },

    rebuildTrackList(activeVideoId) {
        const activeId = activeVideoId || (this.tracks[this.currentIndex] && this.tracks[this.currentIndex].videoId);
        this.tracks = [...this.baseTracks, ...this.customTracks];
        const idx = this.tracks.findIndex(t => t.videoId === activeId);
        this.currentIndex = idx >= 0 ? idx : 0;
        this.renderTrackList();
        this.updateCurrentTrackInfo();
    },

    extractVideoId(url) {
        try {
            const reg = /(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?(?:.*&)?v=|embed\/))([\w-]{11})/;
            const match = url.match(reg);
            return match ? match[1] : null;
        } catch (error) {
            return null;
        }
    },

    async fetchVideoMeta(videoId) {
        const endpoint = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error('Meta fetch failed');
        const data = await res.json();
        return {
            title: data.title,
            author: data.author_name
        };
    },

    displayFeedback(message, type = 'info') {
        if (!this.refs.feedback) return;
        const colorMap = {
            success: 'text-emerald-500',
            error: 'text-rose-500',
            info: 'text-slate-500 dark:text-slate-400'
        };
        this.refs.feedback.className = `text-xs ${colorMap[type] || colorMap.info}`;
        this.refs.feedback.textContent = message;
        if (type !== 'info') {
            setTimeout(() => {
                if (this.refs.feedback?.textContent === message) {
                    this.refs.feedback.textContent = '';
                }
            }, 3000);
        }
    },

    ensurePlayerReady(callback) {
        if (this.playerReady && this.player) {
            callback();
            return;
        }
        this.pendingActions.push(callback);
        if (this.apiReady && !this.player) this.setupPlayer();
    },

    setupPlayer() {
        if (this.player || !window.YT || !document.getElementById('music-player')) return;
        this.player = new YT.Player('music-player', {
            height: '200',
            width: '320',
            playerVars: {
                rel: 0,
                controls: 0
            },
            events: {
                onReady: () => {
                    this.playerReady = true;
                    this.refs.placeholder?.classList.add('hidden');
                    if (this.refs.volumeInput) this.setVolume(parseInt(this.refs.volumeInput.value, 10));
                    while (this.pendingActions.length) {
                        const fn = this.pendingActions.shift();
                        try { fn(); } catch (error) { console.error(error); }
                    }
                },
                onStateChange: (event) => {
                    const PLAYING = window.YT.PlayerState.PLAYING;
                    const PAUSED = window.YT.PlayerState.PAUSED;
                    const ENDED = window.YT.PlayerState.ENDED;
                    if (event.data === PLAYING) {
                        this.setPlayingState(true);
                    } else if (event.data === PAUSED) {
                        this.setPlayingState(false);
                    } else if (event.data === ENDED) {
                        this.nextTrack();
                    }
                }
            }
        });
    }
};

window.musicPlayer = musicPlayer;

window.onYouTubeIframeAPIReady = function () {
    musicPlayer.apiReady = true;
    musicPlayer.setupPlayer();
};

// --- Dynamic Test Loading ---
const TESTS_BASE_PATH = 'tests';
const MANIFEST_PATH = `${TESTS_BASE_PATH}/manifest.json`;

// --- LOGIC ---
const app = {
    container: document.getElementById('app-container'),
    timerEl: document.getElementById('exam-timer'),
    currentExam: null, answers: {}, timerInterval: null, startTime: null, endTime: null,
    examResult: null, isReviewMode: false,
    subjects: {},
    examContentDB: {},
    subjectLoadError: null,
    testsBasePath: TESTS_BASE_PATH,
    // Statistics State
    stats: { attempts: {}, totalTime: 0 },

    // Step-by-Step Mode State
    stepMode: {
        active: false,           // Is step mode active
        currentIndex: 0,         // Current question index in queue
        questionQueue: [],       // Flattened list of all questions
        correctCount: 0,         // Number of correct answers
        skippedCount: 0,         // Number of skipped questions
        currentQuestion: null,   // Current question object
        selectedAnswer: null,    // Selected answer for current question
        tfAnswers: {},           // For Part 2 T/F sub-questions
        isChecked: false,        // Has current answer been checked
        isCorrect: false         // Is current answer correct
    },

    // Pending exam for mode selection
    pendingExam: { subId: null, examId: null, title: null },

    async init() {
        // Check if first visit - show theme selector modal
        const hasSelectedTheme = localStorage.getItem('studyStation_themeSelected');
        if (!hasSelectedTheme) {
            // Show theme selector modal for first-time visitors
            const themeModal = document.getElementById('theme-selector-modal');
            if (themeModal) {
                themeModal.classList.remove('hidden');
            }
            // Don't apply any theme yet - wait for user selection
        } else {
            // Theme Init (for returning visitors)
            if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark'); document.getElementById('dark-mode-toggle').checked = true;
            } else { document.getElementById('dark-mode-toggle').checked = false; }
        }

        // Load Stats
        const savedStats = localStorage.getItem('studyStation_stats');
        if (savedStats) this.stats = JSON.parse(savedStats);

        // Load saved settings from localStorage
        this.loadDisplaySettings();

        // Listeners
        document.getElementById('dark-mode-toggle').addEventListener('change', (e) => this.toggleDarkMode(e.target.checked));

        // Font Size
        const fontSlider = document.getElementById('font-size-slider');
        if (fontSlider) {
            fontSlider.addEventListener('input', (e) => {
                this.applyDisplaySetting('fontSize', e.target.value);
            });
        }

        // Line Height  
        const lineHeightSlider = document.getElementById('line-height-slider');
        if (lineHeightSlider) {
            lineHeightSlider.addEventListener('input', (e) => {
                this.applyDisplaySetting('lineHeight', e.target.value);
            });
        }

        // UI Scale
        const uiScaleSlider = document.getElementById('ui-scale-slider');
        if (uiScaleSlider) {
            uiScaleSlider.addEventListener('input', (e) => {
                this.applyDisplaySetting('uiScale', e.target.value);
            });
        }

        // Content Width
        const contentWidthSlider = document.getElementById('content-width-slider');
        if (contentWidthSlider) {
            contentWidthSlider.addEventListener('input', (e) => {
                this.applyDisplaySetting('contentWidth', e.target.value);
            });
        }

        // Answer Layout Toggle
        const answerLayoutToggle = document.getElementById('answer-layout-toggle');
        if (answerLayoutToggle) {
            answerLayoutToggle.addEventListener('change', (e) => {
                this.toggleAnswerLayout(e.target.checked);
            });
        }

        await this.loadSubjects();
        this.goHome();
    },

    // Font family mapping
    fontFamilies: {
        classic: { name: 'Cổ điển', family: "'Roboto', sans-serif" },
        basic: { name: 'Cơ bản', family: "'Times New Roman', Georgia, serif" },
        modern: { name: 'Hiện đại', family: "'Plus Jakarta Sans', 'Be Vietnam Pro', sans-serif" }
    },

    // Temporary settings for modal preview
    tempSettings: {
        theme: 'light',
        font: 'modern'
    },

    // Preview theme in modal (doesn't save yet)
    previewTheme(theme) {
        this.tempSettings.theme = theme;

        // Update button styles
        const lightBtn = document.getElementById('theme-btn-light');
        const darkBtn = document.getElementById('theme-btn-dark');

        if (theme === 'light') {
            lightBtn.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
            darkBtn.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
        } else {
            darkBtn.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
            lightBtn.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
        }
    },

    // Preview font in modal (updates preview text)
    previewFont(fontType) {
        this.tempSettings.font = fontType;

        // Update font button styles
        ['classic', 'basic', 'modern'].forEach(type => {
            const btn = document.getElementById(`font-btn-${type}`);
            if (btn) {
                if (type === fontType) {
                    btn.classList.remove('border-slate-200');
                    btn.classList.add('border-blue-400', 'bg-blue-50');
                } else {
                    btn.classList.add('border-slate-200');
                    btn.classList.remove('border-blue-400', 'bg-blue-50');
                }
            }
        });

        // Update preview text font
        const previewText = document.getElementById('font-preview-text');
        if (previewText) {
            previewText.style.fontFamily = this.fontFamilies[fontType].family;
        }
    },

    // Confirm and save all settings from modal
    confirmSettings() {
        // Apply theme
        if (this.tempSettings.theme === 'dark') {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
            document.getElementById('dark-mode-toggle').checked = true;
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
            document.getElementById('dark-mode-toggle').checked = false;
        }

        // Apply font
        this.applyFontFamily(this.tempSettings.font);
        localStorage.setItem('studyStation_fontFamily', this.tempSettings.font);

        // Mark as settings selected (won't show modal again)
        localStorage.setItem('studyStation_themeSelected', 'true');

        // Hide the modal
        const themeModal = document.getElementById('theme-selector-modal');
        if (themeModal) {
            themeModal.classList.add('hidden');
        }

        // Update settings panel UI
        this.updateFontFamilyUI(this.tempSettings.font);
    },

    // Set font family from settings panel
    setFontFamily(fontType) {
        this.applyFontFamily(fontType);
        localStorage.setItem('studyStation_fontFamily', fontType);
        this.updateFontFamilyUI(fontType);
    },

    // Apply font family to question and answer elements only (not entire body)
    applyFontFamily(fontType) {
        const fontConfig = this.fontFamilies[fontType] || this.fontFamilies.modern;

        // Set CSS variable for question/answer font
        document.documentElement.style.setProperty('--question-font-family', fontConfig.family);

        // Apply to specific question/answer elements
        const selectors = '.dynamic-text, .question-text, .question-card p, .option-label, .answer-text, [data-question-content]';
        document.querySelectorAll(selectors).forEach(el => {
            el.style.fontFamily = fontConfig.family;
        });
    },

    // Update font family UI in settings panel
    updateFontFamilyUI(fontType) {
        const fontConfig = this.fontFamilies[fontType] || this.fontFamilies.modern;

        // Update display text
        const fontDisplay = document.getElementById('font-family-display');
        if (fontDisplay) {
            fontDisplay.textContent = fontConfig.name;
        }

        // Update button styles
        ['classic', 'basic', 'modern'].forEach(type => {
            const btn = document.getElementById(`settings-font-${type}`);
            if (btn) {
                if (type === fontType) {
                    btn.classList.remove('border-slate-200', 'dark:border-slate-600');
                    btn.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
                } else {
                    btn.classList.add('border-slate-200', 'dark:border-slate-600');
                    btn.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
                }
            }
        });
    },

    // Legacy function for backward compatibility
    selectTheme(theme) {
        this.tempSettings.theme = theme;
        this.tempSettings.font = 'modern';
        this.confirmSettings();
    },

    toggleAnswerLayout(isVertical) {
        if (isVertical) {
            document.body.classList.add('answers-vertical');
        } else {
            document.body.classList.remove('answers-vertical');
        }
        localStorage.setItem('studyStation_answerLayout', isVertical ? 'vertical' : 'horizontal');
    },

    applyDisplaySetting(type, value) {
        const root = document.documentElement;

        switch (type) {
            case 'fontSize':
                root.style.setProperty('--question-font-size', value + 'px');
                const fontDisplay = document.getElementById('font-size-display');
                if (fontDisplay) fontDisplay.innerText = value + 'px';
                localStorage.setItem('studyStation_fontSize', value);
                // Apply directly to dynamic-text elements
                document.querySelectorAll('.dynamic-text').forEach(el => {
                    el.style.fontSize = value + 'px';
                });
                break;

            case 'lineHeight':
                root.style.setProperty('--question-line-height', value);
                const lineDisplay = document.getElementById('line-height-display');
                if (lineDisplay) lineDisplay.innerText = value;
                localStorage.setItem('studyStation_lineHeight', value);
                // Apply directly to question cards
                document.querySelectorAll('.dynamic-text, .question-card, .option-label span').forEach(el => {
                    el.style.lineHeight = value;
                });
                break;

            case 'uiScale':
                const scale = value / 100;
                root.style.setProperty('--ui-scale', scale);
                const scaleDisplay = document.getElementById('ui-scale-display');
                if (scaleDisplay) scaleDisplay.innerText = value + '%';
                localStorage.setItem('studyStation_uiScale', value);
                // Apply scaled font size directly
                const baseSize = parseInt(localStorage.getItem('studyStation_fontSize') || '16');
                const scaledSize = Math.round(baseSize * scale);
                document.querySelectorAll('.dynamic-text').forEach(el => {
                    el.style.fontSize = scaledSize + 'px';
                });
                break;

            case 'contentWidth':
                root.style.setProperty('--content-max-width', value + 'px');
                const widthDisplay = document.getElementById('content-width-display');
                if (widthDisplay) widthDisplay.innerText = value + 'px';
                localStorage.setItem('studyStation_contentWidth', value);
                // Apply directly to content area
                document.querySelectorAll('.content-area').forEach(el => {
                    el.style.maxWidth = value + 'px';
                });
                break;
        }
    },

    loadDisplaySettings() {
        // Font Size (default: 16)
        const fontSize = localStorage.getItem('studyStation_fontSize') || '16';
        document.documentElement.style.setProperty('--question-font-size', fontSize + 'px');
        const fontSlider = document.getElementById('font-size-slider');
        const fontDisplay = document.getElementById('font-size-display');
        if (fontSlider) fontSlider.value = fontSize;
        if (fontDisplay) fontDisplay.innerText = fontSize + 'px';

        // Line Height (default: 1.6)
        const lineHeight = localStorage.getItem('studyStation_lineHeight') || '1.6';
        document.documentElement.style.setProperty('--question-line-height', lineHeight);
        const lineSlider = document.getElementById('line-height-slider');
        const lineDisplay = document.getElementById('line-height-display');
        if (lineSlider) lineSlider.value = lineHeight;
        if (lineDisplay) lineDisplay.innerText = lineHeight;

        // UI Scale (default: 100)
        const uiScale = localStorage.getItem('studyStation_uiScale') || '100';
        document.documentElement.style.setProperty('--ui-scale', uiScale / 100);
        const scaleSlider = document.getElementById('ui-scale-slider');
        const scaleDisplay = document.getElementById('ui-scale-display');
        if (scaleSlider) scaleSlider.value = uiScale;
        if (scaleDisplay) scaleDisplay.innerText = uiScale + '%';

        // Content Width (default: 768)
        const contentWidth = localStorage.getItem('studyStation_contentWidth') || '768';
        document.documentElement.style.setProperty('--content-max-width', contentWidth + 'px');
        const widthSlider = document.getElementById('content-width-slider');
        const widthDisplay = document.getElementById('content-width-display');
        if (widthSlider) widthSlider.value = contentWidth;
        if (widthDisplay) widthDisplay.innerText = contentWidth + 'px';

        // Answer Layout (default: horizontal)
        const answerLayout = localStorage.getItem('studyStation_answerLayout') || 'horizontal';
        const isVertical = answerLayout === 'vertical';
        const answerToggle = document.getElementById('answer-layout-toggle');
        if (answerToggle) answerToggle.checked = isVertical;
        if (isVertical) document.body.classList.add('answers-vertical');

        // Font Family (default: modern)
        const fontFamily = localStorage.getItem('studyStation_fontFamily') || 'modern';
        this.applyFontFamily(fontFamily);
        this.updateFontFamilyUI(fontFamily);
    },

    async loadSubjects() {
        try {
            // Check session cache first (5 minute expiry)
            const CACHE_KEY = 'studyStation_examCache';
            const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

            try {
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { subjects, examContentDB, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_EXPIRY) {
                        console.log('Loaded exams from cache');
                        this.subjects = subjects;
                        this.examContentDB = examContentDB;
                        this.subjectLoadError = Object.keys(this.subjects).length ? null : 'Chưa có bài thi nào.';
                        return;
                    }
                }
            } catch (cacheErr) {
                console.warn('Cache read error:', cacheErr);
            }

            // Try Firebase first (if available)
            if (window.firebaseExams && typeof window.firebaseExams.getAllExams === 'function') {
                try {
                    const firebaseExams = await window.firebaseExams.getAllExams();
                    const firebaseSubjects = window.firebaseExams.getSubjects();

                    if (firebaseExams && firebaseExams.length > 0) {
                        console.log('Loaded exams from Firebase:', firebaseExams.length);

                        // Build subjects from Firebase data
                        this.subjects = {};
                        this.examContentDB = {};

                        firebaseSubjects.forEach(sub => {
                            this.subjects[sub.id] = {
                                id: sub.id,
                                name: sub.name,
                                color: sub.color,
                                bg: sub.bg,
                                icon: sub.icon,
                                exams: []
                            };
                        });

                        firebaseExams.forEach(exam => {
                            const subId = exam.subjectId;
                            if (this.subjects[subId]) {
                                this.subjects[subId].exams.push({
                                    id: exam.id,
                                    title: exam.title,
                                    time: exam.time || 50,
                                    examCode: exam.examCode || '',
                                    createdAt: exam.createdAt || '',
                                    author: exam.author || '',
                                    attemptCount: exam.attemptCount || 0
                                });
                                this.examContentDB[exam.id] = {
                                    id: exam.id,
                                    title: exam.title,
                                    time: exam.time || 50,
                                    part1: exam.part1 || [],
                                    part2: exam.part2 || [],
                                    part3: exam.part3 || []
                                };
                            }
                        });

                        // Sort exams by createdAt descending (newest first)
                        Object.keys(this.subjects).forEach(key => {
                            this.subjects[key].exams.sort((a, b) => {
                                if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
                                return 0;
                            });
                        });

                        // Remove empty subjects
                        Object.keys(this.subjects).forEach(key => {
                            if (this.subjects[key].exams.length === 0) {
                                delete this.subjects[key];
                            }
                        });

                        this.subjectLoadError = Object.keys(this.subjects).length ? null : 'Chưa có bài thi nào. Admin có thể thêm bài thi mới.';

                        // Save to session cache for faster subsequent loads
                        try {
                            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                                subjects: this.subjects,
                                examContentDB: this.examContentDB,
                                timestamp: Date.now()
                            }));
                            console.log('Saved exams to cache');
                        } catch (saveErr) {
                            console.warn('Cache save error:', saveErr);
                        }

                        return;
                    }
                } catch (fbError) {
                    console.warn('Firebase load failed, falling back to local files:', fbError);
                }
            }

            // Fallback to local JSON files
            const res = await fetch(`${MANIFEST_PATH}?v=${Date.now()}`);
            if (!res.ok) throw new Error('Manifest not found');
            const data = await res.json();
            const subjectList = data.subjects || [];
            this.subjects = {};
            this.examContentDB = {};

            await Promise.all(subjectList.map(async (sub) => {
                const normalized = {
                    id: sub.id,
                    name: sub.name,
                    color: sub.color,
                    bg: sub.bg,
                    icon: sub.icon,
                    dir: sub.dir || sub.id,
                    exams: []
                };
                this.subjects[normalized.id] = normalized;
                const files = sub.files || [];

                await Promise.all(files.map(async (fileName) => {
                    try {
                        const examRes = await fetch(`${this.testsBasePath}/${normalized.dir}/${fileName}?v=${Date.now()}`);
                        if (!examRes.ok) throw new Error(`Missing exam ${fileName}`);
                        const examJson = await examRes.json();
                        normalized.exams.push({ id: examJson.id, title: examJson.title, time: examJson.time || 50 });
                        this.examContentDB[examJson.id] = {
                            ...examJson,
                            part1: examJson.part1 || [],
                            part2: examJson.part2 || [],
                            part3: examJson.part3 || []
                        };
                    } catch (examErr) {
                        console.error(`Không thể tải đề thi ${fileName}`, examErr);
                    }
                }));
            }));

            this.subjectLoadError = subjectList.length ? null : 'Chưa có môn học nào trong thư mục tests.';
        } catch (error) {
            console.error('Load subjects failed', error);
            this.subjects = {};
            this.examContentDB = {};
            this.subjectLoadError = 'Không thể tải danh sách đề thi. Vui lòng kiểm tra lại.';
        }
    },

    toggleDarkMode(checked) {
        if (checked) { document.documentElement.classList.add('dark'); localStorage.theme = 'dark'; }
        else { document.documentElement.classList.remove('dark'); localStorage.theme = 'light'; }
    },

    renderTemplate(tplId) {
        const tpl = document.getElementById(tplId);
        this.container.innerHTML = '';
        this.container.appendChild(tpl.content.cloneNode(true));
        window.scrollTo(0, 0);
    },

    // --- Stats Logic ---
    toggleStats() {
        const modal = document.getElementById('stats-modal');
        if (modal.classList.contains('hidden')) {
            // Update content before showing
            const totalExams = Object.values(this.stats.attempts).flat().length;
            const hours = Math.floor(this.stats.totalTime / 3600);
            const minutes = Math.floor((this.stats.totalTime % 3600) / 60);

            document.getElementById('stat-exams').innerText = totalExams;
            document.getElementById('stat-time').innerText = `${hours}h ${minutes}m`;

            // Calculate Average (First 3 attempts per exam)
            let totalScore = 0;
            let count = 0;
            Object.values(this.stats.attempts).forEach(scores => {
                const first3 = scores.slice(0, 3);
                first3.forEach(s => { totalScore += s; count++; });
            });
            const avg = count > 0 ? (totalScore / count) : 0;

            document.getElementById('stat-avg').innerText = avg.toFixed(1);
            document.getElementById('stat-avg-bar').style.width = `${avg * 10}%`; // 0-10 scale maps to 0-100%

            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    },

    updateStats(examId, score, durationSeconds) {
        if (!this.stats.attempts[examId]) this.stats.attempts[examId] = [];
        this.stats.attempts[examId].push(score);
        this.stats.totalTime += durationSeconds;
        localStorage.setItem('studyStation_stats', JSON.stringify(this.stats));
    },

    // --- Navigation ---
    goHome() {
        this.isReviewMode = false;
        this.stopTimer(); this.timerEl.classList.add('hidden');
        this.renderTemplate('tpl-home');
        const grid = this.container.querySelector('.grid');
        const subjectEntries = Object.values(this.subjects || {});

        if (this.subjectLoadError) {
            grid.innerHTML = `<div class="col-span-full bg-white dark:bg-slate-800 p-6 rounded-2xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300">${this.subjectLoadError}</div>`;
            return;
        }

        if (!subjectEntries.length) {
            grid.innerHTML = `<div class="col-span-full bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300">Chưa có đề thi nào trong thư mục tests.</div>`;
            return;
        }

        subjectEntries.forEach(sub => {
            const card = document.createElement('div');
            card.className = `bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-soft card-hover cursor-pointer group flex flex-col items-center text-center py-8 hover:border-blue-400 dark:hover:border-blue-500`;
            card.onclick = () => this.goSubject(sub.id);
            card.innerHTML = `<div class="w-16 h-16 rounded-2xl ${sub.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-sm">${sub.icon}</div><h3 class="text-xl font-bold text-slate-800 dark:text-white mb-2">${sub.name}</h3><p class="text-slate-400 text-sm font-medium bg-slate-50 dark:bg-slate-700 dark:text-slate-300 px-3 py-1 rounded-full">${sub.exams.length} đề thi</p>`;
            grid.appendChild(card);
        });
    },

    goSubject(subId) {
        const sub = this.subjects[subId];
        if (!sub) { alert('Không tìm thấy môn học này.'); return; }
        this.renderTemplate('tpl-exam-list');
        this.container.querySelector('#subject-title').innerText = sub.name;
        this.container.querySelector('#subject-icon-large').innerHTML = sub.icon;
        this.container.querySelector('#subject-icon-large').className = `p-4 rounded-2xl ${sub.bg}`;
        const grid = this.container.querySelector('#exam-grid');
        if (!sub.exams.length) {
            grid.innerHTML = `<div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300">Chưa có đề thi nào trong môn này.</div>`;
            return;
        }
        sub.exams.forEach((exam, index) => {
            const el = document.createElement('div');
            el.className = 'exam-card bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group';
            el.onclick = () => this.showExamModeModal(subId, exam.id, exam.title);

            const createdDate = exam.createdAt
                ? `<span class="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 flex items-center"><svg class="w-3 h-3 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>${new Date(exam.createdAt).toLocaleDateString('vi-VN')}</span>`
                : '';

            // Số lượt làm đề (attemptCount) - luôn hiển thị
            const attemptCount = exam.attemptCount || 0;
            const attemptInfo = `<span class="text-[10px] md:text-xs text-emerald-600 dark:text-emerald-400 flex items-center"><svg class="w-3 h-3 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>${attemptCount} lượt thi</span>`;

            el.innerHTML = `
                <div class="flex items-start gap-3 md:gap-4">
                    <div class="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs md:text-sm">${(index + 1).toString().padStart(2, '0')}</div>
                    <div class="flex-1 min-w-0 overflow-hidden">
                        <h4 class="font-bold text-base md:text-lg text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug mb-1">${exam.title}</h4>
                        <div class="flex flex-wrap items-center gap-2 md:gap-4 mt-2">
                            <span class="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded flex items-center">
                                <svg class="w-3 h-3 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                ${exam.time} phút
                            </span>
                            ${createdDate}
                            ${attemptInfo}
                        </div>
                    </div>
                    <div class="shrink-0 flex items-center gap-2">
                        <button onclick="event.stopPropagation(); app.showHistoryModal('${exam.id}', '${exam.title.replace(/'/g, "\\'")}')" 
                            class="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors" 
                            title="Xem lịch sử làm bài">
                            <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.93 4.93A10 10 0 1021 12"></path>
                            </svg>
                        </button>
                        <div class="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">
                             <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(el);
        });
    },

    renderMath() {
        if (window.MathJax) {
            window.MathJax.typesetPromise();
        }
    },

    // Show exam mode selection modal
    showExamModeModal(subId, examId, title) {
        this.pendingExam = { subId, examId, title };
        document.getElementById('mode-modal-exam-title').textContent = title;
        document.getElementById('exam-mode-modal').classList.remove('hidden');
    },

    // Handle mode selection
    confirmExamMode(mode) {
        document.getElementById('exam-mode-modal').classList.add('hidden');

        const { subId, examId } = this.pendingExam;
        if (!subId || !examId) return;

        if (mode === 'classic') {
            this.startExam(subId, examId);
        } else if (mode === 'stepbystep') {
            this.startStepMode(subId, examId);
        }
    },

    startExam(subId, examId) {
        const subject = this.subjects[subId];
        if (!subject) { alert('Không tìm thấy môn học này.'); return; }
        const examMeta = subject.exams.find(e => e.id === examId);
        const originalData = this.examContentDB[examId];

        if (!examMeta || !originalData) { alert('Không tìm thấy dữ liệu bài thi.'); return; }

        // Deep copy for session to enable shuffling without mutating original
        const examData = JSON.parse(JSON.stringify(originalData));

        // Shuffle Helper
        const shuffle = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        // 1. Shuffle Question Order (Part 1, 2, 3)
        if (examData.part1) shuffle(examData.part1);
        if (examData.part2) shuffle(examData.part2);
        if (examData.part3) shuffle(examData.part3);

        // 2. Shuffle Options for Part 1 & Remap Correct Index
        if (examData.part1) {
            examData.part1.forEach(q => {
                const originalOptions = q.options || [];
                // Store pairs of {text, isCorrect} to track the answer
                const optionObjs = originalOptions.map((opt, i) => ({
                    text: opt,
                    isCorrect: i === (q.correct ?? 0)
                }));

                shuffle(optionObjs); // Shuffle the options

                // Reconstruct options and find new correct index
                q.options = optionObjs.map(o => o.text);
                const newCorrectIndex = optionObjs.findIndex(o => o.isCorrect);
                q.correct = newCorrectIndex >= 0 ? newCorrectIndex : 0;
            });
        }

        // 3. Shuffle Sub-questions for Part 2
        if (examData.part2) {
            examData.part2.forEach(q => {
                if (q.subQuestions) shuffle(q.subQuestions);
            });
        }

        this.currentExam = { meta: examMeta, data: examData, subId: subId };
        this.answers = {};
        this.isReviewMode = false;
        this.startTime = new Date();

        this.renderTemplate('tpl-taking-exam');
        this.timerEl.classList.remove('hidden');

        this.renderQuestions(examData);
        this.renderPalette(examData);
        this.startTimer(examMeta.time * 60);
        this.renderMath();

        // Log practice attempt (ghi log và tăng số lượt thi)
        if (window.firebaseExams?.logPracticeAttempt) {
            console.log('[Practice] Logging attempt for:', examId, examMeta.title, subId);
            window.firebaseExams.logPracticeAttempt(examId, examMeta.title, subId)
                .then(() => console.log('[Practice] Attempt logged successfully'))
                .catch(err => console.error('[Practice] Failed to log attempt:', err));
        } else {
            console.warn('[Practice] logPracticeAttempt not available');
        }
    },

    renderQuestions(data) {
        /**
         * Helper: Escape HTML for safe display using DOM textContent (safest method).
         * @param {string} text - Input text
         * @param {boolean} restoreBold - If true, <b>/<strong> tags render as Blue Bold.
         * @param {boolean} highlightCode - If true, HTML tags are highlighted with Emerald color.
         */
        const formatText = (text, restoreBold = false, highlightCode = false) => {
            if (text === null || text === undefined) return '';

            // Fix non-standard LaTeX commands for MathJax
            // Converts \female -> \venus and \male -> \mars
            text = String(text)
                .replace(/\\female/g, '\\venus')
                .replace(/\\male/g, '\\mars');

            // Auto-wrap common LaTeX symbols that are not inside math delimiters
            // Pattern: detect ^\circ not inside \( \) or $ $
            // Wrap numbers followed by ^\circ with math delimiters
            text = text.replace(/(\d+(?:[,\.]\d+)?)\s*\^\s*\\circ\s*([A-Z])?/g, (match, num, unit) => {
                if (unit) {
                    return `\\(${num}^\\circ\\text{${unit}}\\)`;
                }
                return `\\(${num}^\\circ\\)`;
            });

            // Also handle standalone ^\circ (without number)
            text = text.replace(/(?<![\\$(])\^\s*\\circ\s*([A-Z])?(?![\\)$])/g, (match, unit) => {
                if (unit) {
                    return `\\(^\\circ\\text{${unit}}\\)`;
                }
                return `\\(^\\circ\\)`;
            });

            // 1. Safe Escape using DOM (browser handles all edge cases perfectly)
            const div = document.createElement('div');
            div.textContent = String(text);
            let safe = div.innerHTML;

            // 2. Convert newlines to <br> for proper line breaks
            // Handle both actual newlines (\n) and literal backslash-n from JSON (\\n)
            safe = safe.replace(/\\n/g, '<br>');  // Literal \n from JSON (escaped as \\n in source)
            safe = safe.replace(/\n/g, '<br>');   // Actual newline characters

            // 3. Restore <b>/<strong> as blue bold (only for question text)
            if (restoreBold) {
                safe = safe.replace(/&lt;(b|strong)&gt;([\s\S]*?)&lt;\/\1&gt;/gi, (match, tag, content) => {
                    return `<${tag} class="font-bold text-blue-600 dark:text-blue-400">${content}</${tag}>`;
                });
            }

            // 4. Highlight HTML Tags (only if requested)
            if (highlightCode) {
                const codeClass = "font-mono text-emerald-600 dark:text-emerald-400 bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-sm font-bold";
                // Match escaped HTML tags: &lt;tagname...&gt;
                // Uses negative lookahead to stop at &gt; without consuming it prematurely
                safe = safe.replace(/(&lt;\/?[a-zA-Z][a-zA-Z0-9]*(?:(?!&gt;).)*&gt;)/g, (match) => {
                    return `<span class="${codeClass}">${match}</span>`;
                });
            }

            return safe;
        };

        let globalQIndex = 0;
        const renderQ = (q, index, type) => {
            globalQIndex++;
            const displayId = globalQIndex;
            const div = document.createElement('div');
            const uniqueId = `${type}_${q.id}`;
            div.id = `q-${uniqueId}`;
            div.dataset.type = type;
            div.className = 'bg-white dark:bg-slate-800 p-5 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-soft question-card';

            let content = `
                <div class="mb-4 md:mb-6 font-medium text-slate-800 dark:text-white">
                    <div>
                        <span class="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 mr-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-xl font-bold text-sm shadow-sm align-middle">${displayId}</span><span class="leading-relaxed font-question dynamic-text font-bold text-lg">${formatText(q.text, true, true)}</span>
                        ${q.image ? `<img src="${q.image}" class="mt-3 max-w-full md:max-w-md rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm cursor-pointer hover:opacity-90 hover:shadow-lg transition-all" alt="Question image" title="Nhấn để xem ảnh lớn" onclick="openLightbox('${q.image}')" onerror="this.style.display='none'">` : ''}
                    </div>
                </div>`;

            if (type === 1) {
                // Build options using DOM APIs for absolute safety (textContent never breaks)
                const optionsGrid = document.createElement('div');
                optionsGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-start answer-options-grid';

                q.options.forEach((opt, i) => {
                    const label = document.createElement('label');
                    label.className = 'cursor-pointer group relative option-label';
                    label.dataset.idx = i;

                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = `q_${uniqueId}`;
                    radio.value = i;
                    radio.className = 'peer sr-only option-radio';
                    radio.disabled = this.isReviewMode;
                    radio.addEventListener('change', () => this.handleAnswer(1, q.id, i));

                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'p-3 md:p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-start h-full';

                    const dotOuter = document.createElement('div');
                    dotOuter.className = 'option-dot-outer w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-500 mr-3 mt-0.5 flex items-center justify-center shrink-0';
                    const dotInner = document.createElement('div');
                    dotInner.className = 'option-dot-inner w-2.5 h-2.5 bg-white rounded-full';
                    dotOuter.appendChild(dotInner);

                    const optionText = document.createElement('span');
                    optionText.className = 'text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-white font-question dynamic-text text-left flex-1 min-w-0 w-full break-words whitespace-pre-wrap';
                    // Use formatText with highlightCode=true to show HTML tags in emerald color
                    optionText.innerHTML = formatText(opt, false, true);

                    optionDiv.appendChild(dotOuter);
                    optionDiv.appendChild(optionText);
                    label.appendChild(radio);
                    label.appendChild(optionDiv);
                    optionsGrid.appendChild(label);
                });

                // Append grid after setting div.innerHTML for question header
                div.innerHTML = content;
                div.appendChild(optionsGrid);
                return div;
            } else if (type === 2) {
                content += `<div class="space-y-3">
                    ${q.subQuestions.map(sub => `
                        <div class="sub-question-row p-3 md:p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700" data-sub="${sub.id}" data-qid="${q.id}">
                            <div class="text-slate-700 dark:text-slate-300 font-question dynamic-text mb-3"><span class="font-bold mr-2 text-indigo-600 dark:text-indigo-400 font-sans">${sub.id})</span>${formatText(sub.text, false, true)}</div>
                            <div class="flex justify-end">
                                <div class="inline-flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-600 shadow-sm tf-btn-group">
                                    <button type="button" data-tf-value="true" class="tf-btn px-4 py-2 text-sm font-bold rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" ${this.isReviewMode ? 'disabled' : ''}>ĐÚNG</button>
                                    <button type="button" data-tf-value="false" class="tf-btn px-4 py-2 text-sm font-bold rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" ${this.isReviewMode ? 'disabled' : ''}>SAI</button>
                                </div>
                            </div>
                        </div>`).join('')}</div>`;
            } else if (type === 3) {
                content += `<div class="relative">
                    <input type="text" id="input-${uniqueId}" oninput="app.handleAnswer(3, ${q.id}, this.value)" placeholder="Nhập đáp án..." class="w-full md:w-2/3 p-3 md:p-4 pl-5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900 focus:border-emerald-500 outline-none transition-all font-medium text-lg text-slate-800 dark:text-white placeholder:text-slate-400 font-question" ${this.isReviewMode ? 'disabled' : ''}>
                    ${this.isReviewMode ? `<div class="mt-2 text-sm font-bold text-emerald-600">Đáp án đúng: ${formatText(q.correct, false, true)}</div>` : ''}
                </div>`;
            }
            div.innerHTML = content;
            return div;
        };

        const p1 = document.getElementById('part-1-questions');
        const p2 = document.getElementById('part-2-questions');
        const p3 = document.getElementById('part-3-questions');

        if (data.part1.length) data.part1.forEach(q => p1.appendChild(renderQ(q, 0, 1))); else document.getElementById('part-1-container').classList.add('hidden');
        if (data.part2.length) data.part2.forEach(q => p2.appendChild(renderQ(q, 0, 2))); else document.getElementById('part-2-container').classList.add('hidden');
        if (data.part3.length) data.part3.forEach(q => p3.appendChild(renderQ(q, 0, 3))); else document.getElementById('part-3-container').classList.add('hidden');

        // Event delegation for True/False buttons
        if (p2) {
            // Handler function to avoid code duplication
            const handleTFClick = (e) => {
                const btn = e.target.closest('.tf-btn[data-tf-value]');
                if (!btn || btn.disabled) return;

                // Prevent default to stop any unwanted behavior
                e.preventDefault();

                const row = btn.closest('.sub-question-row');
                if (!row) return;

                const qId = parseInt(row.dataset.qid, 10);
                const subId = row.dataset.sub;
                const isTrue = btn.dataset.tfValue === 'true';

                this.handleTFAnswer(qId, subId, isTrue, btn);
            };

            // Use both click and touchend for better mobile support
            p2.addEventListener('click', handleTFClick);

            // Touchend for immediate mobile response
            p2.addEventListener('touchend', (e) => {
                const btn = e.target.closest('.tf-btn[data-tf-value]');
                if (!btn || btn.disabled) return;

                // Prevent ghost click
                e.preventDefault();

                const row = btn.closest('.sub-question-row');
                if (!row) return;

                const qId = parseInt(row.dataset.qid, 10);
                const subId = row.dataset.sub;
                const isTrue = btn.dataset.tfValue === 'true';

                this.handleTFAnswer(qId, subId, isTrue, btn);
            }, { passive: false });
        }
    },

    renderPalette(data) {
        let globalQIndex = 0;
        const createBtn = (id, type, isMobile) => {
            globalQIndex++;
            const uniqueId = `${type}_${id}`;
            const btnId = isMobile ? `mob-pal-btn-${uniqueId}` : `pal-btn-${uniqueId}`;
            return `<button id="${btnId}" onclick="document.getElementById('q-${uniqueId}').scrollIntoView({behavior: 'smooth', block: 'center'})" class="question-nav-item w-full aspect-square flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800">${globalQIndex}</button>`;
        };
        const allQuestions = [
            ...data.part1.map(q => ({ id: q.id, type: 1 })),
            ...data.part2.map(q => ({ id: q.id, type: 2 })),
            ...data.part3.map(q => ({ id: q.id, type: 3 }))
        ];
        // We need to render independent lists for desktop and mobile because the counter increments

        // Reset and render for Desktop
        globalQIndex = 0;
        document.getElementById('question-palette').innerHTML = allQuestions.map(q => createBtn(q.id, q.type, false)).join('');

        // Reset and render for Mobile
        globalQIndex = 0;
        document.getElementById('mobile-palette-grid').innerHTML = allQuestions.map(q => createBtn(q.id, q.type, true)).join('');
    },

    handleAnswer(part, qId, value) {
        if (this.isReviewMode) return;
        const key = `${part}_${qId}`;
        if (!this.answers[key]) this.answers[key] = {};
        this.answers[key].val = value;
        this.answers[key].part = part;
        this.updatePalette(key, value !== "" && value !== undefined);
    },

    handleTFAnswer(qId, subId, isTrue, btnEl) {
        if (this.isReviewMode) return;
        const key = `2_${qId}`;
        if (!this.answers[key]) this.answers[key] = { part: 2, sub: {} };
        if (!this.answers[key].sub) this.answers[key].sub = {};
        this.answers[key].sub[subId] = isTrue;

        const parent = btnEl.closest('.tf-btn-group') || btnEl.parentElement;
        parent.querySelectorAll('.tf-btn').forEach(b => {
            b.classList.remove('active-tf', 'bg-blue-600', 'bg-emerald-600', 'bg-red-500', 'text-white');
            b.classList.add('text-slate-500', 'dark:text-slate-400');
        });

        btnEl.classList.remove('text-slate-500', 'dark:text-slate-400');
        btnEl.classList.add('active-tf', 'text-white', 'bg-blue-600');

        const qData = this.currentExam.data.part2.find(q => q.id === qId);
        const req = qData ? qData.subQuestions.map(s => s.id) : [];
        const ans = Object.keys(this.answers[key].sub);
        this.updatePalette(key, req.every(k => ans.includes(k)));
    },

    updatePalette(uniqueId, isAnswered) {
        [`pal-btn-${uniqueId}`, `mob-pal-btn-${uniqueId}`].forEach(id => {
            const el = document.getElementById(id);
            if (el) isAnswered ? el.classList.add('answered') : el.classList.remove('answered');
        });
    },

    startTimer(duration) {
        let timer = duration;
        const updateDisplay = () => {
            const minutes = parseInt(timer / 60, 10);
            const seconds = parseInt(timer % 60, 10);
            this.timerEl.textContent = (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
            if (--timer < 0) { this.stopTimer(); alert("Hết giờ!"); this.submitExamLogic(); }
        };
        updateDisplay();
        this.timerInterval = setInterval(updateDisplay, 1000);
    },

    stopTimer() { if (this.timerInterval) clearInterval(this.timerInterval); },

    toggleSettings() { document.getElementById('settings-modal').classList.toggle('hidden'); },

    submitExam() { document.getElementById('submit-confirm-modal').classList.remove('hidden'); },

    confirmSubmit() {
        document.getElementById('submit-confirm-modal').classList.add('hidden');
        this.submitExamLogic();
    },

    submitExamLogic() {
        this.stopTimer();
        this.endTime = new Date();
        const durationSeconds = Math.floor((this.endTime - this.startTime) / 1000);

        const data = this.currentExam.data;
        let maxScore = 0;
        let earnedScore = 0;
        let correctCount = 0;
        let totalQuestions = data.part1.length + data.part2.length + data.part3.length;
        let wrongCount = 0;

        // Grading
        maxScore += data.part1.length * 0.25;
        data.part1.forEach(q => {
            const key = `1_${q.id}`;
            if (this.answers[key]?.val == q.correct) { earnedScore += 0.25; correctCount++; }
        });

        maxScore += data.part2.length * 1.0;
        data.part2.forEach(q => {
            const key = `2_${q.id}`;
            let qCorrectSub = 0;
            if (this.answers[key]?.sub) {
                q.subQuestions.forEach(sub => {
                    if (this.answers[key].sub[sub.id] === sub.correct) qCorrectSub++;
                });
            }
            if (qCorrectSub === 1) earnedScore += 0.1;
            if (qCorrectSub === 2) earnedScore += 0.25;
            if (qCorrectSub === 3) earnedScore += 0.5;
            if (qCorrectSub === 4) { earnedScore += 1.0; correctCount++; }
        });

        maxScore += data.part3.length * 0.25;
        data.part3.forEach(q => {
            const key = `3_${q.id}`;
            const userVal = String(this.answers[key]?.val || "").trim().toLowerCase();
            const correctVal = String(q.correct).trim().toLowerCase();
            // Basic matching, could be improved
            if (userVal === correctVal) { earnedScore += 0.25; correctCount++; }
        });

        const finalScore = maxScore > 0 ? (earnedScore / maxScore) * 10 : 0;
        wrongCount = totalQuestions - correctCount;

        // Update Statistics
        this.updateStats(this.currentExam.meta.id, finalScore, durationSeconds);

        // Store exam result for the current session (for review)
        this.examResult = {
            examId: this.currentExam.meta.id,
            examTitle: this.currentExam.meta.title,
            subjectId: this.currentExam.subId,
            score: finalScore,
            correctCount,
            totalQuestions,
            wrongCount,
            durationSeconds,
            answers: { ...this.answers },
            examData: this.currentExam.data
        };

        // Save result to Firebase for history
        if (window.firebaseExams?.savePracticeResult) {
            window.firebaseExams.savePracticeResult(this.examResult)
                .then(() => console.log('[Practice] Result saved to Firebase'))
                .catch(err => console.error('[Practice] Failed to save result:', err));
        }

        // Show Result
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        const timeStr = `${minutes} phút ${seconds} giây`;

        this.renderTemplate('tpl-result');
        this.timerEl.classList.add('hidden');

        document.getElementById('result-subject-name').innerText = this.currentExam.meta.title;
        document.getElementById('score-display').innerText = finalScore.toFixed(2);
        document.getElementById('result-time').innerText = timeStr;
        document.getElementById('result-correct').innerText = `${correctCount}/${totalQuestions}`;
        document.getElementById('result-wrong').innerText = `${wrongCount}/${totalQuestions}`;

        // Setup feedback input char counter
        const feedbackInput = document.getElementById('feedback-input');
        const charCount = document.getElementById('feedback-char-count');
        if (feedbackInput && charCount) {
            feedbackInput.addEventListener('input', () => {
                charCount.textContent = `${feedbackInput.value.length}/256`;
            });
        }

        // Load feedbacks for this exam
        this.loadFeedbacks();
    },

    reviewExam() {
        this.isReviewMode = true;
        this.renderTemplate('tpl-taking-exam');
        document.getElementById('desktop-palette-sidebar').classList.add('hidden');
        document.getElementById('mobile-footer').classList.add('hidden');
        document.getElementById('review-controls').classList.remove('hidden');

        this.renderQuestions(this.currentExam.data);
        this.renderMath();

        const data = this.currentExam.data;

        // Helper to set status - now uses uniqueId format (type_id)
        const setStatus = (uniqueId, isCorrect) => {
            const el = document.getElementById(`q-${uniqueId}`);
            if (!el) {
                console.warn(`[Review] Element not found: q-${uniqueId}`);
                return;
            }
            el.dataset.status = isCorrect ? 'correct' : 'wrong';
            el.classList.add(isCorrect ? 'border-green-200' : 'border-red-200');
            if (isCorrect) el.classList.add('dark:border-green-900');
            else el.classList.add('dark:border-red-900');
        };

        // Helper to render explanation
        const renderExplanation = (uniqueId, explanation) => {
            if (!explanation || (!explanation.text && !explanation.image && !explanation.video)) return;

            const el = document.getElementById(`q-${uniqueId}`);
            if (!el) return;

            // Extract YouTube video ID
            const getYouTubeId = (url) => {
                if (!url) return null;
                const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                return match ? match[1] : null;
            };

            // Extract Google Drive file ID
            const getGoogleDriveId = (url) => {
                if (!url) return null;
                // Match patterns:
                // - https://drive.google.com/file/d/FILE_ID/view
                // - https://drive.google.com/open?id=FILE_ID
                // - https://drive.google.com/uc?id=FILE_ID
                const patterns = [
                    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
                    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
                    /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/
                ];
                for (const pattern of patterns) {
                    const match = url.match(pattern);
                    if (match) return match[1];
                }
                return null;
            };

            const youtubeId = getYouTubeId(explanation.video);
            const driveId = getGoogleDriveId(explanation.video);

            // Generate video HTML based on platform
            let videoHtml = '';
            if (youtubeId) {
                // YouTube embed
                videoHtml = `
                    <div class="aspect-video max-w-lg rounded-lg overflow-hidden shadow-sm">
                        <iframe 
                            class="w-full h-full" 
                            src="https://www.youtube.com/embed/${youtubeId}" 
                            title="Video lời giải" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                        </iframe>
                    </div>
                `;
            } else if (driveId) {
                // Google Drive embed
                videoHtml = `
                    <div class="aspect-video max-w-lg rounded-lg overflow-hidden shadow-sm bg-slate-100 dark:bg-slate-700">
                        <iframe 
                            class="w-full h-full" 
                            src="https://drive.google.com/file/d/${driveId}/preview" 
                            title="Video lời giải (Google Drive)" 
                            frameborder="0" 
                            allow="autoplay; encrypted-media" 
                            allowfullscreen>
                        </iframe>
                    </div>
                    <p class="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        Video từ Google Drive
                    </p>
                `;
            } else if (explanation.video) {
                // Fallback: link to external video
                videoHtml = `
                    <a href="${explanation.video}" target="_blank" class="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 dark:text-orange-400 text-sm font-medium">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Xem video lời giải
                    </a>
                `;
            }

            const explanationHtml = `
                <div class="explanation-section mt-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                    <div class="flex items-center gap-2 mb-3">
                        <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                        </svg>
                        <span class="font-bold text-orange-700 dark:text-orange-400">💡 Lời giải</span>
                    </div>
                    ${explanation.text ? `<p class="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-3 whitespace-pre-wrap">${this.escapeHtml(explanation.text.replace(/\\female/g, '\\venus').replace(/\\male/g, '\\mars'))}</p>` : ''}
                    ${explanation.image ? `<img src="${explanation.image}" class="max-w-full md:max-w-lg rounded-lg border border-orange-200 dark:border-orange-700 shadow-sm mb-3 cursor-pointer hover:shadow-lg transition-shadow" alt="Hình ảnh lời giải" onclick="openLightbox('${explanation.image}')" onerror="this.style.display='none'">` : ''}
                    ${videoHtml}
                </div>
            `;
            el.insertAdjacentHTML('beforeend', explanationHtml);
        };

        // Part 1: Multiple Choice (type = 1)
        data.part1.forEach(q => {
            const uniqueId = `1_${q.id}`;
            const userVal = this.answers[uniqueId]?.val;
            const isCorrect = userVal == q.correct;
            setStatus(uniqueId, isCorrect);

            // Select inputs using uniqueId format
            const inputs = document.querySelectorAll(`input[name="q_${uniqueId}"]`);
            inputs.forEach(inp => {
                const val = parseInt(inp.value);
                const wrapper = inp.nextElementSibling;
                if (val === q.correct) wrapper.classList.add('review-correct');
                if (val === userVal && val !== q.correct) wrapper.classList.add('review-wrong');
                if (val === userVal) inp.checked = true;
            });

            // Render explanation if exists
            if (q.explanation) renderExplanation(uniqueId, q.explanation);
        });

        // Part 2: True/False (type = 2)
        data.part2.forEach(q => {
            const uniqueId = `2_${q.id}`;
            const userSub = this.answers[uniqueId]?.sub || {};
            let fullyCorrect = true;
            q.subQuestions.forEach(sub => {
                const userAns = userSub[sub.id];
                const row = document.querySelector(`#q-${uniqueId} .sub-question-row[data-sub="${sub.id}"]`);
                if (!row) {
                    console.warn(`[Review] Row not found for sub ${sub.id} in q-${uniqueId}`);
                    return;
                }
                if (userAns !== sub.correct) {
                    fullyCorrect = false;
                    row.classList.add('bg-red-50', 'dark:bg-red-900/10');
                } else {
                    row.classList.add('bg-green-50', 'dark:bg-green-900/10');
                }
                const btns = row.querySelectorAll('.tf-btn');
                // btns[0] = ĐÚNG, btns[1] = SAI

                // Highlight user's answer
                if (userAns === true) btns[0].classList.add(sub.correct === true ? 'selected-true' : 'selected-false');
                if (userAns === false) btns[1].classList.add(sub.correct === false ? 'selected-true' : 'selected-false');

                // Always highlight the correct answer prominently
                const correctBtn = sub.correct ? btns[0] : btns[1];
                correctBtn.classList.add('review-correct-answer');

                // If user was wrong, also mark their wrong choice
                if (userAns !== sub.correct && userAns !== undefined) {
                    const wrongBtn = userAns ? btns[0] : btns[1];
                    wrongBtn.classList.add('review-wrong-answer');
                }
            });
            setStatus(uniqueId, fullyCorrect);

            // Render explanation if exists
            if (q.explanation) renderExplanation(uniqueId, q.explanation);
        });

        // Part 3: Short Answer (type = 3)
        data.part3.forEach(q => {
            const uniqueId = `3_${q.id}`;
            const userVal = String(this.answers[uniqueId]?.val || "").trim().toLowerCase();
            const correctVal = String(q.correct).trim().toLowerCase();
            const isCorrect = userVal === correctVal;
            setStatus(uniqueId, isCorrect);

            // Select input using uniqueId format
            const inp = document.getElementById(`input-${uniqueId}`);
            if (inp) {
                inp.value = this.answers[uniqueId]?.val || "";
                if (isCorrect) inp.classList.add('border-green-500', 'bg-green-50');
                else inp.classList.add('border-red-500', 'bg-red-50');
            }

            // Render explanation if exists
            if (q.explanation) renderExplanation(uniqueId, q.explanation);
        });
    },

    filterReview(type) {
        document.querySelectorAll('.filter-btn').forEach(b => {
            if (b.dataset.filter === type) b.classList.add('ring-2', 'ring-offset-2', 'ring-blue-400');
            else b.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-400');
        });
        const cards = document.querySelectorAll('.question-card');
        cards.forEach(card => {
            const status = card.dataset.status;
            if (type === 'all') card.classList.remove('hidden');
            else if (type === 'correct') { if (status === 'correct') card.classList.remove('hidden'); else card.classList.add('hidden'); }
            else if (type === 'wrong') { if (status === 'wrong') card.classList.remove('hidden'); else card.classList.add('hidden'); }
        });
    },

    // ============================================================
    // FEEDBACK SYSTEM
    // ============================================================

    async loadFeedbacks() {
        if (!this.currentExam?.meta?.id || !window.firebaseFeedback) return;

        const feedbackList = document.getElementById('feedback-list');
        if (!feedbackList) return;

        try {
            const feedbacks = await window.firebaseFeedback.getExamFeedbacks(this.currentExam.meta.id);
            this.renderFeedbackList(feedbacks);
        } catch (error) {
            console.error('Failed to load feedbacks:', error);
            feedbackList.innerHTML = `
                <div class="text-center text-slate-400 text-sm py-4">
                    Không thể tải góp ý. <button onclick="app.loadFeedbacks()" class="text-purple-500 hover:underline">Thử lại</button>
                </div>
            `;
        }
    },

    async submitFeedback() {
        if (!this.currentExam?.meta?.id || !window.firebaseFeedback) return;

        const input = document.getElementById('feedback-input');
        if (!input) return;

        const content = input.value.trim();
        if (!content) {
            alert('Vui lòng nhập nội dung góp ý.');
            return;
        }

        try {
            await window.firebaseFeedback.addFeedback(this.currentExam.meta.id, content);
            input.value = '';
            document.getElementById('feedback-char-count').textContent = '0/256';
            await this.loadFeedbacks();
        } catch (error) {
            alert(error.message || 'Lỗi gửi góp ý.');
        }
    },

    async submitReply(commentId) {
        if (!this.currentExam?.meta?.id || !window.firebaseFeedback) return;

        const input = document.getElementById(`reply-input-${commentId}`);
        if (!input) return;

        const content = input.value.trim();
        if (!content) return;

        try {
            await window.firebaseFeedback.addReply(this.currentExam.meta.id, commentId, content);
            await this.loadFeedbacks();
        } catch (error) {
            alert(error.message || 'Lỗi gửi trả lời.');
        }
    },

    async deleteFeedback(commentId) {
        if (!this.currentExam?.meta?.id || !window.firebaseFeedback) return;
        if (!confirm('Bạn có chắc muốn xóa góp ý này?')) return;

        try {
            await window.firebaseFeedback.deleteFeedback(this.currentExam.meta.id, commentId);
            await this.loadFeedbacks();
        } catch (error) {
            alert(error.message || 'Lỗi xóa góp ý.');
        }
    },

    async markFeedbackFixed(commentId) {
        if (!this.currentExam?.meta?.id || !window.firebaseFeedback) return;

        try {
            await window.firebaseFeedback.markFeedbackFixed(this.currentExam.meta.id, commentId);
            await this.loadFeedbacks();
        } catch (error) {
            alert(error.message || 'Lỗi đánh dấu đã sửa.');
        }
    },

    toggleReplyForm(commentId) {
        const form = document.getElementById(`reply-form-${commentId}`);
        if (form) {
            form.classList.toggle('hidden');
            if (!form.classList.contains('hidden')) {
                document.getElementById(`reply-input-${commentId}`)?.focus();
            }
        }
    },

    renderFeedbackList(feedbacks) {
        const feedbackList = document.getElementById('feedback-list');
        if (!feedbackList) return;

        const currentUser = window.firebaseFeedback?.getCurrentUserInfo?.();
        const isAdmin = window.firebaseFeedback?.checkIsAdmin?.() || false;

        if (!feedbacks || feedbacks.length === 0) {
            feedbackList.innerHTML = `
                <div class="text-center text-slate-400 text-sm py-6">
                    <svg class="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
                    </svg>
                    Chưa có góp ý nào. Hãy là người đầu tiên!
                </div>
            `;
            return;
        }

        feedbackList.innerHTML = feedbacks.map(fb => {
            const timeAgo = this.formatTimeAgo(fb.createdAt);
            const canDelete = currentUser && (currentUser.uid === fb.userId || isAdmin);
            const canMarkFixed = isAdmin && !fb.isFixed;
            const avatar = fb.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(fb.userName)}&background=8b5cf6&color=fff`;

            const repliesHtml = (fb.replies || []).map(reply => {
                const replyAvatar = reply.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.userName)}&background=6366f1&color=fff`;
                const replyTimeAgo = this.formatTimeAgo(reply.createdAt);
                return `
                    <div class="flex gap-2 mt-3 ml-8 pl-3 border-l-2 border-slate-200 dark:border-slate-600">
                        <img src="${replyAvatar}" class="w-6 h-6 rounded-full shrink-0" alt="${reply.userName}">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-semibold text-xs text-slate-700 dark:text-slate-200">${reply.userName}</span>
                                <span class="text-[10px] text-slate-400">${replyTimeAgo}</span>
                            </div>
                            <p class="text-sm text-slate-600 dark:text-slate-300 mt-0.5 break-words">${this.escapeHtml(reply.content)}</p>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div class="flex gap-3">
                        <img src="${avatar}" class="w-9 h-9 rounded-full shrink-0" alt="${fb.userName}">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-semibold text-sm text-slate-800 dark:text-white">${fb.userName}</span>
                                <span class="text-xs text-slate-400">${timeAgo}</span>
                                ${fb.isFixed ? `
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
                                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                                        Đã sửa
                                    </span>
                                ` : ''}
                            </div>
                            <p class="text-sm text-slate-600 dark:text-slate-300 mt-1 break-words">${this.escapeHtml(fb.content)}</p>
                            
                            <!-- Actions -->
                            <div class="flex items-center gap-3 mt-2">
                                <button onclick="app.toggleReplyForm('${fb.id}')" class="text-xs text-slate-500 hover:text-purple-500 font-medium">Trả lời</button>
                                ${canMarkFixed ? `<button onclick="app.markFeedbackFixed('${fb.id}')" class="text-xs text-green-600 hover:text-green-700 font-medium">✓ Đã sửa</button>` : ''}
                                ${canDelete ? `<button onclick="app.deleteFeedback('${fb.id}')" class="text-xs text-red-500 hover:text-red-600 font-medium">Xóa</button>` : ''}
                            </div>

                            <!-- Replies -->
                            ${repliesHtml}

                            <!-- Reply Form -->
                            <div id="reply-form-${fb.id}" class="hidden mt-3 flex gap-2">
                                <input id="reply-input-${fb.id}" type="text" maxlength="256" class="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white dark:bg-slate-700 dark:text-white" placeholder="Trả lời...">
                                <button onclick="app.submitReply('${fb.id}')" class="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg">Gửi</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    formatTimeAgo(dateStr) {
        if (!dateStr) return '';
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ============================================================
    // PRACTICE HISTORY
    // ============================================================

    async showHistoryModal(examId, examTitle) {
        const modal = document.getElementById('history-modal');
        const titleEl = document.getElementById('history-exam-title');
        const listEl = document.getElementById('history-list');

        if (!modal) return;

        modal.classList.remove('hidden');
        titleEl.textContent = examTitle;
        listEl.innerHTML = '<div class="text-center text-slate-400 py-8"><div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>Đang tải...</div>';

        try {
            if (!window.firebaseExams?.getPracticeHistory) {
                listEl.innerHTML = '<div class="text-center text-slate-400 py-8">Chức năng không khả dụng</div>';
                return;
            }

            const history = await window.firebaseExams.getPracticeHistory(examId);

            if (!history || history.length === 0) {
                listEl.innerHTML = `
                    <div class="text-center py-8">
                        <svg class="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <p class="text-slate-500 dark:text-slate-400 font-medium">Chưa có lịch sử làm bài</p>
                        <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">Bắt đầu làm bài thi để xem lịch sử tại đây</p>
                    </div>
                `;
                return;
            }

            listEl.innerHTML = history.map((item, index) => {
                const date = new Date(item.timestamp);
                const dateStr = date.toLocaleDateString('vi-VN');
                const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                const durationMins = Math.floor(item.durationSeconds / 60);
                const durationSecs = item.durationSeconds % 60;
                const scoreColor = item.score >= 8 ? 'text-emerald-600 dark:text-emerald-400'
                    : item.score >= 5 ? 'text-blue-600 dark:text-blue-400'
                        : 'text-red-600 dark:text-red-400';
                const scoreBg = item.score >= 8 ? 'bg-emerald-50 dark:bg-emerald-900/30'
                    : item.score >= 5 ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'bg-red-50 dark:bg-red-900/30';

                return `
                    <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors">
                        <div class="flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 ${scoreBg} rounded-xl flex items-center justify-center shrink-0">
                                    <span class="font-bold ${scoreColor}">${item.score.toFixed(1)}</span>
                                </div>
                                <div>
                                    <div class="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                        <span>${dateStr}</span>
                                        <span class="text-slate-400">•</span>
                                        <span>${timeStr}</span>
                                    </div>
                                    <div class="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        <span class="flex items-center gap-1">
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            ${item.correctCount}/${item.totalQuestions} đúng
                                        </span>
                                        <span class="flex items-center gap-1">
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            ${durationMins}:${durationSecs.toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button onclick="app.reviewFromHistory('${item.id}')" 
                                class="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors shrink-0"
                                title="Xem lại bài làm">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.93 4.93A10 10 0 1021 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // Store history for review
            this.historyCache = history;

        } catch (error) {
            console.error('[History] Failed to load:', error);
            listEl.innerHTML = `<div class="text-center text-red-500 py-8">Lỗi tải lịch sử: ${error.message}</div>`;
        }
    },

    closeHistoryModal() {
        const modal = document.getElementById('history-modal');
        if (modal) modal.classList.add('hidden');
    },

    async reviewFromHistory(historyId) {
        // Find the history item
        const item = this.historyCache?.find(h => h.id === historyId);
        if (!item || !item.examData) {
            alert('Không thể xem lại bài làm này. Dữ liệu không khả dụng.');
            return;
        }

        // Close the history modal
        this.closeHistoryModal();

        // Set up for review
        this.currentExam = {
            meta: { id: item.examId, title: item.examTitle },
            data: item.examData,
            subId: item.subjectId
        };
        this.answers = item.answers || {};
        this.isReviewMode = true;

        // Render review
        this.renderTemplate('tpl-taking-exam');
        document.getElementById('desktop-palette-sidebar').classList.add('hidden');
        document.getElementById('mobile-footer').classList.add('hidden');
        document.getElementById('review-controls').classList.remove('hidden');

        this.renderQuestions(this.currentExam.data);
        this.renderMath();

        // Apply review styling (reuse existing review logic)
        const data = this.currentExam.data;

        const setStatus = (uniqueId, isCorrect) => {
            const el = document.getElementById(`q-${uniqueId}`);
            if (!el) return;
            el.dataset.status = isCorrect ? 'correct' : 'wrong';
            el.classList.add(isCorrect ? 'border-green-200' : 'border-red-200');
            if (isCorrect) el.classList.add('dark:border-green-900');
            else el.classList.add('dark:border-red-900');
        };

        // Part 1
        data.part1.forEach(q => {
            const uniqueId = `1_${q.id}`;
            const userVal = this.answers[uniqueId]?.val;
            const isCorrect = userVal == q.correct;
            setStatus(uniqueId, isCorrect);

            const inputs = document.querySelectorAll(`input[name="q_${uniqueId}"]`);
            inputs.forEach(inp => {
                const val = parseInt(inp.value);
                const wrapper = inp.nextElementSibling;
                if (val === q.correct) wrapper.classList.add('review-correct');
                if (val === userVal && val !== q.correct) wrapper.classList.add('review-wrong');
                if (val === userVal) inp.checked = true;
            });
        });

        // Part 2
        data.part2.forEach(q => {
            const uniqueId = `2_${q.id}`;
            const userSub = this.answers[uniqueId]?.sub || {};
            let fullyCorrect = true;
            q.subQuestions.forEach(sub => {
                const userAns = userSub[sub.id];
                const row = document.querySelector(`#q-${uniqueId} .sub-question-row[data-sub="${sub.id}"]`);
                if (!row) return;
                if (userAns !== sub.correct) {
                    fullyCorrect = false;
                    row.classList.add('bg-red-50', 'dark:bg-red-900/10');
                } else {
                    row.classList.add('bg-green-50', 'dark:bg-green-900/10');
                }
                const btns = row.querySelectorAll('.tf-btn');
                if (userAns === true) btns[0].classList.add(sub.correct === true ? 'selected-true' : 'selected-false');
                if (userAns === false) btns[1].classList.add(sub.correct === false ? 'selected-true' : 'selected-false');
                const correctBtn = sub.correct ? btns[0] : btns[1];
                correctBtn.classList.add('review-correct-answer');
                if (userAns !== sub.correct && userAns !== undefined) {
                    const wrongBtn = userAns ? btns[0] : btns[1];
                    wrongBtn.classList.add('review-wrong-answer');
                }
            });
            setStatus(uniqueId, fullyCorrect);
        });

        // Part 3
        data.part3.forEach(q => {
            const uniqueId = `3_${q.id}`;
            const userVal = String(this.answers[uniqueId]?.val || "").trim().toLowerCase();
            const correctVal = String(q.correct).trim().toLowerCase();
            const isCorrect = userVal === correctVal;
            setStatus(uniqueId, isCorrect);

            const inp = document.getElementById(`input-${uniqueId}`);
            if (inp) {
                inp.value = this.answers[uniqueId]?.val || "";
                if (isCorrect) inp.classList.add('border-green-500', 'bg-green-50');
                else inp.classList.add('border-red-500', 'bg-red-50');
            }
        });
    },

    // ============================================================
    // STEP-BY-STEP MODE METHODS
    // Chế độ làm từng câu một - phải trả lời đúng mới qua câu tiếp
    // ============================================================

    // Start Step-by-Step Mode
    startStepMode(subId, examId) {
        const subject = this.subjects[subId];
        if (!subject) { alert('Không tìm thấy môn học này.'); return; }
        const examMeta = subject.exams.find(e => e.id === examId);
        const originalData = this.examContentDB[examId];

        if (!examMeta || !originalData) { alert('Không tìm thấy dữ liệu bài thi.'); return; }

        // Deep copy
        const examData = JSON.parse(JSON.stringify(originalData));

        // Shuffle helper
        const shuffle = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        // Build question queue (flatten all parts)
        const questionQueue = [];

        // Part 1 - Multiple Choice
        if (examData.part1) {
            shuffle(examData.part1);
            examData.part1.forEach((q, idx) => {
                // Shuffle options
                const optionObjs = (q.options || []).map((opt, i) => ({
                    text: opt,
                    isCorrect: i === (q.correct ?? 0)
                }));
                shuffle(optionObjs);
                q.options = optionObjs.map(o => o.text);
                q.correct = optionObjs.findIndex(o => o.isCorrect);

                questionQueue.push({
                    type: 'part1',
                    partLabel: 'Phần I: Trắc nghiệm',
                    typeLabel: 'Trắc nghiệm',
                    data: q,
                    index: idx + 1
                });
            });
        }

        // Part 2 - True/False
        if (examData.part2) {
            shuffle(examData.part2);
            examData.part2.forEach((q, idx) => {
                if (q.subQuestions) shuffle(q.subQuestions);
                questionQueue.push({
                    type: 'part2',
                    partLabel: 'Phần II: Đúng/Sai',
                    typeLabel: 'Đúng / Sai',
                    data: q,
                    index: idx + 1
                });
            });
        }

        // Part 3 - Short Answer
        if (examData.part3) {
            shuffle(examData.part3);
            examData.part3.forEach((q, idx) => {
                questionQueue.push({
                    type: 'part3',
                    partLabel: 'Phần III: Trả lời ngắn',
                    typeLabel: 'Trả lời ngắn',
                    data: q,
                    index: idx + 1
                });
            });
        }

        // Initialize step mode state
        this.stepMode = {
            active: true,
            currentIndex: 0,
            questionQueue: questionQueue,
            correctCount: 0,
            skippedCount: 0,
            currentQuestion: null,
            selectedAnswer: null,
            tfAnswers: {},
            isChecked: false,
            isCorrect: false
        };

        this.currentExam = { meta: examMeta, data: examData, subId: subId };
        this.startTime = new Date();
        this.timerEl.classList.remove('hidden');

        // Render step-by-step template
        this.renderTemplate('tpl-step-by-step');

        // Update total count
        document.getElementById('step-total').textContent = questionQueue.length;

        // Render first question
        this.renderStepQuestion();
        this.startTimer(examMeta.time * 60);
    },

    // Render current step question
    renderStepQuestion() {
        const { currentIndex, questionQueue } = this.stepMode;

        if (currentIndex >= questionQueue.length) {
            this.showStepResult();
            return;
        }

        const q = questionQueue[currentIndex];
        this.stepMode.currentQuestion = q;
        this.stepMode.selectedAnswer = null;
        this.stepMode.tfAnswers = {};
        this.stepMode.tfCorrect = {};  // Reset T/F correct tracker
        this.stepMode.isChecked = false;
        this.stepMode.isCorrect = false;

        // Update progress
        document.getElementById('step-current').textContent = currentIndex + 1;
        document.getElementById('step-correct-count').textContent = this.stepMode.correctCount;
        document.getElementById('step-skipped-count').textContent = this.stepMode.skippedCount;

        const progress = ((currentIndex) / questionQueue.length) * 100;
        document.getElementById('step-progress-bar').style.width = progress + '%';

        // Update type badge
        document.getElementById('step-question-type-badge').textContent = q.typeLabel;
        document.getElementById('step-question-part').textContent = q.partLabel;

        // Helper: format text with MathJax support
        const formatText = (text) => {
            if (!text) return '';
            const el = document.createElement('span');
            el.textContent = text;
            let escaped = el.innerHTML;
            // Handle degree symbols
            escaped = escaped.replace(/(\d*)°C/g, '\\($1^\\circ C\\)');
            escaped = escaped.replace(/(\d*)°F/g, '\\($1^\\circ F\\)');
            escaped = escaped.replace(/(\d*)°/g, '\\($1^\\circ\\)');
            return escaped;
        };

        // Render question text
        document.getElementById('step-question-text').innerHTML = formatText(q.data.text);

        // Handle image
        const imgContainer = document.getElementById('step-question-image');
        if (q.data.image) {
            imgContainer.classList.remove('hidden');
            imgContainer.querySelector('img').src = q.data.image;
        } else {
            imgContainer.classList.add('hidden');
        }

        // Hide all answer containers first
        document.getElementById('step-options-container').classList.remove('hidden');
        document.getElementById('step-options-container').innerHTML = '';
        document.getElementById('step-subquestions-container').classList.add('hidden');
        document.getElementById('step-short-answer-container').classList.add('hidden');

        // Render based on question type
        if (q.type === 'part1') {
            this.renderStepPart1(q.data);
        } else if (q.type === 'part2') {
            document.getElementById('step-options-container').classList.add('hidden');
            document.getElementById('step-subquestions-container').classList.remove('hidden');
            this.renderStepPart2(q.data);
        } else if (q.type === 'part3') {
            document.getElementById('step-options-container').classList.add('hidden');
            document.getElementById('step-short-answer-container').classList.remove('hidden');
            document.getElementById('step-short-input').value = '';
            document.getElementById('step-short-input').focus();
        }

        // Hide feedback
        document.getElementById('step-feedback').classList.add('hidden');

        // Reset buttons - show check button for Part 2 and Part 3 (Part 1 auto-checks on click)
        if (q.type === 'part2' || q.type === 'part3') {
            document.getElementById('step-check-btn').classList.remove('hidden');
        } else {
            document.getElementById('step-check-btn').classList.add('hidden');
        }
        document.getElementById('step-next-btn').classList.add('hidden');
        document.getElementById('step-skip-btn').disabled = false;

        // Render MathJax
        this.renderMath();

        // Scroll to top
        document.getElementById('step-question-container').scrollTop = 0;
    },

    // Render Part 1 options
    renderStepPart1(q) {
        const container = document.getElementById('step-options-container');
        container.innerHTML = '';

        const labels = ['A', 'B', 'C', 'D'];
        (q.options || []).forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'step-option flex items-start gap-3';
            btn.innerHTML = `
                <span class="w-8 h-8 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">${labels[i]}</span>
                <span class="dynamic-text text-slate-700 dark:text-slate-200 pt-1">${this.stepFormatText(opt)}</span>
            `;
            btn.onclick = () => this.stepSelectOption(i, btn);
            container.appendChild(btn);
        });
    },

    // Render Part 2 sub-questions
    renderStepPart2(q) {
        const container = document.getElementById('step-subquestions-container');
        container.innerHTML = '';

        (q.subQuestions || []).forEach((sub, i) => {
            const row = document.createElement('div');
            row.className = 'p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl';
            row.innerHTML = `
                <p class="dynamic-text text-slate-700 dark:text-slate-200 mb-3">${String.fromCharCode(97 + i)}) ${this.stepFormatText(sub.text)}</p>
                <div class="flex gap-2" id="step-tf-btns-${i}">
                    <button class="step-tf-btn" onclick="app.stepSelectTF(${i}, true, this)">Đúng</button>
                    <button class="step-tf-btn" onclick="app.stepSelectTF(${i}, false, this)">Sai</button>
                </div>
            `;
            container.appendChild(row);
        });
    },

    // Helper: Format text for step mode
    stepFormatText(text) {
        if (!text) return '';
        const el = document.createElement('span');
        el.textContent = text;
        let escaped = el.innerHTML;
        escaped = escaped.replace(/(\d*)°C/g, '\\($1^\\circ C\\)');
        escaped = escaped.replace(/(\d*)°F/g, '\\($1^\\circ F\\)');
        escaped = escaped.replace(/(\d*)°/g, '\\($1^\\circ\\)');
        return escaped;
    },

    // Select option for Part 1 - auto check on click
    stepSelectOption(index, btnEl) {
        if (this.stepMode.isChecked) return;

        const q = this.stepMode.currentQuestion;
        if (!q) return;

        // Remove previous selection
        document.querySelectorAll('#step-options-container .step-option').forEach(b => {
            b.classList.remove('step-option-selected', 'step-option-correct', 'step-option-wrong');
        });

        this.stepMode.selectedAnswer = index;
        this.stepMode.isChecked = true;

        const isCorrect = index === q.data.correct;

        if (isCorrect) {
            // Correct - show green
            btnEl.classList.add('step-option-correct');
            this.stepMode.isCorrect = true;
            this.stepMode.correctCount++;

            // Update count and show next button
            document.getElementById('step-correct-count').textContent = this.stepMode.correctCount;
            document.getElementById('step-check-btn').classList.add('hidden');
            document.getElementById('step-next-btn').classList.remove('hidden');
            document.getElementById('step-skip-btn').disabled = true;
        } else {
            // Wrong - only show red on selected, don't reveal correct answer
            btnEl.classList.add('step-option-wrong');
            this.stepMode.isCorrect = false;

            // Allow retry after a short delay
            setTimeout(() => {
                if (!this.stepMode.isCorrect) {
                    btnEl.classList.remove('step-option-wrong');
                    this.stepMode.isChecked = false;
                }
            }, 1000);
        }
    },

    // Select T/F for Part 2 - just select, don't check yet
    stepSelectTF(subIndex, isTrue, btnEl) {
        // If already checked and this sub was correct, don't allow change
        if (this.stepMode.isChecked) return;

        // Clear previous selection for this sub-question only
        const container = document.getElementById(`step-tf-btns-${subIndex}`);
        container.querySelectorAll('.step-tf-btn').forEach(b => {
            b.classList.remove('step-tf-selected-true', 'step-tf-selected-false', 'step-tf-correct', 'step-tf-wrong');
        });

        // Highlight selected button
        btnEl.classList.add(isTrue ? 'step-tf-selected-true' : 'step-tf-selected-false');

        // Store the answer
        this.stepMode.tfAnswers[subIndex] = isTrue;
    },

    // Check answer - used for Part 2 (T/F) and Part 3 (short answer)
    stepCheckAnswer() {
        const q = this.stepMode.currentQuestion;
        if (!q || this.stepMode.isChecked) return;

        // Part 2 - True/False
        if (q.type === 'part2') {
            const subQuestions = q.data.subQuestions || [];
            const totalSubs = subQuestions.length;
            const answeredSubs = Object.keys(this.stepMode.tfAnswers).length;

            // Check if all sub-questions are answered
            if (answeredSubs < totalSubs) {
                // Shake unanswered sub-questions
                subQuestions.forEach((_, i) => {
                    if (this.stepMode.tfAnswers[i] === undefined) {
                        const container = document.getElementById(`step-tf-btns-${i}`);
                        if (container) {
                            container.classList.add('animate-shake');
                            setTimeout(() => container.classList.remove('animate-shake'), 500);
                        }
                    }
                });
                return;
            }

            // Check each sub-question and show results
            let allCorrect = true;
            subQuestions.forEach((sub, i) => {
                const userAns = this.stepMode.tfAnswers[i];
                const correctAns = sub.correct === true || sub.correct === 'true';
                const isSubCorrect = userAns === correctAns;

                const container = document.getElementById(`step-tf-btns-${i}`);
                const btns = container.querySelectorAll('.step-tf-btn');

                // Remove selection styling
                btns.forEach(b => b.classList.remove('step-tf-selected-true', 'step-tf-selected-false'));

                if (isSubCorrect) {
                    // Show correct in green
                    (userAns ? btns[0] : btns[1]).classList.add('step-tf-correct');
                } else {
                    // Show user's wrong answer in red
                    (userAns ? btns[0] : btns[1]).classList.add('step-tf-wrong');
                    allCorrect = false;
                }
            });

            this.stepMode.isChecked = true;

            if (allCorrect) {
                // All correct - show next button
                this.stepMode.isCorrect = true;
                this.stepMode.correctCount++;
                document.getElementById('step-correct-count').textContent = this.stepMode.correctCount;
                document.getElementById('step-check-btn').classList.add('hidden');
                document.getElementById('step-next-btn').classList.remove('hidden');
                document.getElementById('step-skip-btn').disabled = true;
            } else {
                // Some wrong - allow retry after delay
                setTimeout(() => {
                    this.stepMode.isChecked = false;
                    // Reset TF buttons styling
                    document.querySelectorAll('.step-tf-btn').forEach(b => {
                        b.classList.remove('step-tf-correct', 'step-tf-wrong');
                    });
                    // Clear answers
                    this.stepMode.tfAnswers = {};
                }, 1500);
            }
            return;
        }

        // Part 3 - Short Answer
        if (q.type === 'part3') {
            const input = document.getElementById('step-short-input');
            const userVal = input.value.trim().toLowerCase();
            const correctVal = String(q.data.correct).trim().toLowerCase();

            if (!userVal) {
                input.classList.add('animate-shake');
                setTimeout(() => input.classList.remove('animate-shake'), 500);
                return;
            }

            const isCorrect = userVal === correctVal;

            if (isCorrect) {
                input.classList.remove('border-slate-200', 'dark:border-slate-600');
                input.classList.add('border-emerald-500', 'bg-emerald-50', 'dark:bg-emerald-900/20');

                this.stepMode.isChecked = true;
                this.stepMode.isCorrect = true;
                this.stepMode.correctCount++;

                document.getElementById('step-correct-count').textContent = this.stepMode.correctCount;
                document.getElementById('step-check-btn').classList.add('hidden');
                document.getElementById('step-next-btn').classList.remove('hidden');
                document.getElementById('step-skip-btn').disabled = true;
            } else {
                input.classList.remove('border-slate-200', 'dark:border-slate-600');
                input.classList.add('border-red-500', 'bg-red-50', 'dark:bg-red-900/20');

                setTimeout(() => {
                    input.classList.remove('border-red-500', 'bg-red-50', 'dark:bg-red-900/20');
                    input.classList.add('border-slate-200', 'dark:border-slate-600');
                    input.value = '';
                    input.focus();
                }, 1000);
            }
        }
    },

    // Show feedback message
    showStepFeedback(isCorrect, title, message) {
        const feedback = document.getElementById('step-feedback');
        const icon = document.getElementById('step-feedback-icon');
        const titleEl = document.getElementById('step-feedback-title');
        const messageEl = document.getElementById('step-feedback-message');

        feedback.classList.remove('hidden', 'feedback-correct', 'feedback-wrong');
        feedback.classList.add(isCorrect ? 'feedback-correct' : 'feedback-wrong');

        icon.innerHTML = isCorrect
            ? '<svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>'
            : '<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
        icon.className = `shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isCorrect ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`;

        titleEl.textContent = title;
        titleEl.className = `font-bold text-lg mb-1 ${isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`;

        messageEl.textContent = message;
        messageEl.className = `text-sm ${isCorrect ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`;
    },

    // Go to next question
    stepNextQuestion() {
        this.stepMode.currentIndex++;
        this.renderStepQuestion();
    },

    // Skip current question
    stepSkipQuestion() {
        if (this.stepMode.isChecked) return;

        this.stepMode.skippedCount++;
        document.getElementById('step-skipped-count').textContent = this.stepMode.skippedCount;

        this.stepMode.currentIndex++;
        this.renderStepQuestion();
    },

    // Exit step mode
    exitStepMode() {
        if (confirm('Bạn có chắc muốn thoát chế độ từng câu? Tiến trình sẽ không được lưu.')) {
            this.stopTimer();
            this.stepMode.active = false;
            this.timerEl.classList.add('hidden');
            this.goHome();
        }
    },

    // Show step mode result
    showStepResult() {
        this.stopTimer();
        this.stepMode.active = false;
        this.timerEl.classList.add('hidden');

        const { correctCount, skippedCount, questionQueue } = this.stepMode;
        const total = questionQueue.length;
        const score = ((correctCount / total) * 10).toFixed(1);

        this.renderTemplate('tpl-result');

        // Calculate time
        const duration = Math.floor((new Date() - this.startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;

        document.getElementById('result-subject-name').textContent = `${this.currentExam.meta.title} (Chế độ Từng Câu)`;
        document.getElementById('score-display').textContent = score;
        document.getElementById('result-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('result-correct').textContent = `${correctCount}/${total}`;
        document.getElementById('result-wrong').textContent = `${total - correctCount - skippedCount}/${total}`;

        // Update average bar
        const avgBar = document.getElementById('stat-avg-bar');
        if (avgBar) avgBar.style.width = (score * 10) + '%';
    }
};

// Export app and musicPlayer for manual initialization
window.app = app;
window.musicPlayer = musicPlayer;
