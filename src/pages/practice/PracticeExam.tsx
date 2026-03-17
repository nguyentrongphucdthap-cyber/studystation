import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getExamContent,
    logPracticeAttempt,
    savePracticeResult,
    getSubjects,
    getPracticeHistory,
} from '@/services/exam.service';
import { logUserActivity } from '@/services/auth.service';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn, formatTime } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { AlertDialog, ConfirmDialog } from '@/components/ui/Dialog';
import { LatexContent } from '@/components/ui/LatexContent';
import type { Exam, Part1Question, Part2Question, Part3Question, PracticeHistory } from '@/types';
import {
    ArrowLeft,
    Clock,
    CheckCircle,
    XCircle,
    Send,
    RotateCcw,
    Eye,
    BookOpen,
    MinusCircle,
    ChevronDown,
    ChevronUp,
    History,
    Trophy,
    Shuffle,
    ChevronUp as ArrowUp,
    List,
    Target,
    X,
} from 'lucide-react';

type ExamMode = 'ready' | 'taking' | 'result';

export default function PracticeExam() {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { user, isGuest } = useAuth();
    const { settings } = useTheme();

    const [exam, setExam] = useState<Exam | null>(null);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<ExamMode>('ready');

    // Timer
    const [timeLeft, setTimeLeft] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const startTimeRef = useRef(0);

    // Answers — use undefined-safe types
    // Part 1: map questionId → chosen option index (0-3) | undefined
    const [part1Answers, setPart1Answers] = useState<Record<number, number | undefined>>({});
    // Part 2: map "qId-subId" → boolean | undefined
    const [part2Answers, setPart2Answers] = useState<Record<string, boolean | undefined>>({});
    // Part 3: map questionId → user text
    const [part3Answers, setPart3Answers] = useState<Record<number, string>>({});

    // Results
    const [score, setScore] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [duration, setDuration] = useState(0);
    const [examHistory, setExamHistory] = useState<PracticeHistory[]>([]);
    const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});

    // Shuffled versions of questions
    const [shuffledP1, setShuffledP1] = useState<Part1Question[]>([]);
    const [shuffledP2, setShuffledP2] = useState<Part2Question[]>([]);
    const [shuffledP3, setShuffledP3] = useState<Part3Question[]>([]);
    const [isShuffled, setIsShuffled] = useState(false);
    
    // Feature: Practice Mode (One-by-one)
    const [isPracticeMode, setIsPracticeMode] = useState(false);
    const [currentPracticeIdx, setCurrentPracticeIdx] = useState(0);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
    const [resultFilter, setResultFilter] = useState<'all' | 'correct' | 'incorrect'>('all');

    // UI
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [showAnswerSheet, setShowAnswerSheet] = useState(false);
    const [showMobileTOC, setShowMobileTOC] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [isNavbarVisible, setIsNavbarVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [alertState, setAlertState] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        open: false, title: '', message: '', type: 'info',
    });
    const [showFeedback, setShowFeedback] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [wrongOptId, setWrongOptId] = useState<number | null>(null);
    const [wrongSubQId, setWrongSubQId] = useState<string | null>(null);
    const [wrongPart3, setWrongPart3] = useState(false);

    // Practice Queue
    const practiceQueue = useMemo(() => {
        return [
            ...shuffledP1.map(q => ({ type: 'p1', id: q.id, data: q })),
            ...shuffledP2.map(q => ({ type: 'p2', id: q.id, data: q })),
            ...shuffledP3.map(q => ({ type: 'p3', id: q.id, data: q }))
        ];
    }, [shuffledP1, shuffledP2, shuffledP3]);

    useEffect(() => {
        async function load() {
            if (!examId) return;
            try {
                const [examData, historyData] = await Promise.all([
                    getExamContent(examId),
                    getPracticeHistory(examId).catch(() => []) // Fallback for history
                ]);
                setExam(examData);
                setExamHistory(historyData);
                if (examData) {
                    setTimeLeft(examData.time * 60);
                    setShuffledP1(examData.part1 || []);
                    setShuffledP2(examData.part2 || []);
                    setShuffledP3(examData.part3 || []);
                    
                    // Log viewing the exam
                    logUserActivity('PracticeExam', `Xem đề: ${examData.title}`);
                }
            } catch (err) {
                console.error('[PracticeExam] Load error:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [examId]);

    // Timer
    useEffect(() => {
        if (mode === 'taking' && timeLeft > 0 && !isPracticeMode) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        handleSubmit();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [mode]);

    useEffect(() => {
        if (mode !== 'result') {
            setShowAnswerSheet(false);
        }
    }, [mode]);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            
            // Show/hide scroll to top button
            setShowScrollTop(currentScrollY > 400);

            // Handle navbar visibility based on scroll direction
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                // Scrolling down - hide
                setIsNavbarVisible(false);
            } else {
                // Scrolling up - show
                setIsNavbarVisible(true);
            }
            
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    const handleStart = () => {
        setMode('taking');
        startTimeRef.current = Date.now();
    };

    // Helper: Fisher-Yates shuffle
    const shuffleArray = <T,>(array: T[]): T[] => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = arr[i]!;
            arr[i] = arr[j]!;
            arr[j] = temp;
        }
        return arr;
    };

    const handleShuffle = () => {
        if (!exam) return;

        // Current answers for mapping if needed
        const newPart1Answers = { ...part1Answers };

        // Shuffle Part 1: Shuffle questions + shuffle options within questions
        // We'll map the current selected option index to the new index
        const newP1 = shuffleArray(shuffledP1.length > 0 ? shuffledP1 : (exam.part1 || [])).map(q => {
            const currentSelectedIdx = part1Answers[q.id];
            const originalOptions = [...q.options];
            const originalCorrectText = (q.options[q.correct] || '') as string;
            
            // If user had selected an answer, find its text
            const selectedText = currentSelectedIdx !== undefined ? originalOptions[currentSelectedIdx] : null;

            const newOptions = shuffleArray(originalOptions);
            const newCorrect = newOptions.indexOf(originalCorrectText);
            
            // Update the answer in part1Answers if exists
            if (selectedText !== null && selectedText !== undefined) {
                const newSelectedIdx = newOptions.indexOf(selectedText);
                newPart1Answers[q.id] = newSelectedIdx === -1 ? undefined : newSelectedIdx;
            }

            return {
                ...q,
                options: newOptions,
                correct: (newCorrect === -1 ? 0 : newCorrect) as 0 | 1 | 2 | 3
            };
        });

        // Shuffle Part 2 & 3 questions (order only)
        const newP2 = shuffleArray(shuffledP2.length > 0 ? shuffledP2 : (exam.part2 || []));
        const newP3 = shuffleArray(shuffledP3.length > 0 ? shuffledP3 : (exam.part3 || []));

        setShuffledP1(newP1);
        setShuffledP2(newP2);
        setShuffledP3(newP3);
        setPart1Answers(newPart1Answers);
        setIsShuffled(true);

        setAlertState({
            open: true,
            title: 'Đã xáo trộn!',
            message: 'Thứ tự câu hỏi và đáp án đã được thay đổi ngẫu nhiên.',
            type: 'success'
        });
    };

    const handleResetQuestions = () => {
        if (!exam) return;
        
        // When resetting, we need to map the answers back to the original indices
        const newPart1Answers = { ...part1Answers };
        (exam.part1 || []).forEach(originalQ => {
            const currentDisplayQ = shuffledP1.find(q => q.id === originalQ.id);
            if (currentDisplayQ) {
                const currentSelectedIdx = part1Answers[originalQ.id];
                if (currentSelectedIdx !== undefined) {
                    const selectedText = currentDisplayQ.options[currentSelectedIdx];
                    if (selectedText !== undefined) {
                        const originalIdx = originalQ.options.indexOf(selectedText);
                        newPart1Answers[originalQ.id] = originalIdx === -1 ? undefined : originalIdx;
                    }
                }
            }
        });

        setShuffledP1(exam.part1 || []);
        setShuffledP2(exam.part2 || []);
        setShuffledP3(exam.part3 || []);
        setPart1Answers(newPart1Answers);
        setIsShuffled(false);
        setAlertState({
            open: true,
            title: 'Đã khôi phục!',
            message: 'Thứ tự câu hỏi đã quay lại ban đầu.',
            type: 'info'
        });
    };

    const handlePart1Select = (qId: number, optionIdx: number) => {
        if (isPracticeMode) {
            const currentQ = practiceQueue[currentPracticeIdx];
            if (currentQ?.type === 'p1') {
                const correctIdx = (currentQ.data as Part1Question).correct;
                if (optionIdx === correctIdx) {
                    setPart1Answers({ ...part1Answers, [qId]: optionIdx });
                    setShowFeedback(true);
                } else {
                    setWrongOptId(optionIdx);
                    setTimeout(() => setWrongOptId(null), 800);
                }
            }
        } else {
            setPart1Answers({ ...part1Answers, [qId]: optionIdx });
        }
    };

    const handlePart2Select = (qId: number, sqId: string, value: boolean) => {
        if (isPracticeMode) {
            const currentQ = practiceQueue[currentPracticeIdx];
            if (currentQ?.type === 'p2') {
                const subQ = (currentQ.data as Part2Question).subQuestions.find(s => s.id === sqId);
                if (subQ) {
                    if (value === subQ.correct) {
                        const newPart2Answers = { ...part2Answers, [`${qId}-${sqId}`]: value };
                        setPart2Answers(newPart2Answers);
                        const answeredAll = (currentQ.data as Part2Question).subQuestions.every(sq => newPart2Answers[`${currentQ.id}-${sq.id}`] !== undefined);
                        if (answeredAll) setShowFeedback(true);
                    } else {
                        setWrongSubQId(`${qId}-${sqId}-${value}`);
                        setTimeout(() => setWrongSubQId(null), 800);
                    }
                }
            }
        } else {
            setPart2Answers({ ...part2Answers, [`${qId}-${sqId}`]: value });
        }
    };

    const handlePart3Change = (qId: number, value: string) => {
        setPart3Answers({ ...part3Answers, [qId]: value });
    };
    
    const handlePart3Submit = (_qId: number) => {
        if (isPracticeMode) {
            const q = practiceQueue[currentPracticeIdx];
            if (q?.type === 'p3') {
                const userAns = (part3Answers[q.id] || '').trim().toLowerCase();
                const correctAns = (q.data as Part3Question).correct.trim().toLowerCase();
                if (userAns === correctAns) {
                    setShowFeedback(true);
                    setWrongPart3(false);
                } else {
                    setWrongPart3(true);
                    setTimeout(() => setWrongPart3(false), 1500);
                }
            }
        }
    };

    const handleSubmit = useCallback(async () => {
        clearInterval(timerRef.current);
        if (!exam) return;

        let correct = 0;
        let total = 0;

        // ── Part 1 ──
        // Important: use CURRENT display questions (shuffledP1) because indices in part1Answers match them
        shuffledP1.forEach((q: Part1Question) => {
            total++;
            const userAns = part1Answers[q.id];
            if (userAns !== undefined && userAns === q.correct) {
                correct++;
            }
        });

        // ── Part 2 ──
        shuffledP2.forEach((q: Part2Question) => {
            q.subQuestions.forEach((sq) => {
                total++;
                const key = `${q.id}-${sq.id}`;
                const userAns = part2Answers[key];
                if (userAns !== undefined && userAns === sq.correct) {
                    correct++;
                }
            });
        });

        // ── Part 3 ──
        shuffledP3.forEach((q: Part3Question) => {
            total++;
            const userAnswer = (part3Answers[q.id] || '').trim().toLowerCase();
            const correctAnswer = q.correct.trim().toLowerCase();
            if (userAnswer && correctAnswer && userAnswer === correctAnswer) {
                correct++;
            }
        });

        const finalScore = total > 0 ? Math.round((correct / total) * 10 * 10) / 10 : 0;
        const dur = Math.round((Date.now() - startTimeRef.current) / 1000);

        setScore(finalScore);
        setCorrectCount(correct);
        setTotalQuestions(total);
        setDuration(dur);
        setMode('result');

        // Save to Firebase
        try {
            await logPracticeAttempt(exam.id, exam.title, exam.subjectId, 'classic', dur);
            if (!isGuest && user) {
                const newAttemptId = crypto.randomUUID(); // Fallback ID for local optimism
                await savePracticeResult({
                    examId: exam.id,
                    examTitle: exam.title,
                    subjectId: exam.subjectId,
                    score: finalScore,
                    correctCount: correct,
                    totalQuestions: total,
                    durationSeconds: dur,
                    answers: { part1: part1Answers, part2: part2Answers, part3: part3Answers },
                });
                
                // Optimistically update local examHistory so it instantly appears on chart
                setExamHistory(prev => [{
                    id: newAttemptId,
                    userId: user.uid,
                    examId: exam.id,
                    examTitle: exam.title,
                    subjectId: exam.subjectId,
                    score: finalScore,
                    correctCount: correct,
                    totalQuestions: total,
                    durationSeconds: dur,
                    answers: { part1: part1Answers, part2: part2Answers, part3: part3Answers },
                    timestamp: new Date().toISOString()
                }, ...prev]);
            }
        } catch (err) {
            console.error('[Practice] Save result error:', err);
        }
    }, [exam, part1Answers, part2Answers, part3Answers, user, isGuest]);

    const handleSkip = () => {
        const q = practiceQueue[currentPracticeIdx];
        if (!q) return;

        if (q.type === 'p1') {
            const item = shuffledP1.find(x => x.id === q.id);
            if (item) setShuffledP1(prev => [...prev.filter(x => x.id !== q.id), item]);
        } else if (q.type === 'p2') {
            const item = shuffledP2.find(x => x.id === q.id);
            if (item) setShuffledP2(prev => [...prev.filter(x => x.id !== q.id), item]);
        } else if (q.type === 'p3') {
            const item = shuffledP3.find(x => x.id === q.id);
            if (item) setShuffledP3(prev => [...prev.filter(x => x.id !== q.id), item]);
        }
        setShowFeedback(false);
    };

    const handleNextPractice = () => {
        if (!practiceQueue || practiceQueue.length === 0) return;
        
        // Find next unanswered question
        let nextIdx = -1;
        
        // Check from current + 1 to end
        for (let i = currentPracticeIdx + 1; i < practiceQueue.length; i++) {
            const q = practiceQueue[i];
            if (!q) continue;
            const isAnswered = q.type === 'p1' ? part1Answers[q.id] !== undefined :
                              q.type === 'p2' ? (q.data as Part2Question).subQuestions.every(sq => part2Answers[`${q.id}-${sq.id}`] !== undefined) :
                              (part3Answers[q.id] || '').trim().length > 0;
            if (!isAnswered) {
                nextIdx = i;
                break;
            }
        }
        
        // If not found, check from 0 to current
        if (nextIdx === -1) {
            for (let i = 0; i < currentPracticeIdx; i++) {
                const q = practiceQueue[i];
                if (!q) continue;
                const isAnswered = q.type === 'p1' ? part1Answers[q.id] !== undefined :
                                  q.type === 'p2' ? (q.data as Part2Question).subQuestions.every(sq => part2Answers[`${q.id}-${sq.id}`] !== undefined) :
                                  (part3Answers[q.id] || '').trim().length > 0;
                if (!isAnswered) {
                    nextIdx = i;
                    break;
                }
            }
        }

        if (nextIdx !== -1) {
            setCurrentPracticeIdx(nextIdx);
            setShowFeedback(false);
        } else {
            handleSubmit();
        }
    };

    const handleReset = () => {
        setPart1Answers({});
        setPart2Answers({});
        setPart3Answers({});
        setScore(0);
        setCorrectCount(0);
        setTotalQuestions(0);
        if (exam) setTimeLeft(exam.time * 60);
        setMode('ready');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner size="lg" label="Đang tải đề thi..." />
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="py-20 text-center">
                <p className="text-muted-foreground">Không tìm thấy đề thi</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/practice')}>
                    <ArrowLeft className="h-4 w-4" /> Quay lại
                </Button>
            </div>
        );
    }

    const subject = getSubjects().find((s) => s.id === exam.subjectId);

    // ==================== READY VIEW ====================
    if (mode === 'ready') {
        const totalQ = (exam.part1?.length || 0) +
            (exam.part2 || []).reduce((sum: number, q: Part2Question) => sum + q.subQuestions.length, 0) +
            (exam.part3?.length || 0);

        return (
            <div className="mx-auto max-w-lg">
                <button onClick={() => navigate('/practice')} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
                </button>

                <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
                    <div className="mb-4 text-5xl">{subject?.icon || '📝'}</div>
                    <h1 className="mb-2 text-xl font-bold">{exam.title}</h1>
                    <p className="text-sm text-muted-foreground">{subject?.name}</p>

                    <div className="my-6 flex justify-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" /> {exam.time} phút
                        </div>
                        <div className="flex items-center gap-1.5">
                            <BookOpen className="h-4 w-4" /> {totalQ} câu hỏi
                        </div>
                    </div>

                    <div className="mb-6 rounded-lg bg-muted/50 p-3 text-left text-xs text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">📋 Cấu trúc đề:</p>
                        {(exam.part1?.length || 0) > 0 && <p>• Phần 1: {exam.part1?.length} câu trắc nghiệm</p>}
                        {(exam.part2?.length || 0) > 0 && (
                            <p>• Phần 2: {exam.part2?.length} câu Đúng/Sai ({(exam.part2 || []).reduce((s: number, q: Part2Question) => s + q.subQuestions.length, 0)} ý)</p>
                        )}
                        {(exam.part3?.length || 0) > 0 && <p>• Phần 3: {exam.part3?.length} câu trả lời ngắn</p>}
                    </div>

                    <Button size="xl" className="w-full" onClick={handleStart}>
                        🚀 Bắt đầu làm bài
                    </Button>
                </div>

                {/* Specific Exam History */}
                {!isGuest && examHistory.length > 0 && (
                    <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-5">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2 px-2">
                            <History size={16} /> Lịch sử gần đây
                        </h3>
                        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 shadow-soft overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 font-bold text-gray-500 uppercase text-[10px]">Ngày làm</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 uppercase text-[10px] text-center">Thời gian</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 uppercase text-[10px] text-right">Điểm số</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {examHistory.slice(0, 5).map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50/50 transition-all">
                                            <td className="px-4 py-3 text-gray-600 font-medium">
                                                {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 text-center font-bold">
                                                {formatTime(log.durationSeconds)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={cn(
                                                    "font-black",
                                                    log.score >= 8 ? "text-emerald-600" : log.score >= 5 ? "text-amber-600" : "text-red-500"
                                                )}>
                                                    {log.score.toFixed(1)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ==================== TAKING VIEW ====================
    if (mode === 'taking' && exam) {
        const p1Answered = Object.values(part1Answers).filter(v => v !== undefined).length;
        const p2Answered = Object.values(part2Answers).filter(v => v !== undefined).length;
        const p3Answered = Object.values(part3Answers).filter(v => (v || '').trim()).length;

        const totalQs = shuffledP1.length + (shuffledP2.reduce((acc, q) => acc + q.subQuestions.length, 0)) + shuffledP3.length;
        const answeredQs = p1Answered + p2Answered + p3Answered;
        const completionPercent = totalQs > 0 ? Math.round((answeredQs / totalQs) * 100) : 0;

        const isTimeLow = timeLeft < 300;

        const scrollToQuestion = (id: string | number) => {
            const el = document.getElementById(`q-${id}`);
            if (el) {
                const offset = 100;
                const bodyRect = document.body.getBoundingClientRect().top;
                const elementRect = el.getBoundingClientRect().top;
                const elementPosition = elementRect - bodyRect;
                const offsetPosition = elementPosition - offset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        };


        return (
            <div className="mx-auto w-full px-4 lg:px-8">
                {/* Timer header */}
                <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm lg:-mx-8 lg:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setShowSubmitConfirm(true)} className="p-1 hover:bg-muted rounded-full transition-colors">
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <h2 className="text-sm font-bold truncate max-w-[150px] sm:max-w-none lg:text-base flex items-center gap-2">
                                {exam.title}
                                {isShuffled && (
                                    <span 
                                        className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider"
                                        style={{ backgroundColor: `rgba(var(--accent-rgb), 0.15)`, color: settings.accentColor }}
                                    >
                                        Đang xáo trộn
                                    </span>
                                )}
                            </h2>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Shuffle/Reset Buttons */}
                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={handleShuffle}
                                    title="Xáo trộn đề thi"
                                    className="h-8 px-2 text-slate-600 hover:text-blue-600 dark:text-slate-400"
                                >
                                    <Shuffle className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Xáo trộn</span>
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={handleResetQuestions}
                                    title="Khôi phục thứ tự ban đầu"
                                    className="h-8 px-2 text-slate-600 hover:text-amber-600 dark:text-slate-400"
                                >
                                    <RotateCcw className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Khôi phục</span>
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => {
                                        setIsPracticeMode(!isPracticeMode);
                                        setCurrentPracticeIdx(0);
                                        setShowFeedback(false);
                                    }}
                                    title={isPracticeMode ? "Chuyển sang chế độ Cổ điển" : "Chuyển sang chế độ Luyện tập"}
                                    className={cn(
                                        "h-8 px-2 transition-all",
                                        isPracticeMode ? "text-emerald-600 bg-emerald-50" : "text-slate-600 dark:text-slate-400"
                                    )}
                                >
                                    <Target className={cn("h-4 w-4 mr-1", isPracticeMode && "animate-pulse")} />
                                    <span className="hidden sm:inline">Luyện tập</span>
                                </Button>
                            </div>

                            <div className={cn(
                                'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-mono font-bold transition-all',
                                isTimeLow ? 'bg-red-100 text-red-700 animate-pulse dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-foreground'
                            )}>
                                <Clock className="h-4 w-4" />
                                {formatTime(timeLeft)}
                            </div>
                                {isPracticeMode && !showSidebar && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setShowSidebar(true)}
                                        className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-slate-200"
                                        title="Hiện mục lục"
                                    >
                                        <BookOpen className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button size="sm" onClick={() => setShowSubmitConfirm(true)} className="hidden sm:flex">
                                    <Send className="h-3.5 w-3.5" /> Nộp bài
                                </Button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                    {/* Main Content: Questions */}
                    <div className="flex-1 space-y-8 min-w-0">
                        {isPracticeMode ? (
                            <div className="space-y-6">
                                {(() => {
                                    const q = practiceQueue[currentPracticeIdx];
                                    if (!q) return <div className="text-center py-20 text-muted-foreground">Đã hoàn thành tất cả câu hỏi!</div>;
                                    
                                    const isCorrect = (() => {
                                        if (q.type === 'p1') return part1Answers[q.id] === (q.data as Part1Question).correct;
                                        if (q.type === 'p2') return (q.data as Part2Question).subQuestions.every(sq => part2Answers[`${q.id}-${sq.id}`] === sq.correct);
                                        if (q.type === 'p3') return (part3Answers[q.id] || '').trim().toLowerCase() === (q.data as Part3Question).correct.trim().toLowerCase();
                                        return false;
                                    })();

                                    return (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                            {/* Progress bar for Practice Mode */}
                                            <div className="bg-muted rounded-full h-2 w-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500 transition-all duration-500" 
                                                    style={{ width: `${((currentPracticeIdx + 1) / practiceQueue.length) * 100}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                                <span>Câu {currentPracticeIdx + 1} / {practiceQueue.length}</span>
                                                <span className="text-emerald-600">Độ chính xác: {Math.round((correctCount / (answeredQs || 1)) * 100)}%</span>
                                            </div>

                                            {/* Question Card */}
                                            <div className="rounded-2xl border border-border bg-card p-6 shadow-lg min-h-[300px] flex flex-col">
                                                <div className="mb-6 text-lg font-semibold leading-relaxed">
                                                    <span className={cn(
                                                        "mr-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold",
                                                        q.type === 'p1' ? "bg-blue-100 text-blue-600" : q.type === 'p2' ? "bg-amber-100 text-amber-600" : "bg-violet-100 text-violet-600"
                                                    )}>
                                                        {currentPracticeIdx + 1}
                                                    </span>
                                                    <LatexContent content={q.data.text} />
                                                </div>

                                                {q.data.image && (
                                                    <div className="mb-6 flex justify-center">
                                                        <img src={q.data.image} alt="" className="max-h-80 rounded-xl object-contain shadow-md" />
                                                    </div>
                                                )}

                                                <div className="flex-1">
                                                    {q.type === 'p1' && (
                                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                            {(q.data as Part1Question).options.map((opt, oIdx) => {
                                                                const isSelected = part1Answers[q.id] === oIdx;
                                                                const isCorrectOpt = oIdx === (q.data as Part1Question).correct;
                                                                const isWrongFlash = wrongOptId === oIdx;
                                                                return (
                                                                    <button
                                                                        key={oIdx}
                                                                        onClick={() => handlePart1Select(q.id, oIdx)}
                                                                        disabled={showFeedback && isCorrect}
                                                                        className={cn(
                                                                            'group flex items-center rounded-xl border-2 p-4 text-left text-sm transition-all duration-200 active:scale-[0.97]',
                                                                            isSelected
                                                                                ? (isCorrectOpt ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-red-500 bg-red-50 text-red-900 animate-shake')
                                                                                : isWrongFlash
                                                                                    ? 'border-red-500 bg-red-50 text-red-900 animate-shake'
                                                                                    : (showFeedback && isCorrect && isCorrectOpt ? 'border-emerald-500 bg-emerald-50/50' : 'border-transparent bg-muted/30 hover:border-blue-300 hover:bg-muted/60')
                                                                        )}
                                                                    >
                                                                        <span className={cn(
                                                                            'mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold transition-all',
                                                                            isSelected
                                                                                ? (isCorrectOpt ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-red-500 border-red-500 text-white')
                                                                                : isWrongFlash
                                                                                    ? 'bg-red-500 border-red-500 text-white'
                                                                                    : 'border-muted-foreground/30 bg-background text-muted-foreground'
                                                                        )}>
                                                                            {String.fromCharCode(65 + oIdx)}
                                                                        </span>
                                                                        <LatexContent content={opt} />
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {q.type === 'p2' && (
                                                        <div className="space-y-4">
                                                            {(q.data as Part2Question).subQuestions.map((sq) => {
                                                                const key = `${q.id}-${sq.id}`;
                                                                const userAns = part2Answers[key];
                                                                return (
                                                                    <div key={key} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center">
                                                                        <div className="flex flex-1 items-start gap-2">
                                                                            <span className="mt-0.5 text-xs font-black text-amber-600 uppercase">{sq.id})</span>
                                                                            <LatexContent content={sq.text} className="text-sm leading-relaxed" />
                                                                        </div>
                                                                        <div className="flex shrink-0 items-center gap-2">
                                                                            {[true, false].map((val) => (
                                                                                <button
                                                                                    key={val ? 'T' : 'F'}
                                                                                    onClick={() => handlePart2Select(q.id, sq.id, val)}
                                                                                    disabled={showFeedback && isCorrect}
                                                                                    className={cn(
                                                                                        'flex h-10 w-12 items-center justify-center rounded-lg text-sm font-bold transition-all border-2',
                                                                                        userAns === val 
                                                                                            ? (val === sq.correct ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-red-500 border-red-500 text-white shadow-md animate-shake') 
                                                                                            : wrongSubQId === `${q.id}-${sq.id}-${val}`
                                                                                                ? 'bg-red-500 border-red-500 text-white shadow-md animate-shake'
                                                                                                : (showFeedback && isCorrect && val === sq.correct ? 'border-emerald-500 text-emerald-600' : 'bg-background text-muted-foreground border-slate-100')
                                                                                    )}
                                                                                >
                                                                                    {val ? 'Đ' : 'S'}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {q.type === 'p3' && (
                                                        <div className="space-y-4">
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={part3Answers[q.id] || ''}
                                                                    onChange={(e) => handlePart3Change(q.id, e.target.value)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && handlePart3Submit(q.id)}
                                                                    placeholder="Nhập câu trả lời..."
                                                                    disabled={showFeedback && isCorrect}
                                                                    className={cn( // Fixed: Added cn()
                                                                        "w-full rounded-xl border px-4 py-4 text-base font-medium outline-none transition-all",
                                                                        wrongPart3 
                                                                            ? "border-red-500 bg-red-50 text-red-900 animate-shake"
                                                                            : showFeedback 
                                                                                ? (isCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-red-500 bg-red-50 text-red-900")
                                                                                : "border-input bg-background focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                                                                    )}
                                                                />
                                                                {!showFeedback && (
                                                                    <Button 
                                                                        size="sm" 
                                                                        onClick={() => handlePart3Submit(q.id)}
                                                                        className="absolute right-2 top-2 bottom-2 bg-violet-600 hover:bg-violet-700"
                                                                    >
                                                                        Kiểm tra
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            {showFeedback && !isCorrect && (
                                                                <p className="text-xs text-red-600 font-bold animate-shake">Chưa chính xác, hãy thử lại!</p>
                                                            )}
                                                            {showFeedback && isCorrect && (
                                                                <div className="p-4 rounded-xl bg-emerald-100 text-emerald-800 text-sm font-bold animate-bounce-in">
                                                                    ✨ Chính xác! Đáp án là: {(q.data as Part3Question).correct}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Navigation Buttons for Practice Mode */}
                                                <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row gap-4 justify-between items-center">
                                                    <Button variant="ghost" className="text-muted-foreground" onClick={handleSkip}>
                                                        <RotateCcw className="h-4 w-4 mr-2" /> Bỏ qua & làm sau
                                                    </Button>
                                                    
                                                    <div className="flex gap-3 w-full sm:w-auto">
                                                        {showFeedback && (
                                                            <Button 
                                                                className={cn(
                                                                    "flex-1 sm:w-40 font-bold h-12 rounded-xl transition-all",
                                                                    isCorrect ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-slate-200 text-slate-500 cursor-not-allowed"
                                                                )}
                                                                disabled={!isCorrect}
                                                                onClick={handleNextPractice}
                                                            >
                                                                {currentPracticeIdx === practiceQueue.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Explanation (Shown when correct) */}
                                            {showFeedback && isCorrect && (q.data as any).explanation && (
                                                <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100 animate-in fade-in zoom-in-95 duration-500">
                                                    <h5 className="flex items-center gap-2 text-blue-700 font-black text-xs uppercase tracking-widest mb-3">
                                                        <BookOpen size={16} /> Lời giải chi tiết
                                                    </h5>
                                                    <div className="text-sm text-blue-900 leading-relaxed">
                                                        <LatexContent content={(q.data as any).explanation} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <>
                                {/* Part 1 */}
                                {shuffledP1.length > 0 && (
                            <section>
                                <div className="mb-4 flex items-center gap-2 border-l-4 border-blue-500 pl-3">
                                    <h3 className="text-xl font-bold">Phần 1: Trắc nghiệm</h3>
                                    <span className="text-sm text-muted-foreground">({shuffledP1.length} câu)</span>
                                </div>
                                <div className="space-y-6">
                                    {shuffledP1.map((q, idx) => (
                                        <div key={q.id} id={`q-p1-${q.id}`} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
                                            <div className="mb-4 text-base font-semibold leading-relaxed">
                                                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-600">
                                                    {idx + 1}
                                                </span>
                                                <LatexContent content={q.text} />
                                            </div>
                                            {q.image && (
                                                <div className="mb-4 flex justify-center">
                                                    <img src={q.image} alt="" className="max-h-64 rounded-xl object-contain shadow-sm" />
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                {q.options.map((opt, oIdx) => {
                                                    const isSelected = part1Answers[q.id] === oIdx;
                                                    return (
                                                        <button
                                                            key={oIdx}
                                                            onClick={() => handlePart1Select(q.id, oIdx)}
                                                            className={cn(
                                                                'group flex items-center rounded-xl border-2 p-4 text-left text-sm transition-all duration-200 ease-out active:scale-[0.97]',
                                                                isSelected
                                                                    ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm'
                                                                    : 'border-transparent bg-muted/30 hover:border-blue-300 hover:bg-muted/60'
                                                            )}
                                                        >
                                                            <span className={cn(
                                                                'mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold transition-all duration-200',
                                                                isSelected
                                                                    ? 'border-blue-500 bg-blue-500 text-white'
                                                                    : 'border-muted-foreground/30 bg-background text-muted-foreground'
                                                            )}>
                                                                {String.fromCharCode(65 + oIdx)}
                                                            </span>
                                                            <LatexContent content={opt} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Part 2 */}
                        {shuffledP2.length > 0 && (
                            <section>
                                <div className="mb-4 flex items-center gap-2 border-l-4 border-amber-500 pl-3">
                                    <h3 className="text-xl font-bold">Phần 2: Đúng/Sai</h3>
                                    <span className="text-sm text-muted-foreground">({shuffledP2.length} câu)</span>
                                </div>
                                <div className="space-y-6">
                                    {shuffledP2.map((q, idx) => (
                                        <div key={q.id} id={`q-p2-${q.id}`} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                                            <div className="mb-4 text-base font-semibold leading-relaxed">
                                                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-600">
                                                    {(shuffledP1.length) + idx + 1}
                                                </span>
                                                <LatexContent content={q.text} />
                                            </div>
                                            <div className="space-y-3">
                                                {q.subQuestions.map((sq) => {
                                                    const key = `${q.id}-${sq.id}`;
                                                    const userAns = part2Answers[key];
                                                    return (
                                                        <div key={key} className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-center">
                                                            <div className="flex flex-1 items-start gap-2">
                                                                <span className="mt-0.5 text-xs font-black text-amber-600 uppercase">{sq.id})</span>
                                                                <LatexContent content={sq.text} className="text-sm leading-relaxed" />
                                                            </div>
                                                            <div className="flex shrink-0 items-center gap-2">
                                                                <button
                                                                    onClick={() => handlePart2Select(q.id, sq.id, true)}
                                                                    className={cn(
                                                                        'flex h-10 w-12 items-center justify-center rounded-lg text-sm font-bold transition-all border-2',
                                                                        userAns === true 
                                                                            ? 'text-white shadow-md' 
                                                                            : 'bg-background hover:bg-slate-50 text-muted-foreground border-slate-100'
                                                                    )}
                                                                    style={userAns === true ? { backgroundColor: settings.accentColor, borderColor: settings.accentColor } : {}}
                                                                >
                                                                    Đ
                                                                </button>
                                                                <button
                                                                    onClick={() => handlePart2Select(q.id, sq.id, false)}
                                                                    className={cn(
                                                                        'flex h-10 w-12 items-center justify-center rounded-lg text-sm font-bold transition-all border-2',
                                                                        userAns === false 
                                                                            ? 'text-white shadow-md' 
                                                                            : 'bg-background hover:bg-slate-50 text-muted-foreground border-slate-100'
                                                                    )}
                                                                    style={userAns === false ? { backgroundColor: settings.accentColor, borderColor: settings.accentColor } : {}}
                                                                >
                                                                    S
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Part 3 */}
                        {shuffledP3.length > 0 && (
                            <section>
                                <div className="mb-4 flex items-center gap-2 border-l-4 border-violet-500 pl-3">
                                    <h3 className="text-xl font-bold">Phần 3: Trả lời ngắn</h3>
                                    <span className="text-sm text-muted-foreground">({shuffledP3.length} câu)</span>
                                </div>
                                <div className="space-y-6">
                                    {shuffledP3.map((q, idx) => (
                                        <div key={q.id} id={`q-p3-${q.id}`} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                                            <div className="mb-4 text-base font-semibold leading-relaxed">
                                                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-600">
                                                    {(shuffledP1.length) + (shuffledP2.length) + idx + 1}
                                                </span>
                                                <LatexContent content={q.text} />
                                            </div>
                                            <input
                                                type="text"
                                                value={part3Answers[q.id] || ''}
                                                onChange={(e) => handlePart3Change(q.id, e.target.value)}
                                                placeholder="Nhập câu trả lời..."
                                                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                        </>
                    )}
                    </div>

                    {/* Sidebar: Table of Contents — scrolls with user */}
                    {showSidebar && (
                        <aside className="hidden w-full shrink-0 lg:block lg:w-[280px] lg:sticky lg:top-[120px] lg:self-start transition-all animate-in slide-in-from-right-4">
                            <div className="relative rounded-2xl border border-border bg-card p-5 shadow-lg">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute top-3 right-3 h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
                                    onClick={() => setShowSidebar(false)}
                                    title="Ẩn mục lục"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                    <BookOpen className="h-4 w-4" /> Mục lục
                                </h4>

                            {/* Progress summary */}
                            <div className="mb-4 flex gap-2 text-xs">
                                <span className="flex-1 text-center rounded-lg bg-primary/10 text-primary font-bold py-1">
                                    {p1Answered + p2Answered + p3Answered}/{shuffledP1.length + (shuffledP2.reduce((acc, q) => acc + q.subQuestions.length, 0)) + shuffledP3.length} đã làm
                                </span>
                                {isShuffled && (
                                    <span className="flex-1 text-center rounded-lg bg-blue-100 text-blue-600 font-bold py-1">
                                        Đã xáo trộn
                                    </span>
                                )}
                            </div>

                            <div className="space-y-5">
                                {/* Part 1 TOC */}
                                {shuffledP1.length > 0 && (
                                    <div>
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Phần 1</span>
                                            <span className="text-[10px] text-muted-foreground">{p1Answered}/{shuffledP1.length}</span>
                                        </div>
                                        <div className="grid grid-cols-5 gap-1.5">
                                            {shuffledP1.map((q, idx) => {
                                                const isCurrent = isPracticeMode && practiceQueue[currentPracticeIdx]?.id === q.id && practiceQueue[currentPracticeIdx]?.type === 'p1';
                                                return (
                                                    <button
                                                        key={q.id}
                                                        onClick={() => {
                                                            if (isPracticeMode) {
                                                                const qIdx = practiceQueue.findIndex(x => x.type === 'p1' && x.id === q.id);
                                                                if (qIdx !== -1) {
                                                                    setCurrentPracticeIdx(qIdx);
                                                                    setShowFeedback(false);
                                                                }
                                                            } else {
                                                                scrollToQuestion(`p1-${q.id}`);
                                                            }
                                                        }}
                                                        className={cn(
                                                            'flex h-9 items-center justify-center rounded-lg text-xs font-bold transition-all duration-150',
                                                            isCurrent ? 'ring-2 ring-emerald-500 ring-offset-2 z-10' : '',
                                                            part1Answers[q.id] !== undefined
                                                                ? 'bg-primary text-primary-foreground shadow-sm scale-[0.97]'
                                                                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
                                                        )}
                                                    >
                                                        {idx + 1}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Part 2 TOC */}
                                {shuffledP2.length > 0 && (
                                    <div>
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Phần 2</span>
                                        </div>
                                        <div className="grid grid-cols-5 gap-1.5">
                                            {shuffledP2.map((q, idx) => {
                                                const isDone = q.subQuestions.every(sq => part2Answers[`${q.id}-${sq.id}`] !== undefined);
                                                const someDone = q.subQuestions.some(sq => part2Answers[`${q.id}-${sq.id}`] !== undefined);
                                                const isCurrent = isPracticeMode && practiceQueue[currentPracticeIdx]?.id === q.id && practiceQueue[currentPracticeIdx]?.type === 'p2';
                                                
                                                return (
                                                    <button
                                                        key={q.id}
                                                        onClick={() => {
                                                            if (isPracticeMode) {
                                                                const qIdx = practiceQueue.findIndex(x => x.type === 'p2' && x.id === q.id);
                                                                if (qIdx !== -1) {
                                                                    setCurrentPracticeIdx(qIdx);
                                                                    setShowFeedback(false);
                                                                }
                                                            } else {
                                                                scrollToQuestion(`p2-${q.id}`);
                                                            }
                                                        }}
                                                        className={cn(
                                                            'flex h-9 items-center justify-center rounded-lg text-xs font-bold transition-all duration-150',
                                                            isCurrent ? 'ring-2 ring-emerald-500 ring-offset-2 z-10' : '',
                                                            isDone ? 'bg-primary text-primary-foreground shadow-sm scale-[0.97]' :
                                                                someDone ? 'bg-primary/25 text-primary border border-primary/30' :
                                                                    'bg-muted text-muted-foreground hover:bg-accent border border-transparent'
                                                        )}
                                                    >
                                                        {shuffledP1.length + idx + 1}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Part 3 TOC */}
                                {shuffledP3.length > 0 && (
                                    <div>
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Phần 3</span>
                                            <span className="text-[10px] text-muted-foreground">{p3Answered}/{shuffledP3.length}</span>
                                        </div>
                                        <div className="grid grid-cols-5 gap-1.5">
                                            {shuffledP3.map((q, idx) => {
                                                const isCurrent = isPracticeMode && practiceQueue[currentPracticeIdx]?.id === q.id && practiceQueue[currentPracticeIdx]?.type === 'p3';
                                                const answered = (part3Answers[q.id] || '').trim().length > 0;
                                                
                                                return (
                                                    <button
                                                        key={q.id}
                                                        onClick={() => {
                                                            if (isPracticeMode) {
                                                                const qIdx = practiceQueue.findIndex(x => x.type === 'p3' && x.id === q.id);
                                                                if (qIdx !== -1) {
                                                                    setCurrentPracticeIdx(qIdx);
                                                                    setShowFeedback(false);
                                                                }
                                                            } else {
                                                                scrollToQuestion(`p3-${q.id}`);
                                                            }
                                                        }}
                                                        className={cn(
                                                            'flex h-9 items-center justify-center rounded-lg text-xs font-bold transition-all duration-150',
                                                            isCurrent ? 'ring-2 ring-emerald-500 ring-offset-2 z-10' : '',
                                                            answered
                                                                ? 'bg-primary text-primary-foreground shadow-sm scale-[0.97]'
                                                                : 'bg-muted text-muted-foreground hover:bg-accent border border-transparent'
                                                        )}
                                                    >
                                                        {shuffledP1.length + shuffledP2.length + idx + 1}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-4 border-t border-border">
                                <Button className="w-full" onClick={() => setShowSubmitConfirm(true)}>
                                    <Send className="mr-2 h-4 w-4" /> Nộp bài thi
                                </Button>
                            </div>
                        </div>
                    </aside>
                    )}
                </div>

                <ConfirmDialog
                    open={showSubmitConfirm}
                    onClose={() => setShowSubmitConfirm(false)}
                    onConfirm={handleSubmit}
                    title="Nộp bài?"
                    message={`Bạn còn ${formatTime(timeLeft)} thời gian. Bạn có chắc chắn muốn nộp bài?`}
                    confirmText="Nộp bài"
                />

                {/* Floating Navbar (Redesigned Pill Shape) - Portaled */}
                {createPortal(
                    <div className={cn(
                        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] w-fit max-w-[95%] transition-all duration-500 transform",
                        isNavbarVisible ? "translate-y-0 opacity-100" : "translate-y-32 opacity-0"
                    )}>
                        <div className="flex items-center gap-2">
                            {/* Main Pill */}
                            <div className="bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.4)] p-1.5 flex items-center gap-1 transition-all">
                                {/* Progress Circular/Pill */}
                                <div 
                                    className="rounded-full px-3 py-1.5 flex items-center gap-2"
                                    style={{ backgroundColor: settings.accentColor }}
                                >
                                    <div className="flex flex-col items-start leading-none">
                                        <span className="text-[10px] text-white/70 font-bold uppercase tracking-tighter">Tiến độ</span>
                                        <span className="text-white font-black text-sm">{answeredQs}/{totalQs}</span>
                                    </div>
                                    <div className="h-6 w-px bg-white/20" />
                                    <span className="text-white font-black text-sm">{completionPercent}%</span>
                                </div>

                                {/* Timer Section */}
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors",
                                    isTimeLow ? "bg-red-500/20 text-red-500 animate-pulse" : "text-slate-300"
                                )}>
                                    <Clock className="h-4 w-4" />
                                    <span className="font-mono font-black text-sm md:text-base">{formatTime(timeLeft)}</span>
                                </div>

                                {/* Actions Group */}
                                <div className="flex items-center gap-1 pl-1 border-l border-slate-700">
                                    {/* TOC Button - Integrated */}
                                    <button 
                                        onClick={() => setShowMobileTOC(true)}
                                        className="h-9 w-9 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                        title="Mục lục"
                                    >
                                        <List className="h-4 w-4" />
                                    </button>
                                    
                                    <button 
                                        onClick={() => setShowSubmitConfirm(true)}
                                        className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-full font-black text-xs md:text-sm transition-all flex items-center gap-2 shadow-lg"
                                    >
                                        <Send className="h-3.5 w-3.5" /> 
                                        <span className="hidden xs:block">Nộp bài</span>
                                    </button>
                                </div>
                            </div>

                            {/* Scroll to Top - Positioned next to navbar */}
                            <button
                                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                className={cn(
                                    "h-12 w-12 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl transition-all duration-300 transform",
                                    showScrollTop ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
                                )}
                                style={{ color: settings.accentColor }}
                                title="Lên đầu trang"
                            >
                                <ArrowUp className="h-5 w-5" />
                            </button>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Mobile TOC Drawer - Portaled */}
                {showMobileTOC && createPortal(
                    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4">
                        <div 
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in" 
                            onClick={() => setShowMobileTOC(false)} 
                        />
                        <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <h4 className="flex items-center gap-2 font-black text-slate-800 dark:text-gray-100">
                                    <List className="h-5 w-5" style={{ color: settings.accentColor }} /> Danh sách câu hỏi
                                </h4>
                                <button 
                                    onClick={() => setShowMobileTOC(false)}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                                >
                                    <XCircle className="h-5 w-5 text-slate-400" />
                                </button>
                            </div>
                            
                            <div className="p-5 max-h-[60vh] overflow-y-auto">
                                <div className="space-y-6">
                                    {/* Part 1 */}
                                    {shuffledP1.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Phần 1: Trắc nghiệm</p>
                                            <div className="grid grid-cols-5 gap-2">
                                                {shuffledP1.map((q, idx) => (
                                                    <button
                                                        key={q.id}
                                                        onClick={() => { scrollToQuestion(`p1-${q.id}`); setShowMobileTOC(false); }}
                                                        className={cn(
                                                            'h-10 rounded-xl font-bold transition-all border-2',
                                                            part1Answers[q.id] !== undefined 
                                                                ? 'text-white' 
                                                                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
                                                        )}
                                                        style={part1Answers[q.id] !== undefined ? { backgroundColor: settings.accentColor, borderColor: settings.accentColor, boxShadow: `0 4px 12px rgba(var(--accent-rgb), 0.3)` } : {}}
                                                    >
                                                        {idx + 1}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Part 2 */}
                                    {shuffledP2.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Phần 2: Đúng/Sai</p>
                                            <div className="grid grid-cols-5 gap-2">
                                                {shuffledP2.map((q, idx) => {
                                                    const isDone = q.subQuestions.every(sq => part2Answers[`${q.id}-${sq.id}`] !== undefined);
                                                    const someDone = q.subQuestions.some(sq => part2Answers[`${q.id}-${sq.id}`] !== undefined);
                                                    return (
                                                        <button
                                                            key={q.id}
                                                            onClick={() => { scrollToQuestion(`p2-${q.id}`); setShowMobileTOC(false); }}
                                                            className={cn(
                                                                'h-10 rounded-xl font-bold transition-all border-2',
                                                                isDone ? 'text-white' :
                                                                someDone ? 'bg-slate-50' :
                                                                'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
                                                            )}
                                                            style={
                                                                isDone ? { backgroundColor: settings.accentColor, borderColor: settings.accentColor, boxShadow: `0 4px 12px rgba(var(--accent-rgb), 0.3)` } :
                                                                someDone ? { color: settings.accentColor, borderColor: `rgba(var(--accent-rgb), 0.3)`, backgroundColor: `rgba(var(--accent-rgb), 0.05)` } : {}
                                                            }
                                                        >
                                                            {shuffledP1.length + idx + 1}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Part 3 */}
                                    {shuffledP3.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Phần 3: Trả lời ngắn</p>
                                            <div className="grid grid-cols-5 gap-2">
                                                {shuffledP3.map((q, idx) => (
                                                    <button
                                                        key={q.id}
                                                        onClick={() => { scrollToQuestion(`p3-${q.id}`); setShowMobileTOC(false); }}
                                                        className={cn(
                                                            'h-10 rounded-xl font-bold transition-all border-2',
                                                            (part3Answers[q.id] || '').trim()
                                                                ? 'text-white' 
                                                                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
                                                        )}
                                                        style={(part3Answers[q.id] || '').trim() ? { backgroundColor: settings.accentColor, borderColor: settings.accentColor, boxShadow: `0 4px 12px rgba(var(--accent-rgb), 0.3)` } : {}}
                                                    >
                                                        {shuffledP1.length + shuffledP2.length + idx + 1}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-gray-50/50">
                                <Button className="w-full h-12 rounded-2xl font-black text-base" onClick={() => { setShowMobileTOC(false); setShowSubmitConfirm(true); }}>
                                    <Send className="h-4 w-4 mr-2" /> Nộp bài thi ngay
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        );
    }

    // ==================== RESULT DATA COMPUTATION ====================
    let displayScore = score;
    let displayCorrectCount = correctCount;
    let displayTotalQuestions = totalQuestions;
    let displayDuration = duration;
    let displayPart1Answers = part1Answers;
    let displayPart2Answers = part2Answers;
    let displayPart3Answers = part3Answers;
    let displayTimestamp = '';

    if (selectedHistoryId) {
        const hist = examHistory.find(h => h.id === selectedHistoryId);
        if (hist) {
            displayScore = hist.score;
            displayCorrectCount = hist.correctCount;
            displayTotalQuestions = hist.totalQuestions;
            displayDuration = hist.durationSeconds;
            const histAnswers = hist.answers as { part1?: any, part2?: any, part3?: any };
            displayPart1Answers = histAnswers.part1 || {};
            displayPart2Answers = histAnswers.part2 || {};
            displayPart3Answers = histAnswers.part3 || {};
            
            // Format time correctly
            const d = new Date(hist.timestamp);
            displayTimestamp = `Lần nộp: ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')} ngày ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
        }
    }

    // ==================== RESULT VIEW ====================
    return (
        <div className="mx-auto max-w-3xl">
            {/* Score card */}
            <div className="mb-6 rounded-2xl border border-border bg-card p-6 text-center shadow-lg relative">
                {displayTimestamp && (
                    <div className="absolute top-4 left-4 right-4 text-center">
                        <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                            Đang xem kết quả cũ ({displayTimestamp})
                        </span>
                    </div>
                )}
                <div className={cn(
                    'mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold shadow-inner relative group',
                    displayScore >= 8 ? 'bg-emerald-100 text-emerald-700' :
                        displayScore >= 5 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700',
                    displayTimestamp ? 'mt-8' : '' // Push down if showing history tag
                )}>
                    <Trophy className="absolute -top-2 -right-2 h-8 w-8 text-amber-500 animate-bounce group-hover:scale-125 transition-transform" />
                    {displayScore}
                </div>
                <h2 className="text-xl font-bold">
                    {displayScore >= 8 ? '🎉 Xuất sắc!' : displayScore >= 5 ? '👍 Khá tốt!' : '💪 Cố gắng hơn!'}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                    {exam?.title}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {selectedHistoryId && (
                        <Button variant="outline" onClick={() => setSelectedHistoryId(null)}>
                            Về lần nộp hiện tại
                        </Button>
                    )}
                    <Button variant={selectedHistoryId ? "ghost" : "outline"} onClick={handleReset}>
                        <RotateCcw className="h-4 w-4" /> Làm lại
                    </Button>
                    <Button 
                        variant={showAnswerSheet ? "default" : "outline"} 
                        onClick={() => setShowAnswerSheet(!showAnswerSheet)}
                        className={showAnswerSheet ? "bg-blue-600 hover:bg-blue-700" : "text-blue-600 border-blue-200 hover:bg-blue-50"}
                    >
                        <Eye className="h-4 w-4" /> {showAnswerSheet ? 'Ẩn đáp án' : 'Xem đáp án'}
                    </Button>
                    <Button onClick={() => navigate('/practice')}>
                        <BookOpen className="h-4 w-4" /> Đề khác
                    </Button>
                </div>

                {/* Summary Table */}
                <div className="mt-8 grid grid-cols-3 gap-4 border-t pt-6">
                    <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Đúng / Câu</p>
                        <p className="text-xl font-black text-gray-900">{displayCorrectCount} / {displayTotalQuestions}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Thời gian</p>
                        <p className="text-xl font-black text-gray-900">{formatTime(displayDuration)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Hiệu suất</p>
                        <p className="text-xl font-black text-emerald-600">{displayTotalQuestions > 0 ? ((displayCorrectCount / displayTotalQuestions) * 100).toFixed(0) : 0}%</p>
                    </div>
                </div>

                {/* Biểu đề" điểm số 10 lần gần nhất của đề này */}
                {(() => {
                    // Cần gộp thêm điểm số hiện tại vào lịch sử vì examHistory có thể chưa chứa lần nộp bài này
                    // nếu load lúc đầu, hoặc chứa rồi nếu react effect reload.
                    // An toàn nhất: coi score hiện tại là 1 điểm neo. 
                    // Tạm thời lấy examHistory vẽ.
                    const recentAttempts = [...examHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10).reverse();
                    
                    if (recentAttempts.length < 2) return null;

                    const maxScore = 10;
                    const width = 400;
                    const height = 100;
                    const stepX = width / (recentAttempts.length - 1);
                    
                    const points = recentAttempts.map((log, i) => {
                        const x = i * stepX;
                        const y = height - (log.score / maxScore) * height;
                        // Use string comparisons if id is loosely typed
                        return { x, y, score: log.score, id: log.id, history: log };
                    });

                    const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
                    const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

                    return (
                        <div className="mt-8 pt-6 border-t relative group overflow-hidden">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center justify-center gap-2 mb-6">
                                <History className="h-4 w-4 text-blue-500" />
                                Lịch sử điểm số đề này
                            </h3>
                            <div className="h-32 w-full max-w-lg mx-auto relative pt-4">
                                <svg className="w-full h-full overflow-visible" viewBox={`0 -20 ${width} ${height + 40}`}>
                                    <defs>
                                        <linearGradient id="scoreAreaExam" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                        </linearGradient>
                                        <linearGradient id="lineGradExam" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#60a5fa" />
                                            <stop offset="50%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#2563eb" />
                                        </linearGradient>
                                    </defs>
                                    <path d={areaD} fill="url(#scoreAreaExam)" />
                                    <path d={pathD} fill="none" stroke="url(#lineGradExam)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    
                                    {points.map((p, i) => {
                                        const isSelected = p.id === selectedHistoryId;
                                        return (
                                            <g key={i} className="group/point" onClick={() => setSelectedHistoryId(p.id)}>
                                                <circle 
                                                    cx={p.x} cy={p.y} r={isSelected ? "7" : "5"} 
                                                    className={cn(
                                                        "transition-all duration-300 group-hover/point:r-6 cursor-pointer stroke-[3]",
                                                        isSelected ? "fill-white stroke-amber-500" : "fill-white stroke-blue-500 group-hover/point:stroke-emerald-500"
                                                    )}
                                                />
                                                <text
                                                    x={p.x}
                                                    y={p.y - 12}
                                                    textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                                                    className={cn(
                                                        "text-[12px] font-black transition-all group-hover/point:-translate-y-1 group-hover/point:text-[14px]",
                                                        isSelected ? "fill-amber-600 opacity-100" : "fill-gray-500 opacity-0 group-hover:opacity-100 group-hover/point:fill-emerald-600"
                                                    )}
                                                >
                                                    {p.score.toFixed(1)}
                                                </text>
                                                <rect 
                                                    x={p.x - stepX/2} y={-20} width={stepX} height={height + 40} 
                                                    fill="transparent" className="cursor-pointer"
                                                />
                                            </g>
                                        );
                                    })}
                                    <line x1="0" y1={height} x2={width} y2={height} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
                                </svg>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Answer review */}
            {showAnswerSheet && (
            <div className="space-y-4 pb-20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold flex items-center gap-2 m-0 shrink-0">
                        <Eye className="h-5 w-5 text-blue-500" /> Kết quả chi tiết
                    </h3>
                    
                    {/* Filters Toggle */}
                    <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto overflow-x-auto shrink-0">
                        <button
                            onClick={() => setResultFilter('all')}
                            className={cn('px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap', resultFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
                        >
                            Tất cả
                        </button>
                        <button
                            onClick={() => setResultFilter('correct')}
                            className={cn('px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap', resultFilter === 'correct' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-emerald-600')}
                        >
                            Câu đúng
                        </button>
                        <button
                            onClick={() => setResultFilter('incorrect')}
                            className={cn('px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap', resultFilter === 'incorrect' ? 'bg-red-100 text-red-700 shadow-sm' : 'text-gray-500 hover:text-red-600')}
                        >
                            Câu sai / Chưa làm
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            const allExpanded = Object.keys(expandedResults).length > 0;
                            setExpandedResults(allExpanded ? {} : {
                                ...exam.part1?.reduce((a, q) => ({ ...a, [`p1-${q.id}`]: true }), {}),
                                ...exam.part2?.reduce((a, q) => ({ ...a, [`p2-${q.id}`]: true }), {}),
                                ...exam.part3?.reduce((a, q) => ({ ...a, [`p3-${q.id}`]: true }), {}),
                            });
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline shrink-0"
                    >
                        {Object.keys(expandedResults).length > 0 ? 'Thu gọn tất cả' : 'Bật xem tất cả'}
                    </button>
                </div>

                <div className="space-y-3">
                    {/* Part 1 review */}
                    {exam.part1?.map((q) => {
                        const userAns = displayPart1Answers[q.id];
                        const answered = userAns !== undefined;
                        const isCorrect = answered && userAns === q.correct;
                        const isExpanded = expandedResults[`p1-${q.id}`];

                        if (resultFilter === 'correct' && !isCorrect) return null;
                        if (resultFilter === 'incorrect' && isCorrect) return null;

                        return (
                            <div key={`p1-${q.id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
                                <button
                                    onClick={() => setExpandedResults({ ...expandedResults, [`p1-${q.id}`]: !isExpanded })}
                                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                                            !answered ? "bg-gray-100 text-gray-400" : isCorrect ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                                        )}>
                                            {isCorrect ? <CheckCircle size={16} /> : !answered ? <MinusCircle size={16} /> : <XCircle size={16} />}
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Câu {q.id} (Trắc nghiệm)</span>
                                            <p className="text-sm font-semibold text-gray-700 line-clamp-1">{q.text}</p>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} className="text-gray-300" /> : <ChevronDown size={20} className="text-gray-300" />}
                                </button>

                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-1 border-t border-gray-50 bg-gray-50/30 animate-in fade-in slide-in-from-top-2">
                                        <div className="mb-4 text-sm font-medium text-gray-800 leading-relaxed">
                                            <LatexContent content={q.text} />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {q.options.map((opt, idx) => (
                                                <div key={idx} className={cn(
                                                    'rounded-xl px-4 py-3 text-xs flex items-start gap-2 border',
                                                    idx === q.correct
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
                                                        : answered && idx === userAns
                                                            ? 'bg-red-50 border-red-200 text-red-800'
                                                            : 'bg-white border-gray-100 text-gray-500'
                                                )}>
                                                    <span className="font-bold opacity-50">{String.fromCharCode(65 + idx)}.</span>
                                                    <LatexContent content={opt} />
                                                </div>
                                            ))}
                                        </div>
                                        {q.explanation && (
                                            <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100 text-[11px] leading-relaxed">
                                                <div className="font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    💡 Giải thích
                                                </div>
                                                <LatexContent content={q.explanation} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Part 2 rewrite similarly ... but it's long, I will simplify if needed */}
                    {exam.part2?.map((q) => {
                        const isExpanded = expandedResults[`p2-${q.id}`];
                        const subResults = q.subQuestions.map(sq => {
                            const key = `${q.id}-${sq.id}`;
                            const userAns = displayPart2Answers[key];
                            return userAns !== undefined && userAns === sq.correct;
                        });
                        const allCorrect = subResults.every(r => r === true);
                        const someIncorrect = subResults.some(r => r === false);

                        if (resultFilter === 'correct' && !allCorrect) return null;
                        if (resultFilter === 'incorrect' && allCorrect) return null;

                        return (
                            <div key={`p2-${q.id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
                                <button
                                    onClick={() => setExpandedResults({ ...expandedResults, [`p2-${q.id}`]: !isExpanded })}
                                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                                            allCorrect ? "bg-emerald-100 text-emerald-600" : someIncorrect ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-400"
                                        )}>
                                            {allCorrect ? <CheckCircle size={16} /> : someIncorrect ? <XCircle size={16} /> : <MinusCircle size={16} />}
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Câu {q.id} (Đúng/Sai)</span>
                                            <p className="text-sm font-semibold text-gray-700 line-clamp-1">{q.text}</p>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} className="text-gray-300" /> : <ChevronDown size={20} className="text-gray-300" />}
                                </button>

                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-1 border-t border-gray-50 bg-gray-50/30 animate-in fade-in slide-in-from-top-2">
                                        <div className="mb-4 text-sm font-medium text-gray-800">
                                            <LatexContent content={q.text} />
                                        </div>
                                        <div className="space-y-2">
                                            {q.subQuestions.map((sq) => {
                                                const key = `${q.id}-${sq.id}`;
                                                const userAns = part2Answers[key];
                                                const answered = userAns !== undefined;
                                                const isCorrectSq = answered && userAns === sq.correct;
                                                return (
                                                    <div key={key} className={cn(
                                                        "flex items-center justify-between p-3 rounded-xl border text-xs",
                                                        !answered ? "bg-gray-50/50 border-gray-100 text-gray-400" :
                                                            isCorrectSq ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-red-50/50 border-red-100 text-red-800"
                                                    )}>
                                                        <span className="font-medium">{sq.id}) <LatexContent content={sq.text} /></span>
                                                        <div className="flex items-center gap-2 font-black shrink-0 ml-3">
                                                            {answered ? (isCorrectSq ? 'CHÍNH XÁC' : 'SAI') : 'BỎ TRỐNG'}
                                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-200 mx-1" />
                                                            ĐÁP ÁN: {sq.correct ? 'Đ' : 'S'}
                                                            {answered && !isCorrectSq && <span className="opacity-50 ml-1">({userAns ? 'Đ' : 'S'})</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {q.explanation && (
                                            <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100 text-[11px] leading-relaxed">
                                                <div className="font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    💡 Giải thích
                                                </div>
                                                <LatexContent content={q.explanation} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Part 3 review */}
                    {exam.part3?.map((q) => {
                        const userAnsRaw = displayPart3Answers[q.id] || '';
                        const userAns = userAnsRaw.trim().toLowerCase();
                        const correctAns = q.correct.trim().toLowerCase();
                        const answered = userAnsRaw.trim().length > 0;
                        const isCorrect = answered && userAns === correctAns;
                        const isExpanded = expandedResults[`p3-${q.id}`];

                        if (resultFilter === 'correct' && !isCorrect) return null;
                        if (resultFilter === 'incorrect' && isCorrect) return null;

                        return (
                            <div key={`p3-${q.id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
                                <button
                                    onClick={() => setExpandedResults({ ...expandedResults, [`p3-${q.id}`]: !isExpanded })}
                                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                                            !answered ? "bg-gray-100 text-gray-400" : isCorrect ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                                        )}>
                                            {isCorrect ? <CheckCircle size={16} /> : !answered ? <MinusCircle size={16} /> : <XCircle size={16} />}
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Câu {q.id} (Trả lời ngắn)</span>
                                            <p className="text-sm font-semibold text-gray-700 line-clamp-1">{q.text}</p>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} className="text-gray-300" /> : <ChevronDown size={20} className="text-gray-300" />}
                                </button>

                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-1 border-t border-gray-50 bg-gray-50/30 animate-in fade-in slide-in-from-top-2">
                                        <div className="mb-4 text-sm font-medium text-gray-800">
                                            <LatexContent content={q.text} />
                                        </div>
                                        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Bạn trả lời</p>
                                                <p className={cn("text-sm font-bold", isCorrect ? "text-emerald-600" : "text-red-500")}>
                                                    {answered ? userAnsRaw : '(Bỏ trống)'}
                                                </p>
                                            </div>
                                            <div className="w-px h-10 bg-gray-100" />
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Đáp án đúng</p>
                                                <p className="text-sm font-bold text-emerald-600">
                                                    {q.correct}
                                                </p>
                                            </div>
                                        </div>
                                        {q.explanation && (
                                            <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100 text-[11px] leading-relaxed">
                                                <div className="font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    💡 Giải thích
                                                </div>
                                                <LatexContent content={q.explanation} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            )}

            <AlertDialog
                open={alertState.open}
                onClose={() => setAlertState({ ...alertState, open: false })}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
        </div>
    );
}










