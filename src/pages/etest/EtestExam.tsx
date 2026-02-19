import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEtestExam } from '@/services/etest.service';
import { cn, formatTime } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import type { EtestExam } from '@/types';
import {
    ArrowLeft, Clock, CheckCircle, XCircle,
    Sun, Moon, ChevronLeft, ChevronRight, Send, RotateCcw,
} from 'lucide-react';
import { LatexContent } from '@/components/ui/LatexContent';

type ExamView = 'ready' | 'taking' | 'result';
type TabView = 'passage' | 'questions';



export default function EtestExamPage() {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const [exam, setExam] = useState<EtestExam | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<ExamView>('ready');
    const [currentSection, setCurrentSection] = useState(0);
    const [mobileTab, setMobileTab] = useState<TabView>('passage');
    const [darkMode, setDarkMode] = useState(false);

    // Timer
    const [timeLeft, setTimeLeft] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    // Answers
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [score, setScore] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [total, setTotal] = useState(0);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

    useEffect(() => {
        if (!examId) return;
        getEtestExam(examId).then((data) => {
            setExam(data);
            if (data) setTimeLeft(data.time * 60);
            setLoading(false);
        });
    }, [examId]);

    useEffect(() => {
        if (view === 'taking' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) { clearInterval(timerRef.current); handleSubmit(); return 0; }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [view]);

    const handleSubmit = useCallback(() => {
        clearInterval(timerRef.current);
        if (!exam) return;
        let correct = 0;
        let totalQ = 0;
        exam.sections.forEach((sec, si) => {
            sec.questions.forEach((q, qi) => {
                totalQ++;
                const key = `${si}-${qi}`;
                if (answers[key] === q.correct) correct++;
            });
        });
        const finalScore = totalQ > 0 ? Math.round((correct / totalQ) * 10 * 10) / 10 : 0;
        setScore(finalScore);
        setCorrectCount(correct);
        setTotal(totalQ);
        setView('result');
    }, [exam, answers]);

    if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" label="Đang tải..." /></div>;
    if (!exam) return <div className="py-20 text-center"><p className="text-muted-foreground">Không tìm thấy bài đọc</p></div>;

    const section = exam.sections[currentSection];

    // ==================== READY ====================
    if (view === 'ready') {
        return (
            <div className="mx-auto max-w-lg">
                <button onClick={() => navigate('/etest')} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> Quay lại
                </button>
                <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
                    <div className="mb-4 text-5xl">📝</div>
                    <h1 className="mb-2 text-xl font-bold">{exam.title}</h1>
                    <div className="my-6 flex justify-center gap-6 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {exam.time} phút</span>
                        <span>{exam.sections.length} passage(s)</span>
                        <span>{exam.sections.reduce((s, sec) => s + sec.questions.length, 0)} câu hỏi</span>
                    </div>
                    <Button size="xl" className="w-full" onClick={() => setView('taking')}>🚀 Bắt đầu</Button>
                </div>
            </div>
        );
    }

    // ==================== RESULT ====================
    if (view === 'result') {
        return (
            <div className="mx-auto max-w-3xl">
                <div className="mb-6 rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
                    <div className={cn(
                        'mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold',
                        score >= 8 ? 'bg-emerald-100 text-emerald-700' : score >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    )}>{score}</div>
                    <h2 className="text-xl font-bold">{score >= 8 ? '🎉 Excellent!' : score >= 5 ? '👍 Good job!' : '💪 Keep trying!'}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{correctCount}/{total} correct</p>
                    <div className="mt-6 flex justify-center gap-3">
                        <Button variant="outline" onClick={() => { setView('ready'); setAnswers({}); if (exam) setTimeLeft(exam.time * 60); }}>
                            <RotateCcw className="h-4 w-4" /> Làm lại
                        </Button>
                        <Button onClick={() => navigate('/etest')}>Bài khác</Button>
                    </div>
                </div>

                {/* Answer review */}
                <div className="space-y-4">
                    {exam.sections.map((sec, si) => (
                        <div key={si} className="rounded-xl border border-border bg-card p-4">
                            <h3 className="text-sm font-bold mb-2">Passage {si + 1}</h3>
                            {sec.questions.map((q, qi) => {
                                const key = `${si}-${qi}`;
                                const isCorrect = answers[key] === q.correct;
                                return (
                                    <div key={qi} className={cn('flex items-start gap-2 rounded-md px-3 py-1.5 text-xs mb-1', isCorrect ? 'text-emerald-700' : 'text-red-600')}>
                                        {isCorrect ? <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" /> : <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />}
                                        <span className="flex-1">Q{qi + 1}: {q.text.substring(0, 80)}... → {q.options[q.correct]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ==================== TAKING ====================
    const isTimeLow = timeLeft < 300;

    return (
        <div className={cn('mx-auto w-full', darkMode && 'dark')}>
            {/* Header */}
            <div className="sticky top-14 z-30 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate max-w-[150px]">{exam.title}</span>
                        {exam.sections.length > 1 && (
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" disabled={currentSection === 0} onClick={() => setCurrentSection((p) => p - 1)}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                    {currentSection + 1}/{exam.sections.length}
                                </span>
                                <Button variant="ghost" size="icon" disabled={currentSection === exam.sections.length - 1} onClick={() => setCurrentSection((p) => p + 1)}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)}>
                            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </Button>
                        <div className={cn(
                            'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-mono font-bold',
                            isTimeLow ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-muted text-foreground'
                        )}>
                            <Clock className="h-3.5 w-3.5" /> {formatTime(timeLeft)}
                        </div>
                        <Button size="sm" onClick={() => setShowSubmitConfirm(true)}>
                            <Send className="h-3.5 w-3.5" /> Nộp
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile tab switcher */}
            <div className="mb-4 flex rounded-lg bg-muted p-1 lg:hidden">
                <button onClick={() => setMobileTab('passage')} className={cn('flex-1 rounded-md py-2 text-sm font-medium transition-all', mobileTab === 'passage' ? 'bg-background shadow' : 'text-muted-foreground')}>
                    Passage
                </button>
                <button onClick={() => setMobileTab('questions')} className={cn('flex-1 rounded-md py-2 text-sm font-medium transition-all', mobileTab === 'questions' ? 'bg-background shadow' : 'text-muted-foreground')}>
                    Questions
                </button>
            </div>

            {/* Split view */}
            <div className="flex gap-4">
                {/* Passage */}
                <div className={cn('flex-1 rounded-xl border border-border bg-card p-5', mobileTab !== 'passage' && 'hidden lg:block')}>
                    <LatexContent content={section?.passage || ''} className="prose prose-sm max-w-none dark:prose-invert block" />
                </div>

                {/* Questions */}
                <div className={cn('flex-1 space-y-4', mobileTab !== 'questions' && 'hidden lg:block')}>
                    {section?.questions.map((q, qi) => {
                        const key = `${currentSection}-${qi}`;
                        return (
                            <div key={qi} className="rounded-xl border border-border bg-card p-4">
                                <p className="mb-3 text-sm font-medium">
                                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">{qi + 1}</span>
                                    <LatexContent content={q.text} />
                                </p>
                                <div className="space-y-1.5">
                                    {q.options.map((opt, oi) => (
                                        <button
                                            key={oi}
                                            onClick={() => setAnswers({ ...answers, [key]: oi })}
                                            className={cn(
                                                'w-full rounded-lg border p-2.5 text-left text-sm transition-all',
                                                answers[key] === oi
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium dark:bg-emerald-900/20'
                                                    : 'border-border hover:bg-accent'
                                            )}
                                        >
                                            {String.fromCharCode(65 + oi)}. <LatexContent content={opt} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <ConfirmDialog
                open={showSubmitConfirm}
                onClose={() => setShowSubmitConfirm(false)}
                onConfirm={handleSubmit}
                title="Submit?"
                message={`Bạn còn ${formatTime(timeLeft)}. Nộp bài ngay?`}
                confirmText="Nộp bài"
            />
        </div>
    );
}
