/**
 * FloatingHub — Premium draggable floating action button with multi-tab panel
 * Features: Chat (Friends + Mago AI), Pomodoro Timer, Notes, Study Tracker, Music, Theme
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle,
    Timer,
    StickyNote,
    BarChart3,
    Palette,
    Send,
    Plus,
    X,
    RotateCcw,
    UserPlus,
    ChevronLeft,
    Check,
    Trash2,
    Sparkles,
    Music,
    ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
    subscribeFriends,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    sendChatMessage,
    subscribeToMessages,
    sendMagoMessage,
    saveMagoResponse,
    subscribeToMagoMessages,
    getConversationId,
    MAGO_SYSTEM_PROMPT,
    subscribeFriendPresence,
    subscribeToAllConvos,
} from '@/services/chat.service';
import { generateAIContent, type AIChatMessage } from '@/services/ai.service';
import type { ChatMessage, Friend } from '@/types';
import './FloatingHub.css';

// ============================================================
// CONSTANTS
// ============================================================
type TabId = 'chat' | 'pomodoro' | 'notes' | 'study' | 'music' | 'theme';

const TABS: { id: TabId; icon: typeof MessageCircle; label: string }[] = [
    { id: 'chat', icon: MessageCircle, label: 'Chat' },
    { id: 'pomodoro', icon: Timer, label: 'Pomodoro' },
    { id: 'notes', icon: StickyNote, label: 'Ghi chú' },
    { id: 'study', icon: BarChart3, label: 'Học tập' },
    { id: 'music', icon: Music, label: 'Nhạc' },
    { id: 'theme', icon: Palette, label: 'Giao diện' },
];

const POMODORO_MODES = [
    { id: 'focus', label: 'Tập trung', duration: 25 * 60 },
    { id: 'shortBreak', label: 'Nghỉ ngắn', duration: 5 * 60 },
    { id: 'longBreak', label: 'Nghỉ dài', duration: 15 * 60 },
] as const;

const ACCENT_COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const FAB_STORAGE_KEY = 'hub_fab_position';
const NOTES_KEY_PREFIX = 'hub_notes_';
const THEME_KEY = 'hub_theme';
const POMODORO_SESSIONS_KEY = 'hub_pomodoro_sessions';
const MUSIC_LINKS_KEY = 'hub_music_links';

// ============================================================
// MAIN COMPONENT
// ============================================================

export function FloatingHub() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('chat');
    const [fabPos, setFabPos] = useState(() => {
        try {
            const saved = localStorage.getItem(FAB_STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return { x: window.innerWidth - 72, y: window.innerHeight - 120 };
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
    const pomodoroInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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
                            return next;
                        });
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
        const fabW = 52;
        const fabH = 52;
        return {
            x: Math.max(0, Math.min(x, window.innerWidth - fabW)),
            y: Math.max(0, Math.min(y, window.innerHeight - fabH)),
        };
    }, []);

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
    const fabCenterX = fabPos.x + 26;
    const fabCenterY = fabPos.y + 26;
    const isOnLeft = fabCenterX < window.innerWidth / 2;
    const isOnTop = fabCenterY < window.innerHeight / 2;

    const panelW = 380;
    const panelGap = 10;

    const panelStyle: React.CSSProperties = {};

    // Horizontal: open toward the side with more space
    if (isOnLeft) {
        panelStyle.left = Math.max(8, Math.min(fabPos.x, window.innerWidth - panelW - 8));
    } else {
        panelStyle.right = Math.max(8, Math.min(window.innerWidth - fabPos.x - 52, window.innerWidth - panelW - 8));
    }

    // Vertical: open below if FAB is on top half, above if on bottom half
    if (isOnTop) {
        panelStyle.top = fabPos.y + 52 + panelGap;
    } else {
        panelStyle.bottom = Math.max(8, window.innerHeight - fabPos.y + panelGap);
    }

    // Panel position class for transform-origin animation
    const panelPosClass = `panel-${isOnTop ? 'top' : 'bottom'}-${isOnLeft ? 'left' : 'right'}`;

    if (!user) return null;

    // Format time for FAB display
    const fabMins = Math.floor(pomodoroTimeLeft / 60);
    const fabSecs = pomodoroTimeLeft % 60;
    const fabTimeStr = `${String(fabMins).padStart(2, '0')}:${String(fabSecs).padStart(2, '0')}`;
    const showTimerOnFab = pomodoroRunning && !isOpen;
    const fabTimerProgress = pomodoroRunning
        ? (POMODORO_MODES.find(m => m.id === pomodoroMode)!.duration - pomodoroTimeLeft) / POMODORO_MODES.find(m => m.id === pomodoroMode)!.duration
        : 0;
    const fabRingCircumference = 2 * Math.PI * 28; // r=28 for 52px FAB (with some padding)

    return (
        <>
            {/* FAB */}
            <button
                ref={fabRef}
                className={`hub-fab ${isDragging ? 'dragging' : ''} ${isOpen ? 'open' : ''} ${showTimerOnFab ? 'timer-active' : ''}`}
                style={{ left: fabPos.x, top: fabPos.y }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
            >
                {/* SVG Progress Ring Overlay (Pomodoro active) */}
                {showTimerOnFab && (
                    <svg className="fab-timer-ring" viewBox="0 0 60 60" width="60" height="60">
                        <circle className="fab-ring-bg" cx="30" cy="30" r="28" />
                        <circle
                            className="fab-ring-progress"
                            cx="30" cy="30" r="28"
                            strokeDasharray={fabRingCircumference}
                            strokeDashoffset={fabRingCircumference * (1 - fabTimerProgress)}
                        />
                    </svg>
                )}
                {isOpen ? (
                    <X className="hub-fab-icon" size={20} />
                ) : showTimerOnFab ? (
                    <span className="hub-fab-timer">{fabTimeStr}</span>
                ) : (
                    <Sparkles className="hub-fab-icon" size={20} />
                )}
                {/* Unread badge on FAB */}
                {chatUnreadCount > 0 && !isOpen && (
                    <span className="hub-fab-badge">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</span>
                )}
            </button>


            {/* Panel */}
            {isOpen && (
                <div className={`hub-panel ${panelPosClass}`} style={panelStyle}>
                    {/* Sidebar tabs */}
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
                                onSetMode={(m) => { setPomodoroMode(m); setPomodoroRunning(false); setPomodoroTimeLeft(POMODORO_MODES.find(p => p.id === m)!.duration); }}
                                onToggleRunning={() => setPomodoroRunning(r => !r)}
                                onReset={() => { setPomodoroRunning(false); setPomodoroTimeLeft(POMODORO_MODES.find(p => p.id === pomodoroMode)!.duration); }}
                            />
                        )}
                        {activeTab === 'notes' && <NotesTab userEmail={user.email} />}
                        {activeTab === 'study' && <StudyTrackerTab userEmail={user.email} />}
                        {activeTab === 'music' && <MusicTab />}
                        {activeTab === 'theme' && <ThemeTab />}
                    </div>
                </div>
            )}
        </>
    );
}

// ============================================================
// CHAT TAB — with online status, unread badges, Mago AI fallback
// ============================================================

const CHAT_READ_KEY = 'hub_chat_read_timestamps'; // localStorage key for read tracking

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
    const [magoLocalMessages, setMagoLocalMessages] = useState<ChatMessage[]>([]);
    const [magoRtdbFailed, setMagoRtdbFailed] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Read timestamps from localStorage
    const getReadTimestamps = useCallback((): Record<string, number> => {
        try { return JSON.parse(localStorage.getItem(CHAT_READ_KEY) || '{}'); } catch { return {}; }
    }, []);

    const markAsRead = useCallback((chatId: string) => {
        const ts = getReadTimestamps();
        ts[chatId] = Date.now();
        localStorage.setItem(CHAT_READ_KEY, JSON.stringify(ts));
    }, [getReadTimestamps]);

    // Subscribe to friends
    useEffect(() => {
        const unsub = subscribeFriends(setFriends);
        return () => unsub();
    }, []);

    // Subscribe to friend presence
    useEffect(() => {
        const acceptedEmails = friends.filter(f => f.status === 'accepted').map(f => f.email);
        if (!acceptedEmails.length) { setOnlineMap({}); return; }
        const unsub = subscribeFriendPresence(acceptedEmails, setOnlineMap);
        return () => unsub();
    }, [friends]);

    // Subscribe to messages (with Mago RTDB fallback)
    useEffect(() => {
        if (!activeChat) return;

        if (activeChat === 'mago') {
            if (magoRtdbFailed) {
                setMessages(magoLocalMessages);
                return;
            }
            try {
                const unsub = subscribeToMagoMessages((msgs) => {
                    setMessages(msgs);
                    setMagoRtdbFailed(false);
                });
                return () => unsub();
            } catch {
                setMagoRtdbFailed(true);
                setMessages(magoLocalMessages);
                return;
            }
        }

        const convId = getConversationId(user.email, activeChat);
        const unsub = subscribeToMessages(convId, setMessages);
        return () => unsub();
    }, [activeChat, user.email, magoRtdbFailed, magoLocalMessages]);

    // Mark active chat as read
    useEffect(() => {
        if (activeChat) markAsRead(activeChat);
    }, [activeChat, messages, markAsRead]);

    // Subscribe to all conversations last messages in one go (more efficient/stable)
    useEffect(() => {
        const unsub = subscribeToAllConvos((updates) => {
            setLastMessages(prev => ({ ...prev, ...updates }));
        });
        return () => unsub();
    }, [user.email]);

    // Compute unread count and notify parent
    useEffect(() => {
        const readTs = getReadTimestamps();
        let total = 0;

        // Mago unread
        const magoLast = lastMessages['mago'];
        if (magoLast && magoLast.role === 'mago') {
            const lastRead = readTs['mago'] || 0;
            if (magoLast.timestamp > lastRead) total++;
        }

        // Friend unreads
        for (const f of friends.filter(f => f.status === 'accepted')) {
            const last = lastMessages[f.email];
            if (last && last.senderEmail !== user.email) {
                const lastRead = readTs[f.email] || 0;
                if (last.timestamp > lastRead) total++;
            }
        }

        onUnreadChange?.(total);
    }, [lastMessages, friends, user.email, getReadTimestamps, onUnreadChange]);

    // Auto scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !activeChat) return;
        const text = input.trim();
        setInput('');

        if (activeChat === 'mago') {
            // Try RTDB first, fallback to local
            const userMsg: ChatMessage = {
                id: `local_${Date.now()}`,
                text,
                senderEmail: user.email,
                senderName: user.displayName || 'User',
                timestamp: Date.now(),
                role: 'user',
            };

            try {
                await sendMagoMessage(text);
            } catch {
                setMagoRtdbFailed(true);
                setMagoLocalMessages(prev => [...prev, userMsg]);
                setMessages(prev => [...prev, userMsg]);
            }

            setIsMagoTyping(true);

            try {
                // Build conversation history
                const recentMsgs = messages.slice(-8);
                const history: AIChatMessage[] = recentMsgs.map(msg => ({
                    role: msg.role === 'mago' ? 'model' as const : 'user' as const,
                    parts: [{ text: msg.text }],
                }));
                history.push({ role: 'user', parts: [{ text }] });

                const response = await generateAIContent(history, {
                    temperature: 0.8,
                    maxOutputTokens: 500,
                    systemInstruction: MAGO_SYSTEM_PROMPT,
                });

                if (response) {
                    try {
                        await saveMagoResponse(response);
                    } catch {
                        // RTDB failed, save locally
                        const aiMsg: ChatMessage = {
                            id: `local_ai_${Date.now()}`,
                            text: response,
                            senderEmail: 'mago@studystation.site',
                            senderName: 'Mago ✨',
                            timestamp: Date.now(),
                            role: 'mago',
                        };
                        setMagoRtdbFailed(true);
                        setMagoLocalMessages(prev => [...prev, aiMsg]);
                        setMessages(prev => [...prev, aiMsg]);
                    }
                }
            } catch (err) {
                console.error('[Mago] AI error:', err);
                const errorMsg: ChatMessage = {
                    id: `local_err_${Date.now()}`,
                    text: 'Xin lỗi, tôi đang gặp sự cố. Bạn thử lại sau nhé! 😢',
                    senderEmail: 'mago@studystation.site',
                    senderName: 'Mago ✨',
                    timestamp: Date.now(),
                    role: 'mago',
                };
                try { await saveMagoResponse(errorMsg.text); } catch {
                    setMagoLocalMessages(prev => [...prev, errorMsg]);
                    setMessages(prev => [...prev, errorMsg]);
                }
            } finally {
                setIsMagoTyping(false);
            }
        } else {
            const convId = getConversationId(user.email, activeChat);
            await sendChatMessage(convId, text);
        }
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

    // ── Chat list view ──
    if (!activeChat) {
        return (
            <>
                <div className="hub-content-header">
                    <h3>💬 Chat</h3>
                    <button
                        onClick={() => setShowAddFriend(true)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b5cf6' }}
                    >
                        <UserPlus size={18} />
                    </button>
                </div>
                <div className="hub-content-body">
                    {/* Add friend modal */}
                    {showAddFriend && (
                        <div className="chat-add-friend-modal">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>Thêm bạn bè</span>
                                <button onClick={() => setShowAddFriend(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <X size={14} />
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                    type="email"
                                    placeholder="Nhập email..."
                                    value={friendEmail}
                                    onChange={e => { setFriendEmail(e.target.value); setFriendError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
                                    className="chat-add-friend-input"
                                />
                                <button onClick={handleAddFriend} className="chat-add-friend-btn">Gửi</button>
                            </div>
                            {friendError && <p className="chat-add-friend-error">{friendError}</p>}
                        </div>
                    )}

                    {/* Pending requests */}
                    {pendingReceived.length > 0 && (
                        <div className="chat-section">
                            <p className="chat-section-label">Lời mời kết bạn</p>
                            {pendingReceived.map(f => (
                                <div key={f.email} className="chat-contact-item pending">
                                    <div className="chat-contact-avatar" style={{ background: '#f59e0b', color: 'white' }}>
                                        {f.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="chat-contact-info">
                                        <p className="chat-contact-name">{f.displayName}</p>
                                        <p className="chat-contact-preview">{f.email}</p>
                                    </div>
                                    <button onClick={() => acceptFriendRequest(f.email)} className="chat-accept-btn">
                                        <Check size={14} />
                                    </button>
                                    <button onClick={() => removeFriend(f.email)} className="chat-reject-btn">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Mago AI — pinned */}
                    <div className="chat-contact-item mago" onClick={() => setActiveChat('mago')}>
                        <div className="chat-contact-avatar mago-avatar">🧙</div>
                        <div className="chat-contact-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="chat-contact-name">Mago</span>
                                <span className="chat-ai-badge">AI ✨</span>
                            </div>
                            <p className="chat-contact-preview">
                                {lastMessages['mago']?.text || 'Trợ lý học tập thông minh'}
                            </p>
                        </div>
                        <div className="chat-contact-meta">
                            {lastMessages['mago'] && (
                                <span className="chat-contact-time">{formatTimeAgo(lastMessages['mago'].timestamp)}</span>
                            )}
                        </div>
                    </div>

                    {/* Friends list */}
                    {friends.filter(f => f.status === 'accepted').length > 0 && (
                        <div className="chat-section">
                            <p className="chat-section-label">Bạn bè</p>
                            {friends.filter(f => f.status === 'accepted').map(f => {
                                const last = lastMessages[f.email];
                                const isOnline = onlineMap[f.email.toLowerCase()] || false;
                                const lastRead = readTs[f.email] || 0;
                                const hasUnread = last && last.senderEmail !== user.email && last.timestamp > lastRead;
                                return (
                                    <div key={f.email} className={`chat-contact-item ${hasUnread ? 'unread' : ''}`} onClick={() => setActiveChat(f.email)}>
                                        <div className="chat-contact-avatar-wrap">
                                            <div className="chat-contact-avatar" style={{ background: '#e0e7ff', color: '#4f46e5', overflow: 'hidden' }}>
                                                {f.photoURL ? <img src={f.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : f.displayName.charAt(0).toUpperCase()}
                                            </div>
                                            <span className={`chat-status-dot ${isOnline ? 'online' : 'offline'}`} />
                                        </div>
                                        <div className="chat-contact-info">
                                            <p className={`chat-contact-name ${hasUnread ? 'bold' : ''}`}>{f.displayName}</p>
                                            <p className={`chat-contact-preview ${hasUnread ? 'unread-text' : ''}`}>
                                                {last ? (last.senderEmail === user.email ? `Bạn: ${last.text}` : last.text) : f.email}
                                            </p>
                                        </div>
                                        <div className="chat-contact-meta">
                                            {last && <span className="chat-contact-time">{formatTimeAgo(last.timestamp)}</span>}
                                            {hasUnread && <span className="chat-unread-dot" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Sent requests */}
                    {friends.filter(f => f.status === 'pending_sent').length > 0 && (
                        <div className="chat-section">
                            <p className="chat-section-label">Đã gửi lời mời</p>
                            {friends.filter(f => f.status === 'pending_sent').map(f => (
                                <div key={f.email} className="chat-contact-item sent-request">
                                    <div className="chat-contact-avatar" style={{ background: '#f3f4f6', color: '#9ca3af' }}>
                                        {f.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="chat-contact-info">
                                        <p className="chat-contact-name" style={{ color: '#6b7280' }}>{f.email}</p>
                                        <p className="chat-contact-preview">Đang chờ chấp nhận...</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {friends.filter(f => f.status === 'accepted').length === 0 && friends.filter(f => f.status === 'pending_sent').length === 0 && (
                        <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af' }}>
                            <UserPlus size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                            <p style={{ fontSize: '12px' }}>Thêm bạn bè bằng email</p>
                            <button
                                onClick={() => setShowAddFriend(true)}
                                style={{ marginTop: '8px', padding: '6px 16px', borderRadius: '8px', background: '#8b5cf6', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
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
    const chatPartner = activeChat === 'mago' ? null : friends.find(f => f.email === activeChat);
    const chatPartnerName = activeChat === 'mago' ? 'Mago' : chatPartner?.displayName || activeChat;
    const isPartnerOnline = activeChat !== 'mago' && onlineMap[activeChat.toLowerCase()];

    return (
        <>
            <div className="hub-content-header chat-conv-header">
                <button onClick={() => setActiveChat(null)} className="chat-back-btn">
                    <ChevronLeft size={18} />
                </button>
                <div className="chat-header-info">
                    {activeChat === 'mago' ? (
                        <div className="chat-header-avatar mago-avatar" style={{ width: 28, height: 28, fontSize: 14 }}>🧙</div>
                    ) : (
                        <div className="chat-contact-avatar-wrap" style={{ width: 28, height: 28 }}>
                            <div className="chat-header-avatar" style={{ background: '#e0e7ff', color: '#4f46e5', width: 28, height: 28, fontSize: 11, overflow: 'hidden' }}>
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
                        <p className="chat-header-status">
                            {activeChat === 'mago' ? 'Luôn sẵn sàng ✨' : isPartnerOnline ? '🟢 Đang hoạt động' : '⚫ Không hoạt động'}
                        </p>
                    </div>
                </div>
            </div>
            <div className="hub-content-body">
                {messages.length === 0 && activeChat === 'mago' && (
                    <div className="chat-empty-state">
                        <div style={{ fontSize: '40px', marginBottom: '8px' }}>🧙‍♂️</div>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#4c1d95' }}>Xin chào! Tôi là Mago</p>
                        <p style={{ fontSize: '12px', marginTop: '4px', color: '#7c3aed' }}>Hỏi tôi bất cứ điều gì về StudyStation nhé! ✨</p>
                    </div>
                )}
                {messages.map(msg => {
                    const isSent = msg.senderEmail === user.email;
                    const isMago = msg.role === 'mago';
                    return (
                        <div key={msg.id} className={`chat-message ${isSent ? 'sent' : 'received'} ${isMago ? 'mago' : ''}`}>
                            {!isSent && (
                                <div className="chat-avatar" style={isMago ? { background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' } : { overflow: 'hidden' }}>
                                    {isMago ? '🧙' : (() => {
                                        const partner = friends.find(f => f.email === msg.senderEmail);
                                        return partner?.photoURL
                                            ? <img src={partner.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : msg.senderName.charAt(0).toUpperCase();
                                    })()}
                                </div>
                            )}
                            <div>
                                <div className="chat-bubble">
                                    {msg.text}
                                </div>
                                <span className={`chat-msg-time ${isSent ? 'sent' : ''}`}>{formatMsgTime(msg.timestamp)}</span>
                            </div>
                        </div>
                    );
                })}
                {isMagoTyping && (
                    <div className="chat-message received mago">
                        <div className="chat-avatar" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>🧙</div>
                        <div className="chat-bubble typing-indicator">
                            <span className="typing-dot" />
                            <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
                            <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-bar">
                <input
                    type="text"
                    placeholder={activeChat === 'mago' ? 'Hỏi Mago...' : 'Nhắn tin...'}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    disabled={isMagoTyping}
                />
                <button onClick={handleSend} disabled={isMagoTyping || !input.trim()}>
                    <Send size={16} />
                </button>
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
    onSetMode: (mode: 'focus' | 'shortBreak' | 'longBreak') => void;
    onToggleRunning: () => void;
    onReset: () => void;
}

function PomodoroTab({ mode, timeLeft, isRunning, sessions, onSetMode, onToggleRunning, onReset }: PomodoroTabProps) {
    const currentMode = POMODORO_MODES.find(m => m.id === mode)!;
    const totalDuration = currentMode.duration;
    const progress = (totalDuration - timeLeft) / totalDuration;
    const circumference = 2 * Math.PI * 80;
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;

    return (
        <>
            <div className="hub-content-header">
                <h3>⏱️ Pomodoro</h3>
                <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600 }}>
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
                                <stop offset="0%" stopColor="#8b5cf6" />
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
                    color: '#8b5cf6',
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
            color: NOTE_COLORS[notes.length % NOTE_COLORS.length] || '#8b5cf6',
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
                    <h3>📝 Ghi chú</h3>
                    <button
                        onClick={createNote}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b5cf6' }}
                        title="Tạo ghi chú mới"
                    >
                        <Plus size={18} />
                    </button>
                </div>
                <div className="hub-content-body">
                    {notes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                            <StickyNote size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                            <p style={{ fontSize: '13px', fontWeight: 600 }}>Chưa có ghi chú</p>
                            <button
                                onClick={createNote}
                                style={{ marginTop: '10px', padding: '8px 18px', borderRadius: '10px', background: '#8b5cf6', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
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
// STUDY TRACKER TAB
// ============================================================

function StudyTrackerTab({ userEmail }: { userEmail: string }) {
    const [stats, setStats] = useState({ totalExams: 0, avgScore: 0, streak: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch practice history from Firestore
        async function fetchStats() {
            try {
                const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
                const { db } = await import('@/config/firebase');

                const q = query(
                    collection(db, 'practice_logs'),
                    where('userEmail', '==', userEmail),
                    orderBy('timestamp', 'desc')
                );
                const snap = await getDocs(q);
                const logs = snap.docs.map(d => d.data());

                let totalScore = 0;
                let scored = 0;
                for (const log of logs) {
                    if (typeof log.score === 'number') {
                        totalScore += log.score;
                        scored++;
                    }
                }

                // Calculate streak (consecutive days with activity)
                const days = new Set(logs.map(l => {
                    const d = new Date(l.timestamp as string);
                    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                }));

                let streak = 0;
                const today = new Date();
                for (let i = 0; i < 365; i++) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                    if (days.has(key)) streak++;
                    else if (i > 0) break;
                }

                setStats({
                    totalExams: logs.length,
                    avgScore: scored > 0 ? Math.round(totalScore / scored * 10) / 10 : 0,
                    streak,
                });
            } catch (err) {
                console.warn('[StudyTracker] Error:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, [userEmail]);

    return (
        <>
            <div className="hub-content-header">
                <h3>📊 Theo dõi học tập</h3>
            </div>
            <div className="hub-content-body">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                        <div style={{ fontSize: '24px', animation: 'hubPulse 1.5s ease-in-out infinite' }}>📊</div>
                        <p style={{ fontSize: '12px', marginTop: '8px' }}>Đang tải...</p>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                            <div className="stat-card">
                                <div className="stat-value">{stats.totalExams}</div>
                                <div className="stat-label">Bài thi</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{stats.avgScore}</div>
                                <div className="stat-label">Điểm TB</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{stats.streak}</div>
                                <div className="stat-label">Streak 🔥</div>
                            </div>
                        </div>

                        {stats.totalExams === 0 && (
                            <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af' }}>
                                <p style={{ fontSize: '28px', marginBottom: '8px' }}>📚</p>
                                <p style={{ fontSize: '12px' }}>Chưa có dữ liệu học tập.</p>
                                <p style={{ fontSize: '11px', marginTop: '4px' }}>Hãy làm bài thi để bắt đầu theo dõi!</p>
                            </div>
                        )}

                        {stats.totalExams > 0 && (
                            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '14px', marginTop: '8px' }}>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Tóm tắt</p>
                                <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.8 }}>
                                    Bạn đã hoàn thành <strong style={{ color: '#8b5cf6' }}>{stats.totalExams}</strong> bài thi
                                    với điểm trung bình <strong style={{ color: '#8b5cf6' }}>{stats.avgScore}</strong>.
                                    {stats.streak > 0 && <> Streak hiện tại: <strong style={{ color: '#f59e0b' }}>{stats.streak}</strong> ngày liên tiếp 🔥</>}
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

// ============================================================
// THEME TAB
// ============================================================

function ThemeTab() {
    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem(THEME_KEY);
            if (saved) return JSON.parse(saved);
        } catch { /* */ }
        return { mode: 'light', accentColor: '#8b5cf6', fontSize: 'medium' };
    });

    const updateSetting = (key: string, value: string) => {
        const updated = { ...settings, [key]: value };
        setSettings(updated);
        try { localStorage.setItem(THEME_KEY, JSON.stringify(updated)); } catch { /* */ }

        // Apply theme changes to document
        if (key === 'mode') {
            document.documentElement.classList.toggle('dark', value === 'dark');
        }
        if (key === 'fontSize') {
            const sizes: Record<string, string> = { small: '14px', medium: '16px', large: '18px' };
            document.documentElement.style.fontSize = sizes[value] || '16px';
        }
        if (key === 'accentColor') {
            document.documentElement.style.setProperty('--accent-color', value);
        }
    };

    return (
        <>
            <div className="hub-content-header">
                <h3>🎨 Tùy chỉnh</h3>
            </div>
            <div className="hub-content-body">
                {/* Dark mode toggle */}
                <div className="theme-option">
                    <label>🌙 Chế độ tối</label>
                    <button
                        className={`toggle-switch ${settings.mode === 'dark' ? 'on' : ''}`}
                        onClick={() => updateSetting('mode', settings.mode === 'dark' ? 'light' : 'dark')}
                    />
                </div>

                {/* Accent color */}
                <div className="theme-option" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <label>🎨 Màu chủ đạo</label>
                    <div className="color-picker">
                        {ACCENT_COLORS.map(color => (
                            <button
                                key={color}
                                className={`color-swatch ${settings.accentColor === color ? 'selected' : ''}`}
                                style={{ background: color }}
                                onClick={() => updateSetting('accentColor', color)}
                            />
                        ))}
                    </div>
                </div>

                {/* Font size */}
                <div className="theme-option" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <label>🔤 Cỡ chữ</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {(['small', 'medium', 'large'] as const).map(size => (
                            <button
                                key={size}
                                onClick={() => updateSetting('fontSize', size)}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    border: settings.fontSize === size ? '2px solid #8b5cf6' : '1.5px solid #e5e7eb',
                                    background: settings.fontSize === size ? '#ede9fe' : 'white',
                                    color: settings.fontSize === size ? '#7c3aed' : '#6b7280',
                                    fontWeight: 600,
                                    fontSize: size === 'small' ? '11px' : size === 'large' ? '15px' : '13px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {size === 'small' ? 'Nhỏ' : size === 'medium' ? 'Vừa' : 'Lớn'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Reset */}
                <button
                    onClick={() => {
                        const defaults = { mode: 'light', accentColor: '#8b5cf6', fontSize: 'medium' };
                        setSettings(defaults);
                        try { localStorage.setItem(THEME_KEY, JSON.stringify(defaults)); } catch { /* */ }
                        document.documentElement.classList.remove('dark');
                        document.documentElement.style.fontSize = '16px';
                    }}
                    style={{
                        width: '100%', marginTop: '16px', padding: '10px', borderRadius: '12px',
                        border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}
                >
                    <RotateCcw size={14} /> Đặt lại mặc định
                </button>
            </div>
        </>
    );
}

// ============================================================
// MUSIC TAB
// ============================================================

interface MusicLink {
    id: string;
    url: string;
    title: string;
    source: 'youtube' | 'spotify' | 'soundcloud' | 'unknown';
}

const PRESET_PLAYLISTS: MusicLink[] = [
    { id: 'yt1', url: 'https://www.youtube.com/embed/videoseries?list=PLMIbmfP_9vb8BCxRoraJpoo4q1yMFg4CE', title: '☕ Lofi Study Beats', source: 'youtube' },
    { id: 'yt2', url: 'https://www.youtube.com/embed/jfKfPfyJRdk', title: '🎵 Lofi Girl - beats to relax/study to', source: 'youtube' },
    { id: 'sp1', url: 'https://open.spotify.com/embed/playlist/0vvXsWCC9xrXsKd4FyS8kM', title: '🎧 Deep Focus - Spotify', source: 'spotify' },
    { id: 'sc1', url: 'https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/chaborbeats/sets/lofi-study-chill&color=%238b5cf6&auto_play=false', title: '🌙 SoundCloud Lofi Chill', source: 'soundcloud' },
];

function parseEmbedUrl(input: string): { url: string; source: MusicLink['source'] } {
    const trimmed = input.trim();
    // YouTube
    const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/)?)([\w-]{11})/);
    if (ytMatch) return { url: `https://www.youtube.com/embed/${ytMatch[1]}`, source: 'youtube' };
    const ytPlaylist = trimmed.match(/[?&]list=([\w-]+)/);
    if (ytPlaylist) return { url: `https://www.youtube.com/embed/videoseries?list=${ytPlaylist[1]}`, source: 'youtube' };
    // Spotify
    const spMatch = trimmed.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([\w]+)/);
    if (spMatch) return { url: `https://open.spotify.com/embed/${spMatch[1]}/${spMatch[2]}`, source: 'spotify' };
    // SoundCloud
    if (trimmed.includes('soundcloud.com')) {
        return { url: `https://w.soundcloud.com/player/?url=${encodeURIComponent(trimmed)}&color=%238b5cf6&auto_play=false`, source: 'soundcloud' };
    }
    // Direct embed URL
    if (trimmed.startsWith('http')) return { url: trimmed, source: 'unknown' };
    return { url: '', source: 'unknown' };
}

function MusicTab() {
    const [customLinks, setCustomLinks] = useState<MusicLink[]>(() => {
        try {
            const raw = localStorage.getItem(MUSIC_LINKS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    });
    const [urlInput, setUrlInput] = useState('');
    const [activePlayer, setActivePlayer] = useState<MusicLink | null>(null);
    const [addError, setAddError] = useState('');

    const saveLinks = (links: MusicLink[]) => {
        setCustomLinks(links);
        try { localStorage.setItem(MUSIC_LINKS_KEY, JSON.stringify(links)); } catch { /* */ }
    };

    const addCustomLink = () => {
        setAddError('');
        if (!urlInput.trim()) return;
        const { url, source } = parseEmbedUrl(urlInput);
        if (!url) { setAddError('URL không hợp lệ'); return; }
        const newLink: MusicLink = {
            id: Date.now().toString(),
            url,
            title: source === 'youtube' ? '🎬 YouTube' : source === 'spotify' ? '🎧 Spotify' : source === 'soundcloud' ? '🌙 SoundCloud' : '🔗 Nhạc',
            source,
        };
        saveLinks([newLink, ...customLinks]);
        setUrlInput('');
    };

    const removeCustomLink = (id: string) => {
        saveLinks(customLinks.filter(l => l.id !== id));
        if (activePlayer?.id === id) setActivePlayer(null);
    };

    const getIframeHeight = (source: MusicLink['source']) => {
        if (source === 'spotify') return 152;
        if (source === 'soundcloud') return 166;
        return 200;
    };

    // Player view
    if (activePlayer) {
        return (
            <>
                <div className="hub-content-header">
                    <h3>
                        <button onClick={() => setActivePlayer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                            <ChevronLeft size={18} />
                        </button>
                        <span style={{ fontSize: '14px' }}>{activePlayer.title}</span>
                    </h3>
                </div>
                <div className="hub-content-body" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="music-player-frame">
                        <iframe
                            src={activePlayer.url}
                            width="100%"
                            height={getIframeHeight(activePlayer.source)}
                            frameBorder="0"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            allowFullScreen
                            loading="lazy"
                            style={{ borderRadius: '12px', border: 'none' }}
                        />
                    </div>
                    <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
                        Nhấn play trên trình phát bên trên để nghe nhạc 🎶
                    </p>
                </div>
            </>
        );
    }

    // Playlist list view
    return (
        <>
            <div className="hub-content-header">
                <h3>🎵 Âm nhạc</h3>
            </div>
            <div className="hub-content-body">
                {/* Add custom URL */}
                <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                            type="text"
                            placeholder="Paste YouTube/Spotify/SoundCloud URL..."
                            value={urlInput}
                            onChange={e => { setUrlInput(e.target.value); setAddError(''); }}
                            onKeyDown={e => e.key === 'Enter' && addCustomLink()}
                            style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '12px', outline: 'none' }}
                        />
                        <button onClick={addCustomLink} style={{ padding: '8px 14px', borderRadius: '10px', background: '#8b5cf6', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                            <Plus size={14} />
                        </button>
                    </div>
                    {addError && <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{addError}</p>}
                </div>

                {/* Custom links */}
                {customLinks.length > 0 && (
                    <>
                        <p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Nhạc của bạn</p>
                        <div className="music-playlist-list">
                            {customLinks.map(link => (
                                <div key={link.id} className="music-playlist-item" onClick={() => setActivePlayer(link)}>
                                    <div className="music-playlist-icon" data-source={link.source}>
                                        <Music size={16} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p className="music-playlist-title">{link.title}</p>
                                        <p className="music-playlist-source">{link.source}</p>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeCustomLink(link.id); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '4px' }}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Preset playlists */}
                <p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '14px 0 6px' }}>Playlist gợi ý</p>
                <div className="music-playlist-list">
                    {PRESET_PLAYLISTS.map(pl => (
                        <div key={pl.id} className="music-playlist-item" onClick={() => setActivePlayer(pl)}>
                            <div className="music-playlist-icon" data-source={pl.source}>
                                <Music size={16} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p className="music-playlist-title">{pl.title}</p>
                                <p className="music-playlist-source">{pl.source}</p>
                            </div>
                            <ExternalLink size={14} style={{ color: '#d1d5db' }} />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

export default FloatingHub;
