// --- CATEGORIES & DATA ---
const CATEGORIES = {
    'gdpt': 'Chương trình GDPT',
    'advanced_gdpt': '(Nâng cao) Chương trình GDPT',
    'topic': 'Từ vựng theo chủ đề'
};

const VOCAB_INDEX_URL = './vocab/index.json';
let VOCAB_SETS = [];
let vocabLoaded = false;

// Cache discovered files per folder to avoid redundant scans
const folderFileCache = {};

// Legacy fallback list (used only if automatic scan fails)
const FALLBACK_FILES = {
    'gdpt-program': [
        'family-life.json', 'life-story.json', 'school-life.json', 'friendship.json',
        'environment.json', 'global-warming.json', 'cultural-diversity.json',
        'future-jobs.json', 'cities.json', 'ecotourism.json', 'relationship.json'
    ],
    'advanced-gdpt-program': [
        'core.json', 'academic.json', 'ielts.json', 'advanced.json',
        'essay.json', 'presentation.json', 'debate.json'
    ],
    'topic-vocab': [
        'technology.json', 'business.json', 'travel.json', 'food.json',
        'health.json', 'sports.json', 'music.json', 'art.json',
        'science.json', 'education.json', 'culture.json', 'history.json',
        'politics.json', 'economy.json', 'medicine.json', 'law.json',
        'engineering.json', 'psychology.json', 'philosophy.json'
    ]
};

// --- GLOBAL STATE ---
let currentView = 'home';
let currentSet = null;
let sessionStartTime = 0;
let searchTerm = '';
let progressFilter = 'all';
let currentSessionData = []; // Data used for the current session (subset for relearn or full set)
let isRelearnMode = false;   // Flag to indicate if we are in relearn mode
let lastSessionConfig = { mode: null, dataset: 'full' }; // Track last finished session

const SESSION_STATE_KEY = 'vocab_session_state_v2';

// Game States
let fcIndex = 0;
let fcIsFlipped = false;
let fcStats = { known: 0, learning: 0 };
let sessionWrongItems = []; // Track wrong answers with source references

const MATCH_BATCH_PAIR_COUNT = 10;
let matchCards = [];
let matchSelected = [];
let matchMatched = [];
let matchTimerInterval;
let matchTime = 0;
let matchCurrentBatch = 0; // Batch hiện tại (mỗi batch 10 cặp)
let matchTotalPairs = 0; // Tổng số cặp
let matchCorrectPairs = 0; // Số cặp đúng
let matchWrongAttempts = 0; // Số lần chọn sai
let matchBatchSizes = [];
let matchBatchProgress = [];

let learnIndex = 0;
let learnStats = { correct: 0, wrong: 0 };
let learnQuestions = [];
let isLearnAnswerLocked = false;

// User Data State
const DEFAULT_USER_STATS = {
    totalWords: 0,
    totalMinutes: 0,
    sessions: 0,
    learnedIds: [],
    weakWords: {},
    randomHistory: {},
    matchingStats: { total: 0, correct: 0 },
    learnStats: { total: 0, correct: 0 }
};

let userStats = normalizeUserStats(JSON.parse(localStorage.getItem('study_stats')) || DEFAULT_USER_STATS);
let learnedWordCache = new Set(userStats.learnedIds || []);

// Word selection state
let selectedWordCount = null; // null = all, number = specific count
let wordSelectionMode = 'random'; // 'random', 'first', 'next', 'unlearned', 'custom'

// --- MUSIC PLAYER ---
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
const MUSIC_CUSTOM_KEY = 'studystation_music_custom_tracks_v1';
const MUSIC_UI_STATE_KEY = 'studystation_music_state_v1';
const DEFAULT_MUSIC_STATE = {
    visible: false,
    volume: 60,
    currentTrackId: DEFAULT_MUSIC_TRACKS[0]?.id || null,
    isPlaying: false,
    compact: false,
    showArtwork: true
};

let customMusicTracks = [];
let musicPlaylist = [];
let currentTrackIndex = 0;
let musicState = { ...DEFAULT_MUSIC_STATE };
let musicControlsBound = false;
let ytPlayer = null;
let isYouTubePlayerReady = false;
let pendingTrackAction = null;
let youtubeApiInjected = false;

function initMusicFeature() {
    customMusicTracks = loadCustomMusicTracks();
    musicState = { ...DEFAULT_MUSIC_STATE, ...loadMusicState() };
    if (typeof musicState.compact !== 'boolean') {
        musicState.compact = window.innerWidth < 768;
    }
    if (typeof musicState.showArtwork !== 'boolean') {
        musicState.showArtwork = true;
    }
    rebuildMusicPlaylist();
    const savedIndex = musicPlaylist.findIndex(track => track.id === musicState.currentTrackId);
    currentTrackIndex = savedIndex >= 0 ? savedIndex : 0;
    musicState.currentTrackId = musicPlaylist[currentTrackIndex]?.id || null;
    renderMusicPlaylist();
    updateNowPlayingUI(getCurrentTrack());
    attachMusicControlListeners();
    updateMusicVolume(musicState.volume, { skipSave: true });
    setMusicPanelVisibility(Boolean(musicState.visible));
    setMusicFeedback('');
    injectYouTubeApiScript();
    applyMusicDisplayState();
    updateMiniPlayerUI();
    window.addEventListener('resize', handleMusicResponsivePadding);
}

function attachMusicControlListeners() {
    if (musicControlsBound) return;
    const addForm = document.getElementById('music-add-form');
    if (addForm) addForm.addEventListener('submit', handleMusicAddSubmit);
    const prevBtn = document.getElementById('music-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', (event) => {
        event.preventDefault();
        handleMusicPrev();
    });
    const nextBtn = document.getElementById('music-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', (event) => {
        event.preventDefault();
        handleMusicNext();
    });
    const playBtn = document.getElementById('music-play-btn');
    if (playBtn) playBtn.addEventListener('click', (event) => {
        event.preventDefault();
        toggleMusicPlayback();
    });
    const volumeInput = document.getElementById('music-volume');
    if (volumeInput) volumeInput.addEventListener('input', (event) => updateMusicVolume(event.target.value));
    const compactBtn = document.getElementById('music-compact-btn');
    if (compactBtn) compactBtn.addEventListener('click', toggleMusicCompactMode);
    const miniExpand = document.getElementById('music-mini-expand');
    if (miniExpand) miniExpand.addEventListener('click', toggleMusicCompactMode);
    const miniPlay = document.getElementById('music-mini-play');
    if (miniPlay) miniPlay.addEventListener('click', (event) => {
        event.preventDefault();
        toggleMusicPlayback();
    });
    const miniNext = document.getElementById('music-mini-next');
    if (miniNext) miniNext.addEventListener('click', (event) => {
        event.preventDefault();
        handleMusicNext();
    });
    const miniPrev = document.getElementById('music-mini-prev');
    if (miniPrev) miniPrev.addEventListener('click', (event) => {
        event.preventDefault();
        handleMusicPrev();
    });
    const artworkToggle = document.getElementById('music-artwork-toggle');
    if (artworkToggle) artworkToggle.addEventListener('click', toggleMusicArtworkVisibility);
    const overlay = document.getElementById('music-overlay');
    if (overlay) overlay.addEventListener('click', () => toggleMusicPanel(false));
    musicControlsBound = true;
}

function injectYouTubeApiScript() {
    if (youtubeApiInjected) return;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.id = 'yt-player-api';
    document.body.appendChild(script);
    youtubeApiInjected = true;
}

window.onYouTubeIframeAPIReady = function () {
    createYouTubePlayer();
};

function createYouTubePlayer() {
    const host = document.getElementById('music-player-host');
    if (!host) return;
    ytPlayer = new YT.Player('music-player-host', {
        height: '0',
        width: '0',
        videoId: getCurrentTrack()?.videoId || extractYouTubeVideoId(DEFAULT_MUSIC_TRACKS[0]?.url || '') || '',
        playerVars: { autoplay: 0, controls: 0, rel: 0, playsinline: 1 },
        events: {
            onReady: () => {
                isYouTubePlayerReady = true;
                ytPlayer.setVolume(musicState.volume);
                const pending = pendingTrackAction;
                pendingTrackAction = null;
                if (pending) {
                    const track = musicPlaylist.find(item => item.id === pending.trackId);
                    if (track) {
                        cueTrack(track, { autoplay: pending.autoplay });
                        return;
                    }
                }
                const current = getCurrentTrack();
                if (current) cueTrack(current, { autoplay: false });
            },
            onStateChange: handleYouTubePlayerStateChange
        }
    });
}

function handleYouTubePlayerStateChange(event) {
    if (!event || typeof event.data === 'undefined') return;
    if (event.data === YT.PlayerState.ENDED) {
        musicState.isPlaying = false;
        handleMusicNext(true);
    } else if (event.data === YT.PlayerState.PLAYING) {
        musicState.isPlaying = true;
    } else if (event.data === YT.PlayerState.PAUSED) {
        musicState.isPlaying = false;
    }
    updatePlayButtonUI();
    saveMusicState();
}

function rebuildMusicPlaylist() {
    const sanitizedCustom = (customMusicTracks || [])
        .map(track => normalizeTrack({ ...track, source: 'custom' }))
        .filter(Boolean);
    customMusicTracks = sanitizedCustom;

    const sanitizedDefaults = DEFAULT_MUSIC_TRACKS
        .map(track => normalizeTrack(track))
        .filter(Boolean);

    const dedupedDefaults = sanitizedDefaults.filter(def =>
        !sanitizedCustom.some(custom => custom.videoId === def.videoId)
    );

    musicPlaylist = [...dedupedDefaults, ...sanitizedCustom];
}

function loadCustomMusicTracks() {
    try {
        const raw = localStorage.getItem(MUSIC_CUSTOM_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(track => normalizeTrack({ ...track, source: 'custom' }))
            .filter(Boolean);
    } catch (error) {
        console.warn('Không thể đọc playlist tùy chỉnh:', error);
        return [];
    }
}

function saveCustomMusicTracks() {
    try {
        const exportData = customMusicTracks.map(({ id, title, url }) => ({ id, title, url }));
        localStorage.setItem(MUSIC_CUSTOM_KEY, JSON.stringify(exportData));
    } catch (error) {
        console.warn('Không thể lưu playlist tùy chỉnh:', error);
    }
}

function loadMusicState() {
    try {
        const raw = localStorage.getItem(MUSIC_UI_STATE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.warn('Không thể đọc trạng thái âm nhạc:', error);
        return {};
    }
}

function saveMusicState() {
    try {
        const payload = {
            visible: Boolean(musicState.visible),
            volume: musicState.volume,
            currentTrackId: musicState.currentTrackId,
            isPlaying: Boolean(musicState.isPlaying),
            compact: Boolean(musicState.compact),
            showArtwork: Boolean(musicState.showArtwork)
        };
        localStorage.setItem(MUSIC_UI_STATE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('Không thể lưu trạng thái âm nhạc:', error);
    }
}

function getCurrentTrack() {
    return musicPlaylist[currentTrackIndex] || null;
}

function setCurrentTrack(index, options = {}) {
    if (!musicPlaylist.length) return;
    if (index < 0) index = 0;
    if (index >= musicPlaylist.length) index = musicPlaylist.length - 1;
    currentTrackIndex = index;
    const track = getCurrentTrack();
    if (!track) return;
    musicState.currentTrackId = track.id;
    cueTrack(track, options);
    renderMusicPlaylist();
    updateMiniPlayerUI(track);
    updateArtworkUI(track);
    saveMusicState();
}

function cueTrack(track, options = {}) {
    if (!track) return;
    const autoplay = options.autoplay === true;
    updateNowPlayingUI(track);
    if (!ytPlayer || !isYouTubePlayerReady) {
        pendingTrackAction = { trackId: track.id, autoplay };
        return;
    }
    try {
        if (autoplay) {
            ytPlayer.loadVideoById(track.videoId);
            musicState.isPlaying = true;
        } else {
            ytPlayer.cueVideoById(track.videoId);
            musicState.isPlaying = false;
        }
        updatePlayButtonUI();
    } catch (error) {
        console.warn('Không thể phát YouTube:', error);
        setMusicFeedback('Không phát được video này. Hãy thử link khác.', 'error');
    }
}

function updateNowPlayingUI(track) {
    const titleEl = document.getElementById('music-current-title');
    if (titleEl) {
        titleEl.textContent = track ? track.title : 'Chưa chọn bài hát';
    }
    updateMiniPlayerUI(track);
    const openBtn = document.getElementById('music-open-youtube');
    if (openBtn) {
        if (track?.url) {
            openBtn.classList.remove('hidden');
            openBtn.onclick = () => window.open(track.url, '_blank', 'noopener');
        } else {
            openBtn.classList.add('hidden');
            openBtn.onclick = null;
        }
    }
    updateArtworkUI(track);
}

function renderMusicPlaylist() {
    const listEl = document.getElementById('music-track-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!musicPlaylist.length) {
        const empty = document.createElement('p');
        empty.className = 'text-sm text-slate-500 dark:text-slate-400';
        empty.textContent = 'Chưa có bài hát nào. Hãy thêm link YouTube!';
        listEl.appendChild(empty);
        return;
    }
    musicPlaylist.forEach((track, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isActive = index === currentTrackIndex;
        btn.className = `w-full flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition-all btn-press ${isActive
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-100'
            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`;
        const contentWrap = document.createElement('div');
        contentWrap.className = 'flex items-center gap-3 flex-1';
        const thumb = document.createElement('img');
        thumb.src = track.thumbnail;
        thumb.alt = track.title;
        thumb.loading = 'lazy';
        thumb.className = 'w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0';
        const infoWrap = document.createElement('div');
        const name = document.createElement('p');
        name.className = 'text-sm md:text-base font-semibold truncate';
        name.textContent = track.title;
        const badge = document.createElement('p');
        badge.className = `text-[11px] uppercase tracking-wide ${isActive ? 'text-indigo-400 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`;
        badge.textContent = track.source === 'preset' ? 'Sẵn có' : 'Tùy chỉnh';
        infoWrap.appendChild(name);
        infoWrap.appendChild(badge);
        contentWrap.appendChild(thumb);
        contentWrap.appendChild(infoWrap);
        const rightWrap = document.createElement('div');
        rightWrap.className = 'flex items-center gap-2';
        const badgeDot = document.createElement('span');
        badgeDot.className = `w-2 h-2 rounded-full ${track.source === 'preset' ? 'bg-indigo-400' : 'bg-emerald-400'}`;
        rightWrap.appendChild(badgeDot);
        const icon = document.createElement('i');
        icon.className = `ph ${musicState.isPlaying && isActive ? 'ph-equalizer text-indigo-500' : 'ph-play text-slate-400 dark:text-slate-600'} text-xl`;
        rightWrap.appendChild(icon);
        btn.appendChild(contentWrap);
        btn.appendChild(rightWrap);
        btn.addEventListener('click', () => handleTrackSelect(index));
        listEl.appendChild(btn);
    });
}

function handleTrackSelect(index) {
    const shouldAutoplay = Boolean(musicState.isPlaying);
    setCurrentTrack(index, { autoplay: shouldAutoplay });
}

function handleMusicNext(forceAutoplay) {
    if (!musicPlaylist.length) return;
    const newIndex = (currentTrackIndex + 1) % musicPlaylist.length;
    const autoplay = typeof forceAutoplay === 'boolean' ? forceAutoplay : musicState.isPlaying;
    setCurrentTrack(newIndex, { autoplay });
}

function handleMusicPrev(forceAutoplay) {
    if (!musicPlaylist.length) return;
    const newIndex = (currentTrackIndex - 1 + musicPlaylist.length) % musicPlaylist.length;
    const autoplay = typeof forceAutoplay === 'boolean' ? forceAutoplay : musicState.isPlaying;
    setCurrentTrack(newIndex, { autoplay });
}

function toggleMusicPlayback() {
    if (!musicPlaylist.length) return;
    if (!ytPlayer || !isYouTubePlayerReady) {
        setMusicFeedback('YouTube chưa sẵn sàng, thử lại sau nhé.', 'error');
        return;
    }
    if (!getCurrentTrack()) {
        setCurrentTrack(0, { autoplay: true });
        return;
    }
    if (musicState.isPlaying) {
        ytPlayer.pauseVideo();
        musicState.isPlaying = false;
    } else {
        ytPlayer.playVideo();
        musicState.isPlaying = true;
    }
    updatePlayButtonUI();
    saveMusicState();
}

function updatePlayButtonUI() {
    updatePlayButtonIcon('music-play-btn', musicState.isPlaying ? 'pause' : 'play', 'text-3xl');
    updatePlayButtonIcon('music-mini-play', musicState.isPlaying ? 'pause' : 'play', 'text-xl');
}

function updateMusicVolume(value, options = {}) {
    let numeric = Number(value);
    if (Number.isNaN(numeric)) numeric = musicState.volume;
    numeric = Math.min(100, Math.max(0, numeric));
    musicState.volume = numeric;
    updateMusicVolumeUI(numeric);
    if (ytPlayer && isYouTubePlayerReady) {
        ytPlayer.setVolume(numeric);
    }
    if (!options.skipSave) saveMusicState();
}

function updateMusicVolumeUI(volume) {
    const volumeInput = document.getElementById('music-volume');
    if (volumeInput) volumeInput.value = volume;
    const label = document.getElementById('music-volume-value');
    if (label) label.textContent = `${volume}%`;
}

function setMusicFeedback(message = '', type = 'info') {
    const feedbackEl = document.getElementById('music-feedback');
    if (!feedbackEl) return;
    const base = 'text-xs mt-1 min-h-[1.5rem]';
    let color = 'text-slate-500 dark:text-slate-400';
    if (type === 'error') color = 'text-red-500 dark:text-red-400';
    else if (type === 'success') color = 'text-emerald-600 dark:text-emerald-400';
    feedbackEl.className = `${base} ${color}`;
    feedbackEl.textContent = message;
}

async function handleMusicAddSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('music-url-input');
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) {
        setMusicFeedback('Hãy dán link YouTube để thêm.', 'error');
        return;
    }
    const videoId = extractYouTubeVideoId(raw);
    if (!videoId) {
        setMusicFeedback('Link YouTube chưa đúng định dạng.', 'error');
        return;
    }
    if (musicPlaylist.some(track => track.videoId === videoId)) {
        setMusicFeedback('Bài hát này đã có trong danh sách.', 'info');
        input.value = '';
        return;
    }
    setMusicFeedback('Đang lấy tiêu đề từ YouTube...', 'info');
    let title = '';
    try {
        title = await fetchYouTubeTitle(videoId);
    } catch (error) {
        title = '';
    }
    const newTrack = normalizeTrack({
        id: `custom-${videoId}`,
        title: title || 'Bài hát riêng',
        url: sanitizeYouTubeUrl(raw) || buildYouTubeWatchUrl(videoId),
        source: 'custom'
    });
    if (!newTrack) {
        setMusicFeedback('Không thể thêm bài hát này.', 'error');
        return;
    }
    customMusicTracks.push(newTrack);
    saveCustomMusicTracks();
    rebuildMusicPlaylist();
    const newIndex = musicPlaylist.findIndex(track => track.videoId === videoId);
    setCurrentTrack(newIndex >= 0 ? newIndex : currentTrackIndex, { autoplay: true });
    setMusicFeedback('Đã thêm bài hát mới!', 'success');
    input.value = '';
}

function extractYouTubeVideoId(input) {
    if (!input) return '';
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const regex = /(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&]|$)/;
    const match = trimmed.match(regex);
    return match ? match[1] : '';
}

async function fetchYouTubeTitle(videoId) {
    const url = `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Không thể lấy tiêu đề');
    const data = await response.json();
    return data?.title || '';
}

function toggleMusicPanel(forceState) {
    if (typeof forceState === 'boolean') {
        setMusicPanelVisibility(forceState);
    } else {
        setMusicPanelVisibility(!musicState.visible);
    }
}

function setMusicPanelVisibility(shouldShow) {
    const panel = document.getElementById('music-panel');
    if (panel) {
        panel.classList.toggle('hidden', !shouldShow);
        if (shouldShow) panel.scrollTop = 0;
    }
    toggleMusicOverlay(shouldShow);
    musicState.visible = shouldShow;
    updateMusicToggleVisual(shouldShow);
    applyMusicDisplayState();
    updateMiniPlayerUI();
    saveMusicState();
}

function updateMusicToggleVisual(isActive) {
    const btn = document.getElementById('music-toggle-btn');
    if (!btn) return;
    btn.classList.toggle('text-indigo-500', isActive);
    btn.classList.toggle('bg-indigo-50', isActive);
    btn.classList.toggle('dark:text-indigo-300', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
}

function normalizeTrack(track) {
    if (!track) return null;
    const videoId = track.videoId || extractYouTubeVideoId(track.url || '');
    if (!videoId) return null;
    return {
        id: track.id || `track-${videoId}`,
        title: (track.title || 'Bài hát riêng').trim(),
        videoId,
        url: track.url ? sanitizeYouTubeUrl(track.url) || buildYouTubeWatchUrl(videoId) : buildYouTubeWatchUrl(videoId),
        thumbnail: getYouTubeThumbnail(videoId),
        source: track.source || 'preset'
    };
}

function sanitizeYouTubeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
        const url = new URL(rawUrl.trim());
        if (!url.hostname.includes('youtube.com') && !url.hostname.includes('youtu.be')) return '';
        const videoId = extractYouTubeVideoId(rawUrl);
        return videoId ? buildYouTubeWatchUrl(videoId) : '';
    } catch (error) {
        return '';
    }
}

function buildYouTubeWatchUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

function handleMusicResponsivePadding() {
    applyMusicDisplayState();
}

function getYouTubeThumbnail(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function toggleMusicCompactMode(event) {
    if (event) event.preventDefault();
    musicState.compact = !musicState.compact;
    applyMusicDisplayState();
    saveMusicState();
}

function toggleMusicArtworkVisibility(event) {
    if (event) event.preventDefault();
    musicState.showArtwork = !musicState.showArtwork;
    updateArtworkUI(getCurrentTrack());
    saveMusicState();
}

function applyMusicDisplayState() {
    const panel = document.getElementById('music-panel');
    const fullSections = document.getElementById('music-full-sections');
    const compactBtn = document.getElementById('music-compact-btn');
    const miniExpand = document.getElementById('music-mini-expand');
    const miniControls = document.getElementById('music-mini-controls');
    if (panel) panel.classList.toggle('music-panel-compact', musicState.compact);
    if (fullSections) fullSections.classList.toggle('hidden', musicState.compact);
    if (miniControls) miniControls.classList.toggle('opacity-60', !musicState.compact);
    const iconClass = musicState.compact ? 'ph ph-arrows-out' : 'ph ph-minimize';
    if (compactBtn) {
        const icon = compactBtn.querySelector('i');
        if (icon) icon.className = `${iconClass} text-lg`;
        compactBtn.setAttribute('aria-label', musicState.compact ? 'Mở rộng giao diện âm nhạc' : 'Thu nhỏ giao diện âm nhạc');
    }
    if (miniExpand) {
        const icon = miniExpand.querySelector('i');
        if (icon) icon.className = musicState.compact ? 'ph ph-arrows-out text-lg' : 'ph ph-arrows-in text-lg';
        miniExpand.setAttribute('aria-label', musicState.compact ? 'Mở rộng bảng âm nhạc' : 'Thu nhỏ bảng âm nhạc');
    }
}

function updateArtworkUI(track) {
    const wrapper = document.getElementById('music-artwork-wrapper');
    const img = document.getElementById('music-artwork');
    const toggleBtn = document.getElementById('music-artwork-toggle');
    if (!wrapper || !img) return;
    if (!track) {
        wrapper.classList.add('hidden');
        return;
    }
    wrapper.classList.remove('hidden');
    img.src = track.thumbnail;
    img.alt = track.title || 'Artwork bài hát';
    const shouldHide = !musicState.showArtwork;
    img.classList.toggle('hidden', shouldHide);
    if (toggleBtn) {
        toggleBtn.textContent = shouldHide ? 'Hiện ảnh' : 'Ẩn ảnh';
    }
}

function updatePlayButtonIcon(buttonId, state, sizeClass) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    const icon = btn.querySelector('i');
    const isPlaying = state === 'pause';
    btn.setAttribute('aria-label', isPlaying ? 'Tạm dừng nhạc' : 'Phát nhạc');
    if (icon) icon.className = `ph ${isPlaying ? 'ph-pause' : 'ph-play'} ${sizeClass}`;
}

function updateMiniPlayerUI(track = getCurrentTrack()) {
    const titleEl = document.getElementById('music-mini-title');
    if (titleEl) {
        titleEl.textContent = track ? track.title : 'Chưa chọn bài hát';
    }
    const miniControls = document.getElementById('music-mini-controls');
    if (miniControls) {
        miniControls.classList.toggle('hidden', !musicState.visible);
    }
    updatePlayButtonUI();
}

function toggleMusicOverlay(visible) {
    const overlay = document.getElementById('music-overlay');
    if (!overlay) return;
    overlay.classList.toggle('hidden', !visible);
}

// --- THEME & DATA ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
}

function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

function saveStats() { localStorage.setItem('study_stats', JSON.stringify(userStats)); }

function normalizeUserStats(rawStats = {}) {
    const normalized = {
        ...DEFAULT_USER_STATS,
        ...rawStats
    };
    normalized.learnedIds = normalizeLearnedIds(normalized.learnedIds);
    normalized.weakWords = normalized.weakWords || {};
    normalized.randomHistory = normalized.randomHistory || {};
    normalized.matchingStats = normalized.matchingStats || { total: 0, correct: 0 };
    normalized.learnStats = normalized.learnStats || { total: 0, correct: 0 };
    return normalized;
}

function normalizeLearnedIds(entries) {
    if (!Array.isArray(entries)) return [];
    const seen = new Set();
    const normalized = [];
    entries.forEach(entry => {
        let value = null;
        if (typeof entry === 'string' && entry.includes('::')) {
            value = entry;
        } else if (entry != null) {
            value = buildLegacyLearnedKey(entry);
        }
        if (value && !seen.has(value)) {
            seen.add(value);
            normalized.push(value);
        }
    });
    return normalized;
}

function buildLearnedKey(setId, wordId) {
    if (wordId == null) return null;
    const safeSetId = setId || 'global';
    return `${safeSetId}::${wordId}`;
}

function buildLegacyLearnedKey(wordId) {
    if (wordId == null) return null;
    return `legacy::${wordId}`;
}

function hasLearnedWord(setId, wordId) {
    const key = buildLearnedKey(setId, wordId);
    const legacyKey = buildLegacyLearnedKey(wordId);
    return (key && learnedWordCache.has(key)) || (legacyKey && learnedWordCache.has(legacyKey));
}

function refreshLearnedWordCache() {
    learnedWordCache = new Set(userStats.learnedIds || []);
}

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function saveSessionState(state) {
    if (!state || !state.setId) return;
    try {
        localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('Không thể lưu trạng thái phiên học:', error);
    }
}

function loadSessionStateFromStorage() {
    try {
        const raw = localStorage.getItem(SESSION_STATE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('Không thể đọc trạng thái phiên học:', error);
        return null;
    }
}

function clearSessionState() {
    localStorage.removeItem(SESSION_STATE_KEY);
}

function persistFlashcardState() {
    if (!currentSet || !currentSet.id || !currentSessionData.length) return;
    saveSessionState({
        mode: 'flashcard',
        setId: currentSet.id,
        dataset: lastSessionConfig?.dataset || (isRelearnMode ? 'weak' : 'full'),
        isRelearnMode,
        fcIndex,
        fcStats,
        currentSessionData: deepClone(currentSessionData)
    });
}

function persistLearnState() {
    if (!currentSet || !currentSet.id || !learnQuestions.length) return;
    saveSessionState({
        mode: 'learn',
        setId: currentSet.id,
        dataset: lastSessionConfig?.dataset || (isRelearnMode ? 'weak' : 'full'),
        isRelearnMode,
        learnIndex,
        learnStats,
        learnQuestions: deepClone(learnQuestions),
        currentSessionData: deepClone(currentSessionData)
    });
}

function persistMatchingState() {
    if (!currentSet || !currentSet.id || !matchCards.length) return;
    saveSessionState({
        mode: 'matching',
        setId: currentSet.id,
        dataset: 'full',
        isRelearnMode: false,
        matchCards: deepClone(matchCards),
        matchMatched: deepClone(matchMatched),
        matchTime,
        matchCurrentBatch,
        matchBatchSizes: deepClone(matchBatchSizes),
        matchBatchProgress: deepClone(matchBatchProgress),
        matchCorrectPairs,
        matchWrongAttempts,
        currentSessionData: deepClone(currentSessionData)
    });
}

async function loadVocabSets() {
    if (vocabLoaded) return;

    // Show loading
    showLoading(true);

    let localSets = [];
    let firebaseSets = [];

    // 1. Load from local JSON files (existing logic)
    try {
        const response = await fetch(VOCAB_INDEX_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const indexData = await response.json();
        const categories = indexData.categories || [];

        const categoryPromises = categories.map(async (category) => {
            try {
                const filesToTry = await getFilesToScan(category.folder);
                const loadPromises = filesToTry.map(async (filename) => {
                    try {
                        const vocabResponse = await fetch(`./vocab/${category.folder}/${filename}`);
                        if (!vocabResponse.ok) return null;
                        const vocabJson = await vocabResponse.json();
                        if (!vocabJson.words || !Array.isArray(vocabJson.words)) return null;
                        if (filename.includes('vocab-list') || filename.includes('index')) return null;
                        const words = vocabJson.words;
                        if (words.length === 0) return null;
                        const setId = `${category.folder}-${filename.replace(/\.json$/, '')}`.toLowerCase();
                        return {
                            id: setId,
                            categoryId: category.type,
                            title: vocabJson.name || vocabJson.title || filename.replace(/\.json$/, ''),
                            description: vocabJson.title || vocabJson.name || '',
                            color: vocabJson.color || 'indigo',
                            data: words.map(word => ({
                                ...word,
                                topicId: vocabJson.topicId || setId,
                                topicTitle: vocabJson.title || vocabJson.name
                            }))
                        };
                    } catch (_) {
                        return null;
                    }
                });
                const results = await Promise.all(loadPromises);
                return results.filter(r => r !== null);
            } catch (categoryError) {
                console.error(`Không thể tải thư mục ${category.folder}:`, categoryError);
                return [];
            }
        });

        const categoryResults = await Promise.all(categoryPromises);
        localSets = categoryResults.flat();
    } catch (error) {
        console.error('Không thể tải dữ liệu từ vựng local:', error);
        localSets = [];
    }

    // 2. Load from Firebase (new)
    try {
        if (window.firebaseVocab && typeof window.firebaseVocab.getAllVocabSets === 'function') {
            const fbSets = await window.firebaseVocab.getAllVocabSets();
            firebaseSets = (fbSets || []).map(transformFirebaseToDisplayFormat).filter(Boolean);
            console.log(`[Vocab] Loaded ${firebaseSets.length} sets from Firebase`);
        }
    } catch (fbError) {
        console.warn('Không thể tải từ vựng từ Firebase:', fbError);
        firebaseSets = [];
    }

    // 3. Merge: Firebase sets take priority over local sets with same ID
    const localIds = new Set(localSets.map(s => s.id));
    const mergedSets = [...localSets];

    for (const fbSet of firebaseSets) {
        const existingIndex = mergedSets.findIndex(s => s.id === fbSet.id);
        if (existingIndex >= 0) {
            // Firebase overrides local
            mergedSets[existingIndex] = fbSet;
        } else {
            // Add new Firebase set
            mergedSets.push(fbSet);
        }
    }

    VOCAB_SETS = mergedSets;
    console.log(`[Vocab] Total sets loaded: ${VOCAB_SETS.length} (Local: ${localSets.length}, Firebase: ${firebaseSets.length})`);

    vocabLoaded = true;
    showLoading(false);
}

// Transform Firebase vocab set structure to display format
function transformFirebaseToDisplayFormat(fbSet) {
    if (!fbSet || !fbSet.id) return null;

    // Map Firebase category to categoryId
    const categoryMap = {
        'gdpt': 'gdpt',
        'advanced_gdpt': 'advanced_gdpt',
        'topic': 'topic'
    };

    // Convert words from object/array to array format
    let words = [];
    if (fbSet.words) {
        if (Array.isArray(fbSet.words)) {
            words = fbSet.words;
        } else if (typeof fbSet.words === 'object') {
            words = Object.values(fbSet.words);
        }
    }

    if (words.length === 0) return null;

    const setId = fbSet.id;
    const title = fbSet.name || fbSet.title || 'Untitled';

    return {
        id: setId,
        categoryId: categoryMap[fbSet.category] || 'topic',
        title: title,
        description: fbSet.description || fbSet.topic || title,
        color: fbSet.color || 'indigo',
        source: 'firebase', // Mark as Firebase source for debugging
        data: words.map((word, idx) => ({
            id: word.id || idx + 1,
            word: word.word || '',
            type: word.type || '',
            ipa: word.ipa || '',
            meaning: word.meaning || '',
            example: word.example || '',
            topicId: fbSet.topic || setId,
            topicTitle: title
        }))
    };
}


// Attempt to discover JSON files in a folder so new vocab sets auto-load
async function getFilesToScan(folder) {
    if (folderFileCache[folder]) return folderFileCache[folder];
    const sequentialFiles = await scanSequentialNumberedFiles(folder, 20);
    folderFileCache[folder] = sequentialFiles;
    return sequentialFiles;
}

function normalizeFileList(files) {
    if (!Array.isArray(files)) return [];
    const blacklist = ['index', 'manifest', 'vocab-list'];
    const seen = new Set();
    return files
        .map(file => (typeof file === 'string' ? file.trim() : ''))
        .filter(Boolean)
        .filter(name => name.toLowerCase().endsWith('.json'))
        .filter(name => !blacklist.some(term => name.toLowerCase().includes(term)))
        .filter(name => {
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
        });
}

async function tryDirectoryListing(folder) {
    const urlsToTry = [
        `./vocab/${folder}/?t=${Date.now()}`,
        `./vocab/${folder}?t=${Date.now()}`
    ];

    for (const url of urlsToTry) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-cache',
                headers: { 'Accept': 'text/html,application/json' }
            });
            if (!response.ok) continue;
            const contentType = response.headers.get('content-type') || '';

            // Some dev servers (e.g. Vite) can return JSON arrays for directory listing
            if (contentType.includes('application/json')) {
                const data = await response.json();
                const files = Array.isArray(data.files) ? data.files : data;
                const normalized = normalizeFileList(files);
                if (normalized.length) return normalized;
                continue;
            }

            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const links = Array.from(doc.querySelectorAll('a[href$=".json"]'));
            const files = links.map(link => {
                const href = link.getAttribute('href') || '';
                const decoded = decodeURIComponent(href);
                return decoded.split('/').pop();
            });
            const normalized = normalizeFileList(files);
            if (normalized.length) return normalized;
        } catch (error) {
            // Ignore and try next strategy
        }
    }

    return [];
}

async function tryFolderManifest(folder) {
    const manifestCandidates = [
        `./vocab/${folder}/manifest.json`,
        `./vocab/${folder}/filelist.json`,
        `./vocab/${folder}/index.json`
    ];

    for (const url of manifestCandidates) {
        try {
            const response = await fetch(url, { method: 'GET', cache: 'no-cache' });
            if (!response.ok) continue;
            const data = await response.json();
            if (Array.isArray(data.files)) {
                const normalized = normalizeFileList(data.files);
                if (normalized.length) return normalized;
            } else if (Array.isArray(data)) {
                const normalized = normalizeFileList(data);
                if (normalized.length) return normalized;
            }
        } catch (err) {
            // Ignore and try next candidate
        }
    }

    return [];
}

async function scanSequentialNumberedFiles(folder, max = 20) {
    const filenames = Array.from({ length: max }, (_, idx) => `${idx + 1}.json`);
    const checks = await Promise.all(filenames.map(async (fn) => {
        const ok = await checkFileExists(folder, fn);
        return ok ? fn : null;
    }));
    return checks.filter(Boolean);
}

async function checkFileExists(folder, filename) {
    const url = `./vocab/${folder}/${filename}`;
    try {
        const headResponse = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        return headResponse.ok;
    } catch (_) {
        return false;
    }
}

async function probeFallbackFiles(folder) {
    const candidates = FALLBACK_FILES[folder] || [];
    if (!candidates.length) return [];

    const probes = candidates.map(async (filename) => {
        const exists = await checkFileExists(folder, filename);
        return exists ? filename : null;
    });

    const results = await Promise.all(probes);
    return results.filter(Boolean);
}

// Loading UI functions
function showLoading(show) {
    const loadingEl = document.getElementById('loading-overlay');
    if (loadingEl) {
        loadingEl.style.display = show ? 'flex' : 'none';
    }
}

function trackSessionStart() {
    sessionStartTime = Date.now();
    userStats.sessions++;
    sessionWrongItems = []; // Reset wrong words for this session
    saveStats();
}

function trackSessionEnd() {
    if (sessionStartTime > 0) {
        const durationMs = Date.now() - sessionStartTime;
        const minutes = Math.round(durationMs / 60000);
        if (minutes > 0) { userStats.totalMinutes += minutes; saveStats(); }
        sessionStartTime = 0;
    }
}

// Updated Logic: Only count as "Learned" if the specific set/word combo is new
function trackWordLearned(wordId, sourceSetId = currentSet?.id) {
    if (wordId == null) return false;
    if (!Array.isArray(userStats.learnedIds)) userStats.learnedIds = [];

    const key = buildLearnedKey(sourceSetId, wordId);
    const legacyKey = buildLegacyLearnedKey(wordId);

    if (key && learnedWordCache.has(key)) return false;

    if (legacyKey && learnedWordCache.has(legacyKey)) {
        // Upgrade legacy record to precise set-based key without recounting
        userStats.learnedIds = userStats.learnedIds.filter(id => id !== legacyKey);
        learnedWordCache.delete(legacyKey);
        if (key) {
            userStats.learnedIds.push(key);
            learnedWordCache.add(key);
        }
        saveStats();
        return false;
    }

    if (key) {
        userStats.totalWords++;
        userStats.learnedIds.push(key);
        learnedWordCache.add(key);
        saveStats();
        return true; // New word learned
    }
    return false; // Already known or missing key
}

// Logic to save weak words for relearning
function saveWeakWords() {
    if (!sessionWrongItems.length) return;
    if (!userStats.weakWords) userStats.weakWords = {};

    const grouped = {};
    sessionWrongItems.forEach(item => {
        const sourceSetId = item.sourceSetId || currentSet?.id;
        if (!sourceSetId) return;
        if (!grouped[sourceSetId]) grouped[sourceSetId] = new Set();
        grouped[sourceSetId].add(item.wordId);
    });

    Object.entries(grouped).forEach(([setId, ids]) => {
        const sourceSet = VOCAB_SETS.find(s => s.id === setId);
        if (!sourceSet) return;
        const validIds = new Set(sourceSet.data.map(d => d.id));
        const list = userStats.weakWords[setId] || [];
        const combined = new Set([...list]);

        ids.forEach(id => {
            if (validIds.has(id)) combined.add(id);
        });

        userStats.weakWords[setId] = Array.from(combined);
    });

    saveStats();
}

function clearWeakWordEntries(entries) {
    if (!userStats.weakWords || !entries || !entries.length) return;

    entries.forEach(entry => {
        const sourceSetId = entry.sourceSetId || currentSet?.id;
        const wordId = entry.wordId;
        if (!sourceSetId || wordId == null) return;
        if (!userStats.weakWords[sourceSetId]) return;

        userStats.weakWords[sourceSetId] = userStats.weakWords[sourceSetId].filter(id => id !== wordId);
    });

    saveStats();
}

function resetData() {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử học tập?')) {
        userStats = normalizeUserStats({ ...DEFAULT_USER_STATS });
        refreshLearnedWordCache();
        saveStats();
        alert('Đã xóa dữ liệu.');
        showView('home');
    }
}

// --- VIEW MANAGEMENT ---
function showView(viewName) {
    if (currentView === 'flashcard' || currentView === 'matching' || currentView === 'learn') {
        trackSessionEnd();
        stopMatchTimer();
    }

    const container = document.getElementById('app-container');
    const template = document.getElementById(`tpl-${viewName}`);

    container.innerHTML = '';
    if (template) {
        container.appendChild(template.content.cloneNode(true));
    }
    currentView = viewName;

    if (viewName === 'home') {
        renderLibrary();
        document.getElementById('search-input').value = searchTerm;
    } else if (viewName === 'set-detail') {
        renderSetDetail();
    } else if (viewName === 'settings') {
        initSettingsView();
    } else if (viewName === 'stats') {
        renderStatsView();
    }
}

function initSettingsView() {
    const toggle = document.getElementById('dark-mode-toggle');
    toggle.checked = document.documentElement.classList.contains('dark');
    toggle.addEventListener('change', toggleTheme);
}

function renderStatsView() {
    document.getElementById('stats-words').textContent = userStats.totalWords;
    document.getElementById('stats-time').textContent = userStats.totalMinutes;
    document.getElementById('stats-sessions').textContent = userStats.sessions;

    // Calculate combined accuracy for Matching and Learn
    const matchingStats = userStats.matchingStats || { total: 0, correct: 0 };
    const learnStats = userStats.learnStats || { total: 0, correct: 0 };
    const totalAttempts = matchingStats.total + learnStats.total;
    const totalCorrect = matchingStats.correct + learnStats.correct;
    const combinedAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    // Update accuracy display
    const accuracyEl = document.getElementById('stats-accuracy');
    if (accuracyEl) {
        accuracyEl.textContent = `${combinedAccuracy}%`;
    }
}

function getSetProgress(set) {
    if (!set) return { learned: 0, total: 0, percent: 0 };
    const total = set.data.length || 0;
    if (total === 0) return { learned: 0, total: 0, percent: 0 };

    const learned = set.data.reduce((count, item) => {
        const sourceSetId = getSourceSetIdFromItem(item, set.id);
        return count + (hasLearnedWord(sourceSetId, item.id) ? 1 : 0);
    }, 0);
    const percent = Math.round((learned / total) * 100);
    return { learned, total, percent };
}

function buildWeakReviewSet() {
    if (!userStats.weakWords) return null;
    const aggregated = [];

    Object.entries(userStats.weakWords).forEach(([setId, ids]) => {
        if (!ids || !ids.length) return;
        const baseSet = VOCAB_SETS.find(s => s.id === setId);
        if (!baseSet) return;
        ids.forEach(wordId => {
            const word = baseSet.data.find(item => item.id === wordId);
            if (word) {
                aggregated.push({ ...word, _sourceSetId: setId });
            }
        });
    });

    if (!aggregated.length) return null;

    return {
        id: 'weak-review',
        categoryId: 'weak',
        title: 'Ôn tập tổng hợp',
        description: 'Chủ đề chứa toàn bộ các từ bạn cần học lại.',
        color: 'orange',
        isDynamic: true,
        data: aggregated
    };
}

function cloneSessionDataFromSet(set) {
    if (!set?.data) return [];
    return set.data.map(item => ({ ...item }));
}

function getSourceSetIdFromItem(item, fallbackSetId = null) {
    if (item?._sourceSetId) return item._sourceSetId;
    if (fallbackSetId) return fallbackSetId;
    return currentSet?.id || null;
}

function recordSessionWrong(wordId, sourceSetId) {
    if (wordId == null) return;
    sessionWrongItems.push({ wordId, sourceSetId });
}

function getUniqueSessionWrongCount() {
    const seen = new Set();
    sessionWrongItems.forEach(item => {
        const key = `${item.sourceSetId || currentSet?.id || 'default'}-${item.wordId}`;
        seen.add(key);
    });
    return seen.size;
}

function matchesProgressFilter(percent) {
    switch (progressFilter) {
        case 'completed':
            return percent === 100;
        case 'incomplete':
            return percent < 100;
        case 'gt50':
            return percent > 50 && percent < 100;
        case 'lt50':
            return percent < 50;
        default:
            return true;
    }
}

function startRelearnFromResults() {
    if (!currentSet) return;
    if (currentSet.id === 'weak-review') {
        selectSet('weak-review');
        repeatLastSession();
        return;
    }
    const preferredMode = lastSessionConfig.mode === 'learn' ? 'learn' : 'flashcard';
    startRelearn(preferredMode);
}

function repeatLastSession() {
    if (!currentSet || !lastSessionConfig.mode) return;

    let useWeakData = lastSessionConfig.dataset === 'weak';
    if (lastSessionConfig.mode === 'matching') {
        useWeakData = false; // Matching luôn chơi cả bộ
    }

    if (useWeakData) {
        if (currentSet.id === 'weak-review') {
            const rebuilt = resolveSet('weak-review');
            if (!rebuilt || !rebuilt.data.length) {
                alert('Bạn đã hoàn thành hết các từ cần ôn. Sẽ học lại toàn bộ bộ từ.');
                useWeakData = false;
            } else {
                const normalizedData = rebuilt.data.map(item => ({
                    ...item,
                    _sourceSetId: item._sourceSetId || rebuilt.id
                }));
                currentSet = { ...rebuilt, data: normalizedData };
                currentSessionData = cloneSessionDataFromSet(currentSet);
            }
        } else {
            const weakIds = userStats.weakWords?.[currentSet.id] || [];
            if (!weakIds.length) {
                alert('Bạn đã hoàn thành hết các từ cần ôn. Sẽ học lại toàn bộ bộ từ.');
                useWeakData = false;
            } else {
                currentSessionData = currentSet.data.filter(d => weakIds.includes(d.id));
            }
        }
    }

    if (!useWeakData) {
        currentSessionData = cloneSessionDataFromSet(currentSet);
    }

    isRelearnMode = useWeakData;

    switch (lastSessionConfig.mode) {
        case 'learn':
            startLearn();
            break;
        case 'matching':
            startMatching();
            break;
        default:
            startFlashcards();
    }
}

function updateRepeatButton() {
    const repeatBtn = document.getElementById('btn-repeat-session');
    if (!repeatBtn) return;

    if (!lastSessionConfig.mode || !currentSet) {
        repeatBtn.classList.add('hidden');
        return;
    }

    const modeLabels = {
        flashcard: 'Flashcards',
        learn: 'Learn',
        matching: 'Matching'
    };

    repeatBtn.textContent = `Học lại (${modeLabels[lastSessionConfig.mode] || 'Ôn tập'})`;
    repeatBtn.classList.remove('hidden');
}

// --- SEARCH & LIBRARY ---
function handleSearch(val) {
    searchTerm = val.toLowerCase();
    renderLibrary();
}

function resumeSessionIfAvailable() {
    const savedState = loadSessionStateFromStorage();
    if (!savedState) {
        showView('home');
        return;
    }

    let resumed = false;
    switch (savedState.mode) {
        case 'flashcard':
            resumed = resumeFlashcardSession(savedState);
            break;
        case 'learn':
            resumed = resumeLearnSession(savedState);
            break;
        case 'matching':
            resumed = resumeMatchingSession(savedState);
            break;
        default:
            resumed = false;
    }

    if (!resumed) {
        clearSessionState();
        showView('home');
    }
}

function resumeFlashcardSession(state) {
    const set = resolveSet(state.setId);
    if (!set) return false;
    currentSet = { ...set, data: cloneSessionDataFromSet(set) };
    currentSessionData = state.currentSessionData ? deepClone(state.currentSessionData) : cloneSessionDataFromSet(currentSet);
    if (!currentSessionData.length) return false;
    isRelearnMode = !!state.isRelearnMode;
    lastSessionConfig = { mode: 'flashcard', dataset: state.dataset || (isRelearnMode ? 'weak' : 'full') };
    fcIndex = Math.min(state.fcIndex || 0, currentSessionData.length - 1);
    fcStats = state.fcStats || { known: 0, learning: 0 };
    fcIsFlipped = false;
    sessionStartTime = Date.now();
    showView('flashcard');
    updateFlashcardUI();
    return true;
}

function resumeLearnSession(state) {
    const set = resolveSet(state.setId);
    if (!set) return false;
    currentSet = { ...set, data: cloneSessionDataFromSet(set) };
    currentSessionData = state.currentSessionData ? deepClone(state.currentSessionData) : cloneSessionDataFromSet(currentSet);
    learnQuestions = state.learnQuestions ? deepClone(state.learnQuestions) : [];
    if (!learnQuestions.length || !currentSessionData.length) return false;
    isRelearnMode = !!state.isRelearnMode;
    lastSessionConfig = { mode: 'learn', dataset: state.dataset || (isRelearnMode ? 'weak' : 'full') };
    learnIndex = Math.min(state.learnIndex || 0, learnQuestions.length - 1);
    learnStats = state.learnStats || { correct: 0, wrong: 0 };
    isLearnAnswerLocked = false;
    sessionStartTime = Date.now();
    showView('learn');
    renderLearnQuestion();
    return true;
}

function resumeMatchingSession(state) {
    const set = resolveSet(state.setId);
    if (!set) return false;
    currentSet = { ...set, data: cloneSessionDataFromSet(set) };
    currentSessionData = state.currentSessionData ? deepClone(state.currentSessionData) : cloneSessionDataFromSet(currentSet);
    matchCards = state.matchCards ? deepClone(state.matchCards) : [];
    matchMatched = state.matchMatched ? deepClone(state.matchMatched) : [];
    if (!matchCards.length) return false;
    matchSelected = [];
    matchTime = state.matchTime || 0;
    matchCurrentBatch = typeof state.matchCurrentBatch === 'number' ? state.matchCurrentBatch : 0;
    matchBatchSizes = state.matchBatchSizes ? [...state.matchBatchSizes] : deriveMatchBatchSizes(matchCards);
    matchBatchProgress = state.matchBatchProgress ? [...state.matchBatchProgress] : deriveMatchBatchProgress(matchCards, matchMatched);
    matchTotalPairs = currentSessionData.length;
    matchCorrectPairs = state.matchCorrectPairs || Math.floor(matchMatched.length / 2);
    matchWrongAttempts = state.matchWrongAttempts || 0;
    isRelearnMode = false;
    lastSessionConfig = { mode: 'matching', dataset: 'full' };
    showView('matching');
    renderMatchingGridFromCards();
    startMatchTimer();
    return true;
}

function renderMatchingGridFromCards() {
    renderMatchingBatch();
    const timerEl = document.getElementById('match-timer');
    if (timerEl) {
        timerEl.textContent = formatTime(matchTime);
    }
}

function renderLibrary() {
    const container = document.getElementById('library-container');
    const emptyState = document.getElementById('search-empty');
    if (!container) return;

    const filterSelect = document.getElementById('progress-filter');
    if (filterSelect) {
        filterSelect.value = progressFilter;
        filterSelect.onchange = (e) => {
            progressFilter = e.target.value;
            renderLibrary();
        };
    }

    container.innerHTML = '';
    let hasResults = false;

    const weakReviewSet = buildWeakReviewSet();
    if (weakReviewSet) {
        const q = (searchTerm || '').toLowerCase();
        const weakProgress = getSetProgress(weakReviewSet);
        const matchesWeakSearch = !searchTerm ||
            weakReviewSet.title.toLowerCase().includes(q) ||
            weakReviewSet.description.toLowerCase().includes(q);
        const matchesWeakFilter = matchesProgressFilter(weakProgress.percent);

        if (matchesWeakSearch && matchesWeakFilter) {
            hasResults = true;
            const section = document.createElement('div');
            section.className = 'w-full mb-6';

            const header = document.createElement('h3');
            header.className = 'text-lg font-bold text-orange-600 dark:text-orange-300 mb-3 flex items-center gap-2';
            header.innerHTML = `<span class="w-1.5 h-6 bg-orange-400 rounded-full"></span> Chủ đề Ôn tập`;
            section.appendChild(header);

            const card = document.createElement('div');
            card.className = 'bg-orange-50 dark:bg-orange-900/20 p-5 rounded-2xl border border-orange-100 dark:border-orange-900/40 hover:border-orange-300 dark:hover:border-orange-700 transition-all cursor-pointer btn-press shadow-sm flex flex-col gap-3';
            card.onclick = () => selectSet(weakReviewSet);

            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold uppercase tracking-wide text-orange-600 dark:text-orange-300">${weakReviewSet.data.length} từ cần ôn</span>
                    <i class="ph ph-arrow-right text-orange-500 dark:text-orange-200"></i>
                </div>
                <div>
                    <h4 class="text-xl font-bold text-slate-800 dark:text-white mb-1">${weakReviewSet.title}</h4>
                    <p class="text-sm text-slate-500 dark:text-slate-400">${weakReviewSet.description}</p>
                </div>
                <div>
                    <div class="flex items-center justify-between text-xs text-orange-700 dark:text-orange-200 mb-1">
                        <span>Tiến độ</span>
                        <span class="font-bold">${weakReviewSet.data.length} từ chưa thuộc</span>
                    </div>
                    <div class="w-full h-2 bg-orange-100 dark:bg-orange-950/40 rounded-full overflow-hidden">
                        <div class="h-full bg-orange-400 rounded-full" style="width: 100%;"></div>
                    </div>
                </div>
            `;

            section.appendChild(card);
            container.appendChild(section);
        }
    }

    Object.keys(CATEGORIES).forEach(catKey => {
        const sets = VOCAB_SETS.filter(s =>
            s.categoryId === catKey &&
            (s.title.toLowerCase().includes(searchTerm) || s.description.toLowerCase().includes(searchTerm))
        );

        if (sets.length > 0) {
            const section = document.createElement('div');
            section.className = 'w-full';

            const header = document.createElement('h3');
            header.className = 'text-lg font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2';
            header.innerHTML = `<span class="w-1.5 h-6 bg-indigo-500 rounded-full"></span> ${CATEGORIES[catKey]}`;
            section.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4';
            let categoryHasResults = false;

            sets.forEach(set => {
                const card = document.createElement('div');
                const progress = getSetProgress(set);
                if (!matchesProgressFilter(progress.percent)) return;
                categoryHasResults = true;
                const isComplete = progress.percent === 100;
                const showProgress = progress.percent > 0 && progress.percent < 100;

                let cardClasses = 'p-4 md:p-5 rounded-2xl shadow-sm transition-all cursor-pointer btn-press relative overflow-hidden flex flex-col justify-between h-full';
                if (isComplete) {
                    cardClasses += ' bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 hover:border-emerald-400 dark:hover:border-emerald-500';
                } else {
                    cardClasses += ` bg-white dark:bg-dark-card border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-${set.color}-200 dark:hover:border-${set.color}-800`;
                }
                card.className = cardClasses;
                card.onclick = () => selectSet(set.id);

                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            ${isComplete
                        ? `<div class="flex items-center gap-1 text-emerald-600 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider"><i class="ph-fill ph-check-circle"></i><span>ĐÃ HOÀN THÀNH</span></div>`
                        : `<span class="px-2 py-0.5 rounded bg-${set.color}-50 dark:bg-${set.color}-900/30 text-${set.color}-600 dark:text-${set.color}-300 text-[10px] font-bold uppercase tracking-wider">${set.data.length} thẻ</span>`
                    }
                            <i class="ph ph-caret-right ${isComplete ? 'text-emerald-400' : 'text-slate-300 dark:text-slate-600'}"></i>
                        </div>
                        <h4 class="text-lg font-bold text-slate-800 dark:text-white mb-1 line-clamp-2">${set.title}</h4>
                        <p class="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">${set.description}</p>
                    </div>
                    ${showProgress ? `
                    <div class="mt-4">
                        <div class="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 mb-1">
                            <span>Tiến độ</span>
                            <span class="font-bold text-slate-700 dark:text-slate-200">${progress.percent}%</span>
                        </div>
                        <div class="w-full h-2 ${isComplete ? 'bg-emerald-100 dark:bg-emerald-800/40' : 'bg-slate-100 dark:bg-slate-800'} rounded-full overflow-hidden">
                            <div class="h-full rounded-full ${isComplete ? 'bg-emerald-500 dark:bg-emerald-400' : `bg-${set.color}-500 dark:bg-${set.color}-400`} transition-all duration-300" style="width: ${progress.percent}%;"></div>
                        </div>
                    </div>` : ''}
                `;
                grid.appendChild(card);
            });

            if (categoryHasResults) {
                hasResults = true;
                section.appendChild(grid);
                container.appendChild(section);
            }
        }
    });

    if (!hasResults && searchTerm) {
        emptyState.style.display = 'flex';
        setTimeout(() => emptyState.style.opacity = 1, 10);
    } else {
        emptyState.style.display = 'none';
        emptyState.style.opacity = 0;
    }
}

function resolveSet(setOrId) {
    if (!setOrId) return null;
    if (typeof setOrId === 'object') return setOrId;
    if (setOrId === 'weak-review') return buildWeakReviewSet();
    return VOCAB_SETS.find(s => s.id === setOrId) || null;
}

function selectSet(setOrId) {
    const set = resolveSet(setOrId);
    if (!set) return;

    const normalizedData = set.data.map(item => ({
        ...item,
        _sourceSetId: item._sourceSetId || set.id
    }));

    currentSet = { ...set, data: normalizedData };
    currentSessionData = cloneSessionDataFromSet(currentSet);
    isRelearnMode = false;
    updateRepeatButton();
    showView('set-detail');
}

function renderSetDetail() {
    if (!currentSet) return showView('home');
    document.getElementById('detail-title').textContent = currentSet.title;
    document.getElementById('detail-desc').textContent = currentSet.description;
    document.getElementById('detail-count').textContent = `${currentSet.data.length} thuật ngữ`;
    const progress = getSetProgress(currentSet);
    const progressText = document.getElementById('detail-progress');
    const progressBar = document.getElementById('detail-progress-bar');
    const progressWrapper = document.getElementById('detail-progress-wrapper');
    const completeBadge = document.getElementById('detail-complete-badge');
    const showProgress = progress.percent > 0 && progress.percent < 100;
    if (progressText) {
        progressText.textContent = `Tiến độ: ${progress.percent}% (${progress.learned}/${progress.total})`;
    }
    if (progressBar) {
        progressBar.style.width = `${progress.percent}%`;
    }
    if (progressWrapper) {
        progressWrapper.classList.toggle('hidden', !showProgress);
    }
    if (completeBadge) {
        completeBadge.classList.toggle('hidden', progress.percent !== 100);
    }

    // Check for weak words
    const relearnSection = document.getElementById('relearn-section');
    if (relearnSection) {
        if (currentSet.id === 'weak-review') {
            relearnSection.classList.add('hidden');
        } else {
            const weakIds = userStats.weakWords?.[currentSet.id] || [];
            if (weakIds.length > 0) {
                relearnSection.classList.remove('hidden');
                document.getElementById('relearn-count').textContent = weakIds.length;
            } else {
                relearnSection.classList.add('hidden');
            }
        }
    }

    // Reset word selection when viewing set detail
    selectedWordCount = null;
    wordSelectionMode = 'random';
    updateSelectedCountDisplay();
    updateWordCountButtons();
}

// --- WORD SELECTION FUNCTIONS ---
function setWordSelection(mode, count) {
    wordSelectionMode = mode;
    selectedWordCount = count;
    updateSelectedCountDisplay();
    updateWordCountButtons();
}

function showCustomCountInput() {
    const inputDiv = document.getElementById('custom-count-input');
    if (inputDiv) {
        inputDiv.classList.remove('hidden');
        const input = document.getElementById('custom-word-count');
        if (input) {
            input.focus();
            input.value = selectedWordCount || '';
        }
    }
}

function applyCustomCount() {
    const input = document.getElementById('custom-word-count');
    if (!input) return;
    const count = parseInt(input.value);
    if (count && count > 0) {
        setWordSelection('random', count);
        const inputDiv = document.getElementById('custom-count-input');
        if (inputDiv) inputDiv.classList.add('hidden');
    } else {
        alert('Vui lòng nhập số từ hợp lệ (lớn hơn 0)');
    }
}

function updateSelectedCountDisplay() {
    const display = document.getElementById('selected-count-text');
    if (!display) return;

    if (!currentSet) {
        display.textContent = 'Chưa chọn';
        return;
    }

    const totalWords = currentSet.data.length;
    let text = '';

    if (wordSelectionMode === 'all' || selectedWordCount === null) {
        text = `Tất cả ${totalWords} từ`;
    } else if (wordSelectionMode === 'unlearned') {
        const unlearned = currentSet.data.filter(w => !hasLearnedWord(getSourceSetIdFromItem(w, currentSet.id), w.id));
        text = `${unlearned.length} từ chưa học`;
    } else {
        text = `${Math.min(selectedWordCount, totalWords)} từ (ngẫu nhiên)`;
    }

    display.textContent = text;
}

function updateWordCountButtons() {
    const buttons = document.querySelectorAll('.word-count-btn');
    buttons.forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        let isActive = false;

        // Check based on mode and count
        if (wordSelectionMode === 'all' && onclick.includes("'all'")) {
            isActive = true;
        } else if (wordSelectionMode === 'random' && onclick.includes("'random'") && onclick.includes(selectedWordCount)) {
            isActive = true;
        } else if (wordSelectionMode === 'unlearned' && onclick.includes("'unlearned'")) {
            isActive = true;
        }

        if (isActive) {
            btn.classList.add('border-indigo-500', 'bg-indigo-100', 'dark:bg-indigo-900/30', 'text-indigo-700', 'dark:text-indigo-300');
            btn.classList.remove('border-slate-200', 'dark:border-slate-700', 'bg-slate-50', 'dark:bg-slate-800');
        } else {
            btn.classList.remove('border-indigo-500', 'bg-indigo-100', 'dark:bg-indigo-900/30', 'text-indigo-700', 'dark:text-indigo-300');
            btn.classList.add('border-slate-200', 'dark:border-slate-700', 'bg-slate-50', 'dark:bg-slate-800');
        }
    });
}

function getSelectedWords() {
    if (!currentSet) return [];

    let sourceWords = [...currentSet.data];
    const totalWords = sourceWords.length;

    // Filter based on mode
    if (wordSelectionMode === 'unlearned') {
        sourceWords = sourceWords.filter(w => !hasLearnedWord(getSourceSetIdFromItem(w, currentSet.id), w.id));
    }

    // Apply count limit
    if (wordSelectionMode === 'all' || selectedWordCount === null) {
        // All words, but apply smart random if needed
        return applySmartRandom(sourceWords, totalWords);
    } else {
        // Specific count with smart random
        return applySmartRandom(sourceWords, selectedWordCount);
    }
}

function applySmartRandom(words, targetCount) {
    if (words.length <= targetCount) {
        // Not enough words, return all shuffled
        return shuffleArray([...words]);
    }

    const setId = currentSet?.id;
    if (!setId) {
        // No set ID, just random
        return shuffleArray([...words]).slice(0, targetCount);
    }

    // Get previous random history
    const history = userStats.randomHistory?.[setId] || [];
    const maxOverlap = Math.floor(targetCount * 0.2); // 20% max overlap

    // Separate words into: previously used and new
    const historySet = new Set(history);
    const previouslyUsed = words.filter(w => historySet.has(w.id));
    const newWords = words.filter(w => !historySet.has(w.id));

    // Calculate how many from each group
    let fromPrevious = Math.min(previouslyUsed.length, maxOverlap);
    let fromNew = targetCount - fromPrevious;

    // If not enough new words, use more from previous
    if (fromNew > newWords.length) {
        fromPrevious = targetCount - newWords.length;
        fromNew = newWords.length;
    }

    // Select words
    const selected = [];

    // Add from new words (random)
    if (fromNew > 0) {
        const shuffledNew = shuffleArray([...newWords]);
        selected.push(...shuffledNew.slice(0, fromNew));
    }

    // Add from previous words (random, limited to 20%)
    if (fromPrevious > 0) {
        const shuffledPrevious = shuffleArray([...previouslyUsed]);
        selected.push(...shuffledPrevious.slice(0, fromPrevious));
    }

    // Shuffle final selection
    const finalSelection = shuffleArray(selected);

    // Update history (keep last N words to avoid too much memory)
    const maxHistorySize = 100;
    const newHistory = [...finalSelection.map(w => w.id), ...history].slice(0, maxHistorySize);
    if (!userStats.randomHistory) userStats.randomHistory = {};
    userStats.randomHistory[setId] = newHistory;
    saveStats();

    return finalSelection;
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// --- LEARN MODE LOGIC ---
function startLearn() {
    if (!currentSet) return;

    const autoRelearn = currentSet.id === 'weak-review';
    const shouldReuseData = (isRelearnMode || autoRelearn) && currentSessionData.length > 0;
    if (!shouldReuseData) {
        // Use selected words if available, otherwise use all words
        currentSessionData = getSelectedWords();
        if (currentSessionData.length === 0) {
            currentSessionData = cloneSessionDataFromSet(currentSet);
        }
    }
    isRelearnMode = isRelearnMode || autoRelearn;

    if (currentSessionData.length === 0) {
        alert('Không có thuật ngữ để học.');
        return;
    }

    learnIndex = 0;
    learnStats = { correct: 0, wrong: 0 };
    lastSessionConfig = { mode: 'learn', dataset: isRelearnMode ? 'weak' : 'full' };

    // Randomize question order
    learnQuestions = currentSessionData.map(item => ({
        ...item,
        isEngToViet: Math.random() > 0.5
    })).sort(() => 0.5 - Math.random());

    trackSessionStart();
    showView('learn');
    renderLearnQuestion();
}

function startRelearn(preferredMode = 'flashcard') {
    if (!currentSet) return;
    const weakIds = userStats.weakWords?.[currentSet.id] || [];
    if (weakIds.length === 0) {
        alert('Hiện chưa có từ nào cần học lại.');
        return;
    }

    currentSessionData = currentSet.data.filter(d => weakIds.includes(d.id));
    if (currentSessionData.length === 0) {
        alert('Không tìm thấy từ cần ôn thuộc bộ này.');
        return;
    }

    isRelearnMode = true;
    const normalizedMode = preferredMode === 'learn' ? 'learn' : 'flashcard';
    if (normalizedMode === 'learn') {
        startLearn();
    } else {
        startFlashcards();
    }
}

function renderLearnQuestion() {
    const q = learnQuestions[learnIndex];
    isLearnAnswerLocked = false;

    document.getElementById('learn-counter').textContent = `${learnIndex + 1}/${learnQuestions.length}`;
    const percent = ((learnIndex) / learnQuestions.length) * 100;
    document.getElementById('learn-progress-bar').style.width = `${percent}%`;

    const qTypeEl = document.getElementById('learn-q-type');
    const qTextEl = document.getElementById('learn-question');

    if (q.isEngToViet) {
        qTypeEl.textContent = 'Thuật ngữ (Tiếng Anh)';
        qTextEl.textContent = q.word;
    } else {
        qTypeEl.textContent = 'Định nghĩa (Tiếng Việt)';
        qTextEl.textContent = q.meaning;
    }

    const optionsGrid = document.getElementById('learn-options');
    optionsGrid.innerHTML = '';

    // Distractors logic
    let distractors = currentSet.data
        .filter(item => item.id !== q.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

    if (distractors.length < 3) {
        const otherWords = VOCAB_SETS
            .filter(s => s.id !== currentSet.id)
            .flatMap(s => s.data)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3 - distractors.length);
        distractors = [...distractors, ...otherWords];
    }

    const options = [q, ...distractors].sort(() => 0.5 - Math.random());

    options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        // OPTIMIZED COLORS FOR LIGHT MODE: bg-white instead of slate-50, border-slate-200, shadow-sm
        btn.className = 'w-full p-4 rounded-xl text-left bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-400 dark:hover:border-cyan-800 transition-all font-medium text-slate-700 dark:text-slate-300 text-sm md:text-base btn-press relative overflow-hidden';

        btn.textContent = q.isEngToViet ? opt.meaning : opt.word;

        btn.onclick = () => handleLearnAnswer(opt.id, q, btn);
        optionsGrid.appendChild(btn);
    });
}

function handleLearnAnswer(selectedId, questionItem, btn) {
    if (isLearnAnswerLocked) return;
    isLearnAnswerLocked = true;

    const correctId = questionItem.id;
    const sourceSetId = questionItem._sourceSetId || currentSet?.id;
    const isCorrect = selectedId === correctId;

    if (isCorrect) {
        btn.classList.add('anim-correct');
        learnStats.correct++;
        trackWordLearned(correctId, sourceSetId);
        // If correct in relearn mode, remove from weak words
        if (isRelearnMode) clearWeakWordEntries([{ wordId: correctId, sourceSetId }]);

        // Auto advance after correct answer
        setTimeout(() => {
            learnIndex++;
            if (learnIndex < learnQuestions.length) {
                renderLearnQuestion();
            } else {
                finishLearn();
            }
        }, 800);
    } else {
        btn.classList.add('anim-wrong');
        learnStats.wrong++;
        recordSessionWrong(correctId, sourceSetId);

        // Highlight correct answer in green
        const optionsGrid = document.getElementById('learn-options');
        const allButtons = optionsGrid.querySelectorAll('button');
        allButtons.forEach(optBtn => {
            // Find the correct answer button by matching content
            const correctWord = questionItem.isEngToViet ? questionItem.meaning : questionItem.word;
            if (optBtn.textContent === correctWord) {
                optBtn.classList.remove('border-slate-200', 'dark:border-slate-700', 'bg-white', 'dark:bg-slate-800');
                optBtn.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/40', 'text-green-700', 'dark:text-green-300', 'font-bold');
            }
            // Disable all buttons
            optBtn.disabled = true;
            optBtn.classList.add('cursor-not-allowed', 'opacity-80');
        });

        // Add Continue button
        const continueBtn = document.createElement('button');
        continueBtn.className = 'mt-4 w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2';
        continueBtn.innerHTML = `
            <span>Tiếp tục</span>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
        `;
        continueBtn.onclick = () => {
            learnIndex++;
            if (learnIndex < learnQuestions.length) {
                renderLearnQuestion();
            } else {
                finishLearn();
            }
        };
        optionsGrid.appendChild(continueBtn);
    }
}

function finishLearn() {
    saveWeakWords(); // Save any wrong words to persistent storage

    // Calculate accuracy
    const totalQuestions = learnQuestions.length;
    const accuracy = totalQuestions > 0 ? Math.round((learnStats.correct / totalQuestions) * 100) : 0;
    const elapsedSeconds = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;

    // Update stats
    if (!userStats.learnStats) userStats.learnStats = { total: 0, correct: 0 };
    userStats.learnStats.total += totalQuestions;
    userStats.learnStats.correct += learnStats.correct;
    saveStats();

    showView('result');
    document.getElementById('learn-progress-bar').style.width = `100%`;

    // Show stats with accuracy
    const statsBlock = document.getElementById('result-stats-block');
    if (statsBlock) {
        statsBlock.style.display = 'grid';
        statsBlock.innerHTML = `
            <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-2xl border border-green-100 dark:border-green-900/30">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">${learnStats.correct}/${totalQuestions}</div>
                <div class="text-[10px] text-green-800 dark:text-green-300 uppercase font-bold tracking-wider">Câu đúng</div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">${learnStats.wrong}</div>
                <div class="text-[10px] text-orange-800 dark:text-orange-300 uppercase font-bold tracking-wider">Câu sai</div>
            </div>
            <div class="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">${accuracy}%</div>
                <div class="text-[10px] text-indigo-800 dark:text-indigo-300 uppercase font-bold tracking-wider">Tỉ lệ chính xác</div>
            </div>
            <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div class="text-2xl font-bold text-slate-700 dark:text-white">${formatTime(elapsedSeconds)}</div>
                <div class="text-[10px] text-slate-500 dark:text-slate-300 uppercase font-bold tracking-wider">Thời gian</div>
            </div>
        `;
    }

    // Show Relearn button if there were errors
    const btnRelearn = document.getElementById('btn-relearn');
    const uniqueWrongCount = getUniqueSessionWrongCount();
    if (learnStats.wrong > 0 || uniqueWrongCount > 0) {
        btnRelearn.classList.remove('hidden');
        btnRelearn.textContent = `Học lại ${uniqueWrongCount} từ chưa thuộc`;
    } else {
        btnRelearn.classList.add('hidden');
    }

    let msg = `Bạn làm đúng ${learnStats.correct}/${totalQuestions} câu.`;
    if (learnStats.correct === totalQuestions) msg = "Tuyệt đối! Bạn đã nắm vững bài học.";
    else if (learnStats.correct > learnStats.wrong) msg = "Làm tốt lắm! Hãy cố gắng hơn.";

    document.getElementById('result-message').textContent = msg;
    isRelearnMode = false;
    currentSessionData = cloneSessionDataFromSet(currentSet);
    updateRepeatButton();
}

// --- FLASHCARD & MATCHING ---
function startFlashcards() {
    if (!currentSet) return;
    // Note: If coming from startRelearn(), currentSessionData is already filtered.
    // If clicking "Flashcards" directly, ensure we reset to full set if not in relearn mode
    const autoRelearn = currentSet.id === 'weak-review';
    const shouldReuseData = (isRelearnMode || autoRelearn) && currentSessionData.length > 0;
    if (!shouldReuseData) {
        // Use selected words if available, otherwise use all words
        currentSessionData = getSelectedWords();
        if (currentSessionData.length === 0) {
            currentSessionData = cloneSessionDataFromSet(currentSet);
        }
    }
    isRelearnMode = isRelearnMode || autoRelearn;

    if (currentSessionData.length === 0) {
        alert('Không có thuật ngữ để học.');
        return;
    }

    lastSessionConfig = { mode: 'flashcard', dataset: isRelearnMode ? 'weak' : 'full' };

    fcIndex = 0; fcIsFlipped = false; fcStats = { known: 0, learning: 0 };
    trackSessionStart();
    showView('flashcard');
    updateFlashcardUI();
    initDragEvents();
}

function updateFlashcardUI() {
    const data = currentSessionData[fcIndex];
    if (!data) return;

    const card = document.getElementById('flashcard');
    card.style.transform = '';
    card.classList.remove('rotate-y-180', 'no-transition');
    card.classList.add('card-transition');

    document.getElementById('label-left').style.opacity = '0';
    document.getElementById('label-right').style.opacity = '0';
    card.style.borderColor = '';
    fcIsFlipped = false;

    document.getElementById('fc-word').textContent = data.word;
    document.getElementById('fc-ipa').textContent = data.ipa;
    document.getElementById('fc-type').textContent = data.type;
    document.getElementById('fc-meaning').textContent = data.meaning;
    document.getElementById('fc-example').textContent = `"${data.example}"`;
    document.getElementById('fc-progress').textContent = `${fcIndex + 1} / ${currentSessionData.length}`;

    document.getElementById('stat-known').textContent = fcStats.known;
    document.getElementById('stat-learning').textContent = fcStats.learning;
}

function initDragEvents() {
    const card = document.getElementById('flashcard'); if (!card) return;
    let startX = 0, currentX = 0, isDragging = false, pendingTap = false;
    const startDrag = (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        pendingTap = false;
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        card.classList.remove('card-transition');
        card.classList.add('no-transition');
    };
    const moveDrag = (e) => {
        if (!isDragging) return;
        currentX = (e.type.includes('mouse') ? e.clientX : e.touches[0].clientX) - startX;
        const rotate = currentX * 0.05;
        card.style.transform = `translateX(${currentX}px) rotate(${rotate}deg) ${fcIsFlipped ? 'rotateY(180deg)' : ''}`;
        const opacity = Math.min(Math.abs(currentX) / 100, 1);
        if (currentX > 0) {
            document.getElementById('label-right').style.opacity = opacity;
            document.getElementById('label-left').style.opacity = 0;
            card.style.borderColor = `rgba(34, 197, 94, ${opacity})`;
        } else {
            document.getElementById('label-left').style.opacity = opacity;
            document.getElementById('label-right').style.opacity = 0;
            card.style.borderColor = `rgba(239, 68, 68, ${opacity})`;
        }
    };
    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        card.classList.remove('no-transition');
        card.classList.add('card-transition');
        card.style.borderColor = '';
        if (currentX > 80) {
            pendingTap = false;
            processSwipe('right');
        } else if (currentX < -80) {
            pendingTap = false;
            processSwipe('left');
        } else {
            pendingTap = Math.abs(currentX) < 5;
            card.style.transform = fcIsFlipped ? 'rotateY(180deg)' : '';
            document.getElementById('label-left').style.opacity = 0;
            document.getElementById('label-right').style.opacity = 0;
        }
        currentX = 0;
    };
    card.addEventListener('mousedown', startDrag); window.addEventListener('mousemove', moveDrag); window.addEventListener('mouseup', endDrag);
    card.addEventListener('touchstart', startDrag, { passive: true }); card.addEventListener('touchmove', moveDrag, { passive: true }); card.addEventListener('touchend', endDrag);
    card.addEventListener('click', (e) => {
        if (pendingTap) {
            e.preventDefault();
            pendingTap = false;
            toggleFlip();
        }
    });
}

function toggleFlip() { const card = document.getElementById('flashcard'); card.style.transform = `translateX(0) rotate(0deg) ${fcIsFlipped ? '' : 'rotateY(180deg)'}`; fcIsFlipped = !fcIsFlipped; }
function triggerSwipe(dir) { const card = document.getElementById('flashcard'); card.classList.add('card-transition'); const moveX = dir === 'right' ? window.innerWidth : -window.innerWidth; const rotate = dir === 'right' ? 20 : -20; card.style.transform = `translateX(${moveX}px) rotate(${rotate}deg)`; setTimeout(() => processSwipe(dir), 300); }

function processSwipe(dir) {
    if (!currentSet) return;
    const currentCard = currentSessionData[fcIndex];
    if (!currentCard) return;
    const currentWordId = currentCard.id;
    const sourceSetId = getSourceSetIdFromItem(currentCard);

    if (dir === 'right') {
        fcStats.known++;
        trackWordLearned(currentWordId, sourceSetId);
        if (isRelearnMode) clearWeakWordEntries([{ wordId: currentWordId, sourceSetId }]);
    } else {
        fcStats.learning++;
        recordSessionWrong(currentWordId, sourceSetId);
    }

    fcIndex++;
    if (fcIndex < currentSessionData.length) setTimeout(updateFlashcardUI, 50);
    else finishFlashcards();
}

function finishFlashcards() {
    saveWeakWords();

    showView('result');
    document.getElementById('res-known').textContent = fcStats.known;
    document.getElementById('res-learning').textContent = fcStats.learning;
    document.getElementById('result-stats-block').style.display = 'grid';

    const btnRelearn = document.getElementById('btn-relearn');
    const uniqueWrongCount = getUniqueSessionWrongCount();
    if (fcStats.learning > 0 || uniqueWrongCount > 0) {
        btnRelearn.classList.remove('hidden');
        btnRelearn.textContent = `Học lại ${uniqueWrongCount} từ chưa thuộc`;
    } else {
        btnRelearn.classList.add('hidden');
    }

    document.getElementById('result-message').textContent = fcStats.known === currentSessionData.length ? "Tuyệt đỉnh! Đã thuộc hết." : "Cố lên! Ôn lại các từ chưa thuộc nhé.";

    // Reset mode
    isRelearnMode = false;
    currentSessionData = cloneSessionDataFromSet(currentSet);
    updateRepeatButton();
}

function startMatching() {
    if (!currentSet) return;
    // Use selected words if available, otherwise use all words
    currentSessionData = getSelectedWords();
    if (currentSessionData.length === 0) {
        currentSessionData = cloneSessionDataFromSet(currentSet);
    }
    if (currentSessionData.length === 0) {
        alert('Không có thuật ngữ để chơi Matching.');
        return;
    }
    isRelearnMode = false;
    lastSessionConfig = { mode: 'matching', dataset: currentSet.id === 'weak-review' ? 'weak' : 'full' };
    trackSessionStart();
    showView('matching');
    matchSelected = [];
    matchMatched = [];
    matchTime = 0;
    matchCurrentBatch = 0;
    matchTotalPairs = currentSessionData.length;
    matchCorrectPairs = 0;
    matchWrongAttempts = 0;
    matchBatchSizes = [];
    matchBatchProgress = [];
    startMatchTimer();

    // Create all cards grouped by batch (10 pairs per batch)
    const shuffledData = shuffleArray([...currentSessionData]);
    let cards = [];
    shuffledData.forEach((item, index) => {
        const batchIndex = Math.floor(index / MATCH_BATCH_PAIR_COUNT);
        matchBatchSizes[batchIndex] = (matchBatchSizes[batchIndex] || 0) + 1;
        matchBatchProgress[batchIndex] = matchBatchProgress[batchIndex] || 0;
        const sourceSetId = getSourceSetIdFromItem(item, currentSet?.id);
        cards.push({ id: `w-${batchIndex}-${item.id}`, refId: item.id, content: item.word, batch: batchIndex, sourceSetId });
        cards.push({ id: `m-${batchIndex}-${item.id}`, refId: item.id, content: item.meaning, batch: batchIndex, sourceSetId });
    });
    matchCards = cards;

    // Display first batch (10 pairs = 20 cards)
    renderMatchingBatch();
    updateMatchProgressText();
}

function renderMatchingBatch() {
    const grid = document.getElementById('matching-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const batchCards = matchCards.filter(card => card.batch === matchCurrentBatch);
    if (!batchCards.length) return;
    const cardsToRender = shuffleArray([...batchCards]);

    cardsToRender.forEach(card => {
        const isMatched = matchMatched.includes(card.id);
        const el = document.createElement('div');

        if (isMatched) {
            el.className = 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-600 text-green-700 dark:text-green-300 rounded-2xl p-2 md:p-3 flex items-center justify-center text-center h-full font-bold anim-correct text-xs md:text-sm shadow-inner';
        } else {
            el.className = 'bg-white dark:bg-dark-card border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-2 md:p-3 flex items-center justify-center text-center cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all select-none h-full font-medium text-slate-700 dark:text-slate-200 active:scale-95 text-xs md:text-sm btn-press shadow-sm break-words';
            el.onclick = () => handleMatchClick(card, el);
        }

        el.textContent = card.content;
        grid.appendChild(el);
    });
    updateMatchProgressText();
}

function updateMatchProgressText() {
    const progressText = document.getElementById('match-progress');
    if (progressText) {
        progressText.textContent = `${matchCorrectPairs}/${matchTotalPairs} cặp`;
    }
}

function deriveMatchBatchSizes(cards = []) {
    const batchMap = new Map();
    cards.forEach(card => {
        const batchIndex = typeof card.batch === 'number' ? card.batch : 0;
        if (!batchMap.has(batchIndex)) {
            batchMap.set(batchIndex, new Set());
        }
        batchMap.get(batchIndex).add(card.refId);
    });
    const sizes = [];
    batchMap.forEach((set, batchIndex) => {
        sizes[batchIndex] = set.size;
    });
    return sizes;
}

function deriveMatchBatchProgress(cards = [], matchedIds = []) {
    const progressMap = new Map();
    const cardLookup = new Map(cards.map(card => [card.id, card]));
    matchedIds.forEach(id => {
        const card = cardLookup.get(id);
        if (!card) return;
        const batchIndex = typeof card.batch === 'number' ? card.batch : 0;
        if (!progressMap.has(batchIndex)) {
            progressMap.set(batchIndex, new Set());
        }
        progressMap.get(batchIndex).add(card.refId);
    });
    const progress = [];
    progressMap.forEach((set, batchIndex) => {
        progress[batchIndex] = set.size;
    });
    return progress;
}
function handleMatchClick(card, el) {
    if (!card) return;
    if (matchMatched.includes(card.id) || matchSelected.some(s => s.card.id === card.id) || matchSelected.length >= 2) return;
    el.classList.add('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-900/40', 'dark:border-indigo-500');
    matchSelected.push({ card, el });
    if (matchSelected.length === 2) setTimeout(checkMatch, 300);
}

function checkMatch() {
    if (matchSelected.length < 2) return;
    const [first, second] = matchSelected;
    const cardA = first.card;
    const cardB = second.card;
    if (cardA.refId === cardB.refId) {
        // Correct match
        [first.el, second.el].forEach(el => el.className = 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-600 text-green-700 dark:text-green-300 rounded-2xl p-2 md:p-3 flex items-center justify-center text-center h-full font-bold anim-correct text-xs md:text-sm shadow-inner');
        matchMatched.push(cardA.id, cardB.id);
        matchCorrectPairs++;
        const batchIndex = cardA.batch ?? matchCurrentBatch;
        matchBatchProgress[batchIndex] = (matchBatchProgress[batchIndex] || 0) + 1;

        // Track word as learned
        trackWordLearned(cardA.refId, cardA.sourceSetId);
        updateMatchProgressText();

        // Check if current batch is complete before moving on
        const targetPairs = matchBatchSizes[batchIndex] || 0;
        const batchCompleted = targetPairs > 0 && matchBatchProgress[batchIndex] >= targetPairs;
        if (batchCompleted && matchCurrentBatch < matchBatchSizes.length - 1) {
            matchCurrentBatch++;
            setTimeout(() => renderMatchingBatch(), 500);
        }

        // Check if all pairs are matched
        if (matchCorrectPairs === matchTotalPairs) {
            stopMatchTimer();
            setTimeout(() => finishMatching(), 800);
        }
    } else {
        // Wrong match
        matchWrongAttempts++;
        [first.el, second.el].forEach(el => el.classList.add('anim-wrong'));
        setTimeout(() => {
            [first.el, second.el].forEach(el => el.className = 'bg-white dark:bg-dark-card border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-2 md:p-3 flex items-center justify-center text-center cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all select-none h-full font-medium text-slate-700 dark:text-slate-200 active:scale-95 text-xs md:text-sm btn-press shadow-sm break-words');
        }, 600);
    }
    matchSelected = [];
}

function finishMatching() {
    // Calculate accuracy
    const totalAttempts = matchCorrectPairs + matchWrongAttempts;
    const accuracy = totalAttempts > 0 ? Math.round((matchCorrectPairs / totalAttempts) * 100) : 0;

    // Update stats
    if (!userStats.matchingStats) userStats.matchingStats = { total: 0, correct: 0 };
    userStats.matchingStats.total += totalAttempts;
    userStats.matchingStats.correct += matchCorrectPairs;
    saveStats();

    // Show result with accuracy
    showMatchingResult(`Hoàn thành trong ${formatTime(matchTime)}!`, accuracy, matchCorrectPairs, matchTotalPairs);
}
function startMatchTimer() { const timerEl = document.getElementById('match-timer'); matchTimerInterval = setInterval(() => { matchTime++; if (timerEl) timerEl.textContent = formatTime(matchTime); }, 1000); }
function stopMatchTimer() { clearInterval(matchTimerInterval); }
function formatTime(s) { return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; }
// Helper to show result from match
function showMatchingResult(msg, accuracy, correct, total) {
    showView('result');
    document.getElementById('result-message').textContent = msg;

    // Show accuracy stats
    const statsBlock = document.getElementById('result-stats-block');
    if (statsBlock) {
        statsBlock.style.display = 'grid';
        statsBlock.innerHTML = `
            <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-2xl border border-green-100 dark:border-green-900/30">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">${correct}/${total}</div>
                <div class="text-[10px] text-green-800 dark:text-green-300 uppercase font-bold tracking-wider">Cặp đúng</div>
            </div>
            <div class="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">${accuracy}%</div>
                <div class="text-[10px] text-indigo-800 dark:text-indigo-300 uppercase font-bold tracking-wider">Tỉ lệ chính xác</div>
            </div>
        `;
    }

    document.getElementById('btn-relearn').classList.add('hidden');
    updateRepeatButton();
}

// Init App
async function initApp() {
    initTheme();
    initMusicFeature();
    await loadVocabSets();
    showView('home');
}

// Expose initApp for module script to call after Firebase is ready
window.initVocabApp = initApp;
