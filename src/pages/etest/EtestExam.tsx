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
    Sun, Moon, Send, RotateCcw,
    Settings, List, ArrowUp, Sparkles
} from 'lucide-react';
import { LatexContent } from '@/components/ui/LatexContent';
import { useTheme } from '@/contexts/ThemeContext';
import { useUI } from '@/contexts/UIContext';
import { createPortal } from 'react-dom';

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
    const [viewMode, setViewMode] = useState<'exam' | 'optimized'>('exam');
    const { settings } = useTheme();
    const { triggerMago } = useUI();
    const [darkMode, setDarkMode] = useState(settings.mode === 'dark');

    // Navbar Visibility Logic
    const [isNavbarVisible, setIsNavbarVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [showMobileTOC, setShowMobileTOC] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);
    const [showActionMenu, setShowActionMenu] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > 100) {
                setIsNavbarVisible(currentScrollY < lastScrollY);
                setShowScrollTop(true);
            } else {
                setIsNavbarVisible(true);
                setShowScrollTop(false);
            }
            setLastScrollY(currentScrollY);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setShowActionMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                        score >= 8 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : score >= 5 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
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
                                    <div key={qi} className={cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-xs mb-1', isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                                        {isCorrect ? <CheckCircle className="h-3 w-3 flex-shrink-0" /> : <XCircle className="h-3 w-3 flex-shrink-0" />}
                                        <span className="flex-1">Q{qi + 1}: {q.text.substring(0, 80)}... → {q.options[q.correct]}</span>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex-shrink-0 rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
                                            onClick={() => triggerMago(`/explain-etest examId:${examId} s:${si} q:${qi}`)}
                                            title="Giải thích bằng AI"
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                        </Button>
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
    const answeredCount = Object.keys(answers).length;
    const totalQuestions = exam.sections.reduce((s, sec) => s + sec.questions.length, 0);

    return (
        <div className={cn('mx-auto w-full pb-32', darkMode && 'dark')}>
            {/* Old sticky header removed in favor of floating navbar */}

            {/* Mobile tab switcher */}
            <div className="mb-4 flex rounded-lg bg-muted p-1 lg:hidden">
                <button onClick={() => setMobileTab('passage')} className={cn('flex-1 rounded-md py-2 text-sm font-medium transition-all', mobileTab === 'passage' ? 'bg-background shadow' : 'text-muted-foreground')}>
                    Passage
                </button>
                <button onClick={() => setMobileTab('questions')} className={cn('flex-1 rounded-md py-2 text-sm font-medium transition-all', mobileTab === 'questions' ? 'bg-background shadow' : 'text-muted-foreground')}>
                    Questions
                </button>
            </div>

            {/* Split view or Stacked view */}
            <div className={cn(
                'flex gap-4',
                (viewMode === 'optimized' || !section?.passage) ? 'flex-col' : 'flex-row'
            )}>
                {/* Passage */}
                {section?.passage && (
                    <div className={cn(
                        'flex-1 rounded-xl border border-border bg-card p-5', 
                        mobileTab !== 'passage' && 'hidden lg:block',
                        (viewMode === 'optimized' || !section?.passage) ? 'w-full' : ''
                    )}>
                        <LatexContent content={section?.passage || ''} className="prose prose-sm max-w-none dark:prose-invert block" />
                    </div>
                )}

                {/* Questions */}
                <div className={cn(
                    'flex-1 space-y-4', 
                    mobileTab !== 'questions' && 'hidden lg:block',
                    (viewMode === 'optimized' || !section?.passage) ? 'w-full' : ''
                )}>
                    {section?.questions.map((q, qi) => {
                        const key = `${currentSection}-${qi}`;
                        return (
                            <div key={qi} id={`q-${currentSection}-${qi}`} className="rounded-xl border border-border bg-card p-4 scroll-mt-24">
                                <p className="mb-3 text-sm font-medium">
                                    <span 
                                        className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
                                        style={{ backgroundColor: settings.accentColor }}
                                    >
                                        {qi + 1}
                                    </span>
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
                                                    ? 'shadow-sm font-medium'
                                                    : 'border-border hover:bg-accent'
                                            )}
                                            style={answers[key] === oi ? {
                                                borderColor: settings.accentColor,
                                                backgroundColor: darkMode ? `${settings.accentColor}20` : `${settings.accentColor}10`,
                                                color: darkMode ? '#ffffff' : settings.accentColor
                                            } : {}}
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

            {/* Floating Navbar */}
            {createPortal(
                <div className={cn(
                    "fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] w-fit max-w-[95%] transition-all duration-500 transform",
                    isNavbarVisible ? "translate-y-0 opacity-100" : "translate-y-32 opacity-0"
                )}>
                    <div className="flex items-center gap-2">
                        <div className="bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.4)] p-1.5 flex items-center gap-1 transition-all">
                            {/* Progress */}
                            <div 
                                className="rounded-full px-4 py-1.5 flex items-center gap-2 shadow-inner"
                                style={{ backgroundColor: settings.accentColor }}
                            >
                                <span className="text-white font-black text-sm">{answeredCount}/{totalQuestions}</span>
                            </div>

                            {/* Timer */}
                            <div className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors",
                                isTimeLow ? "bg-red-500/20 text-red-500 animate-pulse" : "text-slate-300"
                            )}>
                                <Clock className="h-4 w-4" />
                                <span className="font-mono font-black text-sm md:text-base">{formatTime(timeLeft)}</span>
                            </div>

                            {/* Actions Group */}
                            <div className="flex items-center gap-1 pl-1 border-l border-slate-700 relative" ref={actionMenuRef}>
                                <button 
                                    onClick={() => setShowActionMenu(!showActionMenu)}
                                    className={cn(
                                        "h-9 w-9 flex items-center justify-center rounded-full transition-all",
                                        showActionMenu ? "bg-white text-slate-900" : "text-slate-400 hover:text-white hover:bg-slate-800"
                                    )}
                                >
                                    <Settings className={cn("h-4 w-4 transition-transform", showActionMenu && "rotate-90")} />
                                </button>

                                {showActionMenu && (
                                    <div className="absolute bottom-full mb-3 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 min-w-[160px] animate-in slide-in-from-bottom-2 duration-200">
                                        <button 
                                            onClick={() => { setDarkMode(!darkMode); setShowActionMenu(false); }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                                        >
                                            {darkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
                                            <span>{darkMode ? 'Sáng' : 'Tối'}</span>
                                        </button>
                                        <button 
                                            onClick={() => { setViewMode(viewMode === 'exam' ? 'optimized' : 'exam'); setShowActionMenu(false); }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                                        >
                                            <Sparkles className={cn("h-4 w-4", viewMode === 'optimized' ? "text-emerald-500" : "text-slate-400")} />
                                            <span>{viewMode === 'exam' ? 'Chế độ: Bài thi' : 'Chế độ: Tối ưu'}</span>
                                        </button>
                                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />
                                        <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Chuyển đoạn</div>
                                        {exam.sections.map((_, idx) => (
                                            <button 
                                                key={idx}
                                                onClick={() => { setCurrentSection(idx); setShowActionMenu(false); }}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-colors",
                                                    currentSection === idx ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                                )}
                                            >
                                                <div className={cn("w-1.5 h-1.5 rounded-full", currentSection === idx ? "bg-indigo-600" : "bg-slate-300")} />
                                                Passage {idx + 1}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <button 
                                    onClick={() => setShowMobileTOC(true)}
                                    className="h-9 w-9 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
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

                        <button
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                            className={cn(
                                "h-12 w-12 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl transition-all duration-300 transform",
                                showScrollTop ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
                            )}
                            style={{ color: settings.accentColor }}
                        >
                            <ArrowUp className="h-5 w-5" />
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* TOC Drawer */}
            {showMobileTOC && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setShowMobileTOC(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h4 className="flex items-center gap-2 font-black text-slate-800 dark:text-gray-100">
                                <List className="h-5 w-5" style={{ color: settings.accentColor }} /> Danh sách câu hỏi
                            </h4>
                            <button onClick={() => setShowMobileTOC(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                                <XCircle className="h-5 w-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-6">
                            {exam.sections.map((sec, si) => (
                                <div key={si} className="space-y-3">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                        Passage {si + 1}
                                        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                                    </div>
                                    <div className="grid grid-cols-5 gap-2">
                                        {sec.questions.map((_, qi) => {
                                            const key = `${si}-${qi}`;
                                            const isAnswered = answers[key] !== undefined;
                                            const isActive = currentSection === si;
                                            return (
                                                <button
                                                    key={qi}
                                                    onClick={() => {
                                                        setCurrentSection(si);
                                                        setShowMobileTOC(false);
                                                        setTimeout(() => {
                                                            const el = document.getElementById(`q-${si}-${qi}`);
                                                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                        }, 100);
                                                    }}
                                                    className={cn(
                                                        "h-10 rounded-xl text-xs font-black transition-all border-2",
                                                        isAnswered 
                                                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200"
                                                            : isActive 
                                                                ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-400"
                                                                : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transparency-50 opacity-50"
                                                    )}
                                                >
                                                    {qi + 1}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
