import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getExamContent,
    logPracticeAttempt,
    savePracticeResult,
    getSubjects,
} from '@/services/exam.service';
import { useAuth } from '@/contexts/AuthContext';
import { cn, formatTime, renderMathJax } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { AlertDialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { Exam, Part1Question, Part2Question, Part3Question } from '@/types';
import {
    ArrowLeft,
    Clock,
    CheckCircle,
    XCircle,
    Send,
    RotateCcw,
    Eye,
    BookOpen,
} from 'lucide-react';

type ExamMode = 'ready' | 'taking' | 'result';

export default function PracticeExam() {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { user, isGuest } = useAuth();

    const [exam, setExam] = useState<Exam | null>(null);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<ExamMode>('ready');

    // Timer
    const [timeLeft, setTimeLeft] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const startTimeRef = useRef(0);

    // Answers
    const [part1Answers, setPart1Answers] = useState<Record<number, number>>({});
    const [part2Answers, setPart2Answers] = useState<Record<string, boolean>>({});
    const [part3Answers, setPart3Answers] = useState<Record<number, string>>({});

    // Results
    const [score, setScore] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);

    // UI
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [alertState, setAlertState] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        open: false, title: '', message: '', type: 'info',
    });

    useEffect(() => {
        async function load() {
            if (!examId) return;
            const examData = await getExamContent(examId);
            setExam(examData);
            if (examData) {
                setTimeLeft(examData.time * 60);
            }
            setLoading(false);
        }
        load();
    }, [examId]);

    // MathJax rendering
    useEffect(() => {
        if (exam && mode !== 'ready') {
            setTimeout(renderMathJax, 100);
        }
    }, [exam, mode]);

    // Timer
    useEffect(() => {
        if (mode === 'taking' && timeLeft > 0) {
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

    const handleStart = () => {
        setMode('taking');
        startTimeRef.current = Date.now();
    };

    const handleSubmit = useCallback(async () => {
        clearInterval(timerRef.current);
        if (!exam) return;

        // Calculate score
        let correct = 0;
        let total = 0;

        // Part 1: Multiple choice
        (exam.part1 || []).forEach((q: Part1Question) => {
            total++;
            if (part1Answers[q.id] === q.correct) correct++;
        });

        // Part 2: True/False
        (exam.part2 || []).forEach((q: Part2Question) => {
            q.subQuestions.forEach((sq) => {
                total++;
                const key = `${q.id}-${sq.id}`;
                if (part2Answers[key] === sq.correct) correct++;
            });
        });

        // Part 3: Short answer
        (exam.part3 || []).forEach((q: Part3Question) => {
            total++;
            const userAnswer = (part3Answers[q.id] || '').trim().toLowerCase();
            const correctAnswer = q.correct.trim().toLowerCase();
            if (userAnswer === correctAnswer) correct++;
        });

        const finalScore = total > 0 ? Math.round((correct / total) * 10 * 10) / 10 : 0;
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);

        setScore(finalScore);
        setCorrectCount(correct);
        setTotalQuestions(total);
        setMode('result');

        // Save to Firebase
        try {
            await logPracticeAttempt(exam.id, exam.title, exam.subjectId, 'classic', duration);
            if (!isGuest && user) {
                await savePracticeResult({
                    examId: exam.id,
                    examTitle: exam.title,
                    subjectId: exam.subjectId,
                    score: finalScore,
                    correctCount: correct,
                    totalQuestions: total,
                    durationSeconds: duration,
                    answers: { part1: part1Answers, part2: part2Answers, part3: part3Answers },
                });
            }
        } catch (err) {
            console.error('[Practice] Save result error:', err);
        }
    }, [exam, part1Answers, part2Answers, part3Answers, user, isGuest]);

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
            </div>
        );
    }

    // ==================== TAKING VIEW ====================
    if (mode === 'taking') {
        const isTimeLow = timeLeft < 300; // < 5 min

        return (
            <div className="mx-auto max-w-3xl">
                {/* Timer header */}
                <div className="sticky top-14 z-30 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-medium truncate max-w-[200px] sm:max-w-none">{exam.title}</h2>
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-mono font-bold',
                                isTimeLow ? 'bg-red-100 text-red-700 animate-pulse dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-foreground'
                            )}>
                                <Clock className="h-3.5 w-3.5" />
                                {formatTime(timeLeft)}
                            </div>
                            <Button size="sm" onClick={() => setShowSubmitConfirm(true)}>
                                <Send className="h-3.5 w-3.5" /> Nộp bài
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Questions */}
                <div className="space-y-6">
                    {/* Part 1: Multiple Choice */}
                    {(exam.part1?.length || 0) > 0 && (
                        <section>
                            <h3 className="mb-3 text-lg font-bold text-primary">
                                Phần 1: Trắc nghiệm ({exam.part1?.length} câu)
                            </h3>
                            <div className="space-y-4">
                                {exam.part1?.map((q) => (
                                    <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                                        <p className="mb-3 font-medium">
                                            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                {q.id}
                                            </span>
                                            <span dangerouslySetInnerHTML={{ __html: q.text }} />
                                        </p>
                                        {q.image && (
                                            <img src={q.image} alt="" className="mb-3 max-h-48 rounded-lg" />
                                        )}
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            {q.options.map((opt, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setPart1Answers({ ...part1Answers, [q.id]: idx })}
                                                    className={cn(
                                                        'rounded-lg border p-3 text-left text-sm transition-all',
                                                        part1Answers[q.id] === idx
                                                            ? 'border-primary bg-primary/10 text-primary font-medium'
                                                            : 'border-border hover:border-primary/30 hover:bg-accent'
                                                    )}
                                                >
                                                    <span className="mr-2 font-bold text-xs">
                                                        {String.fromCharCode(65 + idx)}.
                                                    </span>
                                                    <span dangerouslySetInnerHTML={{ __html: opt }} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Part 2: True/False */}
                    {(exam.part2?.length || 0) > 0 && (
                        <section>
                            <h3 className="mb-3 text-lg font-bold text-primary">
                                Phần 2: Đúng/Sai ({exam.part2?.length} câu)
                            </h3>
                            <div className="space-y-4">
                                {exam.part2?.map((q) => (
                                    <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                                        <p className="mb-3 font-medium">
                                            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                {q.id}
                                            </span>
                                            <span dangerouslySetInnerHTML={{ __html: q.text }} />
                                        </p>
                                        <div className="space-y-2">
                                            {q.subQuestions.map((sq) => {
                                                const key = `${q.id}-${sq.id}`;
                                                return (
                                                    <div key={key} className="flex items-center gap-3 rounded-lg border border-border p-3">
                                                        <span className="text-xs font-bold text-muted-foreground uppercase">{sq.id})</span>
                                                        <p className="flex-1 text-sm" dangerouslySetInnerHTML={{ __html: sq.text }} />
                                                        <div className="flex gap-1.5">
                                                            <button
                                                                onClick={() => setPart2Answers({ ...part2Answers, [key]: true })}
                                                                className={cn(
                                                                    'rounded-md px-3 py-1 text-xs font-medium transition-all',
                                                                    part2Answers[key] === true
                                                                        ? 'bg-emerald-600 text-white'
                                                                        : 'bg-muted text-muted-foreground hover:bg-emerald-100'
                                                                )}
                                                            >
                                                                Đ
                                                            </button>
                                                            <button
                                                                onClick={() => setPart2Answers({ ...part2Answers, [key]: false })}
                                                                className={cn(
                                                                    'rounded-md px-3 py-1 text-xs font-medium transition-all',
                                                                    part2Answers[key] === false
                                                                        ? 'bg-red-600 text-white'
                                                                        : 'bg-muted text-muted-foreground hover:bg-red-100'
                                                                )}
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

                    {/* Part 3: Short Answer */}
                    {(exam.part3?.length || 0) > 0 && (
                        <section>
                            <h3 className="mb-3 text-lg font-bold text-primary">
                                Phần 3: Trả lời ngắn ({exam.part3?.length} câu)
                            </h3>
                            <div className="space-y-4">
                                {exam.part3?.map((q) => (
                                    <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                                        <p className="mb-3 font-medium">
                                            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                {q.id}
                                            </span>
                                            <span dangerouslySetInnerHTML={{ __html: q.text }} />
                                        </p>
                                        <input
                                            type="text"
                                            value={part3Answers[q.id] || ''}
                                            onChange={(e) => setPart3Answers({ ...part3Answers, [q.id]: e.target.value })}
                                            placeholder="Nhập câu trả lời..."
                                            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Bottom submit */}
                <div className="mt-6 text-center">
                    <Button size="lg" onClick={() => setShowSubmitConfirm(true)}>
                        <Send className="h-4 w-4" /> Nộp bài
                    </Button>
                </div>

                <ConfirmDialog
                    open={showSubmitConfirm}
                    onClose={() => setShowSubmitConfirm(false)}
                    onConfirm={handleSubmit}
                    title="Nộp bài?"
                    message={`Bạn còn ${formatTime(timeLeft)} thời gian. Bạn có chắc chắn muốn nộp bài?`}
                    confirmText="Nộp bài"
                />
            </div>
        );
    }

    // ==================== RESULT VIEW ====================
    return (
        <div className="mx-auto max-w-3xl">
            {/* Score card */}
            <div className="mb-6 rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
                <div className={cn(
                    'mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold',
                    score >= 8 ? 'bg-emerald-100 text-emerald-700' :
                        score >= 5 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                )}>
                    {score}
                </div>
                <h2 className="text-xl font-bold">
                    {score >= 8 ? '🎉 Xuất sắc!' : score >= 5 ? '👍 Khá tốt!' : '💪 Cố gắng hơn!'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {correctCount}/{totalQuestions} câu đúng · {exam.title}
                </p>

                <div className="mt-6 flex justify-center gap-3">
                    <Button variant="outline" onClick={handleReset}>
                        <RotateCcw className="h-4 w-4" /> Làm lại
                    </Button>
                    <Button onClick={() => navigate('/practice')}>
                        <BookOpen className="h-4 w-4" /> Đề khác
                    </Button>
                </div>
            </div>

            {/* Answer review */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Eye className="h-5 w-5" /> Xem đáp án
                </h3>

                {/* Part 1 review */}
                {exam.part1?.map((q) => {
                    const isCorrect = part1Answers[q.id] === q.correct;
                    return (
                        <div key={q.id} className={cn(
                            'rounded-xl border p-4',
                            isCorrect ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10' : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
                        )}>
                            <div className="mb-2 flex items-center gap-2">
                                {isCorrect ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                                <span className="text-xs font-bold text-muted-foreground">Câu {q.id}</span>
                            </div>
                            <p className="text-sm mb-2" dangerouslySetInnerHTML={{ __html: q.text }} />
                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                {q.options.map((opt, idx) => (
                                    <div key={idx} className={cn(
                                        'rounded-md px-3 py-1.5 text-xs',
                                        idx === q.correct ? 'bg-emerald-200/60 font-medium text-emerald-800 dark:bg-emerald-800/30 dark:text-emerald-300' :
                                            idx === part1Answers[q.id] && idx !== q.correct ? 'bg-red-200/60 text-red-800 line-through dark:bg-red-800/30 dark:text-red-300' :
                                                'text-muted-foreground'
                                    )}>
                                        {String.fromCharCode(65 + idx)}. <span dangerouslySetInnerHTML={{ __html: opt }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {/* Part 2 review */}
                {exam.part2?.map((q) => (
                    <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm font-medium mb-2">
                            <span className="text-xs text-muted-foreground">Câu {q.id}:</span>{' '}
                            <span dangerouslySetInnerHTML={{ __html: q.text }} />
                        </p>
                        {q.subQuestions.map((sq) => {
                            const key = `${q.id}-${sq.id}`;
                            const userAns = part2Answers[key];
                            const isCorrect = userAns === sq.correct;
                            return (
                                <div key={key} className={cn(
                                    'flex items-center justify-between rounded-md px-3 py-1.5 text-xs',
                                    isCorrect ? 'text-emerald-700' : 'text-red-600'
                                )}>
                                    <span>{sq.id}) <span dangerouslySetInnerHTML={{ __html: sq.text }} /></span>
                                    <span>
                                        {isCorrect ? <CheckCircle className="h-3 w-3 inline" /> : <XCircle className="h-3 w-3 inline" />}
                                        {' '}Đáp án: {sq.correct ? 'Đ' : 'S'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ))}

                {/* Part 3 review */}
                {exam.part3?.map((q) => {
                    const userAns = (part3Answers[q.id] || '').trim().toLowerCase();
                    const correctAns = q.correct.trim().toLowerCase();
                    const isCorrect = userAns === correctAns;
                    return (
                        <div key={q.id} className={cn(
                            'rounded-xl border p-4',
                            isCorrect ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10' : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
                        )}>
                            <div className="flex items-center gap-2 mb-1">
                                {isCorrect ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                                <span className="text-xs text-muted-foreground">Câu {q.id}</span>
                            </div>
                            <p className="text-sm mb-1" dangerouslySetInnerHTML={{ __html: q.text }} />
                            <p className="text-xs">
                                <span className="text-muted-foreground">Bạn: </span>
                                <span className={isCorrect ? 'text-emerald-700 font-medium' : 'text-red-600 line-through'}>{part3Answers[q.id] || '(bỏ trống)'}</span>
                                {!isCorrect && (
                                    <span className="ml-2 text-emerald-700 font-medium">→ {q.correct}</span>
                                )}
                            </p>
                        </div>
                    );
                })}
            </div>

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
