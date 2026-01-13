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

// --- Custom Dialog System ---
// Replaces native alert() and confirm() with beautiful modals
window.customDialog = {
    // Icon templates
    icons: {
        warning: `<svg class="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>`,
        error: `<svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`,
        success: `<svg class="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`,
        info: `<svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`,
        question: `<svg class="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`,
        logout: `<svg class="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>`
    },

    // Background colors for icons
    iconBg: {
        warning: 'bg-amber-100 dark:bg-amber-900/30',
        error: 'bg-red-100 dark:bg-red-900/30',
        success: 'bg-emerald-100 dark:bg-emerald-900/30',
        info: 'bg-blue-100 dark:bg-blue-900/30',
        question: 'bg-indigo-100 dark:bg-indigo-900/30',
        logout: 'bg-orange-100 dark:bg-orange-900/30'
    },

    // Pending callback
    _resolveCallback: null,

    // Show alert dialog (replacement for alert())
    alert(title, message, type = 'info') {
        return this.show({
            type,
            title,
            message,
            buttons: [
                { text: 'Đã hiểu', primary: true, action: 'ok' }
            ]
        });
    },

    // Show confirm dialog (replacement for confirm())
    confirm(title, message, options = {}) {
        const type = options.type || 'question';
        const confirmText = options.confirmText || 'Xác nhận';
        const cancelText = options.cancelText || 'Hủy bỏ';
        const confirmClass = options.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700';

        return this.show({
            type,
            title,
            message,
            buttons: [
                { text: cancelText, primary: false, action: 'cancel' },
                { text: confirmText, primary: true, action: 'confirm', className: confirmClass }
            ]
        });
    },

    // Generic show method
    show(config) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('custom-dialog');
            const iconEl = document.getElementById('dialog-icon');
            const titleEl = document.getElementById('dialog-title');
            const messageEl = document.getElementById('dialog-message');
            const actionsEl = document.getElementById('dialog-actions');

            if (!dialog) {
                // Fallback to native if modal not available
                if (config.buttons.length > 1) {
                    resolve(confirm(config.message) ? 'confirm' : 'cancel');
                } else {
                    alert(config.message);
                    resolve('ok');
                }
                return;
            }

            // Set icon
            const iconType = config.type || 'info';
            iconEl.innerHTML = this.icons[iconType] || this.icons.info;
            iconEl.className = `w-16 h-16 rounded-full flex items-center justify-center ${this.iconBg[iconType] || this.iconBg.info}`;

            // Set content
            titleEl.textContent = config.title || '';
            messageEl.textContent = config.message || '';

            // Create buttons
            actionsEl.innerHTML = '';
            (config.buttons || []).forEach(btn => {
                const button = document.createElement('button');
                button.textContent = btn.text;

                if (btn.primary) {
                    button.className = `flex-1 py-3 px-4 rounded-xl text-white font-bold transition-colors shadow-lg ${btn.className || 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`;
                } else {
                    button.className = 'flex-1 py-3 px-4 rounded-xl font-bold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors';
                }

                button.onclick = () => {
                    // Clear callback first to prevent double resolve
                    this._resolveCallback = null;
                    // Close dialog
                    const dlg = document.getElementById('custom-dialog');
                    if (dlg) {
                        dlg.classList.remove('show');
                        document.body.style.overflow = '';
                    }
                    // Resolve with button action
                    resolve(btn.action);
                };
                actionsEl.appendChild(button);
            });

            // Show dialog
            dialog.classList.add('show');
            document.body.style.overflow = 'hidden';
            this._resolveCallback = resolve;
        });
    },

    // Close dialog (called by backdrop click)
    close() {
        const dialog = document.getElementById('custom-dialog');
        if (dialog) {
            dialog.classList.remove('show');
            document.body.style.overflow = '';
        }
        // Only resolve if callback still exists (not already resolved by button)
        if (this._resolveCallback) {
            this._resolveCallback('cancel');
            this._resolveCallback = null;
        }
    }
};

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
    isPlaying: false,
    miniForced: false,
    isMinimized: false,

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
        this.initDraggable();
    },

    bindEvents() {
        this.refs.toggleBtn?.addEventListener('click', () => {
            if (!this.isPanelVisible) {
                // Mở lại từ header -> Luôn hiện Full View
                this.toggleMiniMode(false);
                this.togglePanel(true);
            } else {
                // Đang mở -> Đóng
                this.togglePanel(false);
            }
        });

        // "Thu gọn" button -> Switch to Mini Mode
        this.refs.hideBtn?.addEventListener('click', () => this.toggleMiniMode(true));

        // "Tắt" button -> Stop and Hide
        this.refs.stopBtn?.addEventListener('click', () => {
            this.stopPlayback();
            if (this.refs.panel) this.refs.panel.classList.add('hidden');
            this.isPanelVisible = false;
            this.refs.overlay?.classList.add('hidden');
        });

        // Mini Mode Controls
        this.refs.miniOpen?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMiniMode(false);
        });

        this.refs.miniClose?.addEventListener('click', (e) => {
            e.stopPropagation();
            // Nút "Ẩn": Chỉ ẩn giao diện, nhạc vẫn chạy
            this.togglePanel(false);
        });

        this.refs.miniPlay?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayPause();
        });

        this.refs.prevBtn?.addEventListener('click', () => this.previousTrack());
        this.refs.nextBtn?.addEventListener('click', () => this.nextTrack());
        this.refs.playBtn?.addEventListener('click', () => this.togglePlayPause());

        this.refs.volumeInput?.addEventListener('input', (e) => this.setVolume(e.target.value));

        if (this.refs.addForm) {
            this.refs.addForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddTrack(this.refs.addInput.value);
            });
        }

        this.refs.resetBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.customTracks = [];
            this.saveCustomTracks();
            this.rebuildTrackList();
            this.displayFeedback('Đã khôi phục danh sách mặc định.', 'success');
        });

        this.refs.overlay?.addEventListener('click', () => {
            // Clicking overlay only closes full panel if not draggable mode?
            // Actually, with draggable mode we might not want overlay at all.
            // For now, let's keep it simple: overlay click hides panel (full stop).
            this.togglePanel();
        });
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
        const track = this.tracks[this.currentIndex];
        if (this.refs.miniTitle) {
            this.refs.miniTitle.textContent = track ? track.title : 'Chưa chọn bài hát';
        }
    },

    updateMiniPlayButton() {
        if (!this.refs.miniPlay) return;
        this.refs.miniPlay.innerHTML = this.isPlaying
            ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>`;
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
                // Show panel first to ensure player div is visible for API
                this.togglePanel(true);
                // Small delay to allow transition/rendering
                setTimeout(() => this.playTrack(true), 50);
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

        // Ensure panel is visible for player initialization
        if (autoPlay && !this.isPanelVisible && !this.isMinimized) {
            this.togglePanel(true);
        }

        this.ensurePlayerReady(() => {
            // Hide placeholder explicitly just in case
            this.refs.placeholder?.classList.add('hidden');

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
    },

    toggleMiniMode(minimize) {
        this.isMinimized = minimize;
        const full = document.getElementById('music-full-view');
        const mini = this.refs.mini;

        if (!full || !mini) return;

        if (minimize) {
            full.classList.add('hidden');
            mini.classList.remove('hidden');
            this.refs.panel.classList.remove('w-full', 'md:w-auto', 'md:max-w-md', 'p-4', 'md:p-5');
            this.refs.panel.classList.add('w-auto');
            this.refs.overlay?.classList.add('hidden');
        } else {
            full.classList.remove('hidden');
            mini.classList.add('hidden');
            this.refs.panel.classList.add('w-full', 'md:w-auto', 'md:max-w-md', 'p-4', 'md:p-5');
            this.refs.panel.classList.remove('w-auto');
        }

        // Ensure panel is visible
        if (this.refs.panel.classList.contains('hidden')) {
            this.refs.panel.classList.remove('hidden');
            this.isPanelVisible = true;
        }
    },

    updateMiniInfo() {
        const track = this.tracks[this.currentIndex];
        if (this.refs.miniTitle) {
            this.refs.miniTitle.textContent = track ? track.title : 'Chưa chọn bài hát';
        }
    },

    updateMiniPlayButton() {
        if (!this.refs.miniPlay) return;
        this.refs.miniPlay.innerHTML = this.isPlaying
            ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>`;
    },

    initDraggable() {
        const panel = this.refs.panel;
        if (!panel) return;

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const startDrag = (e) => {
            // 1. Ignore interactive elements (allow dragging on container/text, but not controls)
            // Added textarea, select, a, summary, label to cover all bases
            if (e.target.closest('button, input, textarea, select, a, summary, label')) return;

            // 2. Check draggable areas based on mode
            const isMini = this.isMinimized;

            if (!isMini) {
                // Full Mode: Only drag from Handle or Header
                const isHandle = e.target.classList.contains('music-drag-handle');
                // Header container class in index.html: "flex items-start justify-between gap-4 relative z-20"
                const isHeader = e.target.closest('.flex.items-start.justify-between');

                if (!isHandle && !isHeader) return;
            }
            // Mini Mode: Drag anywhere (implied if we passed step 1)

            isDragging = true;
            panel.classList.add('is-dragging');

            const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
            const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);

            startX = clientX;
            startY = clientY;

            const rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // Override fixed positioning and disable bottom/right to allow free movement
            panel.classList.add('has-moved');
            panel.style.margin = '0'; // Clear margins
            panel.style.transform = 'none'; // Clear transforms

            // Set initial inline styles to lock current position
            panel.style.left = `${initialLeft}px`;
            panel.style.top = `${initialTop}px`;

            // Important: Unset bottom/right so top/left takes precedence
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();

            const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
            const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);

            const dx = clientX - startX;
            const dy = clientY - startY;

            panel.style.left = `${initialLeft + dx}px`;
            panel.style.top = `${initialTop + dy}px`;
        };

        const stopDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            panel.classList.remove('is-dragging');
        };

        panel.addEventListener('mousedown', startDrag);
        panel.addEventListener('touchstart', startDrag, { passive: false });

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });

        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
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

        // Default Exam Mode (default: ask)
        const defaultExamMode = localStorage.getItem('studyStation_defaultExamMode') || 'ask';
        this.updateDefaultModeUI(defaultExamMode);
    },

    async loadSubjects() {
        try {
            // Helper: Promise with timeout
            const withTimeout = (promise, ms, errorMsg) => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(errorMsg)), ms)
                    )
                ]);
            };

            // Helper: Retry function
            const retryAsync = async (fn, retries = 2, delay = 1000) => {
                for (let i = 0; i <= retries; i++) {
                    try {
                        return await fn();
                    } catch (err) {
                        if (i === retries) throw err;
                        console.log(`[Practice] Retry ${i + 1}/${retries} after error:`, err.message);
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            };

            // Try Firebase first (if available)
            if (window.firebaseExams && typeof window.firebaseExams.getAllExams === 'function') {
                try {
                    console.log('[Practice] Loading exams from Firebase...');

                    // Use timeout and retry for better reliability
                    const firebaseExams = await retryAsync(async () => {
                        return await withTimeout(
                            window.firebaseExams.getAllExams(),
                            8000, // 8 seconds timeout
                            'Firebase timeout - network too slow'
                        );
                    }, 2, 1000); // Retry 2 times with 1 second delay

                    const firebaseSubjects = window.firebaseExams.getSubjects();

                    if (firebaseExams && firebaseExams.length > 0) {
                        console.log('[Practice] Loaded exams from Firebase:', firebaseExams.length);

                        // Build subjects from Firebase data
                        this.subjects = {};

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
                                    attemptCount: exam.attemptCount || 0,
                                    tags: exam.tags || []
                                });
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

                        // BACKGROUND PRELOAD: Preload top 3 most popular exams after initial render
                        // This significantly improves first-click experience for popular exams
                        this.preloadPopularExams(firebaseExams);

                        return;
                    }
                } catch (fbError) {
                    console.warn('Firebase load failed, falling back to local files:', fbError.message);
                }
            }

            // Fallback to local JSON files
            const res = await fetch(`${MANIFEST_PATH}?v=${Date.now()}`);
            if (!res.ok) throw new Error('Manifest not found');
            const data = await res.json();
            const subjectList = data.subjects || [];
            this.subjects = {};

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
                    } catch (examErr) {
                        console.error(`Không thể tải đề thi ${fileName}`, examErr);
                    }
                }));
            }));

            this.subjectLoadError = subjectList.length ? null : 'Chưa có môn học nào trong thư mục tests.';
        } catch (error) {
            console.error('[Practice] Load subjects failed:', error);
            this.subjects = {};
            this.subjectLoadError = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.';
        }
    },

    // Lazy load exam content when needed (for starting an exam)
    async getExamContent(examId) {
        // Check if we have content in local cache first
        if (this.examContentDB && this.examContentDB[examId]) {
            return this.examContentDB[examId];
        }

        // Try to load from Firebase
        if (window.firebaseExams?.getExamContent) {
            try {
                const content = await window.firebaseExams.getExamContent(examId);
                if (content) {
                    // Cache locally
                    if (!this.examContentDB) this.examContentDB = {};
                    this.examContentDB[examId] = content;
                    return content;
                }
            } catch (err) {
                console.error('Failed to load exam content:', err);
            }
        }

        return null;
    },

    // Preload popular exams in background for faster first-click experience
    preloadPopularExams(allExams) {
        // Use requestIdleCallback if available, otherwise use setTimeout
        const schedulePreload = window.requestIdleCallback || ((cb) => setTimeout(cb, 1000));

        schedulePreload(() => {
            if (!window.firebaseExams?.getExamContent) return;

            // Sort by attemptCount descending and take top 3
            const popularExams = [...allExams]
                .filter(e => e.attemptCount > 0)
                .sort((a, b) => (b.attemptCount || 0) - (a.attemptCount || 0))
                .slice(0, 3);

            if (popularExams.length === 0) {
                console.log('[Preload] No popular exams to preload');
                return;
            }

            console.log('[Preload] Starting background preload for', popularExams.length, 'popular exams');

            // Preload with a small delay between each to avoid overwhelming the network
            popularExams.forEach((exam, index) => {
                setTimeout(() => {
                    console.log(`[Preload] Preloading exam ${index + 1}/${popularExams.length}:`, exam.id);
                    window.firebaseExams.getExamContent(exam.id).catch(() => {
                        // Silently ignore preload errors - not critical
                    });
                }, index * 500); // 500ms delay between each preload
            });
        });
    },

    // Retry loading subjects (called when user clicks retry button)
    async retryLoadSubjects() {
        console.log('[Practice] Retrying to load subjects...');

        // Clear memory cache in gatekeeper
        if (window.firebaseExams?.clearExamListCache) {
            window.firebaseExams.clearExamListCache();
        }

        // Show loading state
        const grid = this.container.querySelector('.grid');
        if (grid) {
            grid.innerHTML = `
                <div class="col-span-full bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                    <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p class="text-slate-600 dark:text-slate-300 font-medium">Đang tải lại danh sách bài thi...</p>
                </div>
            `;
        }

        // Reset error
        this.subjectLoadError = null;

        // Use setTimeout to ensure UI updates before loading
        await new Promise(r => setTimeout(r, 100));

        try {
            await this.loadSubjects();

            // Check if load was successful
            if (this.subjectLoadError) {
                // Show option to reload page
                if (grid) {
                    grid.innerHTML = `
                        <div class="col-span-full bg-white dark:bg-slate-800 p-6 rounded-2xl border border-red-200 dark:border-red-800 text-center">
                            <svg class="w-12 h-12 mx-auto mb-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                            </svg>
                            <p class="text-red-600 dark:text-red-300 mb-4">${this.subjectLoadError}</p>
                            <div class="flex justify-center gap-3">
                                <button onclick="app.retryLoadSubjects()" 
                                    class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors">
                                    🔄 Thử lại
                                </button>
                                <button onclick="location.reload()" 
                                    class="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors">
                                    ⟳ Tải lại trang
                                </button>
                            </div>
                        </div>
                    `;
                }
                return;
            }

            this.goHome();
        } catch (err) {
            console.error('[Practice] Retry failed:', err);
            this.subjectLoadError = 'Không thể kết nối. Vui lòng tải lại trang.';
            this.goHome();
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

        // Đảm bảo reset flag "đang làm bài" khi về trang chủ
        if (window.firebaseExams?.setExamInProgress) {
            window.firebaseExams.setExamInProgress(false);
        }

        const grid = this.container.querySelector('.grid');
        const subjectEntries = Object.values(this.subjects || {});

        if (this.subjectLoadError) {
            grid.innerHTML = `
                <div class="col-span-full bg-white dark:bg-slate-800 p-6 rounded-2xl border border-red-200 dark:border-red-800 text-center">
                    <svg class="w-12 h-12 mx-auto mb-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <p class="text-red-600 dark:text-red-300 mb-4">${this.subjectLoadError}</p>
                    <button onclick="app.retryLoadSubjects()" 
                        class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors">
                        🔄 Thử tải lại
                    </button>
                </div>
            `;
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

    async goSubject(subId) {
        const sub = this.subjects[subId];
        if (!sub) { alert('Không tìm thấy môn học này.'); return; }

        // Store current subject for filtering
        this.currentSubjectId = subId;
        this.examSearchQuery = '';
        this.examFilterTags = [];

        this.renderTemplate('tpl-exam-list');
        this.container.querySelector('#subject-title').innerText = sub.name;
        this.container.querySelector('#subject-icon-large').innerHTML = sub.icon;
        this.container.querySelector('#subject-icon-large').className = `p-4 rounded-2xl ${sub.bg}`;

        // Collect all unique tags from exams in this subject
        const allTags = new Set();
        sub.exams.forEach(exam => {
            (exam.tags || []).forEach(tag => allTags.add(tag));
        });

        // Setup filter UI
        this.setupExamFilters(Array.from(allTags));

        // Show Knowledge Map card for History and Tin học (info) subjects
        const knowledgeMapCard = this.container.querySelector('#knowledge-map-card');
        if (knowledgeMapCard) {
            if (subId === 'history' || subId === 'info') {
                knowledgeMapCard.classList.remove('hidden');
                // Update the card title based on subject
                const cardTitle = knowledgeMapCard.querySelector('h3');
                const cardDesc = knowledgeMapCard.querySelector('p');
                const cardBtn = knowledgeMapCard.querySelector('#knowledge-map-btn');
                const cardIcon = knowledgeMapCard.querySelector('#knowledge-map-icon');

                if (subId === 'info') {
                    // Tin học - Blue/Purple theme with tech icon
                    if (cardTitle) cardTitle.textContent = 'Mạng Tri Thức Tin học';
                    if (cardDesc) cardDesc.textContent = 'Sơ đồ tư duy • Tài liệu • Video';
                    if (cardBtn) {
                        cardBtn.className = 'w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 md:p-5 rounded-2xl text-white shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all group';
                    }
                    if (cardIcon) cardIcon.textContent = '💻';
                } else {
                    // Lịch sử - Orange/Amber theme with map icon
                    if (cardTitle) cardTitle.textContent = 'Bản đồ kiến thức Lịch sử';
                    if (cardDesc) cardDesc.textContent = 'Sơ đồ tư duy • Video • Thuyết trình • Podcast';
                    if (cardBtn) {
                        cardBtn.className = 'w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-4 md:p-5 rounded-2xl text-white shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all group';
                    }
                    if (cardIcon) cardIcon.textContent = '🗺️';
                }
            } else {
                knowledgeMapCard.classList.add('hidden');
            }
        }

        // Render exam list immediately (without highest scores)
        this.highestScores = {};
        this.renderExamList(sub.exams);

        // Load highest scores in background, then update UI
        if (window.firebaseExams?.getHighestScores) {
            window.firebaseExams.getHighestScores()
                .then(scores => {
                    this.highestScores = scores;
                    console.log('[Practice] Loaded highest scores for', Object.keys(scores).length, 'exams');
                    // Re-render exam list with scores if still on the same subject
                    if (this.currentSubjectId === subId) {
                        this.renderExamList(sub.exams);
                    }
                })
                .catch(err => {
                    console.warn('[Practice] Failed to load highest scores:', err);
                });
        }
    },

    // Knowledge Map Data for History
    knowledgeMapDataHistory: {
        mindmap: [
            { title: 'Bài 6', description: 'Sơ đồ tóm tắt bài 6', url: 'https://drive.google.com/file/d/1I3A-D0X-8IHb5-Il6cLzm6CVqCwrSRre/view?usp=sharing', type: 'image' },
            { title: 'Bài 7', description: 'Sơ đồ tóm tắt bài 7', url: 'https://drive.google.com/file/d/1diaYd2DzdyYQtq2iPg_ZNlwX79VPSv6D/view?usp=sharing', type: 'image' },
            { title: 'Bài 8', description: 'Sơ đồ tóm tắt bài 8', url: 'https://drive.google.com/file/d/1ie05WiTQK5KZ7zb3acOijw3mY1pZz6Kq/view?usp=drive_link', type: 'image' },
            { title: 'Bài 9', description: 'Sơ đồ tóm tắt bài 9', url: 'https://drive.google.com/file/d/1pjyO4CigBwyoA2Zh9GC_qIFD8ojsGZwP/view?usp=drive_link', type: 'image' },
            { title: 'Lịch Sử Thế Giới', description: 'Sơ đồ tóm tắt bài Lịch Sử Thế Giới', url: 'https://drive.google.com/file/d/1wmArICVIo4RW_V_aXw0EFIKav9Cc8Hh_/view?usp=drive_link', type: 'image' },
        ],
        video: [
            { title: 'Bài 6', description: 'Video tóm tắt bài 6', url: 'https://drive.google.com/file/d/1px7-vb0t34wSZnTOc-XoxgyoB4-LdPT3/view?usp=sharing', duration: '5:23' },
            { title: 'Bài 7', description: 'Video tóm tắt bài 7', url: 'https://drive.google.com/file/d/1VKCkwMlWpWDsTpTxDODkm5Li01DI3sh-/view?usp=sharing', duration: '5:23' },
            { title: 'Bài 8', description: 'Video tóm tắt bài 6', url: 'https://drive.google.com/file/d/1BK0-3rorj6ztEUBVkp3zFk5-8dH-1TUo/view?usp=drive_link', duration: '5:23' },
            { title: 'Bài 9', description: 'Video tóm tắt bài 7', url: 'https://drive.google.com/file/d/13-fegzCKZ4j2QASwN4YKshpy_-AMEWYN/view?usp=drive_link', duration: '6:01' },
            { title: 'Lịch Sử Thế Giới', description: 'Video tóm tắt bài Lịch Sử Thế Giới', url: 'https://drive.google.com/file/d/1GPZ6XdJ3aawgfyoq5_SbWJ1EwBL9XHDC/view?usp=drive_link', duration: '5:23' },
        ],
        presentation: [
            { title: 'Bài 6', description: 'Slide PowerPoint đầy đủ', url: 'https://drive.google.com/file/d/15IyF6LZHtcFyaAbP_klOCD1J_dEOgNGI/view?usp=sharing', slides: 14 },
            { title: 'Bài 7', description: 'Slide PowerPoint đầy đủ', url: 'https://drive.google.com/file/d/1YBRknRcM3sfAsLGnT-CVTdrMPnR_7Y38/view?usp=sharing', slides: 14 },
            { title: 'Bài 8', description: 'Slide PowerPoint đầy đủ', url: 'https://drive.google.com/file/d/1obkoSJ_7N6Xo920sL55zW3AxIpacVUBS/view?usp=drive_link', slides: 14 },
            { title: 'Bài 9', description: 'Slide PowerPoint đầy đủ', url: 'https://drive.google.com/file/d/1yuAH6Wg-6H92D2kj-nFfnhOVwQTeD5hS/view?usp=drive_link', slides: 11 },
            { title: 'Lịch Sử Thế Giới', description: 'Slide PowerPoint đầy đủ', url: 'https://drive.google.com/file/d/1tZW6slmE7ySdfBT8KttPx7Gjp8V7Ynh0/view?usp=drive_link', slides: 13 },
        ],
        podcast: [
            { title: 'Bài 6', description: 'Podcast dễ nghe', url: 'https://drive.google.com/file/d/1yEbp5Kncbmb9z09zk-xRg6nRznbXhxwa/view?usp=drive_link', duration: '11:22' },
            { title: 'Bài 7', description: 'Podcast dễ nghe', url: 'https://drive.google.com/file/d/14vQLSPkQwLKt6mLprDiRuVVKuG-O5MNu/view?usp=sharing', duration: '11:22' },
            { title: 'Bài 8', description: 'Podcast dễ nghe', url: 'https://drive.google.com/file/d/1PHSXG3yXzsM5C85o9DeMD1yXRtjwqi8x/view?usp=drive_link', duration: '11:22' },
            { title: 'Bài 9', description: 'Podcast dễ nghe', url: 'https://drive.google.com/file/d/1iINlWPta7iyzc44hdpWkoMPtu3QaKK6x/view?usp=drive_link', duration: '12:47' },
            { title: 'Lịch Sử Thế Giới', description: 'Podcast dễ nghe', url: 'https://drive.google.com/file/d/1phUKo8xsH8behopTANsLbq5d_QB8dgtv/view?usp=drive_link', duration: '11:22' },
        ]
    },

    // Knowledge Map Data for Tin học (Info)
    knowledgeMapDataInfo: {
        mindmap: [
            // Add your Computer Science mindmaps here
            // Example: { title: 'Chương 1', description: 'Sơ đồ tư duy Chương 1', url: 'https://drive.google.com/file/d/YOUR_FILE_ID/view', type: 'image' },
        ],
        video: [
            // Add your Computer Science videos here
        ],
        document: [
            // Add your Computer Science documents here
        ]
    },

    // Get the current knowledge map data based on subject
    getKnowledgeData() {
        if (this.currentSubjectId === 'info') {
            return this.knowledgeMapDataInfo;
        }
        return this.knowledgeMapDataHistory;
    },

    // Open Knowledge Map Modal
    openKnowledgeMap() {
        const modal = this.container.querySelector('#knowledge-map-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const isInfo = this.currentSubjectId === 'info';

            // Update modal header gradient based on subject
            const modalHeader = modal.querySelector('.bg-gradient-to-r');
            if (modalHeader) {
                if (isInfo) {
                    modalHeader.className = 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-5 text-white';
                } else {
                    modalHeader.className = 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-5 text-white';
                }
            }

            // Update modal icon
            const modalIcon = modal.querySelector('.text-3xl');
            if (modalIcon) {
                modalIcon.textContent = isInfo ? '💻' : '🗺️';
            }

            // Update modal title based on subject
            const modalTitle = modal.querySelector('h2');
            const modalDesc = modal.querySelector('p');
            if (modalTitle) {
                modalTitle.textContent = isInfo ? 'Mạng Tri Thức Tin học' : 'Bản đồ kiến thức Lịch sử';
            }
            if (modalDesc) {
                modalDesc.textContent = isInfo
                    ? 'Tài liệu học tập đa dạng cho môn Tin học'
                    : 'Chọn cách tiếp cận kiến thức phù hợp với bạn';
            }
            // Update tabs based on subject
            this.updateKnowledgeTabsVisibility();
            this.currentKnowledgeTab = 'mindmap';
            this.renderKnowledgeContent('mindmap');
            this.updateKnowledgeTabs();
        }
    },

    // Update tabs visibility based on subject
    updateKnowledgeTabsVisibility() {
        const tabs = this.container.querySelectorAll('.knowledge-tab');
        const isInfo = this.currentSubjectId === 'info';
        tabs.forEach(t => {
            const tab = t.dataset.tab;
            // For Tin học, show mindmap, video, document; hide presentation, podcast
            if (isInfo) {
                if (tab === 'presentation' || tab === 'podcast') {
                    t.style.display = 'none';
                } else if (tab === 'document') {
                    t.style.display = 'block';
                } else {
                    t.style.display = 'block';
                }
            } else {
                // For Lịch sử, show all original tabs
                if (tab === 'document') {
                    t.style.display = 'none';
                } else {
                    t.style.display = 'block';
                }
            }
        });
    },

    // Close Knowledge Map Modal
    closeKnowledgeMap() {
        const modal = this.container.querySelector('#knowledge-map-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    // Switch Knowledge Tab
    switchKnowledgeTab(tab) {
        this.currentKnowledgeTab = tab;
        this.updateKnowledgeTabs();
        this.renderKnowledgeContent(tab);
    },

    // Update tab active states
    updateKnowledgeTabs() {
        const tabs = this.container.querySelectorAll('.knowledge-tab');
        tabs.forEach(t => {
            if (t.dataset.tab === this.currentKnowledgeTab) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
    },

    // Render Knowledge Content
    renderKnowledgeContent(tab) {
        const contentEl = this.container.querySelector('#knowledge-content');
        if (!contentEl) return;

        const data = this.getKnowledgeData();
        const items = data[tab] || [];

        if (items.length === 0) {
            contentEl.innerHTML = `
                <div class="text-center py-12 text-slate-400">
                    <span class="text-4xl block mb-3">📭</span>
                    <p>Chưa có nội dung nào trong mục này</p>
                    <p class="text-xs mt-2">Nội dung sẽ được cập nhật sớm</p>
                </div>
            `;
            return;
        }

        const getIcon = (tab, item) => {
            switch (tab) {
                case 'mindmap': return item.type === 'pdf' ? '📄' : '🖼️';
                case 'video': return '▶️';
                case 'presentation': return '📊';
                case 'podcast': return '🎧';
                case 'document': return '📑';
                default: return '📚';
            }
        };

        const getMetadata = (tab, item) => {
            switch (tab) {
                case 'mindmap': return item.type === 'pdf' ? 'PDF' : 'Hình ảnh';
                case 'video': return item.duration;
                case 'presentation': return `${item.slides} slides`;
                case 'podcast': return item.duration;
                case 'document': return 'Tài liệu';
                default: return '';
            }
        };

        const isInfo = this.currentSubjectId === 'info';

        // Dynamic color classes based on subject
        const iconGradient = isInfo
            ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
            : 'bg-gradient-to-br from-amber-400 to-orange-500';
        const hoverBorder = isInfo
            ? 'hover:border-indigo-300 dark:hover:border-indigo-500'
            : 'hover:border-orange-300 dark:hover:border-orange-500';
        const hoverText = isInfo
            ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
            : 'group-hover:text-orange-600 dark:group-hover:text-orange-400';
        const badgeClasses = isInfo
            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300'
            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300';
        const hoverIcon = isInfo
            ? 'group-hover:text-indigo-400'
            : 'group-hover:text-orange-400';

        contentEl.innerHTML = items.map((item, idx) => `
            <div class="knowledge-item block p-4 mb-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 ${hoverBorder} hover:shadow-md transition-all group cursor-pointer"
                 data-url="${item.url}" data-title="${item.title}" data-type="${tab}">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 ${iconGradient} rounded-xl flex items-center justify-center text-xl shadow-sm">
                        ${getIcon(tab, item)}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-slate-800 dark:text-white ${hoverText} transition-colors">${item.title}</h4>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">${item.description}</p>
                        <span class="inline-block mt-2 text-xs font-medium px-2 py-0.5 ${badgeClasses} rounded-full">
                            ${getMetadata(tab, item)}
                        </span>
                    </div>
                    <div class="flex items-center gap-1 shrink-0 mt-1">
                        <span class="text-xs text-slate-400 hidden sm:inline">Nhấn để xem</span>
                        <svg class="w-5 h-5 text-slate-300 dark:text-slate-600 ${hoverIcon} transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                    </div>
                </div>
            </div>
        `).join('');

        // Bind click events to open embed viewer
        contentEl.querySelectorAll('.knowledge-item').forEach(el => {
            el.addEventListener('click', () => {
                const url = el.dataset.url;
                const title = el.dataset.title;
                const type = el.dataset.type;
                this.openEmbedViewer(url, title, type);
            });
        });
    },

    // Open Google Drive Embed Viewer
    openEmbedViewer(url, title, type) {
        // Convert Google Drive share URL to embed URL
        const embedUrl = this.convertToEmbedUrl(url, type);

        // Create or get the embed modal
        let embedModal = document.getElementById('embed-viewer-modal');
        if (!embedModal) {
            embedModal = document.createElement('div');
            embedModal.id = 'embed-viewer-modal';
            embedModal.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in';
            embedModal.innerHTML = `
                <div class="bg-white dark:bg-slate-800 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-orange-500 to-amber-500">
                        <h3 id="embed-viewer-title" class="font-bold text-white text-lg truncate"></h3>
                        <div class="flex items-center gap-2">
                            <a id="embed-open-new" href="#" target="_blank" class="p-2 bg-white/20 rounded-lg text-white hover:bg-white/30 transition-colors" title="Mở trong tab mới">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                            </a>
                            <button id="embed-close-btn" class="p-2 bg-white/20 rounded-lg text-white hover:bg-white/30 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                    </div>
                    <div id="embed-content" class="flex-1 bg-slate-100 dark:bg-slate-900 relative">
                        <div id="embed-loading" class="absolute inset-0 flex items-center justify-center">
                            <div class="flex flex-col items-center gap-3">
                                <div class="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                                <p class="text-slate-500 dark:text-slate-400">Đang tải...</p>
                            </div>
                        </div>
                        <iframe id="embed-iframe" class="w-full h-full border-0 opacity-0 transition-opacity" onload="this.classList.add('opacity-100'); document.getElementById('embed-loading').style.display='none';"></iframe>
                    </div>
                </div>
            `;
            document.body.appendChild(embedModal);

            // Close button event
            embedModal.querySelector('#embed-close-btn').addEventListener('click', () => {
                embedModal.classList.add('hidden');
                embedModal.querySelector('#embed-iframe').src = '';
            });

            // Close on backdrop click
            embedModal.addEventListener('click', (e) => {
                if (e.target === embedModal) {
                    embedModal.classList.add('hidden');
                    embedModal.querySelector('#embed-iframe').src = '';
                }
            });
        }

        // Update modal content
        embedModal.querySelector('#embed-viewer-title').textContent = title;
        embedModal.querySelector('#embed-open-new').href = url;
        embedModal.querySelector('#embed-loading').style.display = 'flex';
        embedModal.querySelector('#embed-iframe').classList.remove('opacity-100');
        embedModal.querySelector('#embed-iframe').src = embedUrl;

        // Update header color based on subject
        const embedHeader = embedModal.querySelector('.bg-gradient-to-r');
        const embedSpinner = embedModal.querySelector('.border-t-orange-500, .border-t-indigo-500');
        const isInfo = this.currentSubjectId === 'info';

        if (embedHeader) {
            embedHeader.className = isInfo
                ? 'flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600'
                : 'flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-orange-500 to-amber-500';
        }

        // Update loading spinner color
        const spinnerEl = embedModal.querySelector('#embed-loading .animate-spin');
        if (spinnerEl) {
            spinnerEl.className = isInfo
                ? 'w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin'
                : 'w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin';
        }

        embedModal.classList.remove('hidden');
    },

    // Convert Google Drive URL to embed URL
    convertToEmbedUrl(url, type) {
        // Extract file ID from various Google Drive URL formats
        let fileId = null;

        // Format: /file/d/FILE_ID/view
        const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match1) fileId = match1[1];

        // Format: id=FILE_ID
        if (!fileId) {
            const match2 = url.match(/id=([a-zA-Z0-9_-]+)/);
            if (match2) fileId = match2[1];
        }

        if (!fileId) {
            console.warn('Could not extract file ID from URL:', url);
            return url;
        }

        // Return appropriate embed URL based on content type
        if (type === 'video' || type === 'podcast') {
            // For video/audio, use preview
            return `https://drive.google.com/file/d/${fileId}/preview`;
        } else {
            // For images, PDFs, presentations - use preview
            return `https://drive.google.com/file/d/${fileId}/preview`;
        }
    },

    // Setup filter event listeners
    setupExamFilters(availableTags) {
        const searchInput = this.container.querySelector('#exam-search-input');
        const clearFiltersBtn = this.container.querySelector('#clear-filters-btn');

        // Preset tags that are always available
        const PRESET_TAGS = ['Trường', 'Hot', 'Đúng Sai', 'Trả lời ngắn', 'Tổng hợp', 'Mạng Xã Hội', 'Mapstudy', 'Tenschool', 'ĐGNL'];

        // Combine preset tags with available tags from exams (unique)
        const allTags = [...new Set([...PRESET_TAGS, ...availableTags])];

        // Search input event
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.examSearchQuery = e.target.value.toLowerCase().trim();
                this.applyExamFilters();
            });
        }

        // Clear filters button
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearExamFilters();
            });
        }

        // Tag filter modal setup (used for both mobile and PC)
        this.setupTagFilterModal(allTags, availableTags);
    },

    // Setup tag filter modal (for both mobile and PC)
    setupTagFilterModal(allTags, usedTagsArray) {
        const mobileBtn = this.container.querySelector('#mobile-tag-filter-btn');
        const mobileModal = this.container.querySelector('#mobile-tag-filter-modal');
        const mobileChips = this.container.querySelector('#mobile-tag-chips');
        const closeBtn = this.container.querySelector('#mobile-tag-filter-close');
        const applyBtn = this.container.querySelector('#mobile-tag-apply-btn');
        const clearBtn = this.container.querySelector('#mobile-tag-clear-btn');
        const selectedCount = this.container.querySelector('#mobile-selected-count');
        const mobileBadge = this.container.querySelector('#mobile-filter-badge');

        if (!mobileBtn || !mobileModal) return;

        // Temporary selection state for mobile modal
        this.mobileTempTags = [...this.examFilterTags];

        // Get icon for tag
        const getTagIcon = (tag) => {
            const icons = {
                'Trường': '🏫', 'Hot': '🔥', 'Đúng Sai': '✓✗', 'Trả lời ngắn': '✏️',
                'Tổng hợp': '📚', 'Mạng Xã Hội': '📱', 'Mapstudy': '🗺️', 'Tenschool': '🎓', 'ĐGNL': '📝'
            };
            return icons[tag] || '🏷️';
        };

        const usedTags = new Set(usedTagsArray);

        // Render mobile tag chips
        const renderMobileChips = () => {
            mobileChips.innerHTML = allTags.map(tag => {
                const isUsed = usedTags.has(tag);
                const isSelected = this.mobileTempTags.includes(tag);
                const baseClass = 'px-4 py-2.5 text-sm font-medium rounded-full border-2 transition-all';
                const selectedClass = isSelected
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 ${!isUsed ? 'opacity-50' : ''}`;

                return `
                    <button type="button" class="mobile-tag-chip ${baseClass} ${selectedClass}" data-tag="${tag}">
                        ${getTagIcon(tag)} ${tag}
                    </button>
                `;
            }).join('');

            // Bind click events
            mobileChips.querySelectorAll('.mobile-tag-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const tag = chip.dataset.tag;
                    const idx = this.mobileTempTags.indexOf(tag);
                    if (idx === -1) {
                        this.mobileTempTags.push(tag);
                    } else {
                        this.mobileTempTags.splice(idx, 1);
                    }
                    renderMobileChips();
                    updateSelectedCount();
                });
            });
        };

        // Update selected count text
        const updateSelectedCount = () => {
            const count = this.mobileTempTags.length;
            if (count === 0) {
                selectedCount.textContent = 'Chưa chọn thẻ nào';
            } else {
                selectedCount.textContent = `Đã chọn ${count} thẻ: ${this.mobileTempTags.join(', ')}`;
            }
        };

        // Update mobile badge
        const updateMobileBadge = () => {
            const count = this.examFilterTags.length;
            if (count > 0) {
                mobileBadge.textContent = count;
                mobileBadge.classList.remove('hidden');
                mobileBadge.classList.add('flex');
            } else {
                mobileBadge.classList.add('hidden');
                mobileBadge.classList.remove('flex');
            }
        };

        // Open modal
        mobileBtn.addEventListener('click', () => {
            this.mobileTempTags = [...this.examFilterTags];
            renderMobileChips();
            updateSelectedCount();
            mobileModal.classList.remove('hidden');
        });

        // Close modal
        const closeModal = () => {
            mobileModal.classList.add('hidden');
        };

        closeBtn.addEventListener('click', closeModal);
        mobileModal.addEventListener('click', (e) => {
            if (e.target === mobileModal) closeModal();
        });

        // Clear all
        clearBtn.addEventListener('click', () => {
            this.mobileTempTags = [];
            renderMobileChips();
            updateSelectedCount();
        });

        // Apply filter
        applyBtn.addEventListener('click', () => {
            this.examFilterTags = [...this.mobileTempTags];
            this.updateTagFilterChipsUI();
            this.applyExamFilters();
            updateMobileBadge();
            closeModal();
        });

        // Initial badge update
        updateMobileBadge();
    },

    // Toggle tag filter
    toggleExamFilterTag(tag) {
        const idx = this.examFilterTags.indexOf(tag);
        if (idx === -1) {
            this.examFilterTags.push(tag);
        } else {
            this.examFilterTags.splice(idx, 1);
        }
        this.updateTagFilterChipsUI();
        this.applyExamFilters();
    },

    // Update filter UI (active filters display and badge)
    updateTagFilterChipsUI() {
        // Update active filters display
        const activeFilters = this.container.querySelector('#active-filters');
        const activeFilterTags = this.container.querySelector('#active-filter-tags');

        if (this.examFilterTags.length > 0 && activeFilters && activeFilterTags) {
            activeFilters.classList.remove('hidden');
            activeFilterTags.innerHTML = this.examFilterTags.map(tag => `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
                    ${tag}
                    <button type="button" class="remove-filter-tag hover:text-red-500" data-tag="${tag}">×</button>
                </span>
            `).join('');

            // Bind remove events
            activeFilterTags.querySelectorAll('.remove-filter-tag').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleExamFilterTag(btn.dataset.tag);
                });
            });
        } else if (activeFilters) {
            activeFilters.classList.add('hidden');
        }

        // Update filter button badge
        const filterBadge = this.container.querySelector('#mobile-filter-badge');
        if (filterBadge) {
            const count = this.examFilterTags.length;
            if (count > 0) {
                filterBadge.textContent = count;
                filterBadge.classList.remove('hidden');
                filterBadge.classList.add('flex');
            } else {
                filterBadge.classList.add('hidden');
                filterBadge.classList.remove('flex');
            }
        }
    },

    // Clear all filters
    clearExamFilters() {
        this.examSearchQuery = '';
        this.examFilterTags = [];

        const searchInput = this.container.querySelector('#exam-search-input');
        if (searchInput) searchInput.value = '';

        this.updateTagFilterChipsUI();
        this.applyExamFilters();
    },

    // Apply filters and re-render
    applyExamFilters() {
        const sub = this.subjects[this.currentSubjectId];
        if (!sub) return;

        let filteredExams = [...sub.exams];

        // Filter by search query
        if (this.examSearchQuery) {
            filteredExams = filteredExams.filter(exam =>
                exam.title.toLowerCase().includes(this.examSearchQuery)
            );
        }

        // Filter by tags (AND logic - exam must have ALL selected tags)
        if (this.examFilterTags.length > 0) {
            filteredExams = filteredExams.filter(exam => {
                const examTags = exam.tags || [];
                return this.examFilterTags.every(tag => examTags.includes(tag));
            });
        }

        this.renderExamList(filteredExams);
    },

    // Render exam list
    renderExamList(exams) {
        const grid = this.container.querySelector('#exam-grid');
        const countDisplay = this.container.querySelector('#exam-count-display');

        if (countDisplay) {
            countDisplay.textContent = `(${exams.length} đề)`;
        }

        if (!exams.length) {
            grid.innerHTML = `<div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 text-center">
                <svg class="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                ${this.examSearchQuery || this.examFilterTags.length > 0
                    ? 'Không tìm thấy đề thi phù hợp với bộ lọc.'
                    : 'Chưa có đề thi nào trong môn này.'}
            </div>`;
            return;
        }

        grid.innerHTML = '';
        const subId = this.currentSubjectId;

        exams.forEach((exam, index) => {
            const el = document.createElement('div');
            el.className = 'exam-card bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group';
            el.dataset.examId = exam.id; // Add data attribute for tracking
            el.onclick = () => this.showExamModeModal(subId, exam.id, exam.title);

            // SMART PREFETCH: Load exam content when user hovers for 300ms
            // This significantly reduces perceived loading time on first click
            let prefetchTimer = null;
            el.addEventListener('mouseenter', () => {
                prefetchTimer = setTimeout(() => {
                    if (window.firebaseExams?.getExamContent) {
                        console.log('[Prefetch] Hover detected, preloading exam:', exam.id);
                        window.firebaseExams.getExamContent(exam.id).catch(() => {
                            // Silently ignore prefetch errors - not critical
                        });
                    }
                }, 300); // Wait 300ms before prefetch to avoid unnecessary loads on quick scrolls
            });
            el.addEventListener('mouseleave', () => {
                if (prefetchTimer) {
                    clearTimeout(prefetchTimer);
                    prefetchTimer = null;
                }
            });

            const createdDate = exam.createdAt
                ? `<span class="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 flex items-center"><svg class="w-3 h-3 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>${new Date(exam.createdAt).toLocaleDateString('vi-VN')}</span>`
                : '';

            // Số lượt làm đề (attemptCount)
            const attemptCount = exam.attemptCount || 0;
            const attemptInfo = `<span class="text-[10px] md:text-xs text-emerald-600 dark:text-emerald-400 flex items-center"><svg class="w-3 h-3 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>${attemptCount} lượt thi</span>`;

            // Tags HTML with icons
            const tagsHtml = (exam.tags && exam.tags.length > 0)
                ? `<div class="flex flex-wrap gap-1.5 mt-2">${exam.tags.map(tag => {
                    // Determine tag color and icon based on tag name
                    let tagColor = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
                    let icon = '🏷️';

                    if (tag === 'Hot') { tagColor = 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300'; icon = '🔥'; }
                    else if (tag === 'Trường') { tagColor = 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300'; icon = '🏫'; }
                    else if (tag === 'ĐGNL') { tagColor = 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300'; icon = '📝'; }
                    else if (tag === 'Tổng hợp') { tagColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'; icon = '📚'; }
                    else if (tag === 'Mapstudy') { tagColor = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300'; icon = '🗺️'; }
                    else if (tag === 'Tenschool') { tagColor = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300'; icon = '🎓'; }
                    else if (tag === 'Mạng Xã Hội') { tagColor = 'bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-300'; icon = '📱'; }
                    else if (tag === 'Đúng Sai') { tagColor = 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/50 dark:text-cyan-300'; icon = '✓✗'; }
                    else if (tag === 'Trả lời ngắn') { tagColor = 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-300'; icon = '✏️'; }

                    return `<span class="text-[10px] font-medium px-2 py-0.5 rounded-full ${tagColor}">${icon} ${tag}</span>`;
                }).join('')}</div>`
                : '';

            // Get highest score for this exam
            const scoreData = this.highestScores?.[exam.id];
            let highestScoreHtml = '';
            if (scoreData && scoreData.highestScore !== undefined) {
                const score = scoreData.highestScore;
                let scoreBg, scoreColor;
                if (score >= 8) {
                    scoreBg = 'bg-emerald-100 dark:bg-emerald-900/40';
                    scoreColor = 'text-emerald-700 dark:text-emerald-400';
                } else if (score >= 5) {
                    scoreBg = 'bg-blue-100 dark:bg-blue-900/40';
                    scoreColor = 'text-blue-700 dark:text-blue-400';
                } else {
                    scoreBg = 'bg-orange-100 dark:bg-orange-900/40';
                    scoreColor = 'text-orange-700 dark:text-orange-400';
                }
                highestScoreHtml = `
                    <div class="flex flex-col items-center justify-center px-3 py-2 ${scoreBg} rounded-xl min-w-[60px]" title="Điểm cao nhất của bạn">
                        <span class="text-[10px] font-medium text-slate-500 dark:text-slate-400">Cao nhất</span>
                        <span class="text-lg font-bold ${scoreColor}">${score.toFixed(1)}</span>
                    </div>
                `;
            }

            el.innerHTML = `
                <div class="flex items-start gap-3 md:gap-4">
                    <div class="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs md:text-sm">${(index + 1).toString().padStart(2, '0')}</div>
                    <div class="flex-1 min-w-0 overflow-hidden">
                        <h4 class="font-bold text-base md:text-lg text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug mb-1">${exam.title}</h4>
                        ${tagsHtml}
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
                        ${highestScoreHtml}
                        <div class="flex flex-col items-center gap-1 group/history cursor-pointer" onclick="event.stopPropagation(); app.showHistoryModal('${exam.id}', '${exam.title.replace(/'/g, "\\'")}')">
                            <button
                                class="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover/history:bg-indigo-100 dark:group-hover/history:bg-indigo-900/50 transition-colors" 
                                title="Xem lịch sử làm bài">
                                <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.93 4.93A10 10 0 1021 12"></path>
                                </svg>
                            </button>
                            <span class="text-[9px] font-bold text-slate-400 group-hover/history:text-indigo-500 transition-colors uppercase tracking-wide">Lịch sử</span>
                        </div>
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

        // Check if user has set a default mode (not 'ask')
        const defaultMode = localStorage.getItem('studyStation_defaultExamMode') || 'ask';

        if (defaultMode !== 'ask') {
            // Automatically use the default mode without showing modal
            this.confirmExamMode(defaultMode);
            return;
        }

        // Show modal for user to choose
        document.getElementById('mode-modal-exam-title').textContent = title;
        // Reset checkbox state
        const checkbox = document.getElementById('remember-mode-checkbox');
        if (checkbox) checkbox.checked = false;
        document.getElementById('exam-mode-modal').classList.remove('hidden');
    },

    // Handle mode selection
    confirmExamMode(mode) {
        document.getElementById('exam-mode-modal').classList.add('hidden');

        // Check if user wants to remember this choice
        const rememberCheckbox = document.getElementById('remember-mode-checkbox');
        if (rememberCheckbox && rememberCheckbox.checked) {
            localStorage.setItem('studyStation_defaultExamMode', mode);
            this.updateDefaultModeUI(mode);
        }

        const { subId, examId } = this.pendingExam;
        if (!subId || !examId) return;

        if (mode === 'classic') {
            this.startExam(subId, examId);
        } else if (mode === 'stepbystep') {
            this.startStepMode(subId, examId);
        }
    },

    // Set default exam mode from settings
    setDefaultExamMode(mode) {
        localStorage.setItem('studyStation_defaultExamMode', mode);
        this.updateDefaultModeUI(mode);
    },

    // Update UI to reflect current default mode
    updateDefaultModeUI(mode) {
        // Update buttons
        const buttons = ['ask', 'classic', 'stepbystep'];
        buttons.forEach(m => {
            const btn = document.getElementById(`settings-mode-${m}`);
            if (btn) {
                if (m === mode) {
                    btn.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
                    btn.classList.remove('border-slate-200', 'dark:border-slate-600', 'bg-white', 'dark:bg-slate-800');
                } else {
                    btn.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
                    btn.classList.add('border-slate-200', 'dark:border-slate-600', 'bg-white', 'dark:bg-slate-800');
                }
            }
        });

        // Update description text
        const descEl = document.getElementById('default-mode-desc');
        if (descEl) {
            const modeNames = {
                'ask': 'Luôn hỏi khi bắt đầu',
                'classic': 'Tự động vào Chế độ Cổ điển',
                'stepbystep': 'Tự động vào Chế độ Từng Câu'
            };
            descEl.textContent = modeNames[mode] || modeNames['ask'];
        }
    },


    async startExam(subId, examId) {
        const subject = this.subjects[subId];
        if (!subject) {
            await window.customDialog.alert('Lỗi', 'Không tìm thấy môn học này.', 'error');
            return;
        }
        const examMeta = subject.exams.find(e => e.id === examId);

        if (!examMeta) {
            await window.customDialog.alert('Lỗi', 'Không tìm thấy bài thi này.', 'error');
            return;
        }

        // Show loading indicator with exam title
        const loadingHtml = `
            <div class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50" id="exam-loading-overlay">
                <div class="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm mx-4">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                        <svg class="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">${examMeta.title}</h3>
                    <div class="flex items-center justify-center gap-1 mb-3">
                        <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                        <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                        <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                    </div>
                    <p id="loading-status" class="text-sm text-slate-500 dark:text-slate-400">Đang tải nội dung bài thi...</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', loadingHtml);

        // Lazy load exam content if not in cache
        let originalData = this.examContentDB?.[examId];
        if (!originalData) {
            try {
                originalData = await this.getExamContent(examId);
            } catch (err) {
                console.error('Failed to load exam content:', err);
            }
        }

        // Remove loading overlay
        document.getElementById('exam-loading-overlay')?.remove();

        if (!originalData) {
            await window.customDialog.alert('Lỗi', 'Không thể tải nội dung bài thi. Vui lòng thử lại.', 'error');
            return;
        }

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

        // Thông báo cho Gatekeeper: Đang làm bài thi (ngăn auto-reload)
        if (window.firebaseExams?.setExamInProgress) {
            window.firebaseExams.setExamInProgress(true);
        }

        this.renderTemplate('tpl-taking-exam');
        this.timerEl.classList.remove('hidden');

        this.renderQuestions(examData);
        this.renderPalette(examData);
        this.startTimer(examMeta.time * 60);
        this.renderMath();

        // Log practice attempt (ghi log và tăng số lượt thi) - mode 'classic'
        if (window.firebaseExams?.logPracticeAttempt) {
            console.log('[Practice] Logging attempt for:', examId, examMeta.title, subId, 'mode: classic');
            window.firebaseExams.logPracticeAttempt(examId, examMeta.title, subId, 'classic')
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

            // Fix common temperature patterns where unit is outside delimiter
            // Pattern: \(117°\)C or \(117^\circ\)C → \(117^\circ\text{C}\)
            text = text.replace(/\\?\((\d+(?:[,\.]\d+)?)[°^\\circ]+\\?\)\s*([CFKcfk])/g, (match, num, unit) => {
                return `\\(${num}^\\circ\\text{${unit.toUpperCase()}}\\)`;
            });

            // Handle Unicode degree symbol followed by unit outside any delimiter
            // Pattern: 117°C (plain text) → \(117^\circ\text{C}\)
            text = text.replace(/(^|[^\\$\(])(\d+(?:[,\.]\d+)?)\s*°\s*([CFKcfk])(?![\\$\)])/g, (match, prefix, num, unit) => {
                return `${prefix}\\(${num}^\\circ\\text{${unit.toUpperCase()}}\\)`;
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

            // Debug: Log question image
            if (q.image) {
                console.log(`[Classic Mode] Q${displayId} has image:`, q.image);
            }
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

        // Thông báo cho Gatekeeper: Đã kết thúc làm bài (cho phép reload nếu cần)
        if (window.firebaseExams?.setExamInProgress) {
            window.firebaseExams.setExamInProgress(false);
        }

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
        // Removed hidden class addition for sidebar/footer to show the Retake button
        // document.getElementById('desktop-palette-sidebar').classList.add('hidden');
        // document.getElementById('mobile-footer').classList.add('hidden');
        document.getElementById('review-controls').classList.remove('hidden');

        this.renderQuestions(this.currentExam.data);
        this.renderPalette(this.currentExam.data); // Render palette for navigation
        this.renderMath();

        // Change "Submit" button to "Retake" button
        const setupRetakeBtn = (btn) => {
            if (btn) {
                btn.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5m10.93 9.93A10 10 0 1120 4.77V4"/></svg>
                    <span>Làm lại bài thi</span>
                `;
                btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
                // Use arrow function to capture 'this' correctly
                btn.onclick = async () => {
                    const result = await window.customDialog.confirm('Xác nhận', 'Bạn có chắc chắn muốn làm lại bài thi này không?', {
                        confirmText: 'Làm lại',
                        cancelText: 'Hủy bỏ',
                        type: 'question'
                    });
                    if (result === 'confirm') {
                        this.startExam(this.currentExam.subId, this.currentExam.meta.id);
                    }
                };
            }
        };

        const desktopBtn = document.querySelector('#submit-btn-container button');
        const mobileBtn = document.querySelector('#mobile-footer button:last-child'); // usually the submit/submit button is last
        setupRetakeBtn(desktopBtn);
        setupRetakeBtn(mobileBtn);


        const data = this.currentExam.data;

        // Helper to set status - now uses uniqueId format (type_id)
        const setStatus = (uniqueId, isCorrect) => {
            const el = document.getElementById(`q-${uniqueId}`);
            if (!el) {
                console.warn(`[Review] Element not found: q-${uniqueId}`);
                return;
            }
            el.dataset.status = isCorrect ? 'correct' : 'wrong';

            // Color navigation palette
            [`pal-btn-${uniqueId}`, `mob-pal-btn-${uniqueId}`].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-slate-500', 'dark:text-slate-400', 'border-slate-200', 'dark:border-slate-600');
                    if (isCorrect) {
                        btn.classList.add('bg-emerald-100', 'dark:bg-emerald-900/50', 'text-emerald-700', 'dark:text-emerald-300', 'border-emerald-300', 'dark:border-emerald-700');
                    } else {
                        btn.classList.add('bg-red-100', 'dark:bg-red-900/50', 'text-red-700', 'dark:text-red-300', 'border-red-300', 'dark:border-red-700');
                    }
                }
            });
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

                // Check if this was a step-by-step mode attempt
                const isStepMode = item.mode === 'stepbystep';

                let scoreDisplay, scoreBg, scoreColor;
                if (isStepMode) {
                    // Show "Từng câu" label instead of score for step-by-step mode
                    scoreDisplay = 'Từng câu';
                    scoreBg = 'bg-purple-50 dark:bg-purple-900/30';
                    scoreColor = 'text-purple-600 dark:text-purple-400';
                } else {
                    // Normal score display
                    scoreDisplay = item.score.toFixed(1);
                    scoreColor = item.score >= 8 ? 'text-emerald-600 dark:text-emerald-400'
                        : item.score >= 5 ? 'text-blue-600 dark:text-blue-400'
                            : 'text-red-600 dark:text-red-400';
                    scoreBg = item.score >= 8 ? 'bg-emerald-50 dark:bg-emerald-900/30'
                        : item.score >= 5 ? 'bg-blue-50 dark:bg-blue-900/30'
                            : 'bg-red-50 dark:bg-red-900/30';
                }

                return `
                    <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors">
                        <div class="flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 ${scoreBg} rounded-xl flex items-center justify-center shrink-0">
                                    <span class="font-bold ${scoreColor} ${isStepMode ? 'text-xs' : ''}">${scoreDisplay}</span>
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
                                        ${isStepMode ? '<span class="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded text-[10px] font-bold">Từng câu</span>' : ''}
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
            await window.customDialog.alert('Lỗi', 'Không thể xem lại bài làm này. Dữ liệu không khả dụng.', 'error');
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
        // Removed hidden class addition to show Retake button
        // document.getElementById('desktop-palette-sidebar').classList.add('hidden');
        // document.getElementById('mobile-footer').classList.add('hidden');
        document.getElementById('review-controls').classList.remove('hidden');

        this.renderQuestions(this.currentExam.data);
        this.renderPalette(this.currentExam.data); // Render palette for navigation
        this.renderMath();

        // Change "Submit" button to "Retake" button
        const setupRetakeBtn = (btn) => {
            if (btn) {
                btn.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5m10.93 9.93A10 10 0 1120 4.77V4"/></svg>
                    <span>Làm lại bài thi</span>
                `;
                btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
                btn.onclick = async () => {
                    const result = await window.customDialog.confirm('Xác nhận', 'Bạn có chắc chắn muốn làm lại bài thi này không?', {
                        confirmText: 'Làm lại',
                        cancelText: 'Hủy bỏ',
                        type: 'question'
                    });
                    if (result === 'confirm') {
                        this.startExam(this.currentExam.subId, this.currentExam.meta.id);
                    }
                };
            }
        };

        const desktopBtn = document.querySelector('#submit-btn-container button');
        const mobileBtn = document.querySelector('#mobile-footer button:last-child');
        setupRetakeBtn(desktopBtn);
        setupRetakeBtn(mobileBtn);

        // Apply review styling (reuse existing review logic)
        const data = this.currentExam.data;

        const setStatus = (uniqueId, isCorrect) => {
            const el = document.getElementById(`q-${uniqueId}`);
            if (!el) return;
            el.dataset.status = isCorrect ? 'correct' : 'wrong';
            el.classList.add(isCorrect ? 'border-green-200' : 'border-red-200');
            if (isCorrect) el.classList.add('dark:border-green-900');
            else el.classList.add('dark:border-red-900');

            // Color navigation palette
            [`pal-btn-${uniqueId}`, `mob-pal-btn-${uniqueId}`].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-slate-500', 'dark:text-slate-400', 'border-slate-200', 'dark:border-slate-600');
                    if (isCorrect) {
                        btn.classList.add('bg-emerald-100', 'dark:bg-emerald-900/50', 'text-emerald-700', 'dark:text-emerald-300', 'border-emerald-300', 'dark:border-emerald-700');
                    } else {
                        btn.classList.add('bg-red-100', 'dark:bg-red-900/50', 'text-red-700', 'dark:text-red-300', 'border-red-300', 'dark:border-red-700');
                    }
                }
            });
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
    // DOWNLOAD EXAM METHODS
    // Tải đề thi - Hỗ trợ DOCX, DOC, PDF với/không có đáp án
    // ============================================================

    // Tính năng Tải Đề Thi đã được chuyển sang Module Tài liệu (Dashboard) 
    // Xem docsApp trong index.html

    // ============================================================
    // STEP-BY-STEP MODE METHODS
    // Chế độ làm từng câu một - phải trả lời đúng mới qua câu tiếp
    // ============================================================

    // Start Step-by-Step Mode
    async startStepMode(subId, examId) {
        const subject = this.subjects[subId];
        if (!subject) { alert('Không tìm thấy môn học này.'); return; }
        const examMeta = subject.exams.find(e => e.id === examId);

        if (!examMeta) { alert('Không tìm thấy bài thi này.'); return; }

        // Show loading indicator with exam title
        const loadingHtml = `
            <div class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50" id="exam-loading-overlay">
                <div class="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm mx-4">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
                        <svg class="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">${examMeta.title}</h3>
                    <p class="text-xs text-purple-600 dark:text-purple-400 font-medium mb-3">Chế độ từng câu</p>
                    <div class="flex items-center justify-center gap-1 mb-3">
                        <div class="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                        <div class="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                        <div class="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                    </div>
                    <p id="loading-status" class="text-sm text-slate-500 dark:text-slate-400">Đang tải nội dung bài thi...</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', loadingHtml);

        // Lazy load exam content if not in cache
        let originalData = this.examContentDB?.[examId];
        if (!originalData) {
            try {
                originalData = await this.getExamContent(examId);
            } catch (err) {
                console.error('Failed to load exam content:', err);
            }
        }

        // Remove loading overlay
        document.getElementById('exam-loading-overlay')?.remove();

        if (!originalData) {
            alert('Không thể tải nội dung bài thi. Vui lòng thử lại.');
            return;
        }

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
            isCorrect: false,
            scoredQuestions: {} // Track which questions have been scored to prevent double counting
        };

        this.currentExam = { meta: examMeta, data: examData, subId: subId };
        this.startTime = new Date();
        this.timerEl.classList.remove('hidden');

        // Thông báo cho Gatekeeper: Đang làm bài thi (ngăn auto-reload)
        if (window.firebaseExams?.setExamInProgress) {
            window.firebaseExams.setExamInProgress(true);
        }

        // Render step-by-step template
        this.renderTemplate('tpl-step-by-step');

        // Update total count
        document.getElementById('step-total').textContent = questionQueue.length;

        // Log practice attempt (ghi log và tăng số lượt thi) - mode 'stepbystep'
        if (window.firebaseExams?.logPracticeAttempt) {
            console.log('[Practice] Logging attempt for:', examId, examMeta.title, subId, 'mode: stepbystep');
            window.firebaseExams.logPracticeAttempt(examId, examMeta.title, subId, 'stepbystep')
                .then(() => console.log('[Practice] Step mode attempt logged successfully'))
                .catch(err => console.error('[Practice] Failed to log step mode attempt:', err));
        } else {
            console.warn('[Practice] logPracticeAttempt not available');
        }

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

        // Debug: Log question data structure
        console.log('[Step Mode] Question data:', q.data);
        console.log('[Step Mode] Has image field:', q.data.image);
        console.log('[Step Mode] Has imageUrl field:', q.data.imageUrl);

        // Update progress
        document.getElementById('step-current').textContent = currentIndex + 1;
        document.getElementById('step-correct-count').textContent = this.stepMode.correctCount;
        document.getElementById('step-skipped-count').textContent = this.stepMode.skippedCount;

        const progress = ((currentIndex) / questionQueue.length) * 100;
        document.getElementById('step-progress-bar').style.width = progress + '%';

        // Update type badge
        document.getElementById('step-question-type-badge').textContent = q.typeLabel;
        document.getElementById('step-question-part').textContent = q.partLabel;

        // Helper: format text with MathJax support (same as classic mode)
        const formatText = (text, restoreBold = false) => {
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

            // Fix common temperature patterns where unit is outside delimiter
            // Pattern: \(117°\)C or \(117^\circ\)C → \(117^\circ\text{C}\)
            text = text.replace(/\\?\((\d+(?:[,\.]\d+)?)[°^\\circ]+\\?\)\s*([CFKcfk])/g, (match, num, unit) => {
                return `\\(${num}^\\circ\\text{${unit.toUpperCase()}}\\)`;
            });

            // Handle degree symbols: °C, °F, ° (only if not already in delimiter)
            text = text.replace(/(^|[^\\$\(])(\d+)°([CFKcfk])(?![\\$\)])/g, (match, prefix, num, unit) => {
                return `${prefix}\\(${num}^\\circ\\text{${unit.toUpperCase()}}\\)`;
            });
            text = text.replace(/(^|[^\\$\(])(\d+)°(?![CFKcfk\\$\)])/g, (match, prefix, num) => {
                return `${prefix}\\(${num}^\\circ\\)`;
            });

            // 1. Safe Escape using DOM (browser handles all edge cases perfectly)
            const div = document.createElement('div');
            div.textContent = String(text);
            let safe = div.innerHTML;

            // 2. Convert newlines to <br> for proper line breaks
            safe = safe.replace(/\\n/g, '<br>');  // Literal \n from JSON
            safe = safe.replace(/\n/g, '<br>');   // Actual newline characters

            // 3. Restore <b>/<strong> as blue bold (only for question text)
            if (restoreBold) {
                safe = safe.replace(/&lt;(b|strong)&gt;([\s\S]*?)&lt;\/\1&gt;/gi, (match, tag, content) => {
                    return `<${tag} class="font-bold text-blue-600 dark:text-blue-400">${content}</${tag}>`;
                });
            }

            return safe;
        };

        // Render question text + image (giống classic mode)
        const imgSrc = q.data.image || q.data.imageUrl || null;
        const imageHtml = imgSrc ? `<img src="${imgSrc}" class="mt-3 max-w-full md:max-w-md rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm cursor-pointer hover:opacity-90 hover:shadow-lg transition-all" alt="Hình minh họa câu hỏi" title="Nhấn để xem ảnh lớn" onclick="openLightbox('${imgSrc}')" onerror="this.style.display='none'">` : '';

        document.getElementById('step-question-text').innerHTML = formatText(q.data.text) + imageHtml;

        // Hide the separate image container (we're now using inline image)
        const imgContainer = document.getElementById('step-question-image');
        if (imgContainer) {
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

        // Show/hide back button based on position
        const backBtn = document.getElementById('step-back-btn');
        if (backBtn) {
            if (currentIndex > 0) {
                backBtn.classList.remove('hidden');
            } else {
                backBtn.classList.add('hidden');
            }
        }

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

    // Helper: Format text for step mode (same as classic mode)
    stepFormatText(text, restoreBold = false) {
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

        // Handle degree symbols: °C, °F, °
        text = text.replace(/(\d*)°C/g, '\\($1^\\circ C\\)');
        text = text.replace(/(\d*)°F/g, '\\($1^\\circ F\\)');
        text = text.replace(/(\d*)°/g, '\\($1^\\circ\\)');

        // 1. Safe Escape using DOM (browser handles all edge cases perfectly)
        const div = document.createElement('div');
        div.textContent = String(text);
        let safe = div.innerHTML;

        // 2. Convert newlines to <br> for proper line breaks
        safe = safe.replace(/\\n/g, '<br>');  // Literal \n from JSON
        safe = safe.replace(/\n/g, '<br>');   // Actual newline characters

        // 3. Restore <b>/<strong> as blue bold (only for question text)
        if (restoreBold) {
            safe = safe.replace(/&lt;(b|strong)&gt;([\s\S]*?)&lt;\/\1&gt;/gi, (match, tag, content) => {
                return `<${tag} class="font-bold text-blue-600 dark:text-blue-400">${content}</${tag}>`;
            });
        }

        return safe;
    },

    // Select option for Part 1 - auto check on click
    stepSelectOption(index, btnEl) {
        if (this.stepMode.isChecked) return;

        const q = this.stepMode.currentQuestion;
        if (!q) return;

        const questionId = `${q.type}_${q.data.id}`;

        // Check if this question was already scored
        const alreadyScored = this.stepMode.scoredQuestions[questionId];

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

            // Only count score if not already scored
            if (!alreadyScored) {
                this.stepMode.correctCount++;
                this.stepMode.scoredQuestions[questionId] = 'correct';
            }

            // Update count and show next button
            document.getElementById('step-correct-count').textContent = this.stepMode.correctCount;
            document.getElementById('step-check-btn').classList.add('hidden');
            document.getElementById('step-next-btn').classList.remove('hidden');
            document.getElementById('step-skip-btn').disabled = true;

            // Show back button if not at first question
            if (this.stepMode.currentIndex > 0) {
                document.getElementById('step-back-btn')?.classList.remove('hidden');
            }

            // Auto advance to next question after 1.25s
            setTimeout(() => {
                // Only advance if still on the same question and it was correct
                if (this.stepMode.isCorrect && this.stepMode.isChecked) {
                    this.stepNextQuestion();
                }
            }, 1250);
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

        const questionId = `${q.type}_${q.data.id}`;
        const alreadyScored = this.stepMode.scoredQuestions[questionId];

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

                // Only count score if not already scored
                if (!alreadyScored) {
                    this.stepMode.correctCount++;
                    this.stepMode.scoredQuestions[questionId] = 'correct';
                }

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

                // Only count score if not already scored
                if (!alreadyScored) {
                    this.stepMode.correctCount++;
                    this.stepMode.scoredQuestions[questionId] = 'correct';
                }

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

    // Go to previous question
    stepPrevQuestion() {
        if (this.stepMode.currentIndex > 0) {
            this.stepMode.currentIndex--;
            // Reset state for re-viewing
            this.stepMode.isChecked = false;
            this.stepMode.isCorrect = false;
            this.stepMode.selectedAnswer = null;
            this.stepMode.tfAnswers = {};
            this.renderStepQuestion();
        }
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
    async exitStepMode() {
        const result = await window.customDialog.confirm(
            'Thoát chế độ từng câu?',
            'Tiến trình làm bài sẽ không được lưu. Bạn có chắc chắn muốn thoát?',
            { type: 'warning', confirmText: 'Thoát', cancelText: 'Tiếp tục làm', danger: true }
        );

        if (result === 'confirm') {
            this.stopTimer();
            this.stepMode.active = false;
            this.timerEl.classList.add('hidden');

            // Thông báo cho Gatekeeper: Đã kết thúc làm bài (cho phép reload nếu cần)
            if (window.firebaseExams?.setExamInProgress) {
                window.firebaseExams.setExamInProgress(false);
            }

            this.goHome();
        }
    },

    // Show step mode result
    showStepResult() {
        this.stopTimer();
        this.stepMode.active = false;
        this.timerEl.classList.add('hidden');

        // Thông báo cho Gatekeeper: Đã kết thúc làm bài (cho phép reload nếu cần)
        if (window.firebaseExams?.setExamInProgress) {
            window.firebaseExams.setExamInProgress(false);
        }

        const { correctCount, skippedCount, questionQueue } = this.stepMode;
        const total = questionQueue.length;
        const score = ((correctCount / total) * 10).toFixed(1);

        // Calculate time
        const duration = Math.floor((new Date() - this.startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;

        // Store exam result for saving to Firebase
        this.examResult = {
            examId: this.currentExam.meta.id,
            examTitle: this.currentExam.meta.title,
            subjectId: this.currentExam.subId,
            score: parseFloat(score),
            correctCount,
            totalQuestions: total,
            wrongCount: total - correctCount - skippedCount,
            skippedCount,
            durationSeconds: duration,
            mode: 'stepbystep', // Mark as step-by-step mode
            answers: { ...this.stepMode.scoredQuestions }, // Store scored questions
            examData: this.currentExam.data
        };

        // Save result to Firebase for history
        if (window.firebaseExams?.savePracticeResult) {
            window.firebaseExams.savePracticeResult(this.examResult)
                .then(() => console.log('[Practice] Step mode result saved to Firebase'))
                .catch(err => console.error('[Practice] Failed to save step mode result:', err));
        }

        this.renderTemplate('tpl-result');

        document.getElementById('result-subject-name').textContent = `${this.currentExam.meta.title} (Chế độ Từng Câu)`;
        document.getElementById('score-display').textContent = score;
        document.getElementById('result-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('result-correct').textContent = `${correctCount}/${total}`;
        document.getElementById('result-wrong').textContent = `${total - correctCount - skippedCount}/${total}`;

        // Update average bar
        const avgBar = document.getElementById('stat-avg-bar');
        if (avgBar) avgBar.style.width = (parseFloat(score) * 10) + '%';
    }
};

// Export app and musicPlayer for manual initialization
window.app = app;
window.musicPlayer = musicPlayer;
