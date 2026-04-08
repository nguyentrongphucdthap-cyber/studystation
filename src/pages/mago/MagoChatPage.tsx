import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Send,
    FileText,
    X,
    Sparkles,
    User,
    History,
    ChevronLeft,
    Image as ImageIcon,
    Brain,
    ListChecks,
    MessageCircle,
    ChevronDown,
    Check,
    Copy,
    Highlighter,
    MessageSquarePlus,
    StickyNote,
    Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    subscribeToMagoMessages,
    sendMagoMessage,
    saveMagoResponse,
    getMagoUsageCountToday,
    addMagoTeachingKnowledge,
    getMagoTeachingSystemPrompt,
    relayMagoMessageToOwnersIfRequestedWithSource,
    MAGO_DAILY_LIMIT,
    MAGO_SYSTEM_PROMPT
} from '@/services/chat.service';
import { generateAIContent, AIChatMessage } from '@/services/ai.service';
import { uploadToImgBB } from '@/services/image.service';
import { getUserRole, hasUnlimitedMagoAccess } from '@/services/auth.service';
import MagoText from '@/components/MagoText';
import './MagoChatPage.css';

interface Attachment {
    id: string;
    file: File;
    preview: string;
    type: 'image' | 'file';
    base64?: string;
}

type ResponseMode = 'normal' | 'hint' | 'detailed' | 'teach';

const MODE_META_REGEX = /^\[mago_mode:(normal|hint|detailed|teach)\]\s*/;
const MODE_TIP_REMAINING_KEY = 'mago_feature_intro_remaining_v2';
const MODE_TIP_DEFAULT_REMAINING = 3;
const NOTES_KEY_PREFIX = 'hub_notes_';

interface NoteItem {
    id: string;
    title: string;
    content: string;
    color: string;
    createdAt: number;
    updatedAt: number;
}

const RESPONSE_MODE_CONFIG: Record<
    ResponseMode,
    {
        label: string;
        shortLabel: string;
        description: string;
        instruction: string;
        icon: React.ComponentType<{ size?: number; className?: string }>;
    }
> = {
    normal: {
        label: 'Chat thông thường',
        shortLabel: 'Chat',
        description: 'Trò chuyện tự nhiên, linh hoạt theo ngữ cảnh.',
        instruction: 'Trả lời tự nhiên như một cuộc chat thông thường, rõ ràng, thân thiện và đi thẳng vào nhu cầu người học.',
        icon: MessageCircle
    },
    hint: {
        label: 'Hiểu cách làm',
        shortLabel: 'Hướng giải',
        description: 'Định hướng tư duy và các bước làm chính.',
        instruction:
            'Ưu tiên hướng dẫn cách làm và tư duy cốt lõi. Không cần triển khai toàn bộ lời giải chi tiết trừ khi thật sự cần.',
        icon: Brain
    },
    detailed: {
        label: 'Bài giải chi tiết',
        shortLabel: 'Giải chi tiết',
        description: 'Trình bày đầy đủ từng bước và giải thích rõ.',
        instruction:
            'Trả lời bằng lời giải chi tiết từng bước, giải thích logic rõ ràng, có kết luận cuối cùng và nhắc các lỗi thường gặp nếu phù hợp.',
        icon: ListChecks
    },
    teach: {
        label: 'Dạy Mago',
        shortLabel: 'Dạy',
        description: 'Lưu kiến thức mới để Mago dùng cho người khác.',
        instruction:
            'Đây là chế độ học thêm kiến thức. Hãy xác nhận đã hiểu, tóm tắt gọn thông tin vừa học và cam kết ưu tiên áp dụng khi phù hợp.',
        icon: MessageSquarePlus
    }
};

const parseMessageMode = (text: string): { mode: ResponseMode; cleanText: string } => {
    const raw = text || '';
    const match = raw.match(MODE_META_REGEX);
    if (!match) {
        return { mode: 'normal', cleanText: raw };
    }

    const mode = (match[1] as ResponseMode) || 'normal';
    const cleanText = raw.replace(MODE_META_REGEX, '').trimStart();
    return { mode, cleanText };
};

const buildModeMeta = (mode: ResponseMode, text: string): string => {
    return `[mago_mode:${mode}] ${text}`.trim();
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const applyHighlights = (text: string, highlights: string[]) => {
    return highlights.reduce((acc, selectedText) => {
        const target = selectedText.trim();
        if (!target) return acc;

        const regex = new RegExp(escapeRegExp(target), 'i');
        if (!regex.test(acc)) return acc;
        return acc.replace(regex, '==$&==');
    }, text);
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isTransientAIError = (message: string) => {
    return /(429|503|rate|timeout|network|temporar|unavailable|overloaded|deadline|socket)/i.test(message);
};

const isModelUnsupportedError = (message: string) => {
    return /(is not found for api version|not supported for generatecontent|model.*not found)/i.test(message);
};

const isLocationUnsupportedError = (message: string) => {
    return /user location is not supported/i.test(message);
};

const buildTeachContent = (raw: string): string => {
    return raw.replace(MODE_META_REGEX, '').trim();
};

const MagoChatPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [usageCount, setUsageCount] = useState(0);
    const [responseMode, setResponseMode] = useState<ResponseMode>('normal');
    const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
    const [modeTipRemaining, setModeTipRemaining] = useState(() => {
        const raw = localStorage.getItem(MODE_TIP_REMAINING_KEY);
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
        localStorage.setItem(MODE_TIP_REMAINING_KEY, String(MODE_TIP_DEFAULT_REMAINING));
        return MODE_TIP_DEFAULT_REMAINING;
    });
    const [actionMessage, setActionMessage] = useState('');
    const [highlightMap, setHighlightMap] = useState<Record<string, string[]>>({});
    const [selectionMenu, setSelectionMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
        text: string;
        messageKey: string;
    }>({
        visible: false,
        x: 0,
        y: 0,
        text: '',
        messageKey: ''
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modeMenuRef = useRef<HTMLDivElement>(null);
    const chatAreaRef = useRef<HTMLDivElement>(null);
    const selectionMenuRef = useRef<HTMLDivElement>(null);

    const role = getUserRole();
    const hasUnlimitedMago = hasUnlimitedMagoAccess(role);
    const canTeachMago = hasUnlimitedMago;

    const imageAttachments = attachments.filter((a) => a.type === 'image');
    const fileAttachments = attachments.filter((a) => a.type === 'file');

    const parsedMessages = useMemo(() => {
        return messages.map((msg, idx) => {
            const isUser = msg.role === 'user' || !msg.role;
            const messageKey = String(msg.id ?? `idx-${idx}`);
            if (!isUser) {
                const highlightedText = applyHighlights(msg.text || '', highlightMap[messageKey] || []);
                return {
                    ...msg,
                    messageKey,
                    isUser,
                    parsedMode: 'normal' as ResponseMode,
                    parsedText: highlightedText
                };
            }

            const { mode, cleanText } = parseMessageMode(msg.text || '');
            const highlightedText = applyHighlights(cleanText, highlightMap[messageKey] || []);
            return {
                ...msg,
                messageKey,
                isUser,
                parsedMode: mode,
                parsedText: highlightedText
            };
        });
    }, [messages, highlightMap]);

    const availableModes = useMemo(() => {
        const allModes = Object.keys(RESPONSE_MODE_CONFIG) as ResponseMode[];
        return canTeachMago ? allModes : allModes.filter((mode) => mode !== 'teach');
    }, [canTeachMago]);

    useEffect(() => {
        if (!canTeachMago && responseMode === 'teach') {
            setResponseMode('normal');
        }
    }, [canTeachMago, responseMode]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    useEffect(() => {
        if (!user?.email) return;

        const unsub = subscribeToMagoMessages((msgs) => {
            setMessages(msgs);
        });

        const updateUsage = async () => {
            const count = await getMagoUsageCountToday(user.email!);
            setUsageCount(count);
        };

        updateUsage();
        return () => unsub();
    }, [user?.email]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const rafId = window.requestAnimationFrame(() => {
            textarea.style.height = '0px';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        });

        return () => window.cancelAnimationFrame(rafId);
    }, [input]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
                setIsModeMenuOpen(false);
            }

            if (selectionMenuRef.current && !selectionMenuRef.current.contains(event.target as Node)) {
                setSelectionMenu((prev) => ({ ...prev, visible: false }));
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!actionMessage) return;
        const timer = window.setTimeout(() => setActionMessage(''), 1800);
        return () => window.clearTimeout(timer);
    }, [actionMessage]);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64 || '');
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const prepareAttachments = async (files: File[], forcedType?: 'image' | 'file') => {
        if (files.length === 0) return;

        const newAttachments: Attachment[] = await Promise.all(
            files.map(async (file) => {
                const isImage = forcedType ? forcedType === 'image' : file.type.startsWith('image/');
                const preview = isImage ? URL.createObjectURL(file) : '';
                const base64 = await fileToBase64(file);

                return {
                    id: Math.random().toString(36).slice(2, 11),
                    file,
                    preview,
                    type: isImage ? 'image' : 'file',
                    base64
                };
            })
        );

        setAttachments((prev) => [...prev, ...newAttachments].slice(0, 5));
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        await prepareAttachments(files, 'image');
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        await prepareAttachments(files, 'file');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePasteAttachments = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = Array.from(e.clipboardData?.items || []);
        const pastedFiles: File[] = [];

        for (const item of items) {
            if (item.kind !== 'file') continue;
            const file = item.getAsFile();
            if (!file) continue;
            pastedFiles.push(file);
        }

        if (pastedFiles.length === 0) return;

        e.preventDefault();
        await prepareAttachments(pastedFiles);
        setActionMessage(`Đã dán ${pastedFiles.length} tệp đính kèm`);
    };

    const removeAttachment = (id: string) => {
        setAttachments((prev) => {
            const item = prev.find((a) => a.id === id);
            if (item?.preview) URL.revokeObjectURL(item.preview);
            return prev.filter((a) => a.id !== id);
        });
    };

    const addToFloatingHubNotes = (selectedText: string) => {
        if (!user?.email) return;

        const storageKey = `${NOTES_KEY_PREFIX}${user.email}`;
        const now = Date.now();
        const note: NoteItem = {
            id: now.toString(),
            title: selectedText.trim().slice(0, 42) + (selectedText.trim().length > 42 ? '...' : ''),
            content: `<p>${escapeHtml(selectedText).replace(/\n/g, '<br/>')}</p>`,
            color: '#3b82f6',
            createdAt: now,
            updatedAt: now
        };

        try {
            const raw = localStorage.getItem(storageKey);
            const notes: NoteItem[] = raw && raw.startsWith('[') ? JSON.parse(raw) : [];
            localStorage.setItem(storageKey, JSON.stringify([note, ...notes]));
            setActionMessage('Đã thêm vào Notes của FloatingHub');
        } catch {
            setActionMessage('Không thể lưu vào Notes');
        }
    };

    const hideSelectionAndClear = () => {
        setSelectionMenu((prev) => ({ ...prev, visible: false }));
        window.getSelection()?.removeAllRanges();
    };

    const handleCopySelected = async () => {
        if (!selectionMenu.text) return;
        try {
            await navigator.clipboard.writeText(selectionMenu.text);
            setActionMessage('Đã sao chép đoạn đã chọn');
        } catch {
            setActionMessage('Không thể sao chép tự động');
        }
        hideSelectionAndClear();
    };

    const handleHighlightSelected = () => {
        if (!selectionMenu.text || !selectionMenu.messageKey) return;
        setHighlightMap((prev) => {
            const current = prev[selectionMenu.messageKey] || [];
            if (current.includes(selectionMenu.text)) return prev;
            return { ...prev, [selectionMenu.messageKey]: [...current, selectionMenu.text] };
        });
        setActionMessage('Đã highlight đoạn đã chọn');
        hideSelectionAndClear();
    };

    const handleAddToChatInput = () => {
        if (!selectionMenu.text) return;
        setInput((prev) => (prev.trim() ? `${prev}\n\n"${selectionMenu.text}"` : `"${selectionMenu.text}"`));
        requestAnimationFrame(() => textareaRef.current?.focus());
        setActionMessage('Đã thêm vào khung chat');
        hideSelectionAndClear();
    };

    const handleAddToNotes = () => {
        if (!selectionMenu.text) return;
        addToFloatingHubNotes(selectionMenu.text);
        hideSelectionAndClear();
    };

    const updateSelectionMenu = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            setSelectionMenu((prev) => ({ ...prev, visible: false }));
            return;
        }

        const selectedText = selection.toString().trim();
        if (!selectedText) {
            setSelectionMenu((prev) => ({ ...prev, visible: false }));
            return;
        }

        const range = selection.getRangeAt(0);
        const anchorNode = selection.anchorNode;
        if (!anchorNode || !chatAreaRef.current || !chatAreaRef.current.contains(anchorNode)) {
            setSelectionMenu((prev) => ({ ...prev, visible: false }));
            return;
        }

        const container = anchorNode instanceof Element ? anchorNode : anchorNode.parentElement;
        const messageEl = container?.closest('[data-message-key]');
        const messageKey = messageEl?.getAttribute('data-message-key') || '';
        if (!messageKey) {
            setSelectionMenu((prev) => ({ ...prev, visible: false }));
            return;
        }

        const rect = range.getBoundingClientRect();
        setSelectionMenu({
            visible: true,
            x: rect.left + rect.width / 2,
            y: rect.top - 12,
            text: selectedText,
            messageKey
        });
    };

    const handleSend = async () => {
        if ((!input.trim() && attachments.length === 0) || isTyping) return;
        if (!user?.email) return;

        if (!hasUnlimitedMago && usageCount >= MAGO_DAILY_LIMIT) {
            alert('Bạn đã hết lượt sử dụng Mago hôm nay. Hãy quay lại vào ngày mai nhé!');
            return;
        }

        const userText = input.trim();
        const currentAttachments = [...attachments];

        setInput('');
        setAttachments([]);
        setIsTyping(true);

        try {
            let richTextForHistory = buildModeMeta(responseMode, userText);
            const aiParts: any[] = [];

            const modeInstruction = RESPONSE_MODE_CONFIG[responseMode].instruction;
            if (userText) {
                aiParts.push({
                    text: `Yêu cầu phản hồi (${RESPONSE_MODE_CONFIG[responseMode].label}): ${modeInstruction}\n\nNội dung người học: ${userText}`
                });
            } else {
                aiParts.push({
                    text: `Yêu cầu phản hồi (${RESPONSE_MODE_CONFIG[responseMode].label}): ${modeInstruction}\n\nNgười học chỉ gửi tệp đính kèm, hãy phân tích nội dung tệp để trả lời.`
                });
            }

            for (const att of currentAttachments) {
                if (att.type === 'image') {
                    try {
                        const uploadRes = await uploadToImgBB(att.file);
                        richTextForHistory += `\n![image](${uploadRes.url})`;
                        aiParts.push({
                            inlineData: {
                                mimeType: att.file.type,
                                data: att.base64
                            }
                        });
                    } catch (err) {
                        console.error('Image upload failed:', err);
                        richTextForHistory += `\n[Lỗi tải ảnh: ${att.file.name}]`;
                    }
                } else {
                    richTextForHistory += `\n[Đã đính kèm file: ${att.file.name}]`;

                    if (att.file.type === 'application/pdf') {
                        aiParts.push({
                            inlineData: {
                                mimeType: 'application/pdf',
                                data: att.base64
                            }
                        });
                    } else if (att.file.type.startsWith('text/') || att.file.type === '') {
                        const textContent = await att.file.text();
                        aiParts.push({ text: `\nNội dung từ file ${att.file.name}:\n${textContent}` });
                    }
                }
            }

            await sendMagoMessage(richTextForHistory);

            const relaySourceText = buildTeachContent(richTextForHistory);
            const relayResult = await relayMagoMessageToOwnersIfRequestedWithSource(userText, relaySourceText);
            if (relayResult.relayed) {
                if (relayResult.failedTo.length > 0) {
                    await saveMagoResponse(`Tôi đã chuyển lời tới ${relayResult.deliveredTo.join(' và ')}. Tuy nhiên chưa gửi được cho ${relayResult.failedTo.join(' và ')}, tôi sẽ thử lại khi bạn gửi lại nhé!`);
                } else {
                    await saveMagoResponse(`Tôi đã chuyển lời giúp bạn tới ${relayResult.deliveredTo.join(' và ')} rồi nhé! ✉️`);
                }
                const newCount = await getMagoUsageCountToday(user.email);
                setUsageCount(newCount);
                return;
            }

            if (responseMode === 'teach') {
                if (!canTeachMago) {
                    throw new Error('MAGO_TEACH_FORBIDDEN');
                }

                const teachContent = buildTeachContent(richTextForHistory);
                if (!teachContent) {
                    await saveMagoResponse('Nội dung dạy đang trống, bạn gửi lại giúp tôi nhé.');
                } else {
                    await addMagoTeachingKnowledge(teachContent);
                    await saveMagoResponse('Đã ghi nhớ kiến thức mới. Tôi sẽ ưu tiên áp dụng đúng theo phạm vi chia sẻ của nội dung này nhé! 📚');
                }

                const newCount = await getMagoUsageCountToday(user.email);
                setUsageCount(newCount);
                return;
            }

            const historyForAI: AIChatMessage[] = parsedMessages.slice(-10).map((m) => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.parsedText || m.text || '' }]
            }));

            historyForAI.push({
                role: 'user',
                parts: aiParts
            });

            const teachingPromptAddon = await getMagoTeachingSystemPrompt(user?.email || '');
            const finalSystemPrompt = `${MAGO_SYSTEM_PROMPT}${teachingPromptAddon}\n\nNgữ cảnh hiện tại: ${RESPONSE_MODE_CONFIG[responseMode].label}. ${modeInstruction}`;

            let response = '';
            let lastAIError: unknown = null;

            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    response = await generateAIContent(historyForAI, {
                        systemInstruction: finalSystemPrompt
                    });
                    break;
                } catch (aiErr: any) {
                    lastAIError = aiErr;
                    const msg = String(aiErr?.message || '');
                    if (attempt < 2 && isTransientAIError(msg)) {
                        await sleep(500);
                        continue;
                    }
                    throw aiErr;
                }
            }

            if (!response) {
                throw lastAIError || new Error('AI response is empty');
            }

            await saveMagoResponse(response);

            const newCount = await getMagoUsageCountToday(user.email);
            setUsageCount(newCount);

            setModeTipRemaining((prev) => {
                const next = Math.max(prev - 1, 0);
                localStorage.setItem(MODE_TIP_REMAINING_KEY, String(next));
                return next;
            });
        } catch (err: any) {
            console.error('Mago Chat Error:', err);
            const errorMsg = String(err?.message || 'Lỗi kết nối với Mago');

            if (err?.message === 'MAGO_LIMIT_REACHED') {
                await saveMagoResponse(`Bạn đã hết lượt sử dụng Mago hôm nay (${MAGO_DAILY_LIMIT}/${MAGO_DAILY_LIMIT}). Hẹn bạn ngày mai nhé! 🧙‍♂️`);
            } else if (err?.message === 'MAGO_TEACH_FORBIDDEN') {
                await saveMagoResponse('Chế độ Dạy chỉ dành cho Boss hoặc Super Admin.');
            } else if (/missing or insufficient permissions/i.test(errorMsg)) {
                await saveMagoResponse('Tài khoản hiện chưa có quyền dùng chế độ Dạy. Nếu bạn là Super Admin/Boss, hãy đăng xuất rồi đăng nhập lại để cập nhật quyền mới.');
            } else if (isLocationUnsupportedError(errorMsg)) {
                await saveMagoResponse('Khu vực mạng hiện tại chưa được API AI hỗ trợ. Bạn thử đổi mạng (Wi-Fi/4G khác) rồi nhắn lại giúp tôi nhé! 🧙‍♂️');
            } else if (isModelUnsupportedError(errorMsg)) {
                await saveMagoResponse('Mô hình AI đang bảo trì hoặc chưa hỗ trợ tạm thời. Bạn gửi lại sau ít phút giúp tôi nhé! 🧙‍♂️');
            } else if (isTransientAIError(errorMsg)) {
                await saveMagoResponse('Mago đang hơi quá tải, bạn gửi lại giúp mình nhé.');
            } else {
                await saveMagoResponse(`Xin lỗi, tôi đang gặp chút sự cố kỹ thuật: ${errorMsg}. Bạn thử lại sau nhé! 🧙‍♂️`);
            }
        } finally {
            setIsTyping(false);
        }
    };

    const currentModeConfig = RESPONSE_MODE_CONFIG[responseMode];
    const CurrentModeIcon = currentModeConfig.icon;

    return (
        <div className="mago-fullscreen-container">
            <div className="mago-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button className="mago-back-btn" onClick={() => navigate('/')}>
                        <ChevronLeft size={24} />
                    </button>
                    <div className="mago-limit-badge">
                        <Sparkles size={16} />
                        <span>Mago A.I</span>
                        <div className="mago-vertical-divider" />
                        <span className="limit-text">{hasUnlimitedMago ? '∞ Lượt' : `${MAGO_DAILY_LIMIT - usageCount} lượt còn lại`}</span>
                    </div>
                </div>

                <div className="mago-header-actions">
                    <button className="mago-icon-btn" title="Xóa lịch sử">
                        <History size={18} />
                    </button>
                </div>
            </div>

            <div
                className="mago-chat-area"
                ref={chatAreaRef}
                onMouseUp={updateSelectionMenu}
                onKeyUp={updateSelectionMenu}
            >
                {parsedMessages.length === 0 && !isTyping && (
                    <div className="mago-welcome-state">
                        <div className="mago-welcome-avatar">
                            <img src="/mago.png?v=20260408" alt="Mago" />
                        </div>
                        <h3>Xin chào, tôi là Mago ✨</h3>
                        <p>Trợ lý học tập cá nhân của bạn. Gửi ảnh bài tập, tài liệu hoặc hỏi bất kỳ điều gì.</p>
                    </div>
                )}

                {parsedMessages.map((msg, idx) => {
                    const isUser = msg.isUser;
                    const modeKey: ResponseMode =
                        msg.parsedMode && msg.parsedMode in RESPONSE_MODE_CONFIG
                            ? (msg.parsedMode as ResponseMode)
                            : 'normal';
                    const modeConfig = RESPONSE_MODE_CONFIG[modeKey];
                    const ModeIcon = modeConfig.icon;

                    return (
                        <div key={msg.id || idx} className={`mago-message-row ${isUser ? 'user' : 'mago'}`}>
                            {!isUser && (
                                <div className="mago-bubble-avatar">
                                    <img
                                        src="/mago.png?v=20260408"
                                        alt="Mago"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </div>
                            )}
                            <div className="mago-message-bubble" data-message-key={msg.messageKey}>
                                {isUser && (
                                    <span className="mago-message-mode-icon" title={modeConfig.label}>
                                        <ModeIcon size={12} />
                                    </span>
                                )}

                                <MagoText text={msg.parsedText || msg.text} />
                                <span className="mago-time-stamp">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            {isUser && (
                                <div className="mago-bubble-avatar user-avatar">
                                    <User size={16} />
                                </div>
                            )}
                        </div>
                    );
                })}

                {isTyping && (
                    <div className="mago-message-row mago">
                        <div className="mago-bubble-avatar thinking-avatar">
                            <img
                                src="/mago.png?v=20260408"
                                alt="Mago"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        <div className="mago-message-bubble typing">
                            <div className="mago-thinking-orb" />
                            <div className="mago-thinking-dots" aria-hidden>
                                <span />
                                <span />
                                <span />
                            </div>
                            <span>Mago đang suy nghĩ...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} style={{ height: '20px' }} />
            </div>

            {selectionMenu.visible && (
                <div
                    className="mago-selection-menu"
                    ref={selectionMenuRef}
                    style={{ left: selectionMenu.x, top: selectionMenu.y }}
                >
                    <button type="button" onClick={handleCopySelected}>
                        <Copy size={13} /> Sao chép
                    </button>
                    <button type="button" onClick={handleHighlightSelected}>
                        <Highlighter size={13} /> Highlight
                    </button>
                    <button type="button" onClick={handleAddToChatInput}>
                        <MessageSquarePlus size={13} /> Thêm vào chat
                    </button>
                    <button type="button" onClick={handleAddToNotes}>
                        <StickyNote size={13} /> Thêm vào notes
                    </button>
                </div>
            )}

            <div className="mago-bottom-zone">
                <div className="mago-input-glass">
                    {modeTipRemaining > 0 && (
                        <div className="mago-mode-tip" role="status">
                            <div className="mago-mode-tip-left">
                                <Info size={14} />
                                <span>
                                    Tính năng mới: chọn chế độ chat (Boss/Super Admin có thêm chế độ Dạy), bôi đen để thao tác nhanh, import ảnh/file riêng.
                                    Còn {modeTipRemaining} lượt giới thiệu.
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setModeTipRemaining(0);
                                    localStorage.setItem(MODE_TIP_REMAINING_KEY, '0');
                                }}
                                aria-label="Đóng gợi ý"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    )}

                    {(imageAttachments.length > 0 || fileAttachments.length > 0) && (
                        <div className="mago-attachments-area">
                            {imageAttachments.length > 0 && (
                                <div className="mago-attachment-category">
                                    <div className="mago-attachment-header">
                                        <ImageIcon size={14} /> Hình ảnh
                                    </div>
                                    <div className="mago-attachment-list">
                                        {imageAttachments.map((att) => (
                                            <div key={att.id} className="mago-att-item image-att">
                                                <img src={att.preview} alt="preview" />
                                                <button onClick={() => removeAttachment(att.id)}>
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {fileAttachments.length > 0 && (
                                <div className="mago-attachment-category border-left">
                                    <div className="mago-attachment-header">
                                        <FileText size={14} /> Tài liệu
                                    </div>
                                    <div className="mago-attachment-list">
                                        {fileAttachments.map((att) => (
                                            <div key={att.id} className="mago-att-item file-att">
                                                <div className="file-icon-wrap">
                                                    <FileText size={16} />
                                                </div>
                                                <span className="file-name">{att.file.name}</span>
                                                <button onClick={() => removeAttachment(att.id)}>
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mago-input-toolbar">
                        <div className="mago-import-actions">
                            <button
                                className="mago-import-btn"
                                onClick={() => imageInputRef.current?.click()}
                                disabled={isTyping}
                                type="button"
                                aria-label="Import ảnh"
                            >
                                <ImageIcon size={16} />
                                <span className="mago-hover-label">Import ảnh</span>
                            </button>
                            <button
                                className="mago-import-btn"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isTyping}
                                type="button"
                                aria-label="Import file"
                            >
                                <FileText size={16} />
                                <span className="mago-hover-label">Import file</span>
                            </button>
                        </div>

                        <div className="mago-mode-picker" ref={modeMenuRef}>
                            <button
                                type="button"
                                className="mago-mode-trigger"
                                onClick={() => setIsModeMenuOpen((prev) => !prev)}
                                disabled={isTyping}
                                aria-haspopup="listbox"
                                aria-expanded={isModeMenuOpen}
                            >
                                <CurrentModeIcon size={15} />
                                <span>{currentModeConfig.shortLabel}</span>
                                <ChevronDown size={14} className={isModeMenuOpen ? 'open' : ''} />
                            </button>

                            {isModeMenuOpen && (
                                <div className="mago-mode-dropdown" role="listbox" aria-label="Chọn chế độ chat">
                                    <div className="mago-mode-dropdown-title">Chế độ phản hồi</div>
                                    {availableModes.map((modeKey) => {
                                        const option = RESPONSE_MODE_CONFIG[modeKey];
                                        const OptionIcon = option.icon;
                                        const isActive = responseMode === modeKey;

                                        return (
                                            <button
                                                type="button"
                                                key={modeKey}
                                                className={`mago-mode-option ${isActive ? 'active' : ''}`}
                                                onClick={() => {
                                                    setResponseMode(modeKey);
                                                    setIsModeMenuOpen(false);
                                                }}
                                            >
                                                <div className="mago-mode-option-icon">
                                                    <OptionIcon size={16} />
                                                </div>
                                                <div className="mago-mode-option-text">
                                                    <div className="mago-mode-option-label">{option.label}</div>
                                                    <div className="mago-mode-option-desc">{option.description}</div>
                                                </div>
                                                {isActive && <Check size={16} className="mago-mode-option-check" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`mago-input-box ${isTyping ? 'disabled' : ''}`}>
                        <input
                            type="file"
                            ref={imageInputRef}
                            style={{ display: 'none' }}
                            multiple
                            accept="image/*"
                            onChange={handleImageSelect}
                        />
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            multiple
                            accept=".pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                            onChange={handleFileSelect}
                        />
                        <textarea
                            ref={textareaRef}
                            className="mago-textarea"
                            placeholder={isTyping ? 'Vui lòng đợi Mago trả lời...' : 'Nhập tin nhắn cho Mago...'}
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onPaste={handlePasteAttachments}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            disabled={isTyping}
                        />
                        <button
                            className={`mago-send-button ${input.trim() || attachments.length > 0 ? 'active' : ''}`}
                            disabled={(!input.trim() && attachments.length === 0) || isTyping}
                            onClick={handleSend}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {actionMessage && <div className="mago-action-toast">{actionMessage}</div>}
        </div>
    );
};

export default MagoChatPage;
