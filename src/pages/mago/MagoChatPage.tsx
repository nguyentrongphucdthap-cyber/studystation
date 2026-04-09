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
    Info,
    CircleHelp,
    Database,
    Pencil,
    Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    subscribeToMagoMessages,
    sendMagoMessage,
    saveMagoResponse,
    addMagoTeachingKnowledge,
    getMagoTeachingKnowledgeList,
    updateMagoTeachingKnowledge,
    deleteMagoTeachingKnowledge,
    type MagoTrainingKnowledgeItem,
    getMagoTeachingSystemPrompt,
    relayMagoMessageToOwnersIfRequestedWithSource,
    MAGO_SYSTEM_PROMPT
} from '@/services/chat.service';
import { subscribeToMagocoins, redeemGiftcodeTransaction } from '@/services/magocoin.service';
import { generateAIContent, AIChatMessage } from '@/services/ai.service';
import { uploadToImgBB } from '@/services/image.service';
import { getUserRole } from '@/services/auth.service';
import { getAllExams, getExamContent, getSubjects } from '@/services/exam.service';
import type { Exam, ExamMetadata } from '@/types';
import MagoText from '@/components/MagoText';
import { LatexContent } from '@/components/ui/LatexContent';
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

interface PickerQuestionOption {
    id: string;
    label: string;
    text: string;
}

interface InsertedQuestionRef {
    key: string;
    examId: string;
    questionId: string;
    subjectName: string;
    examTitle: string;
    questionLabel: string;
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

const EXAM_QUESTION_REF_REGEX = /\[\[EXAM_QUESTION:([^:\]]+):([^\]]+)\]\]/g;

const buildTeachContent = (raw: string): string => {
    return raw.replace(MODE_META_REGEX, '').trim();
};

const appendImageMarkdown = (text: string, image?: string) => {
    if (!image) return text || '';
    const normalized = (text || '').trim();
    const markdown = image.startsWith('![') ? image : `![image](${image})`;
    if (normalized.includes(markdown)) return normalized;
    return normalized ? `${normalized}\n\n${markdown}` : markdown;
};

const resolveQuestionPayload = (exam: Exam, questionRefId: string) => {
    if (questionRefId.startsWith('p1-')) {
        const qId = Number(questionRefId.replace('p1-', ''));
        const q = (exam.part1 || []).find((item) => item.id === qId);
        if (!q) return null;
        const optionsText = (q.options || []).map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join('\n');
        return {
            label: `Phần I - Câu ${q.id}`,
            text: `${appendImageMarkdown(q.text || '', q.image)}\n${optionsText}`.trim()
        };
    }

    if (questionRefId.startsWith('p2-')) {
        const [, qIdRaw, subIdRaw] = questionRefId.split('-');
        const qId = Number(qIdRaw);
        const subId = (subIdRaw || '').toLowerCase();
        const q = (exam.part2 || []).find((item) => item.id === qId);
        if (!q) return null;
        const sub = (q.subQuestions || []).find((item) => String(item.id).toLowerCase() === subId);
        if (!sub) return null;
        return {
            label: `Phần II - Câu ${q.id}${sub.id.toString().toUpperCase()}`,
            text: `${appendImageMarkdown(q.text || '', q.image)}\n${sub.id.toString().toUpperCase()}) ${sub.text || ''}`.trim()
        };
    }

    if (questionRefId.startsWith('p3-')) {
        const qId = Number(questionRefId.replace('p3-', ''));
        const q = (exam.part3 || []).find((item) => item.id === qId);
        if (!q) return null;
        return {
            label: `Phần III - Câu ${q.id}`,
            text: appendImageMarkdown(q.text || '', q.image)
        };
    }

    return null;
};

const MagoChatPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [magocoinBalance, setMagocoinBalance] = useState(0);
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
    const [showExamQuestionPicker, setShowExamQuestionPicker] = useState(false);
    const [examPickerLoading, setExamPickerLoading] = useState(false);
    const [examPickerExams, setExamPickerExams] = useState<ExamMetadata[]>([]);
    const [examPickerSubjectId, setExamPickerSubjectId] = useState('');
    const [examPickerExamId, setExamPickerExamId] = useState('');
    const [examPickerExamContent, setExamPickerExamContent] = useState<Exam | null>(null);
    const [examPickerQuestionId, setExamPickerQuestionId] = useState('');
    const [examPickerFolderFilter, setExamPickerFolderFilter] = useState<'ALL' | 'UNFILED' | string>('ALL');
    const [examPickerExamSearch, setExamPickerExamSearch] = useState('');
    const [examPickerQuestionSearch, setExamPickerQuestionSearch] = useState('');
    const [insertedQuestionRefs, setInsertedQuestionRefs] = useState<InsertedQuestionRef[]>([]);
    const [showKnowledgeManager, setShowKnowledgeManager] = useState(false);
    const [knowledgeItems, setKnowledgeItems] = useState<MagoTrainingKnowledgeItem[]>([]);
    const [knowledgeLoading, setKnowledgeLoading] = useState(false);
    const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
    const [editingKnowledgeContent, setEditingKnowledgeContent] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modeMenuRef = useRef<HTMLDivElement>(null);
    const chatAreaRef = useRef<HTMLDivElement>(null);
    const selectionMenuRef = useRef<HTMLDivElement>(null);

    const role = getUserRole();
    const canTeachMago = /boss|super[-_\s]?admin/i.test(role);

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

    const subjectOptions = useMemo(() => getSubjects(), []);

    const examPickerSubjectExams = useMemo(() => {
        if (!examPickerSubjectId) return [];
        return examPickerExams
            .filter((exam) => exam.subjectId === examPickerSubjectId)
            .sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    }, [examPickerExams, examPickerSubjectId]);

    const examPickerFolderOptions = useMemo(() => {
        const folders = Array.from(
            new Set(
                examPickerSubjectExams
                    .map((exam) => (exam.customFolder || '').trim())
                    .filter(Boolean)
            )
        ).sort((a, b) => a.localeCompare(b, 'vi'));
        return folders;
    }, [examPickerSubjectExams]);

    const examPickerFilteredExams = useMemo(() => {
        const search = examPickerExamSearch.trim().toLowerCase();
        return examPickerSubjectExams.filter((exam) => {
            const folder = (exam.customFolder || '').trim();
            if (examPickerFolderFilter === 'UNFILED' && folder) return false;
            if (examPickerFolderFilter !== 'ALL' && examPickerFolderFilter !== 'UNFILED' && folder !== examPickerFolderFilter) return false;
            if (search && !exam.title.toLowerCase().includes(search)) return false;
            return true;
        });
    }, [examPickerSubjectExams, examPickerFolderFilter, examPickerExamSearch]);

    const examPickerQuestions = useMemo<PickerQuestionOption[]>(() => {
        if (!examPickerExamContent) return [];
        const options: PickerQuestionOption[] = [];

        (examPickerExamContent.part1 || []).forEach((q, idx) => {
            options.push({
                id: `p1-${q.id}`,
                label: `Phần I - Câu ${idx + 1}`,
                text: q.text || ''
            });
        });

        (examPickerExamContent.part2 || []).forEach((q, idx) => {
            const questionPrefix = q.text?.trim() ? `${q.text.trim()}\n` : '';
            (q.subQuestions || []).forEach((sub) => {
                options.push({
                    id: `p2-${q.id}-${sub.id}`,
                    label: `Phần II - Câu ${idx + 1}${String(sub.id).toUpperCase()}`,
                    text: `${questionPrefix}${sub.text || ''}`.trim()
                });
            });
        });

        (examPickerExamContent.part3 || []).forEach((q, idx) => {
            options.push({
                id: `p3-${q.id}`,
                label: `Phần III - Câu ${idx + 1}`,
                text: q.text || ''
            });
        });

        return options;
    }, [examPickerExamContent]);

    const examPickerFilteredQuestions = useMemo(() => {
        const search = examPickerQuestionSearch.trim().toLowerCase();
        if (!search) return examPickerQuestions;
        return examPickerQuestions.filter((question) =>
            question.label.toLowerCase().includes(search) ||
            question.text.toLowerCase().includes(search)
        );
    }, [examPickerQuestions, examPickerQuestionSearch]);

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
        if (!showExamQuestionPicker || examPickerExams.length > 0) return;
        let isCancelled = false;
        const loadExams = async () => {
            setExamPickerLoading(true);
            try {
                const exams = await getAllExams();
                if (isCancelled) return;
                setExamPickerExams(exams);
                if (!examPickerSubjectId && subjectOptions.length > 0) {
                    setExamPickerSubjectId(subjectOptions[0]?.id || '');
                }
            } finally {
                if (!isCancelled) setExamPickerLoading(false);
            }
        };
        loadExams();
        return () => {
            isCancelled = true;
        };
    }, [showExamQuestionPicker, examPickerExams.length, examPickerSubjectId, subjectOptions]);

    useEffect(() => {
        if (!showKnowledgeManager || !canTeachMago) return;
        let isCancelled = false;
        const loadKnowledge = async () => {
            setKnowledgeLoading(true);
            try {
                const list = await getMagoTeachingKnowledgeList();
                if (isCancelled) return;
                setKnowledgeItems(list);
            } catch {
                if (!isCancelled) setActionMessage('Không thể tải kiến thức đã dạy');
            } finally {
                if (!isCancelled) setKnowledgeLoading(false);
            }
        };
        loadKnowledge();
        return () => {
            isCancelled = true;
        };
    }, [showKnowledgeManager, canTeachMago]);

    useEffect(() => {
        setExamPickerExamId('');
        setExamPickerExamContent(null);
        setExamPickerQuestionId('');
        setExamPickerFolderFilter('ALL');
        setExamPickerExamSearch('');
        setExamPickerQuestionSearch('');
    }, [examPickerSubjectId]);

    useEffect(() => {
        if (!examPickerExamId) {
            setExamPickerExamContent(null);
            setExamPickerQuestionId('');
            return;
        }
        let isCancelled = false;
        const loadExam = async () => {
            setExamPickerLoading(true);
            try {
                const exam = await getExamContent(examPickerExamId, true);
                if (isCancelled) return;
                setExamPickerExamContent(exam);
                setExamPickerQuestionId('');
            } finally {
                if (!isCancelled) setExamPickerLoading(false);
            }
        };
        loadExam();
        return () => {
            isCancelled = true;
        };
    }, [examPickerExamId]);

    useEffect(() => {
        if (examPickerExamId && !examPickerFilteredExams.some((exam) => exam.id === examPickerExamId)) {
            setExamPickerExamId('');
            setExamPickerExamContent(null);
            setExamPickerQuestionId('');
        }
    }, [examPickerFilteredExams, examPickerExamId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    useEffect(() => {
        if (!user?.email) return;

        const unsub = subscribeToMagoMessages((msgs) => {
            setMessages(msgs);
        });

        const unsubCoins = subscribeToMagocoins(user.email, (balance) => {
            setMagocoinBalance(balance);
        });

        return () => {
            unsub();
            unsubCoins();
        };
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

    const handleInsertExamQuestion = () => {
        const selectedQuestion = examPickerQuestions.find((q) => q.id === examPickerQuestionId);
        const selectedExam = examPickerFilteredExams.find((e) => e.id === examPickerExamId) || examPickerSubjectExams.find((e) => e.id === examPickerExamId);
        const selectedSubject = subjectOptions.find((s) => s.id === examPickerSubjectId);

        if (!selectedQuestion || !selectedExam || !selectedSubject) return;

        const key = `${selectedExam.id}:${selectedQuestion.id}`;
        setInsertedQuestionRefs((prev) => {
            if (prev.some((item) => item.key === key)) return prev;
            return [
                ...prev,
                {
                    key,
                    examId: selectedExam.id,
                    questionId: selectedQuestion.id,
                    subjectName: selectedSubject.name,
                    examTitle: selectedExam.title,
                    questionLabel: selectedQuestion.label
                }
            ];
        });
        setShowExamQuestionPicker(false);
        setActionMessage(`Đã chèn câu hỏi (${selectedQuestion.label})`);
        requestAnimationFrame(() => textareaRef.current?.focus());
    };

    const handleOpenKnowledgeManager = () => {
        setShowKnowledgeManager(true);
        setEditingKnowledgeId(null);
        setEditingKnowledgeContent('');
    };

    const handleStartEditKnowledge = (item: MagoTrainingKnowledgeItem) => {
        setEditingKnowledgeId(item.id);
        setEditingKnowledgeContent(item.content);
    };

    const handleCancelEditKnowledge = () => {
        setEditingKnowledgeId(null);
        setEditingKnowledgeContent('');
    };

    const handleSaveKnowledge = async () => {
        if (!editingKnowledgeId) return;
        const trimmed = editingKnowledgeContent.trim();
        if (!trimmed) {
            setActionMessage('Nội dung không được để trống');
            return;
        }
        try {
            await updateMagoTeachingKnowledge(editingKnowledgeId, trimmed);
            setKnowledgeItems((prev) =>
                prev.map((item) => (item.id === editingKnowledgeId ? { ...item, content: trimmed } : item))
            );
            handleCancelEditKnowledge();
            setActionMessage('Đã cập nhật kiến thức');
        } catch {
            setActionMessage('Không thể cập nhật kiến thức');
        }
    };

    const handleDeleteKnowledge = async (item: MagoTrainingKnowledgeItem) => {
        const ok = window.confirm('Xóa mục kiến thức này khỏi mago_training?');
        if (!ok) return;
        try {
            await deleteMagoTeachingKnowledge(item.id);
            setKnowledgeItems((prev) => prev.filter((it) => it.id !== item.id));
            if (editingKnowledgeId === item.id) handleCancelEditKnowledge();
            setActionMessage('Đã xóa kiến thức');
        } catch {
            setActionMessage('Không thể xóa kiến thức');
        }
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
        if ((!input.trim() && attachments.length === 0 && insertedQuestionRefs.length === 0) || isTyping) return;
        if (!user?.email) return;

        if (magocoinBalance < 1) {
            alert('Bạn đã hết Magocoin. Hãy làm bài tập để nhận thêm nhé!');
            return;
        }

        const userText = input.trim();
        const currentAttachments = [...attachments];
        const currentInsertedRefs = [...insertedQuestionRefs];

        setInput('');
        setAttachments([]);
        setInsertedQuestionRefs([]);
        setIsTyping(true);

        try {
            let richTextForHistory = '';
            const aiParts: any[] = [];

            const refsFromChips = currentInsertedRefs.map((item) => ({
                token: `[[EXAM_QUESTION:${item.examId}:${item.questionId}]]`,
                examId: item.examId,
                questionRefId: item.questionId
            }));
            const refsFromText = Array.from(userText.matchAll(EXAM_QUESTION_REF_REGEX)).map((match) => ({
                token: match[0],
                examId: (match[1] || '').trim(),
                questionRefId: (match[2] || '').trim()
            }));
            const combinedRefs = [...refsFromChips, ...refsFromText].filter((ref) => ref.examId && ref.questionRefId);
            const dedupRefs = Array.from(new Map(combinedRefs.map((item) => [`${item.examId}:${item.questionRefId}`, item])).values());
            const refContextBlocks: string[] = [];
            if (dedupRefs.length > 0) {
                const examCache = new Map<string, Exam | null>();
                for (const ref of dedupRefs) {
                    const examId = ref.examId;
                    const questionRefId = ref.questionRefId;
                    if (!examId || !questionRefId) continue;

                    if (!examCache.has(examId)) {
                        examCache.set(examId, await getExamContent(examId, true));
                    }
                    const exam = examCache.get(examId);
                    if (!exam) {
                        refContextBlocks.push(`- ${ref.token}: Không tìm thấy đề thi tương ứng.`);
                        continue;
                    }

                    const resolved = resolveQuestionPayload(exam, questionRefId);
                    if (!resolved) {
                        refContextBlocks.push(`- ${ref.token}: Không tìm thấy câu hỏi tương ứng trong đề "${exam.title}".`);
                        continue;
                    }

                    refContextBlocks.push(
                        `- ${ref.token}\n  Môn: ${exam.subjectId}\n  Đề: ${exam.title}\n  Câu: ${resolved.label}\n  Nội dung:\n${resolved.text}`
                    );
                }
            }

            const modeInstruction = RESPONSE_MODE_CONFIG[responseMode].instruction;
            const refsAsText = currentInsertedRefs.map((item) => `[[EXAM_QUESTION:${item.examId}:${item.questionId}]]`).join('\n');
            const userTextForHistory = [userText, refsAsText].filter(Boolean).join('\n');

            // Start building the history text with mode meta and primary text
            richTextForHistory = buildModeMeta(responseMode, userTextForHistory);

            if (userText) {
                aiParts.push({
                    text:
                        `Yêu cầu phản hồi (${RESPONSE_MODE_CONFIG[responseMode].label}): ${modeInstruction}\n\n` +
                        `Nội dung người học: ${userTextForHistory || userText}\n\n` +
                        (refContextBlocks.length > 0
                            ? `Dữ liệu truy xuất tự động từ ID câu hỏi trong hệ thống:\n${refContextBlocks.join('\n\n')}`
                            : '')
                });
            } else if (refsAsText) {
                aiParts.push({
                    text:
                        `Yêu cầu phản hồi (${RESPONSE_MODE_CONFIG[responseMode].label}): ${modeInstruction}\n\n` +
                        `Người học đã chèn ID câu hỏi:\n${refsAsText}\n\n` +
                        (refContextBlocks.length > 0
                            ? `Dữ liệu truy xuất tự động từ ID câu hỏi trong hệ thống:\n${refContextBlocks.join('\n\n')}`
                            : '')
                });
            } else {
                aiParts.push({
                    text: `Yêu cầu phản hồi (${RESPONSE_MODE_CONFIG[responseMode].label}): ${modeInstruction}\n\nNgười học chỉ gửi tệp đính kèm, hãy phân tích nội dung tệp để trả lời.`
                });
            }

            // Process attachments and append to richTextForHistory
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

            setModeTipRemaining((prev) => {
                const next = Math.max(prev - 1, 0);
                localStorage.setItem(MODE_TIP_REMAINING_KEY, String(next));
                return next;
            });
        } catch (err: any) {
            console.error('Mago Chat Error:', err);
            const errorMsg = String(err?.message || 'Lỗi kết nối với Mago');

            if (err?.message === 'MAGO_LIMIT_REACHED') {
                await saveMagoResponse(`Bạn đã hết Magocoin mất rồi! Mong bạn học thêm bài vở hoặc thẻ bài để tôi sớm được hỗ trợ lại bạn nhé 🧙‍♂️!`);
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
                        <span className="limit-text">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {magocoinBalance}
                                <img src="https://i.ibb.co/XkN95yrC/Gemini-Generated-Image-vpnvrgvpnvrgvpnv-removebg-preview.png" alt="Magocoin" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                            </span>
                        </span>
                        <button
                            onClick={() => {
                                const code = window.prompt('Nhập Giftcode Mago của bạn:');
                                if (code && user?.email) {
                                    redeemGiftcodeTransaction(user.email, code).then(res => {
                                        if (res.success) window.alert(`🎉 Chúc mừng! Bạn nhận được ${res.amount} Magocoin.`);
                                        else window.alert(`❌ ${res.error}`);
                                    });
                                }
                            }}
                            className="mago-redeem-button-main"
                        >
                            <img src="https://i.ibb.co/XkN95yrC/Gemini-Generated-Image-vpnvrgvpnvrgvpnv-removebg-preview.png" alt="" />
                            Nhập mã
                        </button>
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

                    {insertedQuestionRefs.length > 0 && (
                        <div className="mago-inserted-questions-area">
                            {insertedQuestionRefs.map((item) => (
                                <div key={item.key} className="mago-inserted-question-chip">
                                    <div className="chip-text">
                                        <span className="chip-top">{item.subjectName} · {item.questionLabel}</span>
                                        <span className="chip-bottom">{item.examTitle}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setInsertedQuestionRefs((prev) => prev.filter((ref) => ref.key !== item.key))}
                                        aria-label="Xóa câu hỏi đã chèn"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
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
                            <button
                                className="mago-import-btn"
                                onClick={() => {
                                    setShowExamQuestionPicker(true);
                                    if (!examPickerSubjectId && subjectOptions.length > 0) {
                                        setExamPickerSubjectId(subjectOptions[0]?.id || '');
                                    }
                                }}
                                disabled={isTyping}
                                type="button"
                                aria-label="Chèn câu hỏi từ đề thi"
                            >
                                <CircleHelp size={16} />
                                <span className="mago-hover-label">Chèn câu hỏi</span>
                            </button>
                            {canTeachMago && (
                                <button
                                    className="mago-import-btn"
                                    onClick={handleOpenKnowledgeManager}
                                    disabled={isTyping}
                                    type="button"
                                    aria-label="Kiến thức đã dạy"
                                >
                                    <Database size={16} />
                                    <span className="mago-hover-label">Kiến thức đã dạy</span>
                                </button>
                            )}
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
                            className={`mago-send-button ${input.trim() || attachments.length > 0 || insertedQuestionRefs.length > 0 ? 'active' : ''}`}
                            disabled={(!input.trim() && attachments.length === 0 && insertedQuestionRefs.length === 0) || isTyping}
                            onClick={handleSend}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {actionMessage && <div className="mago-action-toast">{actionMessage}</div>}

            {showExamQuestionPicker && (
                <div className="mago-picker-overlay" onClick={() => setShowExamQuestionPicker(false)}>
                    <div className="mago-picker-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="mago-picker-header">
                            <h3>Chèn câu hỏi từ đề thi</h3>
                            <button type="button" onClick={() => setShowExamQuestionPicker(false)}>
                                <X size={16} />
                            </button>
                        </div>

                        <div className="mago-picker-grid">
                            <div>
                                <label>Môn học</label>
                                <select
                                    value={examPickerSubjectId}
                                    onChange={(e) => setExamPickerSubjectId(e.target.value)}
                                >
                                    {subjectOptions.map((subject) => (
                                        <option key={subject.id} value={subject.id}>
                                            {subject.icon} {subject.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label>Đề thi</label>
                                <select
                                    value={examPickerExamId}
                                    onChange={(e) => setExamPickerExamId(e.target.value)}
                                >
                                    <option value="">-- Chọn đề thi --</option>
                                    {examPickerFilteredExams.map((exam) => (
                                        <option key={exam.id} value={exam.id}>
                                            {exam.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mago-picker-grid mago-picker-filter-grid">
                            <div>
                                <label>Lọc thư mục</label>
                                <select
                                    value={examPickerFolderFilter}
                                    onChange={(e) => setExamPickerFolderFilter(e.target.value)}
                                >
                                    <option value="ALL">Tất cả thư mục</option>
                                    <option value="UNFILED">Chưa phân thư mục</option>
                                    {examPickerFolderOptions.map((folder) => (
                                        <option key={folder} value={folder}>
                                            {folder}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label>Tìm đề thi</label>
                                <input
                                    type="text"
                                    value={examPickerExamSearch}
                                    onChange={(e) => setExamPickerExamSearch(e.target.value)}
                                    placeholder="Nhập tên đề..."
                                />
                            </div>
                        </div>

                        <div className="mago-picker-question-list">
                            <div className="mago-picker-question-head">
                                <label>Câu hỏi</label>
                                <input
                                    type="text"
                                    value={examPickerQuestionSearch}
                                    onChange={(e) => setExamPickerQuestionSearch(e.target.value)}
                                    placeholder="Tìm câu hỏi..."
                                />
                            </div>
                            {examPickerLoading ? (
                                <div className="mago-picker-empty">Đang tải dữ liệu...</div>
                            ) : examPickerExamId && examPickerQuestions.length === 0 ? (
                                <div className="mago-picker-empty">Đề thi này chưa có câu hỏi.</div>
                            ) : examPickerExamId && examPickerFilteredQuestions.length === 0 ? (
                                <div className="mago-picker-empty">Không tìm thấy câu hỏi phù hợp.</div>
                            ) : (
                                examPickerFilteredQuestions.map((question) => (
                                    <button
                                        key={question.id}
                                        type="button"
                                        className={`mago-picker-question-item ${examPickerQuestionId === question.id ? 'active' : ''}`}
                                        onClick={() => setExamPickerQuestionId(question.id)}
                                    >
                                        <strong>{question.label}</strong>
                                        <div className="mago-picker-question-preview">
                                            {question.text ? (
                                                <LatexContent content={question.text} />
                                            ) : (
                                                <span>(không có nội dung câu hỏi)</span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="mago-picker-actions">
                            <button type="button" onClick={() => setShowExamQuestionPicker(false)}>
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleInsertExamQuestion}
                                disabled={!examPickerQuestionId}
                            >
                                Chèn vào chat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showKnowledgeManager && canTeachMago && (
                <div className="mago-picker-overlay" onClick={() => setShowKnowledgeManager(false)}>
                    <div className="mago-picker-panel mago-knowledge-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="mago-picker-header">
                            <h3>Kiến thức đã dạy (mago_training)</h3>
                            <button type="button" onClick={() => setShowKnowledgeManager(false)}>
                                <X size={16} />
                            </button>
                        </div>

                        <div className="mago-knowledge-body">
                            {knowledgeLoading ? (
                                <div className="mago-picker-empty">Đang tải dữ liệu...</div>
                            ) : knowledgeItems.length === 0 ? (
                                <div className="mago-picker-empty">Chưa có kiến thức nào được dạy.</div>
                            ) : (
                                knowledgeItems.map((item) => {
                                    const isEditing = editingKnowledgeId === item.id;
                                    return (
                                        <div key={item.id} className="mago-knowledge-item">
                                            <div className="mago-knowledge-meta">
                                                <span>{item.createdBy}</span>
                                                <span>{new Date(item.createdAt || Date.now()).toLocaleString()}</span>
                                                <span className={`badge ${item.visibility === 'owner_only' ? 'private' : 'public'}`}>
                                                    {item.visibility === 'owner_only' ? 'Riêng tư' : 'Công khai'}
                                                </span>
                                            </div>

                                            {isEditing ? (
                                                <textarea
                                                    value={editingKnowledgeContent}
                                                    onChange={(e) => setEditingKnowledgeContent(e.target.value)}
                                                    rows={5}
                                                />
                                            ) : (
                                                <p>{item.content}</p>
                                            )}

                                            <div className="mago-knowledge-actions">
                                                {isEditing ? (
                                                    <>
                                                        <button type="button" onClick={handleCancelEditKnowledge}>Hủy</button>
                                                        <button type="button" onClick={handleSaveKnowledge}>Lưu</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button type="button" onClick={() => handleStartEditKnowledge(item)}>
                                                            <Pencil size={13} /> Sửa
                                                        </button>
                                                        <button type="button" className="danger" onClick={() => handleDeleteKnowledge(item)}>
                                                            <Trash2 size={13} /> Xóa
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MagoChatPage;
