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

    async init() {
        // Theme Init
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark'); document.getElementById('dark-mode-toggle').checked = true;
        } else { document.getElementById('dark-mode-toggle').checked = false; }
        
        // Load Stats
        const savedStats = localStorage.getItem('studyStation_stats');
        if (savedStats) this.stats = JSON.parse(savedStats);

        // Listeners
        document.getElementById('dark-mode-toggle').addEventListener('change', (e) => this.toggleDarkMode(e.target.checked));
        document.getElementById('font-size-slider').addEventListener('input', (e) => {
            document.documentElement.style.setProperty('--question-font-size', e.target.value + 'px');
            document.getElementById('font-size-display').innerText = e.target.value + 'px';
        });
        
        await this.loadSubjects();
        this.goHome();
    },

    async loadSubjects() {
        try {
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
            this.subjectLoadError = 'Không thể tải danh sách đề thi. Vui lòng kiểm tra lại thư mục tests.';
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
        window.scrollTo(0,0);
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
        sub.exams.forEach(exam => {
            const el = document.createElement('div');
            el.className = 'bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex justify-between items-center group';
            el.onclick = () => this.startExam(subId, exam.id);
            el.innerHTML = `<div class="flex items-start gap-4"><div class="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm mt-1">0${sub.exams.indexOf(exam) + 1}</div><div><h4 class="font-bold text-lg text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${exam.title}</h4><div class="flex items-center gap-4 mt-2"><span class="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded flex items-center"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>${exam.time} phút</span></div></div></div>`;
            grid.appendChild(el);
        });
    },

    startExam(subId, examId) {
        const subject = this.subjects[subId];
        if (!subject) { alert('Không tìm thấy môn học này.'); return; }
        const examMeta = subject.exams.find(e => e.id === examId);
        const examData = this.examContentDB[examId];
        if (!examMeta || !examData) { alert('Không tìm thấy dữ liệu bài thi.'); return; }
        this.currentExam = { meta: examMeta, data: examData, subId: subId };
        this.answers = {};
        this.isReviewMode = false;
        this.startTime = new Date();

        this.renderTemplate('tpl-taking-exam');
        this.timerEl.classList.remove('hidden');
        
        this.renderQuestions(examData);
        this.renderPalette(examData);
        this.startTimer(examMeta.time * 60);

        if (window.MathJax) MathJax.typesetPromise();
    },

    renderQuestions(data) {
        const renderQ = (q, index, type) => {
            const div = document.createElement('div');
            div.id = `q-${q.id}`;
            div.dataset.type = type;
            div.className = 'bg-white dark:bg-slate-800 p-5 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-soft question-card';
            
            let content = `
                <div class="mb-4 md:mb-6 font-medium text-slate-800 dark:text-white flex gap-4">
                    <div class="shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-xl flex items-center justify-center font-bold shadow-sm">${q.id}</div>
                    <span class="pt-1.5 leading-relaxed font-question dynamic-text">${q.text}</span>
                </div>`;

            if (type === 1) {
                content += `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-start">
                    ${q.options.map((opt, i) => `
                        <label class="cursor-pointer group relative option-label" data-idx="${i}">
                            <input type="radio" name="q${q.id}" value="${i}" class="peer sr-only option-radio" onchange="app.handleAnswer(1, ${q.id}, ${i})" ${this.isReviewMode ? 'disabled' : ''}>
                            <div class="p-3 md:p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center">
                                <div class="option-dot-outer w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-500 mr-3 flex items-center justify-center shrink-0">
                                    <div class="option-dot-inner w-2.5 h-2.5 bg-white rounded-full"></div>
                                </div>
                                <span class="font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-white font-question dynamic-text text-left break-words w-full">${opt}</span>
                            </div>
                        </label>`).join('')}</div>`;
            } else if (type === 2) {
                content += `<div class="space-y-3 md:space-y-4">
                    ${q.subQuestions.map(sub => `
                        <div class="flex items-center justify-between p-3 md:p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700 transition-colors sub-question-row" data-sub="${sub.id}">
                            <div class="flex-1 pr-4 text-slate-700 dark:text-slate-300 font-question dynamic-text"><span class="font-bold mr-2 text-indigo-600 dark:text-indigo-400 font-sans">${sub.id})</span> ${sub.text}</div>
                            <div class="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-600 shadow-sm shrink-0 h-fit self-center">
                                <button onclick="app.handleTFAnswer(${q.id}, '${sub.id}', true, this)" class="tf-btn w-14 md:w-16 py-1.5 md:py-2 text-xs md:text-sm font-bold rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700" ${this.isReviewMode ? 'disabled' : ''}>ĐÚNG</button>
                                <button onclick="app.handleTFAnswer(${q.id}, '${sub.id}', false, this)" class="tf-btn w-14 md:w-16 py-1.5 md:py-2 text-xs md:text-sm font-bold rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700" ${this.isReviewMode ? 'disabled' : ''}>SAI</button>
                            </div>
                        </div>`).join('')}</div>`;
            } else if (type === 3) {
                content += `<div class="relative">
                    <input type="text" id="input-${q.id}" oninput="app.handleAnswer(3, ${q.id}, this.value)" placeholder="Nhập đáp án..." class="w-full md:w-2/3 p-3 md:p-4 pl-5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900 focus:border-emerald-500 outline-none transition-all font-medium text-lg text-slate-800 dark:text-white placeholder:text-slate-400 font-question" ${this.isReviewMode ? 'disabled' : ''}>
                    ${this.isReviewMode ? `<div class="mt-2 text-sm font-bold text-emerald-600">Đáp án đúng: ${q.correct}</div>` : ''}
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
    },

    renderPalette(data) {
        const createBtn = (id, isMobile) => {
            const btnId = isMobile ? `mob-pal-btn-${id}` : `pal-btn-${id}`;
            return `<button id="${btnId}" onclick="document.getElementById('q-${id}').scrollIntoView({behavior: 'smooth', block: 'center'})" class="question-nav-item w-full aspect-square flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800">${id}</button>`;
        };
        const allIds = [...data.part1.map(q=>q.id), ...data.part2.map(q=>q.id), ...data.part3.map(q=>q.id)];
        document.getElementById('question-palette').innerHTML = allIds.map(id => createBtn(id, false)).join('');
        document.getElementById('mobile-palette-grid').innerHTML = allIds.map(id => createBtn(id, true)).join('');
    },

    handleAnswer(part, qId, value) {
        if (this.isReviewMode) return;
        if (!this.answers[qId]) this.answers[qId] = {};
        this.answers[qId].val = value;
        this.answers[qId].part = part;
        this.updatePalette(qId, value !== "" && value !== undefined);
    },

    handleTFAnswer(qId, subId, isTrue, btnEl) {
        if (this.isReviewMode) return;
        if (!this.answers[qId]) this.answers[qId] = { part: 2, sub: {} };
        if (!this.answers[qId].sub) this.answers[qId].sub = {};
        this.answers[qId].sub[subId] = isTrue;

        const parent = btnEl.parentElement;
        parent.querySelectorAll('.tf-btn').forEach(b => {
            b.classList.remove('selected-true', 'selected-false');
            b.classList.add('text-slate-500', 'dark:text-slate-400');
        });
        if (isTrue) { btnEl.classList.add('selected-true'); btnEl.classList.remove('text-slate-500', 'dark:text-slate-400'); }
        else { btnEl.classList.add('selected-false'); btnEl.classList.remove('text-slate-500', 'dark:text-slate-400'); }

        const qData = this.currentExam.data.part2.find(q => q.id === qId);
        const req = qData ? qData.subQuestions.map(s => s.id) : [];
        const ans = Object.keys(this.answers[qId].sub);
        this.updatePalette(qId, req.every(k => ans.includes(k)));
    },

    updatePalette(qId, isAnswered) {
        [`pal-btn-${qId}`, `mob-pal-btn-${qId}`].forEach(id => {
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
            if (this.answers[q.id]?.val == q.correct) { earnedScore += 0.25; correctCount++; }
        });

        maxScore += data.part2.length * 1.0;
        data.part2.forEach(q => {
            let qCorrectSub = 0;
            if (this.answers[q.id]?.sub) {
                q.subQuestions.forEach(sub => {
                    if (this.answers[q.id].sub[sub.id] === sub.correct) qCorrectSub++;
                });
            }
            if (qCorrectSub === 1) earnedScore += 0.1;
            if (qCorrectSub === 2) earnedScore += 0.25;
            if (qCorrectSub === 3) earnedScore += 0.5;
            if (qCorrectSub === 4) { earnedScore += 1.0; correctCount++; }
        });

        maxScore += data.part3.length * 0.25;
        data.part3.forEach(q => {
            const userVal = String(this.answers[q.id]?.val || "").trim().toLowerCase();
            const correctVal = String(q.correct).trim().toLowerCase();
            if (userVal === correctVal) { earnedScore += 0.25; correctCount++; }
        });

        const finalScore = maxScore > 0 ? (earnedScore / maxScore) * 10 : 0;
        wrongCount = totalQuestions - correctCount;

        // Update Statistics
        this.updateStats(this.currentExam.meta.id, finalScore, durationSeconds);

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
    },

    reviewExam() {
        this.isReviewMode = true;
        this.renderTemplate('tpl-taking-exam');
        document.getElementById('desktop-palette-sidebar').classList.add('hidden');
        document.getElementById('mobile-footer').classList.add('hidden');
        document.getElementById('review-controls').classList.remove('hidden');
        
        this.renderQuestions(this.currentExam.data);
        if (window.MathJax) MathJax.typesetPromise();

        const data = this.currentExam.data;
        const setStatus = (id, isCorrect) => {
            const el = document.getElementById(`q-${id}`);
            el.dataset.status = isCorrect ? 'correct' : 'wrong';
            el.classList.add(isCorrect ? 'border-green-200' : 'border-red-200');
            if(isCorrect) el.classList.add('dark:border-green-900');
            else el.classList.add('dark:border-red-900');
        };

        data.part1.forEach(q => {
            const userVal = this.answers[q.id]?.val;
            const isCorrect = userVal == q.correct;
            setStatus(q.id, isCorrect);
            const inputs = document.querySelectorAll(`input[name="q${q.id}"]`);
            inputs.forEach(inp => {
                const val = parseInt(inp.value);
                const wrapper = inp.nextElementSibling;
                if (val === q.correct) wrapper.classList.add('review-correct');
                if (val === userVal && val !== q.correct) wrapper.classList.add('review-wrong');
                if (val === userVal) inp.checked = true;
            });
        });

        data.part2.forEach(q => {
            const userSub = this.answers[q.id]?.sub || {};
            let fullyCorrect = true;
            q.subQuestions.forEach(sub => {
                const userAns = userSub[sub.id];
                const row = document.querySelector(`#q-${q.id} .sub-question-row[data-sub="${sub.id}"]`);
                if (userAns !== sub.correct) { fullyCorrect = false; row.classList.add('bg-red-50', 'dark:bg-red-900/10'); } 
                else { row.classList.add('bg-green-50', 'dark:bg-green-900/10'); }
                const btns = row.querySelectorAll('.tf-btn');
                if(userAns === true) btns[0].classList.add(sub.correct === true ? 'selected-true' : 'selected-false');
                if(userAns === false) btns[1].classList.add(sub.correct === false ? 'selected-true' : 'selected-false');
                if(userAns !== sub.correct) {
                    const correctBtn = sub.correct ? btns[0] : btns[1];
                    correctBtn.style.border = "2px solid #10b981";
                }
            });
            setStatus(q.id, fullyCorrect);
        });

        data.part3.forEach(q => {
            const userVal = String(this.answers[q.id]?.val || "").trim().toLowerCase();
            const correctVal = String(q.correct).trim().toLowerCase();
            const isCorrect = userVal === correctVal;
            setStatus(q.id, isCorrect);
            const inp = document.getElementById(`input-${q.id}`);
            inp.value = this.answers[q.id]?.val || "";
            if(isCorrect) inp.classList.add('border-green-500', 'bg-green-50');
            else inp.classList.add('border-red-500', 'bg-red-50');
        });
    },

    filterReview(type) {
        document.querySelectorAll('.filter-btn').forEach(b => {
            if(b.dataset.filter === type) b.classList.add('ring-2', 'ring-offset-2', 'ring-blue-400');
            else b.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-400');
        });
        const cards = document.querySelectorAll('.question-card');
        cards.forEach(card => {
            const status = card.dataset.status;
            if (type === 'all') card.classList.remove('hidden');
            else if (type === 'correct') { if (status === 'correct') card.classList.remove('hidden'); else card.classList.add('hidden'); }
            else if (type === 'wrong') { if (status === 'wrong') card.classList.remove('hidden'); else card.classList.add('hidden'); }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    musicPlayer.init();
    app.init();
});