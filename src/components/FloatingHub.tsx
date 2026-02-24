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
    UserMinus,
    ChevronLeft,
    Check,
    Trash2,
    Sparkles,
    Music,
    ExternalLink,
    Moon,
    Type,
    Flame,
    Pin,
    PinOff,
    Users,
    Image,
    Upload,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    createStudyRoom,
    subscribeToRooms,
    subscribeToRoom,
    joinStudyRoom,
    leaveStudyRoom,
    sendRoomMessage,
    subscribeToRoomMessages,
    updateRoomTimer
} from '../services/studyroom.service';
import {
    subscribeFriends,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    sendChatMessage,
    subscribeToMessages,
    MAGO_SYSTEM_PROMPT,
    subscribeFriendPresence,
    subscribeToAllConvos,
    createGroupChat,
    sendGroupMessage,
    subscribeToGroupMessages,
    subscribeToGroupChats,
    sendMagoMessage,
    saveMagoResponse,
    subscribeToMagoMessages,
} from '../services/chat.service';
import { generateAIContent, type AIChatMessage } from '@/services/ai.service';
import type { ChatMessage, Friend, GroupChat, StudyRoom, StudyRoomMessage } from '@/types';
import './FloatingHub.css';

// ============================================================
// CONSTANTS
// ============================================================
type TabId = 'chat' | 'pomodoro' | 'notes' | 'study' | 'rooms' | 'music' | 'theme';

const TABS: { id: TabId; icon: typeof MessageCircle; label: string }[] = [
    { id: 'chat', icon: MessageCircle, label: 'Chat' },
    { id: 'pomodoro', icon: Timer, label: 'Pomodoro' },
    { id: 'notes', icon: StickyNote, label: 'Ghi chú' },
    { id: 'study', icon: BarChart3, label: 'Học tập' },
    { id: 'rooms', icon: Users, label: 'Phòng học' },
    { id: 'music', icon: Music, label: 'Nhạc' },
    { id: 'theme', icon: Palette, label: 'Giao diện' },
];

const POMODORO_MODES = [
    { id: 'focus', label: 'Tập trung', duration: 25 * 60 },
    { id: 'shortBreak', label: 'Nghỉ ngắn', duration: 5 * 60 },
    { id: 'longBreak', label: 'Nghỉ dài', duration: 15 * 60 },
] as const;

const ACCENT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const FAB_STORAGE_KEY = 'hub_fab_position';
const NOTES_KEY_PREFIX = 'hub_notes_';
// Theme is managed by ThemeContext (no local key needed)
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
    // Cycle tracked within focus sessions (1 -> 2 -> 3 -> 4)
    const [pomodoroCycle, setPomodoroCycle] = useState(() => (pomodoroSessions % 4) || (pomodoroSessions === 0 ? 0 : 4));
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
                style={fabStyle}
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
                        {activeTab === 'rooms' && (
                            <StudyRoomsTab
                                user={{ email: user.email, name: user.displayName || user.email, photoURL: user.photoURL || undefined }}
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
                                                <div className="chat-contact-avatar" style={{ background: '#e0e7ff', color: '#4f46e5', overflow: 'hidden' }}>
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
                        <p className="chat-header-status">{isGroup ? `${group?.members.length || 0} thành viên` : activeChat === 'mago' ? 'Luôn sẵn sàng ✨' : isPartnerOnline ? '🟢 Đang hoạt động' : '⚫ Không hoạt động'}</p>
                    </div>
                </div>
                <div className="chat-header-actions" style={{ display: 'flex', gap: '8px' }}>
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
            <div className="hub-content-body">
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
                                <div className="chat-bubble">{msg.text}</div>
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
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
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
                <h3><BarChart3 size={16} style={{ verticalAlign: '-3px', marginRight: '6px' }} /> Theo dõi học tập</h3>
            </div>
            <div className="hub-content-body">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                        <div style={{ fontSize: '24px', animation: 'hubPulse 1.5s ease-in-out infinite', display: 'flex', justifyContent: 'center' }}><BarChart3 size={24} /></div>
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
                                <div className="stat-label">Streak <Flame size={12} style={{ verticalAlign: '-2px', color: '#f59e0b' }} /></div>
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
                                    Bạn đã hoàn thành <strong style={{ color: 'var(--accent-color, #3b82f6)' }}>{stats.totalExams}</strong> bài thi
                                    với điểm trung bình <strong style={{ color: 'var(--accent-color, #3b82f6)' }}>{stats.avgScore}</strong>.
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
// STUDY ROOMS TAB — Real-time collaborative sessions
// ============================================================

function StudyRoomsTab({ user }: { user: { email: string; name: string; photoURL?: string } }) {
    const [rooms, setRooms] = useState<StudyRoom[]>([]);
    const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);
    const [messages, setMessages] = useState<StudyRoomMessage[]>([]);
    const [input, setInput] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [newRoomData, setNewRoomData] = useState({ name: '', subject: 'Khác', isPrivate: false });
    const [localTimeLeft, setLocalTimeLeft] = useState(25 * 60);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Subscribe to all rooms
    useEffect(() => {
        if (!user?.email) return;
        let unsub: (() => void) | undefined;
        try {
            unsub = subscribeToRooms(setRooms);
        } catch (err) {
            console.error('[StudyRooms] Failed to set up listener:', err);
        }

        return () => {
            if (unsub) {
                try {
                    unsub();
                } catch (e) {
                    // Ignore cleanup errors to prevent app crash
                }
            }
        };
    }, [user?.email]);

    // Subscribe to room details and messages when joined
    useEffect(() => {
        if (!activeRoom || !user?.email) return;

        let unsubRoom: (() => void) | undefined;
        let unsubMsgs: (() => void) | undefined;

        try {
            unsubRoom = subscribeToRoom(activeRoom.id, (room: StudyRoom | null) => {
                if (!room) {
                    setActiveRoom(null);
                    return;
                }
                setActiveRoom(room);

                // Synchronize local timer with Firestore
                if (room.timerState) {
                    const ts = room.timerState;
                    if (ts.isRunning) {
                        const elapsed = Math.floor((Date.now() - ts.updatedAt) / 1000);
                        const actualTime = Math.max(0, ts.timeLeft - elapsed);
                        setLocalTimeLeft(actualTime);
                    } else {
                        setLocalTimeLeft(ts.timeLeft);
                    }
                }
            });
            unsubMsgs = subscribeToRoomMessages(activeRoom.id, setMessages);
        } catch (err) {
            console.error('[StudyRooms] Failed to subscribe to room details:', err);
        }

        return () => {
            if (unsubRoom) { try { unsubRoom(); } catch (e) { } }
            if (unsubMsgs) { try { unsubMsgs(); } catch (e) { } }
        };
    }, [activeRoom?.id, user?.email]);

    // Local ticking effect
    useEffect(() => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        if (activeRoom?.timerState?.isRunning && localTimeLeft > 0) {
            timerIntervalRef.current = setInterval(() => {
                setLocalTimeLeft(prev => Math.max(0, prev - 1));
            }, 1000);
        }

        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [activeRoom?.timerState?.isRunning, localTimeLeft > 0]);

    // Handle timer expiration (Owner only)
    useEffect(() => {
        const isOwner = activeRoom?.ownerEmail === user.email;
        if (isOwner && localTimeLeft === 0 && activeRoom?.timerState?.isRunning) {
            handleTimerComplete();
        }
    }, [localTimeLeft, activeRoom?.ownerEmail, user.email]);

    const handleTimerComplete = async () => {
        if (!activeRoom || activeRoom.ownerEmail !== user.email) return;

        const ts = activeRoom.timerState!;
        let nextMode = ts.mode;
        let nextTime = 0;
        let nextCycle = ts.cycle;
        let nextSessions = ts.sessions;

        if (ts.mode === 'focus') {
            nextSessions += 1;
            if (ts.cycle < 4) {
                nextMode = 'shortBreak';
                nextTime = 5 * 60;
            } else {
                nextMode = 'longBreak';
                nextTime = 15 * 60;
                nextCycle = 0; // Reset cycle after long break
            }
        } else {
            nextMode = 'focus';
            nextTime = 25 * 60;
            if (ts.mode === 'longBreak') nextCycle = 1;
            else nextCycle += 1;
        }

        await updateRoomTimer(activeRoom.id, {
            ...ts,
            mode: nextMode as any,
            timeLeft: nextTime,
            isRunning: true,
            cycle: nextCycle,
            sessions: nextSessions,
            updatedAt: Date.now()
        });
        playBeep();
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleCreate = async () => {
        if (!newRoomData.name.trim()) return;
        const rid = await createStudyRoom(newRoomData.name, newRoomData.subject, user.email, user.name, newRoomData.isPrivate);
        const room: StudyRoom = {
            id: rid,
            name: newRoomData.name,
            subject: newRoomData.subject,
            ownerEmail: user.email,
            ownerName: user.name,
            members: [{ email: user.email, name: user.name, photoURL: user.photoURL, role: 'owner', joinedAt: Date.now() }],
            isPrivate: newRoomData.isPrivate,
            createdAt: Date.now(),
            lastActive: Date.now(),
            timerState: { mode: 'focus', timeLeft: 25 * 60, isRunning: false, updatedAt: Date.now(), cycle: 1, sessions: 0 }
        };
        setActiveRoom(room);
        setShowCreate(false);
        setNewRoomData({ name: '', subject: 'Khác', isPrivate: false });
    };

    const handleJoin = async (room: StudyRoom) => {
        await joinStudyRoom(room.id, user.email, user.name, user.photoURL);
        setActiveRoom(room);
    };

    const handleLeave = async () => {
        if (!activeRoom) return;
        const member = activeRoom.members.find(m => m.email === user.email);
        if (member) await leaveStudyRoom(activeRoom.id, member);
        setActiveRoom(null);
    };

    const handleSend = async () => {
        if (!input.trim() || !activeRoom) return;
        await sendRoomMessage(activeRoom.id, user.email, user.name, input.trim());
        setInput('');
    };

    const syncTimer = (running: boolean) => {
        if (!activeRoom || activeRoom.ownerEmail !== user.email) return;
        updateRoomTimer(activeRoom.id, {
            ...activeRoom.timerState!,
            timeLeft: localTimeLeft,
            isRunning: running,
            updatedAt: Date.now()
        });
    };

    const resetTimer = async () => {
        if (!activeRoom || activeRoom.ownerEmail !== user.email) return;
        const mode = activeRoom.timerState?.mode || 'focus';
        const duration = mode === 'focus' ? 25 * 60 : (mode === 'shortBreak' ? 5 * 60 : 15 * 60);
        await updateRoomTimer(activeRoom.id, {
            ...activeRoom.timerState!,
            timeLeft: duration,
            isRunning: false,
            updatedAt: Date.now()
        });
    };

    const changeMode = async (mode: 'focus' | 'shortBreak' | 'longBreak') => {
        if (!activeRoom || activeRoom.ownerEmail !== user.email) return;
        const duration = mode === 'focus' ? 25 * 60 : (mode === 'shortBreak' ? 5 * 60 : 15 * 60);
        await updateRoomTimer(activeRoom.id, {
            ...activeRoom.timerState!,
            mode,
            timeLeft: duration,
            isRunning: false,
            updatedAt: Date.now()
        });
    };

    // Room context view
    if (activeRoom) {
        const isOwner = activeRoom.ownerEmail === user.email;
        const ts = activeRoom.timerState;

        return (
            <>
                <div className="hub-content-header">
                    <h3>
                        <button onClick={handleLeave} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                            <ChevronLeft size={18} />
                        </button>
                        <span style={{ fontSize: '14px' }}>{activeRoom.name}</span>
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="avatar-group">
                            {activeRoom.members.map((m, i) => (
                                <div
                                    key={`${m.email}-${i}`}
                                    title={m.name}
                                    className="avatar-group-item"
                                    style={{ zIndex: 10 - i }}
                                >
                                    {m.photoURL ? <img src={m.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.name[0]}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="hub-content-body room-content-body">
                    {/* Synchronized Shared Timer */}
                    <div className="room-shared-timer" style={{ marginBottom: '24px' }}>
                        <div className="room-pomodoro-modes" style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#f3f4f6', padding: '4px', borderRadius: '12px' }}>
                            {POMODORO_MODES.map(m => (
                                <button
                                    key={m.id}
                                    disabled={!isOwner}
                                    onClick={() => changeMode(m.id as any)}
                                    className={`room-mode-btn ${ts?.mode === m.id ? 'active' : ''}`}
                                    style={{
                                        flex: 1, padding: '6px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: 600,
                                        background: ts?.mode === m.id ? 'white' : 'transparent',
                                        boxShadow: ts?.mode === m.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                        color: ts?.mode === m.id ? 'var(--accent-color)' : '#6b7280',
                                        cursor: isOwner ? 'pointer' : 'default', transition: 'all 0.2s'
                                    }}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        <div className="pomodoro-ring small" style={{ width: '140px', height: '140px', margin: '0 auto', position: 'relative' }}>
                            <svg viewBox="0 0 176 176" style={{ width: '100%', height: '100%' }}>
                                <circle className="ring-bg" cx="88" cy="88" r="80" style={{ fill: 'none', stroke: '#f1f5f9', strokeWidth: '8px' }} />
                                <circle
                                    className="ring-progress"
                                    cx="88" cy="88" r="80"
                                    style={{
                                        fill: 'none', stroke: 'var(--accent-color)', strokeWidth: '8px', strokeLinecap: 'round',
                                        strokeDasharray: 2 * Math.PI * 80,
                                        strokeDashoffset: (2 * Math.PI * 80) * (1 - (localTimeLeft / (ts?.mode === 'focus' ? 25 * 60 : (ts?.mode === 'shortBreak' ? 5 * 60 : 15 * 60)))),
                                        transition: 'stroke-dashoffset 1s linear'
                                    }}
                                />
                            </svg>
                            <div className="pomodoro-time" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                <span className="time" style={{ fontSize: '24px', fontWeight: 800 }}>
                                    {Math.floor(localTimeLeft / 60).toString().padStart(2, '0')}:{(localTimeLeft % 60).toString().padStart(2, '0')}
                                </span>
                                <div style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginTop: '-2px' }}>
                                    {ts?.mode === 'focus' ? 'Focus' : 'Break'}
                                </div>
                            </div>
                        </div>

                        <div className="pomodoro-cycle-dots" style={{ display: 'flex', gap: '6px', justifyContent: 'center', margin: '12px 0' }}>
                            {[1, 2, 3, 4].map(dot => (
                                <div
                                    key={dot}
                                    className={`cycle-dot ${dot <= (ts?.cycle || 0) ? 'filled' : ''} ${dot === (ts?.mode === 'focus' ? ts?.cycle : -1) ? 'active' : ''}`}
                                    style={{
                                        width: '6px', height: '6px', borderRadius: '50%',
                                        background: dot <= (ts?.cycle || 0) ? 'var(--accent-color)' : '#e5e7eb',
                                        boxShadow: dot === (ts?.mode === 'focus' ? ts?.cycle : -1) ? '0 0 8px var(--accent-color)' : 'none'
                                    }}
                                />
                            ))}
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            {isOwner ? (
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button
                                        onClick={resetTimer}
                                        style={{ padding: '8px 16px', borderRadius: '12px', border: '1.5px solid #f1f5f9', background: 'white', color: '#6b7280', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        <RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Reset
                                    </button>
                                    <button
                                        onClick={() => syncTimer(!ts?.isRunning)}
                                        style={{
                                            padding: '8px 24px', borderRadius: '12px', border: 'none',
                                            background: ts?.isRunning ? '#ef4444' : 'var(--accent-color)',
                                            color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
                                        }}
                                    >
                                        {ts?.isRunning ? '⏸ Tạm dừng' : '▶ Bắt đầu'}
                                    </button>
                                </div>
                            ) : (
                                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <Sparkles size={12} /> Đồng bộ với chủ phòng
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Room Chat */}
                    <div className="room-chat-container">
                        <div className="room-chat-messages">
                            {messages.map((m) => (
                                <div key={m.id} style={{ marginBottom: '8px', textAlign: m.senderEmail === user.email ? 'right' : 'left' }}>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>{m.senderName}</div>
                                    <div className={`room-msg-bubble ${m.senderEmail === user.email ? 'room-msg-sent' : 'room-msg-received'}`}>
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                placeholder="Gửi tin nhắn cho phòng..."
                                style={{ flex: 1, padding: '8px 12px', borderRadius: '12px', border: '1.5px solid #e5e7eb', fontSize: '12px', outline: 'none' }}
                            />
                            <button onClick={handleSend} style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-color)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // List view
    return (
        <>
            <div className="hub-content-header">
                <h3><Users size={16} style={{ verticalAlign: '-3px', marginRight: '6px' }} /> Phòng học</h3>
                <button
                    onClick={() => setShowCreate(true)}
                    style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                    <Plus size={14} /> Tạo phòng
                </button>
            </div>

            <div className="hub-content-body">
                {showCreate && (
                    <div style={{ background: 'white', padding: '12px', borderRadius: '12px', marginBottom: '16px', border: '1.5px solid var(--accent-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{ fontWeight: 700, fontSize: '13px' }}>Tạo phòng mới</span>
                            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={14} /></button>
                        </div>
                        <input
                            type="text"
                            placeholder="Tên phòng..."
                            value={newRoomData.name}
                            onChange={e => setNewRoomData(prev => ({ ...prev, name: e.target.value }))}
                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1.5px solid #e5e7eb', marginBottom: '8px', fontSize: '12px', outline: 'none' }}
                        />
                        <select
                            value={newRoomData.subject}
                            onChange={e => setNewRoomData(prev => ({ ...prev, subject: e.target.value }))}
                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1.5px solid #e5e7eb', marginBottom: '12px', fontSize: '12px', outline: 'none', color: '#374151' }}
                        >
                            <option value="Khác">Chọn môn học</option>
                            <option value="Toán học">Toán học</option>
                            <option value="Vật lý">Vật lý</option>
                            <option value="Hóa học">Hóa học</option>
                            <option value="Anh văn">Anh văn</option>
                            <option value="Công nghệ">Công nghệ</option>
                        </select>
                        <button
                            onClick={handleCreate}
                            disabled={!newRoomData.name.trim()}
                            style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--accent-color)', color: 'white', border: 'none', fontWeight: 600, fontSize: '12px', cursor: 'pointer', opacity: !newRoomData.name.trim() ? 0.6 : 1 }}
                        >
                            Tạo phòng & Tham gia
                        </button>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {rooms.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                            <Users size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p style={{ fontSize: '12px' }}>Chưa có phòng học nào. Hãy là người đầu tiên tạo phòng!</p>
                        </div>
                    ) : (
                        rooms.map(room => (
                            <div
                                key={room.id}
                                onClick={() => handleJoin(room)}
                                style={{
                                    padding: '12px', borderRadius: '14px', background: 'white',
                                    border: '1px solid #f1f5f9', cursor: 'pointer',
                                    transition: 'all 0.2s', display: 'flex',
                                    alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = '#f1f5f9'}
                            >
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '12px',
                                    background: 'rgba(var(--accent-rgb), 0.1)', color: 'var(--accent-color)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '18px', flexShrink: 0
                                }}>
                                    {room.subject === 'Toán học' ? '📐' : room.subject === 'Anh văn' ? '🌍' : '📚'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#1f2937' }}>{room.name}</span>
                                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>{room.members.length} học sinh</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                                        <span style={{ fontSize: '11px', color: '#6b7280' }}>{room.subject}</span>
                                        <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>
                                            {room.timerState?.isRunning ? 'Đang học 🎯' : 'Chờ đợi...'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}

// ============================================================
// THEME TAB — uses global ThemeContext
// ============================================================

function ThemeTab() {
    const { settings, updateSetting, resetToDefaults } = useTheme();

    return (
        <>
            <div className="hub-content-header">
                <h3><Palette size={16} style={{ verticalAlign: '-3px', marginRight: '6px' }} /> Tùy chỉnh</h3>
            </div>
            <div className="hub-content-body">
                {/* Dark mode toggle */}
                <div className="theme-option">
                    <label><Moon size={14} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Chế độ tối</label>
                    <button
                        className={`toggle-switch ${settings.mode === 'dark' ? 'on' : ''}`}
                        onClick={() => updateSetting('mode', settings.mode === 'dark' ? 'light' : 'dark')}
                    />
                </div>

                {/* Accent color */}
                <div className="theme-option" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <label><Palette size={14} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Màu chủ đạo</label>
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
                    <label><Type size={14} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Cỡ chữ</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {(['small', 'medium', 'large'] as const).map(size => (
                            <button
                                key={size}
                                onClick={() => updateSetting('fontSize', size)}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    border: settings.fontSize === size ? '2px solid var(--accent-color, #3b82f6)' : '1.5px solid #e5e7eb',
                                    background: settings.fontSize === size ? 'rgba(var(--accent-rgb, 59, 130, 246), 0.1)' : 'white',
                                    color: settings.fontSize === size ? 'var(--accent-color, #3b82f6)' : '#6b7280',
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

                {/* Background Image */}
                <div className="theme-option" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <label><Image size={14} style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Hình nền</label>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                                type="text"
                                placeholder="Nhập link hình ảnh..."
                                value={settings.customBackground || ''}
                                onChange={e => updateSetting('customBackground', e.target.value)}
                                style={{
                                    flex: 1, padding: '8px 12px', borderRadius: '10px',
                                    border: '1.5px solid #e5e7eb', fontSize: '12px', outline: 'none',
                                    background: 'white'
                                }}
                            />
                            {settings.customBackground && (
                                <button
                                    onClick={() => updateSetting('customBackground', undefined)}
                                    title="Xóa hình nền"
                                    style={{
                                        padding: '8px', borderRadius: '10px', background: '#fee2e2',
                                        color: '#ef4444', border: 'none', cursor: 'pointer'
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <div
                            style={{
                                position: 'relative', width: '100%', height: '36px',
                                borderRadius: '10px', border: '1.5px dashed #d1d5db',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', color: '#6b7280', cursor: 'pointer',
                                background: '#f9fafb', overflow: 'hidden'
                            }}
                        >
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        const result = event.target?.result as string;
                                        updateSetting('customBackground', result);
                                    };
                                    reader.readAsDataURL(file);
                                }}
                                style={{
                                    position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer'
                                }}
                            />
                            <Upload size={14} style={{ marginRight: '6px' }} /> Tải ảnh lên
                        </div>
                        {settings.customBackground && (
                            <p style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>
                                ✓ Đã áp dụng hình nền tùy chỉnh
                            </p>
                        )}
                    </div>
                </div>

                {/* Reset */}
                <button
                    onClick={resetToDefaults}
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
                <h3><Music size={16} style={{ verticalAlign: '-3px', marginRight: '6px' }} /> Âm nhạc</h3>
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
                        <button onClick={addCustomLink} style={{ padding: '8px 14px', borderRadius: '10px', background: 'var(--accent-color, #3b82f6)', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
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
