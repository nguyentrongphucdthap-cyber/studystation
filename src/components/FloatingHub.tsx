/**
 * FloatingHub — Premium draggable floating action button with multi-tab panel
 * Features: Chat (Friends + Mago AI), Pomodoro Timer, Notes, Study Tracker, Music, Theme
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle,
    Timer,
    StickyNote,
    Palette,
    Send,
    Plus,
    X,
    RotateCcw,
    UserPlus,
    UserMinus,
    ChevronLeft,
    Check,
    Trash2,
    Sparkles,
    Music,
    ExternalLink,
    Moon,
    Type,
    Pin,
    PinOff,
    Users,
    Image,
    Upload,
    Settings,
    LogOut,
    ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    subscribeFriends,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    cancelFriendRequest,
    sendChatMessage,
    subscribeToMessages,
    MAGO_SYSTEM_PROMPT,
    subscribeFriendPresence,
    subscribeToAllConvos,
    createGroupChat,
    sendGroupMessage,
    subscribeToGroupMessages,
    subscribeToGroupChats,
    renameGroupChat,
    deleteGroupChat,
    addGroupMembers,
    leaveGroupChat,
    acceptGroupInvite,
    rejectGroupInvite,
    sendMagoMessage,
    saveMagoResponse,
    subscribeToMagoMessages,
} from '../services/chat.service';
import { generateAIContent, type AIChatMessage } from '@/services/ai.service';
import type { ChatMessage, Friend, GroupChat } from '@/types';
import './FloatingHub.css';
import { APP_VERSION } from '@/version';
import MathText from './MathText';

// ============================================================
// CONSTANTS
// ============================================================
type TabId = 'chat' | 'pomodoro' | 'notes' | 'music' | 'theme';

const TABS: { id: TabId; icon: typeof MessageCircle; label: string }[] = [
    { id: 'chat', icon: MessageCircle, label: 'Chat' },
    { id: 'pomodoro', icon: Timer, label: 'Pomodoro' },
    { id: 'notes', icon: StickyNote, label: 'Ghi chú' },
    { id: 'music', icon: Music, label: 'Nhạc' },
    { id: 'theme', icon: Palette, label: 'Giao diện' },
];

const POMODORO_MODES = [
    { id: 'focus', label: 'Tập trung', duration: 25 * 60 },
    { id: 'shortBreak', label: 'Nghỉ ngắn', duration: 5 * 60 },
    { id: 'longBreak', label: 'Nghỉ dài', duration: 15 * 60 },
] as const;

// Vivid colors
const ACCENT_COLORS_VIVID = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
// Pastel colors
const ACCENT_COLORS_PASTEL = ['#a8d8ea', '#b8e0d2', '#f9c6d0', '#d7c5e8', '#fde2b8', '#b5d5fb', '#ffd6e7', '#c3e8c3'];
const ACCENT_COLORS = [...ACCENT_COLORS_VIVID, ...ACCENT_COLORS_PASTEL];

const FAB_STORAGE_KEY = 'hub_fab_position';
const NOTES_KEY_PREFIX = 'hub_notes_';
// Theme is managed by ThemeContext (no local key needed)
const POMODORO_SESSIONS_KEY = 'hub_pomodoro_sessions';
const MUSIC_STATE_KEY = 'hub_music_state';

const LOFI_TRACKS = [
    { id: 'lofi1', title: 'Lazy Afternoon', artist: 'Lofi Study', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', cover: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&q=80&w=800' },
    { id: 'lofi2', title: 'Midnight Rain', artist: 'Chill Beats', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', cover: 'https://images.unsplash.com/photo-1541689221361-ad95003aa0d5?auto=format&fit=crop&q=80&w=800' },
    { id: 'lofi3', title: 'Cherry Blossom', artist: 'Zen Focus', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', cover: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?auto=format&fit=crop&q=80&w=800' },
    { id: 'lofi4', title: 'Night Owl', artist: 'Lofi Girl', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', cover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=800' },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export function FloatingHub() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('chat');
    const [fabPos, setFabPos] = useState(() => {
        const fabSize = window.innerWidth < 480 ? 48 : 56;
        try {
            const saved = localStorage.getItem(FAB_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    x: Math.max(0, Math.min(parsed.x, window.innerWidth - fabSize)),
                    y: Math.max(0, Math.min(parsed.y, window.innerHeight - fabSize)),
                };
            }
        } catch { /* ignore */ }
        return { x: window.innerWidth - (fabSize + 16), y: window.innerHeight - (fabSize + 64) };
    });
    const [isDragging, setIsDragging] = useState(false);
    const [chatUnreadCount, setChatUnreadCount] = useState(0);

    // ── Fully lifted Pomodoro state (persists across tab switches) ──
    const [pomodoroMode, setPomodoroMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus');
    const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(POMODORO_MODES[0].duration);
    const [pomodoroRunning, setPomodoroRunning] = useState(false);
    const [pomodoroSessions, setPomodoroSessions] = useState(() => {
        try { return parseInt(localStorage.getItem(POMODORO_SESSIONS_KEY) || '0'); } catch { return 0; }
    });
    // Cycle tracked within focus sessions (1 -> 2 -> 3 -> 4)
    const [pomodoroCycle, setPomodoroCycle] = useState(() => (pomodoroSessions % 4) || (pomodoroSessions === 0 ? 0 : 4));
    const pomodoroInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Global Music State (Lifting State Up) ──
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSong, setCurrentSong] = useState<typeof LOFI_TRACKS[0] | null>(() => {
        try {
            const saved = localStorage.getItem(MUSIC_STATE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return LOFI_TRACKS.find(t => t.id === parsed.id) || null;
            }
        } catch { /* ignore */ }
        return null;
    });
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Sync audio on mount
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleDurationChange = () => setDuration(audio.duration);
        const handleEnded = () => {
            if (!currentSong) return;
            // Auto play next song
            const idx = LOFI_TRACKS.findIndex(t => t.id === currentSong.id);
            const nextIdx = (idx + 1) % LOFI_TRACKS.length;
            playSong(LOFI_TRACKS[nextIdx]);
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleDurationChange);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleDurationChange);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [currentSong]);

    const playSong = (song: typeof LOFI_TRACKS[0]) => {
        if (currentSong?.id === song.id) {
            togglePlay();
            return;
        }
        setCurrentSong(song);
        setIsPlaying(true);
        if (audioRef.current) {
            audioRef.current.src = song.url;
            audioRef.current.play().catch(() => setIsPlaying(false));
            localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify({ id: song.id }));
        }
    };

    const togglePlay = () => {
        if (!audioRef.current || !currentSong) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(() => setIsPlaying(false));
            setIsPlaying(true);
        }
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Pomodoro timer effect (runs in PARENT — never unmounts)
    useEffect(() => {
        if (!pomodoroRunning) {
            if (pomodoroInterval.current) { clearInterval(pomodoroInterval.current); pomodoroInterval.current = null; }
            return;
        }
        pomodoroInterval.current = setInterval(() => {
            setPomodoroTimeLeft(prev => {
                if (prev <= 1) {
                    setPomodoroRunning(false);
                    playBeep();
                    if (pomodoroMode === 'focus') {
                        setPomodoroSessions(s => {
                            const next = s + 1;
                            try { localStorage.setItem(POMODORO_SESSIONS_KEY, String(next)); } catch { /* */ }
                            const cyclePos = (next % 4) || 4;
                            setPomodoroCycle(cyclePos);

                            // Auto-switch to break
                            if (cyclePos === 4) {
                                setPomodoroMode('longBreak');
                                setPomodoroTimeLeft(POMODORO_MODES.find(m => m.id === 'longBreak')!.duration);
                            } else {
                                setPomodoroMode('shortBreak');
                                setPomodoroTimeLeft(POMODORO_MODES.find(m => m.id === 'shortBreak')!.duration);
                            }
                            return next;
                        });
                    } else {
                        // After break, switch back to focus
                        setPomodoroMode('focus');
                        setPomodoroTimeLeft(POMODORO_MODES.find(m => m.id === 'focus')!.duration);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (pomodoroInterval.current) clearInterval(pomodoroInterval.current); };
    }, [pomodoroRunning, pomodoroMode]);

    const fabRef = useRef<HTMLButtonElement>(null);
    const dragStart = useRef({ x: 0, y: 0, fabX: 0, fabY: 0 });
    const hasDragged = useRef(false);

    // Save FAB position
    useEffect(() => {
        try { localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(fabPos)); } catch { /* */ }
    }, [fabPos]);

    // ── Clamp to viewport (free-floating, NO edge snapping) ──
    const clampToViewport = useCallback((x: number, y: number) => {
        const fabSize = window.innerWidth < 480 ? 48 : 56;
        return {
            x: Math.max(0, Math.min(x, window.innerWidth - fabSize)),
            y: Math.max(0, Math.min(y, window.innerHeight - fabSize)),
        };
    }, []);

    // Keep FAB on screen during window resize
    useEffect(() => {
        const handleResize = () => {
            setFabPos(prev => clampToViewport(prev.x, prev.y));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [clampToViewport]);

    // --- Drag handlers ---
    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        setIsDragging(true);
        hasDragged.current = false;
        dragStart.current = { x: e.clientX, y: e.clientY, fabX: fabPos.x, fabY: fabPos.y };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [fabPos]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDragged.current = true;
        setFabPos(clampToViewport(
            dragStart.current.fabX + dx,
            dragStart.current.fabY + dy,
        ));
    }, [isDragging, clampToViewport]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        setIsDragging(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);

        // Just clamp — NO edge snapping
        setFabPos((prev: { x: number; y: number }) => clampToViewport(prev.x, prev.y));

        if (!hasDragged.current) {
            setIsOpen(prev => !prev);
        }
    }, [isDragging, clampToViewport]);

    // ── Smart panel positioning based on FAB quadrant ──
    const fabSize = window.innerWidth < 480 ? 48 : 56;
    const fabCenterX = fabPos.x + fabSize / 2;
    const fabCenterY = fabPos.y + fabSize / 2;
    const isOnLeft = fabCenterX < window.innerWidth / 2;
    const isOnTop = fabCenterY < window.innerHeight / 2;

    const panelW = 380;
    const panelGap = 10;

    const fabStyle: React.CSSProperties = {
        left: fabPos.x,
        top: fabPos.y,
        cursor: isDragging ? 'grabbing' : (isOpen ? 'pointer' : 'grab'),
        willChange: 'transform, left, top',
    };
    const panelStyle: React.CSSProperties = {};

    // Horizontal: open toward the side with more space
    if (isOnLeft) {
        panelStyle.left = Math.max(8, Math.min(fabPos.x, window.innerWidth - panelW - 8));
    } else {
        panelStyle.right = Math.max(8, Math.min(window.innerWidth - fabPos.x - fabSize, window.innerWidth - panelW - 8));
    }

    // Vertical: open below if FAB is on top half, above if on bottom half
    if (isOnTop) {
        panelStyle.top = fabPos.y + fabSize + panelGap;
    } else {
        panelStyle.bottom = Math.max(8, window.innerHeight - fabPos.y + panelGap);
    }

    // Panel position class for transform-origin animation
    const panelPosClass = `panel-${isOnTop ? 'top' : 'bottom'}-${isOnLeft ? 'left' : 'right'}`;

    if (!user) return null;

    // ── Pre-render logic for FAB ──
    const showMusicPill = !isOpen && isPlaying && currentSong;
    const remainingTime = duration - currentTime;
    const pomodoroModesMap = {
        focus: POMODORO_MODES[0],
        shortBreak: POMODORO_MODES[1],
        longBreak: POMODORO_MODES[2]
    };

    return (
        <>
            {/* ── Global Music Background Overlay ── */}
            {isPlaying && currentSong && settings.enableMusicBackground && (
                <div 
                    className="hub-global-music-bg"
                    style={{ backgroundImage: `url(${currentSong.cover})` }}
                />
            )}

            {/* Hidden Audio element for Option 1 */}
            <audio ref={audioRef} style={{ display: 'none' }} />
            {/* ── Floating Toggle Button (FAB) ── */}
            <button
                ref={fabRef}
                className={`hub-fab ${isOpen ? 'open' : ''} ${pomodoroRunning ? 'timer-active' : ''} ${isDragging ? 'dragging' : ''} ${showMusicPill ? 'music-pill' : ''}`}
                style={fabStyle}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                aria-label="Toggle Hub"
            >
                {showMusicPill ? (
                    <div className="hub-music-pill-content">
                        <div className="hub-music-pill-cover">
                            <img src={currentSong.cover} alt="" />
                            <div className="wave-bars">
                                <span className="bar" />
                                <span className="bar" />
                                <span className="bar" />
                            </div>
                        </div>
                        <div className="hub-music-pill-info">
                            <span className="hub-music-pill-title">{currentSong.title}</span>
                            <span className="hub-music-pill-time">-{formatTime(remainingTime > 0 ? remainingTime : 0)}</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {pomodoroRunning ? (
                            <>
                                <svg className="fab-timer-ring">
                                    <circle className="fab-ring-bg" cx="30" cy="30" r="28" />
                                    <circle
                                        className="fab-ring-progress"
                                        cx="30" cy="30" r="28"
                                        strokeDasharray={2 * Math.PI * 28}
                                        strokeDashoffset={(2 * Math.PI * 28) * (1 - (pomodoroModesMap[pomodoroMode].duration - pomodoroTimeLeft) / pomodoroModesMap[pomodoroMode].duration)}
                                    />
                                </svg>
                                <span className="hub-fab-timer">
                                    {Math.floor(pomodoroTimeLeft / 60)}:{String(pomodoroTimeLeft % 60).padStart(2, '0')}
                                </span>
                            </>
                        ) : (
                            isOpen ? <X className="hub-fab-icon" size={24} /> : (
                                isPlaying ? <div className="hub-fab-music-playing">
                                    <Music className="hub-fab-icon" size={24} />
                                    <div className="fab-music-dot" />
                                </div> : <Sparkles className="hub-fab-icon" size={24} />
                            )
                        )}
                        {chatUnreadCount > 0 && <span className="hub-fab-badge">{chatUnreadCount > 99 ? '99+' : chatUnreadCount}</span>}
                    </>
                )}
            </button>


            {/* Panel */}
            {isOpen && (
                <>
                    {/* Backdrop for mobile bottom sheet */}
                    <div className="hub-backdrop" onClick={() => setIsOpen(false)} />

                    <div className={`hub-panel ${panelPosClass}`} style={panelStyle}>
                        {/* Sidebar tabs (vertical on desktop, horizontal on mobile via CSS) */}
                        <div className="hub-sidebar">
                            {TABS.map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        className={`hub-sidebar-btn ${activeTab === tab.id ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                        title={tab.label}
                                    >
                                        <Icon size={18} />
                                        {tab.id === 'chat' && chatUnreadCount > 0 && (
                                            <span className="hub-tab-badge">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Content */}
                        <div className="hub-content">
                            {activeTab === 'chat' && <ChatTab user={user} onUnreadChange={setChatUnreadCount} />}
                            {activeTab === 'pomodoro' && (
                                <PomodoroTab
                                    mode={pomodoroMode}
                                    timeLeft={pomodoroTimeLeft}
                                    isRunning={pomodoroRunning}
                                    sessions={pomodoroSessions}
                                    cycle={pomodoroCycle}
                                    onSetMode={(m) => {
                                        setPomodoroMode(m);
                                        setPomodoroTimeLeft(POMODORO_MODES.find(x => x.id === m)!.duration);
                                        setPomodoroRunning(false);
                                    }}
                                    onToggleRunning={() => setPomodoroRunning(!pomodoroRunning)}
                                    onReset={() => {
                                        setPomodoroRunning(false);
                                        setPomodoroTimeLeft(POMODORO_MODES.find(m => m.id === pomodoroMode)!.duration);
                                    }}
                                />
                            )}
                            {activeTab === 'notes' && <NotesTab userEmail={user.email} />}
                            {activeTab === 'music' && (
                                <MusicTab 
                                    currentSong={currentSong} 
                                    isPlaying={isPlaying} 
                                    onTogglePlay={togglePlay} 
                                    onPlaySong={playSong}
                                    currentTime={currentTime}
                                    duration={duration}
                                    onSeek={(time) => {
                                        if (audioRef.current) {
                                            audioRef.current.currentTime = time;
                                            setCurrentTime(time);
                                        }
                                    }}
                                />
                            )}
                            {activeTab === 'theme' && <ThemeTab />}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

// ============================================================
// CHAT TAB — with online status, unread badges, Mago AI fallback
// ============================================================

const CHAT_READ_KEY = 'hub_chat_read_timestamps'; // localStorage key for read tracking
const CHAT_PINNED_KEY = 'hub_pinned_chats'; // localStorage key for pinned conversations

function formatTimeAgo(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'vừa xong';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ`;
    return `${Math.floor(diff / 86_400_000)} ngày`;
}

function formatMsgTime(ts: number): string {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}


function ChatTab({ user, onUnreadChange }: { user: { email: string; displayName: string | null; photoURL?: string | null }; onUnreadChange?: (count: number) => void }) {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [activeChat, setActiveChat] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [friendEmail, setFriendEmail] = useState('');
    const [friendError, setFriendError] = useState('');
    const [isMagoTyping, setIsMagoTyping] = useState(false);
    const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
    const [lastMessages, setLastMessages] = useState<Record<string, ChatMessage>>({});
    const [groups, setGroups] = useState<GroupChat[]>([]);
    const [lastGroupMessages, setLastGroupMessages] = useState<Record<string, ChatMessage>>({});
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [showGroupSettings, setShowGroupSettings] = useState(false);
    const [isRenamingGroup, setIsRenamingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [showInviteMembers, setShowInviteMembers] = useState(false);
    const [pinnedChats, setPinnedChats] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem(CHAT_PINNED_KEY) || '[]'); } catch { return []; }
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const togglePin = useCallback((chatId: string) => {
        setPinnedChats(prev => {
            const next = prev.includes(chatId)
                ? prev.filter(id => id !== chatId)
                : [chatId, ...prev];
            localStorage.setItem(CHAT_PINNED_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const handleRemoveFriend = async (friendEmail: string) => {
        if (!window.confirm(`Bạn có chắc muốn xóa ${friendEmail} khỏi danh sách bạn bè?`)) return;
        try {
            await removeFriend(friendEmail);
            if (activeChat === friendEmail) setActiveChat(null);
        } catch (err) {
            console.error('[Chat] Failed to remove friend:', err);
        }
    };

    const getReadTimestamps = useCallback((): Record<string, number> => {
        try { return JSON.parse(localStorage.getItem(CHAT_READ_KEY) || '{}'); } catch { return {}; }
    }, []);

    const markAsRead = useCallback((chatId: string) => {
        const ts = getReadTimestamps();
        ts[chatId] = Date.now();
        localStorage.setItem(CHAT_READ_KEY, JSON.stringify(ts));
    }, [getReadTimestamps]);

    // Subscriptions
    useEffect(() => {
        const unsub = subscribeFriends(setFriends);
        return () => unsub();
    }, []);

    useEffect(() => {
        const acceptedEmails = friends.filter(f => f.status === 'accepted').map(f => f.email);
        const unsubPresence = subscribeFriendPresence(acceptedEmails, setOnlineMap);
        const unsubConvos = subscribeToAllConvos((updates) => {
            setLastMessages(prev => ({ ...prev, ...updates }));
        });

        const unsubGroups = subscribeToGroupChats((gs) => {
            setGroups(gs);
        });

        return () => {
            unsubPresence();
            unsubConvos();
            unsubGroups();
        };
    }, [friends, user.email]);

    // Set up listeners for group messages specifically, cleaning up correctly when groups change
    useEffect(() => {
        const unsubs: Record<string, () => void> = {};

        groups.forEach(g => {
            if (!unsubs[g.id]) {
                unsubs[g.id] = subscribeToGroupMessages(g.id, (msgs) => {
                    const last = msgs[msgs.length - 1];
                    if (last) {
                        setLastGroupMessages(prev => ({ ...prev, [g.id]: last }));
                    }
                });
            }
        });

        return () => {
            Object.values(unsubs).forEach(unsub => unsub());
        };
    }, [groups.map(g => g.id).join(',')]); // Use a string map of IDs to avoid unnecessary re-subscriptions on simple group metadata updates

    // End of subscriptions
    useEffect(() => {
        if (!activeChat) {
            setMessages([]);
            return;
        }

        let unsub: () => void;
        if (activeChat.startsWith('group_')) {
            unsub = subscribeToGroupMessages(activeChat, (msgs) => {
                setMessages(msgs);
                markAsRead(activeChat);
                onUnreadChange?.(0);
            });
        } else if (activeChat === 'mago') {
            unsub = subscribeToMagoMessages((msgs) => {
                setMessages(msgs);
                markAsRead('mago');
                onUnreadChange?.(0);
            });
        } else {
            const myKey = user.email.toLowerCase().replace(/@/g, '_at_').replace(/\./g, ',');
            const partnerKey = activeChat.toLowerCase().replace(/@/g, '_at_').replace(/\./g, ',');
            const convoId = [myKey, partnerKey].sort().join('__');
            unsub = subscribeToMessages(convoId, (msgs) => {
                setMessages(msgs);
                markAsRead(activeChat.toLowerCase());
                onUnreadChange?.(0);
            });
        }
        return () => unsub();
    }, [activeChat, user.email, onUnreadChange, markAsRead]);

    useEffect(() => {
        const readTs = getReadTimestamps();
        let total = 0;
        const magoLast = lastMessages['mago'];
        if (magoLast && magoLast.role === 'mago') {
            if (magoLast.timestamp > (readTs['mago'] || 0)) total++;
        }
        friends.filter(f => f.status === 'accepted').forEach(f => {
            const last = lastMessages[f.email.toLowerCase()];
            if (last && last.senderEmail.toLowerCase() !== user.email.toLowerCase()) {
                if (last.timestamp > (readTs[f.email.toLowerCase()] || 0)) total++;
            }
        });
        groups.forEach(g => {
            const last = lastGroupMessages[g.id];
            if (last && last.senderEmail.toLowerCase() !== user.email.toLowerCase()) {
                if (last.timestamp > (readTs[g.id] || 0)) total++;
            }
        });
        onUnreadChange?.(total);
    }, [lastMessages, lastGroupMessages, friends, groups, user.email, getReadTimestamps, onUnreadChange]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !activeChat) return;
        const text = input.trim();
        setInput('');

        if (activeChat === 'mago') {
            setIsMagoTyping(true);
            try {
                // 1. Save user message to Firestore
                await sendMagoMessage(text);

                // 2. Clear input is already done above

                // 3. Prepare history for AI (using current messages + the new one)
                const aiHistory: AIChatMessage[] = [...messages, {
                    id: 'temp',
                    text,
                    senderEmail: user.email,
                    senderName: user.displayName || 'Bạn',
                    timestamp: Date.now(),
                    role: 'user'
                }].filter(m => m.role).map(m => ({
                    role: m.role === 'mago' ? 'model' : 'user',
                    parts: [{ text: m.text }]
                }));

                // 4. Generate AI response
                const response = await generateAIContent(aiHistory, { systemInstruction: MAGO_SYSTEM_PROMPT });

                // 5. Save AI response to Firestore
                await saveMagoResponse(response);
            } catch (err: any) {
                console.error('[Chat] Mago AI error:', err);
                const errorMsg = err.message || 'Lỗi kết nối với Mago';
                // Optionally show a non-intrusive error message in chat
                await saveMagoResponse(`Xin lỗi, tôi đang gặp chút sự cố kỹ thuật: ${errorMsg}. Bạn thử lại sau nhé! 🧙‍♂️`);
            } finally {
                setIsMagoTyping(false);
            }
        } else if (activeChat.startsWith('group_')) {
            await sendGroupMessage(activeChat, text);
        } else {
            const myKey = user.email.toLowerCase().replace(/@/g, '_at_').replace(/\./g, ',');
            const partnerKey = activeChat.toLowerCase().replace(/@/g, '_at_').replace(/\./g, ',');
            const convoId = [myKey, partnerKey].sort().join('__');
            await sendChatMessage(convoId, text);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedMembers.length === 0) return;
        const gid = await createGroupChat(groupName, selectedMembers);
        if (gid) {
            setShowCreateGroup(false);
            setGroupName('');
            setSelectedMembers([]);
            setActiveChat(gid);
        }
    };

    const handleRenameGroup = async () => {
        if (!activeChat || !newGroupName.trim()) return;
        await renameGroupChat(activeChat, newGroupName);
        setIsRenamingGroup(false);
    };

    const handleDeleteGroup = async () => {
        if (!activeChat) return;
        if (window.confirm('Bạn có chắc muốn giải tán nhóm này?')) {
            await deleteGroupChat(activeChat);
            setActiveChat(null);
            setShowGroupSettings(false);
        }
    };

    const handleLeaveGroupChan = async () => {
        if (!activeChat) return;
        if (window.confirm('Bạn có chắc muốn rời khỏi nhóm?')) {
            await leaveGroupChat(activeChat);
            setActiveChat(null);
            setShowGroupSettings(false);
        }
    };

    const handleInviteMembers = async (emails: string[]) => {
        if (!activeChat || emails.length === 0) return;
        await addGroupMembers(activeChat, emails);
        setShowInviteMembers(false);
    };

    const toggleMemberSelection = (email: string) => {
        setSelectedMembers(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
    };

    const handleAddFriend = async () => {
        setFriendError('');
        if (!friendEmail.trim()) return;
        const result = await sendFriendRequest(friendEmail.trim());
        if (result.success) {
            setShowAddFriend(false);
            setFriendEmail('');
        } else {
            setFriendError(result.error || 'Lỗi');
        }
    };

    const pendingReceived = friends.filter(f => f.status === 'pending_received');
    const readTs = getReadTimestamps();

    if (!activeChat) {
        return (
            <>
                <div className="hub-content-header">
                    <h3><MessageCircle size={16} style={{ verticalAlign: '-3px', marginRight: '6px' }} /> Chat</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setShowCreateGroup(true)} title="Tạo nhóm" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color, #3b82f6)' }}>
                            <Users size={18} />
                        </button>
                        <button onClick={() => setShowAddFriend(true)} title="Thêm bạn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color, #3b82f6)' }}>
                            <UserPlus size={18} />
                        </button>
                    </div>
                </div>
                <div className="hub-content-body">
                    {showAddFriend && (
                        <div className="chat-add-friend-modal">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>Thêm bạn bè</span>
                                <button onClick={() => setShowAddFriend(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <input type="email" placeholder="Nhập email..." value={friendEmail} onChange={e => setFriendEmail(e.target.value)} className="chat-add-friend-input" />
                                <button onClick={handleAddFriend} className="chat-add-friend-btn">Gửi</button>
                            </div>
                            {friendError && <p className="chat-add-friend-error">{friendError}</p>}
                        </div>
                    )}
                    {showCreateGroup && (
                        <div className="chat-add-friend-modal" style={{ background: '#ecfdf5' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>Tạo nhóm mới</span>
                                <button onClick={() => { setShowCreateGroup(false); setSelectedMembers([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                            </div>
                            <input type="text" placeholder="Tên nhóm..." value={groupName} onChange={e => setGroupName(e.target.value)} className="chat-add-friend-input" style={{ marginBottom: '10px', width: '100%' }} />
                            <p className="chat-section-label" style={{ marginTop: 0 }}>Chọn thành viên ({selectedMembers.length})</p>
                            <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '10px' }}>
                                {friends.filter(f => f.status === 'accepted').map(f => (
                                    <div key={f.email} className={`chat-contact-item ${selectedMembers.includes(f.email) ? 'selected' : ''}`} onClick={() => toggleMemberSelection(f.email)} style={{ padding: '6px 8px', fontSize: '12px' }}>
                                        <div className="chat-contact-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{f.displayName.charAt(0)}</div>
                                        <span style={{ flex: 1 }}>{f.displayName}</span>
                                        {selectedMembers.includes(f.email) && <Check size={12} color="#10b981" />}
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedMembers.length === 0} className="chat-add-friend-btn" style={{ width: '100%', background: '#10b981' }}>Tạo nhóm</button>
                        </div>
                    )}
                    {pendingReceived.length > 0 && (
                        <div className="chat-section">
                            <p className="chat-section-label">Lời mời kết bạn</p>
                            {pendingReceived.map(f => (
                                <div key={f.email} className="chat-contact-item pending">
                                    <div className="chat-contact-avatar" style={{ background: '#f59e0b', color: 'white' }}>{f.displayName.charAt(0).toUpperCase()}</div>
                                    <div className="chat-contact-info">
                                        <p className="chat-contact-name">{f.displayName}</p>
                                        <p className="chat-contact-preview">{f.email}</p>
                                    </div>
                                    <button onClick={() => acceptFriendRequest(f.email)} className="chat-accept-btn"><Check size={14} /></button>
                                    <button onClick={() => removeFriend(f.email)} className="chat-reject-btn"><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                    {(() => {
                        const invitedGroups = groups.filter(g => g.pendingInvites?.includes(user.email.toLowerCase()));
                        if (invitedGroups.length === 0) return null;
                        return (
                            <div className="chat-section">
                                <p className="chat-section-label">Lời mời vào nhóm</p>
                                {invitedGroups.map(g => (
                                    <div key={g.id} className="chat-contact-item pending">
                                        <div className="chat-contact-avatar" style={{ background: g.avatarColor || '#10b981', color: 'white' }}>{g.name.charAt(0).toUpperCase()}</div>
                                        <div className="chat-contact-info">
                                            <p className="chat-contact-name">{g.name}</p>
                                            <p className="chat-contact-preview">Mời bạn vào nhóm</p>
                                        </div>
                                        <button onClick={() => acceptGroupInvite(g.id)} className="chat-accept-btn" title="Tham gia"><Check size={14} /></button>
                                        <button onClick={() => rejectGroupInvite(g.id)} className="chat-reject-btn" title="Từ chối"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                    <div className="chat-contact-item mago" onClick={() => setActiveChat('mago')}>
                        <div className="chat-contact-avatar mago-avatar" style={{ overflow: 'hidden' }}>
                            <img src="/mago.png" alt="Mago" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div className="chat-contact-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="chat-contact-name">Mago</span>
                                <span className="chat-ai-badge">AI ✨</span>
                            </div>
                            <p className="chat-contact-preview">{lastMessages['mago']?.text || 'Trợ lý học tập thông minh'}</p>
                        </div>
                        <div className="chat-contact-meta">
                            {lastMessages['mago'] && <span className="chat-contact-time">{formatTimeAgo(lastMessages['mago'].timestamp)}</span>}
                        </div>
                    </div>
                    {groups.length > 0 && (
                        <div className="chat-section">
                            <p className="chat-section-label">Nhóm</p>
                            {groups.map(g => {
                                const last = lastGroupMessages[g.id];
                                const hasUnread = last && last.senderEmail.toLowerCase() !== user.email.toLowerCase() && last.timestamp > (readTs[g.id] || 0);
                                const isPinned = pinnedChats.includes(g.id);
                                return (
                                    <div key={g.id} className={`chat-contact-item ${hasUnread ? 'unread' : ''} ${isPinned ? 'pinned' : ''}`} onClick={() => setActiveChat(g.id)}>
                                        <div className="chat-contact-avatar" style={{ background: g.avatarColor || '#10b981', color: 'white' }}>{g.name.charAt(0).toUpperCase()}</div>
                                        <div className="chat-contact-info">
                                            <p className={`chat-contact-name ${hasUnread ? 'bold' : ''}`}>{g.name} {isPinned && <Pin size={10} style={{ marginLeft: '4px', color: 'var(--accent-color, #3b82f6)' }} />}</p>
                                            <p className={`chat-contact-preview ${hasUnread ? 'unread-text' : ''}`}>{last ? `${last.senderName}: ${last.text}` : 'Nhóm mới được tạo'}</p>
                                        </div>
                                        <div className="chat-contact-meta">
                                            {last && <span className="chat-contact-time">{formatTimeAgo(last.timestamp)}</span>}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                <button onClick={(e) => { e.stopPropagation(); togglePin(g.id); }} className="chat-pin-btn">{isPinned ? <PinOff size={12} /> : <Pin size={12} />}</button>
                                                {hasUnread && <span className="chat-unread-dot" />}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {(() => {
                        const acceptedFriends = friends.filter(f => f.status === 'accepted');
                        if (acceptedFriends.length === 0) return null;
                        const sortedFriends = [...acceptedFriends].sort((a, b) => {
                            const aPinned = pinnedChats.includes(a.email.toLowerCase());
                            const bPinned = pinnedChats.includes(b.email.toLowerCase());
                            if (aPinned && !bPinned) return -1;
                            if (!aPinned && bPinned) return 1;
                            const aLast = lastMessages[a.email.toLowerCase()]?.timestamp || 0;
                            const bLast = lastMessages[b.email.toLowerCase()]?.timestamp || 0;
                            return bLast - aLast || new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
                        });
                        return (
                            <div className="chat-section">
                                <p className="chat-section-label">Bạn bè</p>
                                {sortedFriends.map(f => {
                                    const emailLower = f.email.toLowerCase();
                                    const last = lastMessages[emailLower];
                                    const isOnline = onlineMap[emailLower] || false;
                                    const lastRead = readTs[emailLower] || 0;
                                    const hasUnread = last && last.senderEmail.toLowerCase() !== user.email.toLowerCase() && last.timestamp > lastRead;
                                    const isPinned = pinnedChats.includes(emailLower);
                                    return (
                                        <div key={f.email} className={`chat-contact-item ${hasUnread ? 'unread' : ''} ${isPinned ? 'pinned' : ''}`} onClick={() => setActiveChat(f.email)}>
                                            <div className="chat-contact-avatar-wrap">
                                                <div className="chat-contact-avatar" style={{ background: 'var(--hub-surface-alt)', color: 'var(--accent-color)', overflow: 'hidden' }}>
                                                    {f.photoURL ? <img src={f.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : f.displayName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className={`chat-status-dot ${isOnline ? 'online' : 'offline'}`} />
                                            </div>
                                            <div className="chat-contact-info">
                                                <p className={`chat-contact-name ${hasUnread ? 'bold' : ''}`}>{f.displayName} {isPinned && <Pin size={10} style={{ marginLeft: '4px', color: 'var(--accent-color, #3b82f6)' }} />}</p>
                                                <p className={`chat-contact-preview ${hasUnread ? 'unread-text' : ''}`}>{last ? (last.senderEmail.toLowerCase() === user.email.toLowerCase() ? `Bạn: ${last.text}` : last.text) : f.email}</p>
                                            </div>
                                            <div className="chat-contact-meta">
                                                {last && <span className="chat-contact-time">{formatTimeAgo(last.timestamp)}</span>}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                    <button onClick={(e) => { e.stopPropagation(); togglePin(emailLower); }} className="chat-pin-btn">{isPinned ? <PinOff size={12} /> : <Pin size={12} />}</button>
                                                    {hasUnread && <span className="chat-unread-dot" />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* Sent requests */}
                    {friends.filter(f => f.status === 'pending_sent').length > 0 && (
                        <div className="chat-section">
                            <p className="chat-section-label">Đã gửi lời mời</p>
                            {friends.filter(f => f.status === 'pending_sent').map(f => (
                                <div key={f.email} className="chat-contact-item sent-request">
                                    <div className="chat-contact-avatar" style={{ background: 'var(--hub-surface-alt)', color: 'var(--hub-text-muted)' }}>
                                        {f.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="chat-contact-info">
                                        <p className="chat-contact-name" style={{ color: 'var(--hub-text-muted)' }}>{f.email}</p>
                                        <p className="chat-contact-preview">Đang chờ chấp nhận...</p>
                                    </div>
                                    <button
                                        onClick={() => cancelFriendRequest(f.email)}
                                        className="chat-reject-btn"
                                        title="Rút lại lời mời"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {friends.filter(f => f.status === 'accepted').length === 0 && friends.filter(f => f.status === 'pending_sent').length === 0 && (
                        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--hub-text-muted)' }}>
                            <UserPlus size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                            <p style={{ fontSize: '12px' }}>Thêm bạn bè bằng email</p>
                            <button
                                onClick={() => setShowAddFriend(true)}
                                style={{ marginTop: '8px', padding: '6px 16px', borderRadius: '8px', background: 'var(--accent-color, #3b82f6)', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                <Plus size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Thêm bạn
                            </button>
                        </div>
                    )}
                </div>
            </>
        );
    }

    // ── Conversation view ──
    const isGroup = activeChat.startsWith('group_');
    const group = isGroup ? groups.find(g => g.id === activeChat) : null;
    const chatPartner = !isGroup && activeChat !== 'mago' ? friends.find(f => f.email === activeChat) : null;
    const chatPartnerName = isGroup ? group?.name || 'Nhóm' : activeChat === 'mago' ? 'Mago' : chatPartner?.displayName || activeChat;
    const isPartnerOnline = !isGroup && activeChat !== 'mago' && onlineMap[activeChat.toLowerCase()];

    return (
        <>
            <div className="hub-content-header chat-conv-header">
                <button onClick={() => setActiveChat(null)} className="chat-back-btn"><ChevronLeft size={18} /></button>
                <div className="chat-header-info">
                    {isGroup ? (
                        <div className="chat-header-avatar" style={{ background: group?.avatarColor || '#10b981', color: 'white', width: 28, height: 28, fontSize: 14 }}>{chatPartnerName.charAt(0).toUpperCase()}</div>
                    ) : activeChat === 'mago' ? (
                        <div className="chat-header-avatar mago-avatar" style={{ width: 28, height: 28, overflow: 'hidden' }}>
                            <img src="/mago.png" alt="Mago" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    ) : (
                        <div className="chat-contact-avatar-wrap" style={{ width: 28, height: 28 }}>
                            <div className="chat-header-avatar" style={{ background: 'var(--hub-surface-alt)', color: 'var(--accent-color)', width: 28, height: 28, fontSize: 11, overflow: 'hidden' }}>
                                {chatPartner?.photoURL ? <img src={chatPartner.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : chatPartnerName.charAt(0).toUpperCase()}
                            </div>
                            <span className={`chat-status-dot small ${isPartnerOnline ? 'online' : 'offline'}`} />
                        </div>
                    )}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {activeChat === 'mago' && <span className="chat-ai-badge">AI</span>}
                            <span style={{ fontSize: '13px', fontWeight: 700 }}>{chatPartnerName}</span>
                        </div>
                        <p className="chat-header-status">{isGroup ? `${group?.members.length || 0} thành viên` : activeChat === 'mago' ? 'Luôn sẵn sàng ✨' : isPartnerOnline ? '🟢 Đang hoạt động' : '⚫ Không hoạt động'}</p>
                    </div>
                </div>
                <div className="chat-header-actions" style={{ display: 'flex', gap: '8px' }}>
                    {isGroup && (
                        <button onClick={() => setShowGroupSettings(!showGroupSettings)} className="chat-header-btn" title="Cài đặt nhóm" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}>
                            <Settings size={18} />
                        </button>
                    )}
                    {!isGroup && activeChat !== 'mago' && (
                        <>
                            <button onClick={() => togglePin(activeChat!.toLowerCase())} className="chat-header-btn" title={pinnedChats.includes(activeChat!.toLowerCase()) ? 'Bỏ ghim' : 'Ghim hội thoại'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}>
                                {pinnedChats.includes(activeChat!.toLowerCase()) ? <PinOff size={16} /> : <Pin size={16} />}
                            </button>
                            <button onClick={() => handleRemoveFriend(activeChat!)} className="chat-header-btn" title="Hủy kết bạn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                                <UserMinus size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="hub-content-body" style={{ position: 'relative' }}>
                {showGroupSettings && isGroup && group && (
                    <div className="chat-group-settings-overlay">
                        <div className="chat-settings-header">
                            <span style={{ fontWeight: 700 }}>Cài đặt nhóm</span>
                            <button onClick={() => setShowGroupSettings(false)} className="chat-settings-close"><X size={14} /></button>
                        </div>
                        <div className="chat-settings-body">
                            {isRenamingGroup ? (
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                                    <input
                                        className="chat-add-friend-input"
                                        placeholder="Tên nhóm mới..."
                                        value={newGroupName}
                                        onChange={e => setNewGroupName(e.target.value)}
                                    />
                                    <button onClick={handleRenameGroup} className="chat-add-friend-btn">Lưu</button>
                                    <button onClick={() => setIsRenamingGroup(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer' }}><X size={14} /></button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setIsRenamingGroup(true); setNewGroupName(group.name); }}
                                    className="chat-settings-item"
                                >
                                    Đổi tên nhóm
                                </button>
                            )}

                            <button
                                onClick={() => setShowInviteMembers(true)}
                                className="chat-settings-item"
                            >
                                Mời thành viên
                            </button>

                            <button
                                onClick={handleLeaveGroupChan}
                                className="chat-settings-item danger"
                            >
                                <LogOut size={14} style={{ marginRight: '6px' }} /> Rời khỏi nhóm
                            </button>

                            {group.createdBy === user.email && (
                                <button
                                    onClick={handleDeleteGroup}
                                    className="chat-settings-item danger"
                                    style={{ borderTop: '1px solid #fee2e2', marginTop: '4px', paddingTop: '8px' }}
                                >
                                    <Trash2 size={14} style={{ marginRight: '6px' }} /> Giải tán nhóm
                                </button>
                            )}
                        </div>

                        {showInviteMembers && (
                            <div className="chat-invite-modal">
                                <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Chọn thành viên mời</p>
                                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {friends.filter(f => f.status === 'accepted' && !group.allRelated?.includes(f.email.toLowerCase())).map(f => (
                                        <div
                                            key={f.email}
                                            className={`chat-contact-item ${selectedMembers.includes(f.email) ? 'selected' : ''}`}
                                            onClick={() => toggleMemberSelection(f.email)}
                                        >
                                            <div className="chat-contact-avatar" style={{ background: '#e0e7ff', color: '#4f46e5', width: 24, height: 24, fontSize: 10 }}>
                                                {f.photoURL ? <img src={f.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : f.displayName[0]}
                                            </div>
                                            <span style={{ fontSize: '12px', flex: 1 }}>{f.displayName}</span>
                                            {selectedMembers.includes(f.email) && <Check size={12} color="#10b981" />}
                                        </div>
                                    ))}
                                    {friends.filter(f => f.status === 'accepted' && !group.allRelated?.includes(f.email.toLowerCase())).length === 0 && (
                                        <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', padding: '10px' }}>Tất cả bạn bè đã được mời hoặc ở trong nhóm</p>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                    <button onClick={() => handleInviteMembers(selectedMembers)} disabled={selectedMembers.length === 0} className="chat-add-friend-btn" style={{ flex: 1 }}>Mời ({selectedMembers.length})</button>
                                    <button onClick={() => { setShowInviteMembers(false); setSelectedMembers([]); }} className="chat-add-friend-btn" style={{ background: '#f3f4f6', color: '#6b7280' }}>Hủy</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {messages.length === 0 && activeChat === 'mago' && (
                    <div className="chat-empty-state">
                        <div style={{ width: 60, height: 60, margin: '0 auto 12px', borderRadius: '50%', overflow: 'hidden', border: '3px solid #e2e8f0', background: 'white' }}>
                            <img src="/mago.png" alt="Mago" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#4c1d95' }}>Xin chào! Tôi là Mago</p>
                        <p style={{ fontSize: '12px', marginTop: '4px', color: '#7c3aed' }}>Hỏi tôi bất cứ điều gì về StudyStation nhé! ✨</p>
                    </div>
                )}
                {messages.map(msg => {
                    const isSent = msg.senderEmail.toLowerCase() === user.email.toLowerCase();
                    const isMago = msg.role === 'mago';
                    return (
                        <div key={msg.id} className={`chat-message ${isSent ? 'sent' : 'received'} ${isMago ? 'mago' : ''}`}>
                            {!isSent && (
                                <div className="chat-avatar" style={isMago ? { overflow: 'hidden' } : { overflow: 'hidden' }}>
                                    {isMago ? <img src="/mago.png" alt="Mago" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (() => {
                                        const partner = friends.find(f => f.email.toLowerCase() === msg.senderEmail.toLowerCase());
                                        return partner?.photoURL ? <img src={partner.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : msg.senderName.charAt(0).toUpperCase();
                                    })()}
                                </div>
                            )}
                            <div>
                                <div className="chat-bubble"><MathText text={msg.text} /></div>
                                <span className={`chat-msg-time ${isSent ? 'sent' : ''}`}>{formatMsgTime(msg.timestamp)}</span>
                            </div>
                        </div>
                    );
                })}
                {isMagoTyping && (
                    <div className="chat-message received mago">
                        <div className="chat-avatar" style={{ overflow: 'hidden' }}>
                            <img src="/mago.png" alt="Mago" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div className="chat-bubble typing-indicator">
                            <span className="typing-dot" /><span className="typing-dot" style={{ animationDelay: '0.2s' }} /><span className="typing-dot" style={{ animationDelay: '0.4s' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-bar">
                <input type="text" placeholder={activeChat === 'mago' ? 'Hỏi Mago...' : 'Nhắn tin...'} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()} disabled={isMagoTyping} />
                <button onClick={handleSend} disabled={isMagoTyping || !input.trim()}><Send size={16} /></button>
            </div>
        </>
    );
}

// ============================================================
// POMODORO TAB (pure UI — all state lives in parent FloatingHub)
// ============================================================

interface PomodoroTabProps {
    mode: 'focus' | 'shortBreak' | 'longBreak';
    timeLeft: number;
    isRunning: boolean;
    sessions: number;
    cycle: number;
    onSetMode: (mode: 'focus' | 'shortBreak' | 'longBreak') => void;
    onToggleRunning: () => void;
    onReset: () => void;
}

function PomodoroTab({ mode, timeLeft, isRunning, sessions, cycle, onSetMode, onToggleRunning, onReset }: PomodoroTabProps) {
    const currentMode = POMODORO_MODES.find(m => m.id === mode)!;
    const totalDuration = currentMode.duration;
    const progress = (totalDuration - timeLeft) / totalDuration;
    const circumference = 2 * Math.PI * 80;
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;

    return (
        <>
            <div className="hub-content-header">
                <h3><Timer size={16} style={{ verticalAlign: '-3px', marginRight: '6px' }} /> Pomodoro</h3>
                <span style={{ fontSize: '12px', color: 'var(--hub-text-muted)', fontWeight: 600 }}>
                    {sessions} phiên
                </span>
            </div>
            <div className="hub-content-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {/* Mode selector */}
                <div className="pomodoro-modes">
                    {POMODORO_MODES.map(m => (
                        <button
                            key={m.id}
                            className={mode === m.id ? 'active' : ''}
                            onClick={() => onSetMode(m.id as typeof mode)}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* Timer ring */}
                <div className="pomodoro-ring">
                    <svg viewBox="0 0 176 176">
                        <defs>
                            <linearGradient id="pomodoroGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="var(--accent-color, #3b82f6)" />
                                <stop offset="100%" stopColor="#ec4899" />
                            </linearGradient>
                        </defs>
                        <circle className="ring-bg" cx="88" cy="88" r="80" />
                        <circle
                            className="ring-progress"
                            cx="88" cy="88" r="80"
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - progress)}
                        />
                    </svg>
                    <div className="pomodoro-time">
                        <span className="time">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
                        <span className="label">{currentMode.label}</span>
                    </div>
                </div>

                {/* Cycle indicators */}
                <div className="pomodoro-cycle-dots">
                    {[1, 2, 3, 4].map(dot => (
                        <div
                            key={dot}
                            className={`cycle-dot ${dot <= cycle ? 'filled' : ''} ${dot === (mode === 'focus' ? cycle : -1) ? 'active' : ''}`}
                            title={`Phiên ${dot}/4`}
                        />
                    ))}
                </div>

                {/* Controls */}
                <div className="pomodoro-controls">
                    <button className="btn-secondary" onClick={onReset}>
                        <RotateCcw size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Reset
                    </button>
                    <button className="btn-primary" onClick={onToggleRunning}>
                        {isRunning ? '⏸ Tạm dừng' : '▶ Bắt đầu'}
                    </button>
                </div>
            </div>
        </>
    );
}

function playBeep() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.value = 0.3;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
    } catch { /* Audio not supported */ }
}
// ============================================================
// NOTES TAB — Rich Text with Multiple Notes
// ============================================================

interface NoteItem {
    id: string;
    title: string;
    content: string; // HTML
    color: string;
    createdAt: number;
    updatedAt: number;
}

const NOTE_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];
const TEXT_COLORS = ['#1f2937', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

function NotesTab({ userEmail }: { userEmail: string }) {
    const storageKey = `${NOTES_KEY_PREFIX}${userEmail}`;
    const [notes, setNotes] = useState<NoteItem[]>(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return [];
            // If old format (plain text), migrate
            if (!raw.startsWith('[')) {
                const migrated: NoteItem[] = [{
                    id: Date.now().toString(),
                    title: 'Ghi chú cũ',
                    content: `<p>${raw.replace(/\n/g, '</p><p>')}</p>`,
                    color: '#3b82f6',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                }];
                localStorage.setItem(storageKey, JSON.stringify(migrated));
                return migrated;
            }
            return JSON.parse(raw);
        } catch { return []; }
    });
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const activeNote = notes.find(n => n.id === activeNoteId);

    const saveNotes = useCallback((updatedNotes: NoteItem[]) => {
        setNotes(updatedNotes);
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
            try {
                localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
                setLastSaved(new Date());
            } catch { /* */ }
        }, 400);
    }, [storageKey]);

    const createNote = () => {
        const newNote: NoteItem = {
            id: Date.now().toString(),
            title: 'Ghi chú mới',
            content: '',
            color: NOTE_COLORS[notes.length % NOTE_COLORS.length] || '#3b82f6',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        const updated = [newNote, ...notes];
        saveNotes(updated);
        setActiveNoteId(newNote.id);
    };

    const deleteNote = (id: string) => {
        const updated = notes.filter(n => n.id !== id);
        saveNotes(updated);
        if (activeNoteId === id) setActiveNoteId(null);
    };

    const updateNoteContent = () => {
        if (!activeNote || !editorRef.current) return;
        const html = editorRef.current.innerHTML;
        const updated = notes.map(n =>
            n.id === activeNote.id ? { ...n, content: html, updatedAt: Date.now() } : n
        );
        saveNotes(updated);
    };

    const updateNoteTitle = (id: string, title: string) => {
        const updated = notes.map(n =>
            n.id === id ? { ...n, title, updatedAt: Date.now() } : n
        );
        saveNotes(updated);
    };

    const execCmd = (cmd: string, value?: string) => {
        document.execCommand(cmd, false, value);
        editorRef.current?.focus();
    };

    // Note list view
    if (!activeNoteId) {
        return (
            <>
                <div className="hub-content-header">
                    <h3><StickyNote size={16} style={{ verticalAlign: '-3px', marginRight: '6px' }} /> Ghi chú</h3>
                    <button
                        onClick={createNote}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color, #3b82f6)' }}
                        title="Tạo ghi chú mới"
                    >
                        <Plus size={18} />
                    </button>
                </div>
                <div className="hub-content-body">
                    {notes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--hub-text-muted)' }}>
                            <StickyNote size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                            <p style={{ fontSize: '13px', fontWeight: 600 }}>Chưa có ghi chú</p>
                            <button
                                onClick={createNote}
                                style={{ marginTop: '10px', padding: '8px 18px', borderRadius: '10px', background: 'var(--accent-color, #3b82f6)', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                <Plus size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Tạo ghi chú
                            </button>
                        </div>
                    ) : (
                        <div className="notes-list">
                            {notes.map(note => (
                                <div
                                    key={note.id}
                                    className="note-card"
                                    onClick={() => setActiveNoteId(note.id)}
                                    style={{ borderLeftColor: note.color }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="note-card-title">{note.title}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '2px' }}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    <p className="note-card-preview"
                                        dangerouslySetInnerHTML={{ __html: note.content.replace(/<[^>]+>/g, ' ').slice(0, 60) || 'Trống...' }}
                                    />
                                    <span className="note-card-date">
                                        {new Date(note.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </>
        );
    }

    // Editor view
    return (
        <>
            <div className="hub-content-header">
                <h3>
                    <button onClick={() => setActiveNoteId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                        <ChevronLeft size={18} />
                    </button>
                    <input
                        className="note-title-input"
                        value={activeNote?.title || ''}
                        onChange={e => updateNoteTitle(activeNoteId, e.target.value)}
                        placeholder="Tiêu đề..."
                    />
                </h3>
                {lastSaved && (
                    <span style={{ fontSize: '10px', color: '#10b981', flexShrink: 0 }}>
                        ✓ {lastSaved.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
            {/* Toolbar */}
            <div className="notes-toolbar">
                <button className="notes-tool-btn" onClick={() => execCmd('bold')} title="In đậm"><strong>B</strong></button>
                <button className="notes-tool-btn" onClick={() => execCmd('italic')} title="In nghiêng"><em>I</em></button>
                <button className="notes-tool-btn" onClick={() => execCmd('underline')} title="Gạch chân"><u>U</u></button>
                <div className="notes-tool-divider" />
                <div style={{ position: 'relative' }}>
                    <button
                        className="notes-tool-btn"
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        title="Đổi màu chữ"
                    >
                        <Palette size={14} />
                    </button>
                    {showColorPicker && (
                        <div className="notes-color-dropdown">
                            {TEXT_COLORS.map(c => (
                                <button
                                    key={c}
                                    className="notes-color-swatch"
                                    style={{ background: c }}
                                    onClick={() => { execCmd('foreColor', c); setShowColorPicker(false); }}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <div className="notes-tool-divider" />
                <button className="notes-tool-btn" onClick={() => execCmd('insertUnorderedList')} title="Danh sách">•</button>
            </div>
            <div className="hub-content-body" style={{ padding: '0' }}>
                <div
                    ref={editorRef}
                    className="notes-editor"
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: activeNote?.content || '' }}
                    onInput={updateNoteContent}
                    data-placeholder="Bắt đầu viết ghi chú... ✍️"
                />
            </div>
        </>
    );
}


// ============================================================
// THEME TAB — uses global ThemeContext
// ============================================================

type SubTabId = 'main' | 'appearance' | 'typography' | 'background' | 'behavior';

function ThemeTab() {
    const { settings, updateSetting, resetToDefaults } = useTheme();
    const [activeSubTab, setActiveSubTab] = useState<SubTabId>('main');

    const categories: { id: SubTabId; label: string; icon: any; class: string }[] = [
        { id: 'appearance', label: 'Giao diện', icon: Palette, class: 'icon-bg-appearance' },
        { id: 'typography', label: 'Kiểu chữ', icon: Type, class: 'icon-bg-typography' },
        { id: 'background', label: 'Hình nền', icon: Image, class: 'icon-bg-background' },
        { id: 'behavior', label: 'Hành vi', icon: Settings, class: 'icon-bg-behavior' },
    ];

    if (activeSubTab === 'main') {
        return (
            <>
                <div className="hub-content-header">
                    <h3><Palette size={16} /> Tùy chỉnh</h3>
                    <button
                        onClick={resetToDefaults}
                        title="Đặt lại cài đặt"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                        <RotateCcw size={16} />
                    </button>
                </div>
                <div className="hub-content-body" style={{ background: 'var(--hub-surface-alt)', padding: '16px' }}>
                    <div className="theme-group">
                        {categories.map(cat => (
                            <div key={cat.id} className="theme-category-item" onClick={() => setActiveSubTab(cat.id)}>
                                <div className="theme-category-label">
                                    <div className={`theme-category-icon-wrapper ${cat.class}`}>
                                        <cat.icon size={18} />
                                    </div>
                                    <span>{cat.label}</span>
                                </div>
                                <ChevronRight className="theme-category-chevron" size={18} />
                            </div>
                        ))}
                    </div>

                    {/* Version */}
                    <div style={{ textAlign: 'center', marginTop: 'auto', padding: '16px 0' }}>
                        <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600, letterSpacing: '0.5px' }}>STUDYSTATION v{APP_VERSION}</span>
                    </div>
                </div>
            </>
        );
    }

    const renderSubHeader = (title: string) => (
        <div className="theme-sub-header">
            <button className="theme-back-btn" onClick={() => setActiveSubTab('main')}>
                <ChevronLeft size={20} />
            </button>
            <span className="theme-sub-title">{title}</span>
        </div>
    );

    return (
        <div className="theme-view-container">
            {activeSubTab === 'appearance' && (
                <>
                    {renderSubHeader('Giao diện')}
                    <div className="hub-content-body" style={{ padding: '16px' }}>
                        <div className="theme-group">
                            <div className="theme-item">
                                <div className="theme-item-header">
                                    <label><Moon size={16} /> Chế độ tối</label>
                                    <button
                                        className={`toggle-switch ${settings.mode === 'dark' ? 'on' : ''}`}
                                        onClick={() => updateSetting('mode', settings.mode === 'dark' ? 'light' : 'dark')}
                                    />
                                </div>
                            </div>
                            <div className="theme-item">
                                <div className="theme-item-header has-content">
                                    <label><Palette size={16} /> Màu chủ đạo</label>
                                </div>
                                <div className="color-picker">
                                    {ACCENT_COLORS.map(color => (
                                        <button
                                            key={color}
                                            className={`color-swatch ${settings.accentColor === color ? 'selected' : ''}`}
                                            style={{ background: color, color: color }}
                                            onClick={() => updateSetting('accentColor', color)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeSubTab === 'typography' && (
                <>
                    {renderSubHeader('Kiểu chữ')}
                    <div className="hub-content-body" style={{ padding: '16px' }}>
                        <div className="theme-group">
                            <div className="theme-item">
                                <div className="theme-item-header has-content">
                                    <label><Type size={16} /> Cỡ chữ</label>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {(['small', 'medium', 'large'] as const).map(size => (
                                        <button
                                            key={size}
                                            onClick={() => updateSetting('fontSize', size)}
                                            style={{
                                                flex: 1, padding: '8px', borderRadius: '10px',
                                                border: settings.fontSize === size ? '2px solid var(--accent-color)' : '1.5px solid var(--hub-border)',
                                                background: settings.fontSize === size ? 'rgba(var(--accent-rgb), 0.1)' : 'var(--hub-surface)',
                                                color: settings.fontSize === size ? 'var(--accent-color)' : 'var(--hub-text-muted)',
                                                fontWeight: 700, fontSize: size === 'small' ? '11px' : size === 'large' ? '14px' : '12px',
                                                cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                        >
                                            {size === 'small' ? 'Nhỏ' : size === 'medium' ? 'Vừa' : 'Lớn'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="theme-item">
                                <div className="theme-item-header has-content">
                                    <label><Type size={16} /> Phông chữ</label>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {(['Be Vietnam Pro', 'Roboto', 'Times New Roman', 'Montserrat (Đậm)'] as const).map(font => (
                                        <button
                                            key={font}
                                            onClick={() => updateSetting('fontFamily', font)}
                                            style={{
                                                padding: '10px 14px', borderRadius: '10px', textAlign: 'left',
                                                border: settings.fontFamily === font ? '2.5px solid var(--accent-color)' : '1.5px solid var(--hub-border)',
                                                background: settings.fontFamily === font ? 'rgba(var(--accent-rgb), 0.05)' : 'var(--hub-surface)',
                                                color: settings.fontFamily === font ? 'var(--accent-color)' : 'var(--hub-text)',
                                                fontWeight: font.includes('Montserrat') ? 800 : 600,
                                                fontFamily: font.replace(' (Đậm)', ''), fontSize: '13px',
                                                cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                        >
                                            {font} {settings.fontFamily === font && '✓'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="theme-item">
                                <div className="theme-item-header has-content">
                                    <label>📄 Giãn cách: <b>{settings.examPadding === 'compact' ? 'Gọn' : settings.examPadding === 'normal' ? 'Vừa' : 'Rộng'}</b></label>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {(['compact', 'normal', 'spacious'] as const).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => updateSetting('examPadding', p)}
                                            style={{
                                                flex: 1, padding: '8px', borderRadius: '10px',
                                                border: settings.examPadding === p ? '2px solid var(--accent-color)' : '1.5px solid var(--hub-border)',
                                                background: settings.examPadding === p ? 'rgba(var(--accent-rgb), 0.1)' : 'var(--hub-surface)',
                                                color: settings.examPadding === p ? 'var(--accent-color)' : 'var(--hub-text-muted)',
                                                fontWeight: 700, fontSize: '12px',
                                                cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                        >
                                            {p === 'compact' ? 'Gọn' : p === 'normal' ? 'Vừa' : 'Rộng'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeSubTab === 'background' && (
                <>
                    {renderSubHeader('Hình nền học tập')}
                    <div className="hub-content-body" style={{ padding: '16px' }}>
                        <div className="theme-group">
                            <div className="theme-item">
                                <div className="theme-item-header has-content">
                                    <label><Image size={16} /> Hình nền tùy chỉnh</label>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <input
                                            placeholder="Link ảnh (.jpg, .png...)"
                                            value={settings.customBackground || ''}
                                            onChange={e => updateSetting('customBackground', e.target.value)}
                                            style={{
                                                flex: 1, padding: '10px 14px', borderRadius: '10px',
                                                border: '1.5px solid var(--hub-border)', fontSize: '12px', outline: 'none',
                                                background: 'var(--hub-surface-alt)',
                                                color: 'var(--hub-text)'
                                            }}
                                        />
                                        {settings.customBackground && (
                                            <button
                                                onClick={() => updateSetting('customBackground', undefined)}
                                                style={{
                                                    padding: '8px', borderRadius: '10px', background: '#fee2e2',
                                                    color: '#ef4444', border: 'none', cursor: 'pointer'
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ position: 'relative', width: '100%', height: '38px', borderRadius: '10px', border: '1.5px dashed var(--hub-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--hub-text-muted)', cursor: 'pointer', background: 'var(--hub-surface)' }}>
                                        <input
                                            type="file" accept="image/*"
                                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = (ev) => updateSetting('customBackground', ev.target?.result as string);
                                                reader.readAsDataURL(file);
                                            }}
                                        />
                                        <Upload size={14} style={{ marginRight: '6px' }} /> Tải ảnh từ máy
                                    </div>
                                </div>
                            </div>
                            
                            {settings.customBackground && (
                                <>
                                    <div className="theme-item">
                                        <div className="theme-item-header">
                                            <label><Image size={16} /> Hiện khi làm bài</label>
                                            <button
                                                className={`toggle-switch ${settings.bgEnabled !== false ? 'on' : ''}`}
                                                onClick={() => updateSetting('bgEnabled', settings.bgEnabled !== false ? false : true)}
                                            />
                                        </div>
                                    </div>
                                    {settings.bgEnabled !== false && (
                                        <>
                                            <div className="theme-item">
                                                <div className="theme-item-header has-content">
                                                    <label>🌫️ Độ trong suốt: <b>{Math.round((settings.bgOpacity ?? 1) * 100)}%</b></label>
                                                </div>
                                                <input
                                                    type="range" min={10} max={100} step={5}
                                                    value={Math.round((settings.bgOpacity ?? 1) * 100)}
                                                    onChange={e => updateSetting('bgOpacity', parseInt(e.target.value) / 100)}
                                                    style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                                                />
                                            </div>
                                            <div className="theme-item">
                                                <div className="theme-item-header has-content">
                                                    <label>🌑 Độ tối: <b>{Math.round((settings.bgDarkness ?? 0) * 100)}%</b></label>
                                                </div>
                                                <input
                                                    type="range" min={0} max={90} step={5}
                                                    value={Math.round((settings.bgDarkness ?? 0) * 100)}
                                                    onChange={e => updateSetting('bgDarkness', parseInt(e.target.value) / 100)}
                                                    style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}

            {activeSubTab === 'behavior' && (
                <>
                    {renderSubHeader('Hành vi')}
                    <div className="hub-content-body" style={{ padding: '16px' }}>
                        <div className="theme-group">
                            <div className="theme-item">
                                <div className="theme-item-header">
                                    <label><Settings size={16} /> Tự ẩn Hub khi thi</label>
                                    <button
                                        className={`toggle-switch ${settings.autoHideHub !== false ? 'on' : ''}`}
                                        onClick={() => updateSetting('autoHideHub', settings.autoHideHub !== false ? false : true)}
                                    />
                                </div>
                            </div>
                            <div className="theme-item">
                                <div className="theme-item-header">
                                    <label><Sparkles size={16} /> Tự chạy Flashcard</label>
                                    <button
                                        className={`toggle-switch ${settings.autoSkipLearn ? 'on' : ''}`}
                                        onClick={() => updateSetting('autoSkipLearn', !settings.autoSkipLearn)}
                                    />
                                </div>
                            </div>
                            <div className="theme-item">
                                <div className="theme-item-header">
                                    <label><Music size={16} /> Đổi nền theo nhạc</label>
                                    <button
                                        className={`toggle-switch ${settings.enableMusicBackground ? 'on' : ''}`}
                                        onClick={() => updateSetting('enableMusicBackground', !settings.enableMusicBackground)}
                                    />
                                </div>
                            </div>
                            {settings.autoSkipLearn && (
                                <div className="theme-item">
                                    <div className="theme-item-header has-content">
                                        <label>⏱️ Thời gian chờ: <b>{settings.autoSkipLearnDuration}s</b></label>
                                    </div>
                                    <input
                                        type="range" min={0.25} max={10} step={0.25}
                                        value={settings.autoSkipLearnDuration}
                                        onChange={e => updateSetting('autoSkipLearnDuration', parseFloat(e.target.value))}
                                        style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Designer Credit at the bottom of Theme Tab */}
            <div style={{ 
                marginTop: '12px', 
                padding: '16px', 
                borderTop: '1px border-dashed var(--hub-border)', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '4px',
                opacity: 0.6
            }}>
                <p style={{ 
                    fontSize: '9px', 
                    fontWeight: 800, 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px', 
                    color: 'var(--hub-text-muted)' 
                }}>
                    Design & Development
                </p>
                <a 
                    href="mailto:studystation.auth@gmail.com"
                    style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        color: 'var(--accent-color)', 
                        textDecoration: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Nguyễn Trọng Phúc <ExternalLink size={10} />
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.8 }}>studystation.auth@gmail.com</span>
                </a>
            </div>
        </div>
    );
}

// ============================================================
// MUSIC TAB
// ============================================================

function MusicTab({ currentSong, isPlaying, onTogglePlay, onPlaySong, currentTime, duration, onSeek }: { 
    currentSong: typeof LOFI_TRACKS[0] | null, 
    isPlaying: boolean, 
    onTogglePlay: () => void, 
    onPlaySong: (song: typeof LOFI_TRACKS[0]) => void,
    currentTime: number,
    duration: number,
    onSeek: (time: number) => void
}) {
    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <>
            <div className="hub-content-header">
                <h3><Music size={16} /> Âm nhạc</h3>
            </div>
            <div className="hub-content-body">
                {/* Active Player Card */}
                {currentSong && (
                    <div className="music-active-card">
                        <div className="music-active-cover">
                            <img src={currentSong.cover} alt="" />
                            {isPlaying && (
                                <div className="music-playing-indicator">
                                    <div className="bar" /><div className="bar" /><div className="bar" />
                                </div>
                            )}
                        </div>
                        <div className="music-active-info">
                            <p className="music-active-title">{currentSong.title}</p>
                            <p className="music-active-artist">{currentSong.artist}</p>
                            
                            <div className="music-active-controls">
                                <button className="music-control-btn" onClick={onTogglePlay}>
                                    {isPlaying ? <span style={{fontSize: '18px'}}>⏸</span> : <span style={{fontSize: '18px'}}>▶</span>}
                                </button>
                                <div className="music-progress-wrap">
                                    <input 
                                        type="range" 
                                        min={0} 
                                        max={duration || 100} 
                                        value={currentTime} 
                                        onChange={(e) => onSeek(parseFloat(e.target.value))}
                                        className="music-progress-slider"
                                    />
                                    <div className="music-time-labels">
                                        <span>{formatTime(currentTime)}</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <p className="music-section-label">Danh sách phát Lofi</p>
                <div className="music-playlist-list">
                    {LOFI_TRACKS.map(track => (
                        <div 
                            key={track.id} 
                            className={`music-playlist-item ${currentSong?.id === track.id ? 'active' : ''}`}
                            onClick={() => onPlaySong(track)}
                        >
                            <div className="music-item-cover">
                                <img src={track.cover} alt="" />
                                {currentSong?.id === track.id && isPlaying && <div className="item-playing-overlay">⏸</div>}
                            </div>
                            <div className="music-item-info">
                                <p className="music-item-title">{track.title}</p>
                                <p className="music-item-artist">{track.artist}</p>
                            </div>
                            {currentSong?.id === track.id && <div className="music-active-dot" />}
                        </div>
                    ))}
                </div>

                <div className="music-tip">
                    <Sparkles size={12} /> Nhạc sẽ tiếp tục phát khi bạn đóng Flow.
                </div>
            </div>
        </>
    );
}

export default FloatingHub;
