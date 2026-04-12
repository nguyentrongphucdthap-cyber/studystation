import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    getPracticeHistoryById, 
    getExamContent, 
    getSubjects 
} from '@/services/exam.service';
import { 
    ArrowLeft, 
    Trophy, 
    Clock, 
    Calendar, 
    Sparkles, 
    ChevronUp, 
    ChevronDown, 
    CheckCircle, 
    XCircle, 
    MinusCircle,
    GripVertical,
    Search,
    X,
    AlertCircle
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { LatexContent } from '@/components/ui/LatexContent';
import MagoSideChat from '@/components/MagoSideChat';
import type { PracticeHistory, Exam } from '@/types';
import { cn, formatTime } from '@/lib/utils';

export default function PracticeReview() {
    const { historyId } = useParams<{ historyId: string }>();
    const navigate = useNavigate();
    
    const [history, setHistory] = useState<PracticeHistory | null>(null);
    const [exam, setExam] = useState<Exam | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
    const [resultFilter, setResultFilter] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showMago, setShowMago] = useState(false);
    const [magoCommand, setMagoCommand] = useState<string | null>(null);
    
    // Resizable Split-Screen Logic
    const [leftWidth, setLeftWidth] = useState(() => {
        const saved = localStorage.getItem(' SS_REVIEW_SPLIT_W');
        return saved ? Number(saved) : 65;
    });
    const isResizing = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function loadData() {
            if (!historyId) return;
            try {
                const hist = await getPracticeHistoryById(historyId);
                if (!hist) {
                    setError('Không tìm thấy lịch sử làm bài');
                    return;
                }
                setHistory(hist);
                
                const examData = await getExamContent(hist.examId, true);
                setExam(examData);
                
                if (examData) {
                    // Expand all by default
                    const initialExpanded: Record<string, boolean> = {};
                    (examData.part1 || []).forEach(q => initialExpanded[`p1-${q.id}`] = true);
                    (examData.part2 || []).forEach(q => initialExpanded[`p2-${q.id}`] = true);
                    (examData.part3 || []).forEach(q => initialExpanded[`p3-${q.id}`] = true);
                    setExpandedResults(initialExpanded);
                }
            } catch (err) {
                console.error('[Review] Load error:', err);
                setError('Lỗi khi tải dữ liệu bài thi');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [historyId]);

    const handleMouseDown = useCallback((_e: React.MouseEvent) => {
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current || !containerRef.current) return;
            
            const containerWidth = containerRef.current.offsetWidth;
            const newLeftWidth = (e.clientX / containerWidth) * 100;
            
            if (newLeftWidth >= 20 && newLeftWidth <= 80) {
                setLeftWidth(newLeftWidth);
            }
        };

        const handleMouseUp = () => {
            if (isResizing.current) {
                isResizing.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem('SS_REVIEW_SPLIT_W', Math.round(leftWidth).toString());
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [leftWidth]);

    const triggerMagoExplanation = (part: string, _qId: number, text: string) => {
        const prompt = `Hãy giải thích câu hỏi sau đây:\n\n[Dữ liệu câu hỏi]\nNội dung: ${text}\nPhần: ${part}\n\n[Yêu cầu]\nGiải thích chi tiết tại sao đáp án đúng lại là đáp án đó và phân tích các lỗi sai thường gặp.`;
        setMagoCommand(prompt);
        setShowMago(true);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
            <Spinner size="lg" />
            <p className="text-slate-400 font-medium animate-pulse">Đang tải chi tiết bài làm...</p>
        </div>
    );
    
    if (error || !history || !exam) return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="text-red-500 h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">{error || 'Có lỗi xảy ra'}</h2>
            <Button onClick={() => navigate(-1)} className="mt-4" variant="outline">Quay lại</Button>
        </div>
    );

    const subjects = getSubjects();
    // const subject = subjects.find(s => s.id === history.subjectId);
    const dateStr = new Date(history.timestamp).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Answers mapping for easier lookup
    const p1Ans = history.answers as Record<string, number>;
    const p2Ans = history.answers as Record<string, boolean>;
    const p3Ans = history.answers as Record<string, string>;

    // Calculate Stats
    const stats = {
        correct: history.correctCount,
        unanswered: 0,
        incorrect: 0
    };

    // Refined unanswered calculation
    (exam.part1 || []).forEach(q => {
        if (p1Ans[q.id] === undefined) stats.unanswered++;
        else if (p1Ans[q.id] !== q.correct) stats.incorrect++;
    });
    (exam.part2 || []).forEach(q => {
        const subQuestions = q.subQuestions;
        const allAnswered = subQuestions.every(sq => p2Ans[`${q.id}-${sq.id}`] !== undefined);
        const allCorrect = subQuestions.every(sq => p2Ans[`${q.id}-${sq.id}`] === sq.correct);
        if (!allAnswered) stats.unanswered++;
        else if (!allCorrect) stats.incorrect++;
    });
    (exam.part3 || []).forEach(q => {
        const ans = p3Ans[q.id];
        if (!ans || ans.trim().length === 0) stats.unanswered++;
        else if (ans.trim().toLowerCase() !== q.correct.trim().toLowerCase()) stats.incorrect++;
    });

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        <ArrowLeft className="h-5 w-5 text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-sm font-bold text-slate-800 line-clamp-1">{exam.title}</h1>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {dateStr}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(history.durationSeconds)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-4 border-l border-slate-100 pl-6">
                        <div className="text-center">
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Điểm số</p>
                            <div className={cn(
                                "text-lg font-black flex items-center gap-1.5",
                                history.score >= 8 ? "text-emerald-600" : history.score >= 5 ? "text-amber-600" : "text-red-600"
                            )}>
                                <Trophy className="h-4 w-4" /> {history.score.toFixed(1)}
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Số câu đúng</p>
                            <div className="text-lg font-black text-slate-700">
                                {history.correctCount}/{history.totalQuestions}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Split Main Content */}
            <main ref={containerRef} className="flex-1 flex overflow-hidden relative">
                {/* Left Pane: Question List */}
                <div 
                    className={cn(
                        "h-full overflow-y-auto bg-slate-50 relative transition-all duration-300",
                        !showMago ? "w-full" : ""
                    )}
                    style={showMago ? { width: `${leftWidth}%` } : {}}
                >
                    <div className={cn(
                        "max-w-3xl mx-auto p-4 md:p-8 space-y-6",
                        !showMago && "max-w-5xl"
                    )}>
                        {/* Toolbar: Search + Tabs */}
                        <div className="sticky top-0 z-20 flex flex-col gap-4 bg-slate-50/80 backdrop-blur-md pb-6 pt-2">
                            {/* Search Bar */}
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input 
                                    type="text"
                                    placeholder="Tìm kiếm nội dung câu hỏi..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full"
                                    >
                                        <X size={14} className="text-slate-400" />
                                    </button>
                                )}
                            </div>

                            {/* Navbar Tabs */}
                            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm items-center justify-between">
                                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                                    {[
                                        { id: 'all', label: 'Tất cả', count: history.totalQuestions, color: 'indigo' },
                                        { id: 'correct', label: 'Câu đúng', count: stats.correct, color: 'emerald' },
                                        { id: 'incorrect', label: 'Câu sai', count: stats.incorrect, color: 'red' },
                                        { id: 'unanswered', label: 'Chưa làm', count: stats.unanswered, color: 'slate' }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setResultFilter(tab.id as any)}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                                                resultFilter === tab.id 
                                                    ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-100` 
                                                    : "text-slate-500 hover:bg-slate-100"
                                            )}
                                        >
                                            {tab.label}
                                            <span className={cn(
                                                "px-1.5 py-0.5 rounded-md text-[10px]",
                                                resultFilter === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {tab.count}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <div className="h-6 w-px bg-slate-100 mx-2 hidden sm:block" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[10px] font-black uppercase tracking-tighter text-indigo-600 h-8 px-3 shrink-0"
                                    onClick={() => {
                                        const allExpanded = Object.keys(expandedResults).length > 10;
                                        if (allExpanded) setExpandedResults({});
                                        else {
                                            const next: any = {};
                                            (exam.part1 || []).forEach(q => next[`p1-${q.id}`] = true);
                                            (exam.part2 || []).forEach(q => next[`p2-${q.id}`] = true);
                                            (exam.part3 || []).forEach(q => next[`p3-${q.id}`] = true);
                                            setExpandedResults(next);
                                        }
                                    }}
                                >
                                    {Object.keys(expandedResults).length > 10 ? 'Thu gọn' : 'Mở rộng'}
                                </Button>
                            </div>
                        </div>

                        {/* Part 1 Render */}
                        {exam.part1?.map((q, idx) => {
                            const userAns = p1Ans[q.id];
                            const answered = userAns !== undefined;
                            const isCorrect = answered && userAns === q.correct;
                            const isExpanded = expandedResults[`p1-${q.id}`];

                            // Filtering
                            if (resultFilter === 'correct' && !isCorrect) return null;
                            if (resultFilter === 'incorrect' && (isCorrect || !answered)) return null;
                            if (resultFilter === 'unanswered' && answered) return null;
                            
                            if (searchQuery && !q.text.toLowerCase().includes(searchQuery.toLowerCase())) return null;

                            return (
                                <div key={`p1-${q.id}`} className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden group">
                                    <button 
                                        onClick={() => setExpandedResults(prev => ({ ...prev, [`p1-${q.id}`]: !isExpanded }))}
                                        className="w-full flex items-center justify-between p-5 text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-inner",
                                                !answered ? "bg-slate-100 text-slate-400" : isCorrect ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                            )}>
                                                {isCorrect ? <CheckCircle size={20} /> : !answered ? <MinusCircle size={20} /> : <XCircle size={20} />}
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">PHẦN I • CÂU {idx + 1}</span>
                                                <h4 className="text-sm font-bold text-slate-700 line-clamp-1">{q.text}</h4>
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronUp size={20} className="text-slate-300" /> : <ChevronDown size={20} className="text-slate-300" />}
                                    </button>

                                    {isExpanded && (
                                        <div className="px-5 pb-6 pt-2 bg-slate-50/30 border-t border-slate-50 animate-in fade-in duration-300">
                                            <div className="mb-5 text-slate-800 leading-relaxed font-medium">
                                                <LatexContent content={q.text} />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {q.options.map((opt, i) => (
                                                    <div key={i} className={cn(
                                                        "p-4 rounded-2xl border text-sm flex items-start gap-3 transition-all",
                                                        i === q.correct 
                                                            ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-bold shadow-sm" 
                                                            : (answered && i === userAns) 
                                                                ? "bg-red-50 border-red-200 text-red-900" 
                                                                : "bg-white border-slate-100 text-slate-500"
                                                    )}>
                                                        <span className="font-black opacity-30 mt-0.5">{String.fromCharCode(65 + i)}</span>
                                                        <LatexContent content={opt} />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-6 flex flex-wrap items-center gap-3">
                                                <Button 
                                                    onClick={() => triggerMagoExplanation('Phần I (Trắc nghiệm)', idx + 1, q.text)}
                                                    className="rounded-xl font-bold bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 shadow-none gap-2 h-10 px-5"
                                                    variant="ghost"
                                                >
                                                    <Sparkles size={16} /> Giải thích bằng Mago AI
                                                </Button>
                                                {q.explanation && (
                                                    <div className="w-full mt-4 p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" /> Giải thích hệ thống
                                                        </p>
                                                        <div className="text-sm text-slate-600 leading-relaxed italic">
                                                            <LatexContent content={q.explanation} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Part 2 Render */}
                        {exam.part2?.map((q, idx) => {
                            const isExpanded = expandedResults[`p2-${q.id}`];
                            const subResults = q.subQuestions.map(sq => {
                                const key = `${q.id}-${sq.id}`;
                                const ans = p2Ans[key];
                                return ans !== undefined && ans === sq.correct;
                            });
                            
                            const allAnswered = q.subQuestions.every(sq => p2Ans[`${q.id}-${sq.id}`] !== undefined);
                            const allCorrect = subResults.every(r => r === true);
                            const someIncorrect = subResults.some(r => r === false);

                            // Filtering
                            if (resultFilter === 'correct' && !allCorrect) return null;
                            if (resultFilter === 'incorrect' && (allCorrect || !allAnswered)) return null;
                            if (resultFilter === 'unanswered' && allAnswered) return null;

                            if (searchQuery && !q.text.toLowerCase().includes(searchQuery.toLowerCase())) return null;

                            return (
                                <div key={`p2-${q.id}`} className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden group">
                                    <button 
                                        onClick={() => setExpandedResults(prev => ({ ...prev, [`p2-${q.id}`]: !isExpanded }))}
                                        className="w-full flex items-center justify-between p-5 text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-inner",
                                                allCorrect ? "bg-emerald-50 text-emerald-600" : someIncorrect ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-400"
                                            )}>
                                                {allCorrect ? <CheckCircle size={20} /> : someIncorrect ? <XCircle size={20} /> : <MinusCircle size={20} />}
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">PHẦN II • CÂU {idx + 1}</span>
                                                <h4 className="text-sm font-bold text-slate-700 line-clamp-1">{q.text}</h4>
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronUp size={20} className="text-slate-300" /> : <ChevronDown size={20} className="text-slate-300" />}
                                    </button>

                                    {isExpanded && (
                                        <div className="px-5 pb-6 pt-2 bg-slate-50/30 border-t border-slate-50 animate-in fade-in duration-300">
                                            <div className="mb-5 text-slate-800 leading-relaxed font-medium">
                                                <LatexContent content={q.text} />
                                            </div>
                                            <div className="space-y-2">
                                                {q.subQuestions.map((sq) => {
                                                    const key = `${q.id}-${sq.id}`;
                                                    const uAns = p2Ans[key];
                                                    const hasAns = uAns !== undefined;
                                                    const isCorrect = hasAns && uAns === sq.correct;

                                                    return (
                                                        <div key={key} className={cn(
                                                            "p-4 rounded-xl border text-sm flex items-center justify-between",
                                                            !hasAns ? "bg-white border-slate-100 text-slate-400" :
                                                                isCorrect ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-red-50/50 border-red-100 text-red-800"
                                                        )}>
                                                            <div className="flex gap-2">
                                                                <span className="font-black opacity-30">{sq.id.toUpperCase()})</span>
                                                                <LatexContent content={sq.text} />
                                                            </div>
                                                            <div className="flex items-center gap-3 shrink-0 ml-4 font-black text-[10px]">
                                                                <span className="opacity-40">{hasAns ? (isCorrect ? 'ĐÚNG' : 'SAI') : 'TRỐNG'}</span>
                                                                <div className="w-1 h-1 bg-slate-200 rounded-full" />
                                                                <span className="text-emerald-600">Đ/A: {sq.correct ? 'Đ' : 'S'}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-6">
                                                <Button 
                                                    onClick={() => triggerMagoExplanation('Phần II (Đúng/Sai)', idx + 1, q.text)}
                                                    className="rounded-xl font-bold bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 shadow-none gap-2 h-10 px-5"
                                                    variant="ghost"
                                                >
                                                    <Sparkles size={16} /> Giải thích bằng Mago AI
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Part 3 Render */}
                        {exam.part3?.map((q, idx) => {
                            const userAns = p3Ans[q.id];
                            const answered = (userAns || '').trim().length > 0;
                            const isCorrect = answered && userAns && userAns.trim().toLowerCase() === q.correct.trim().toLowerCase();
                            const isExpanded = expandedResults[`p3-${q.id}`];

                            // Filtering
                            if (resultFilter === 'correct' && !isCorrect) return null;
                            if (resultFilter === 'incorrect' && (isCorrect || !answered)) return null;
                            if (resultFilter === 'unanswered' && answered) return null;

                            if (searchQuery && !q.text.toLowerCase().includes(searchQuery.toLowerCase())) return null;

                            return (
                                <div key={`p3-${q.id}`} className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden group">
                                    <button 
                                        onClick={() => setExpandedResults(prev => ({ ...prev, [`p3-${q.id}`]: !isExpanded }))}
                                        className="w-full flex items-center justify-between p-5 text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-inner",
                                                !answered ? "bg-slate-100 text-slate-400" : isCorrect ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                            )}>
                                                {isCorrect ? <CheckCircle size={20} /> : !answered ? <MinusCircle size={20} /> : <XCircle size={20} />}
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">PHẦN III • CÂU {idx + 1}</span>
                                                <h4 className="text-sm font-bold text-slate-700 line-clamp-1">{q.text}</h4>
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronUp size={20} className="text-gray-300" /> : <ChevronDown size={20} className="text-gray-300" />}
                                    </button>

                                    {isExpanded && (
                                        <div className="px-5 pb-6 pt-2 bg-slate-50/30 border-t border-slate-50 animate-in fade-in duration-300">
                                            <div className="mb-5 text-slate-800 leading-relaxed font-medium">
                                                <LatexContent content={q.text} />
                                            </div>
                                            <div className="flex gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm items-center">
                                                <div className="flex-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Câu trả lời</p>
                                                    <p className={cn("text-base font-bold", isCorrect ? "text-emerald-600" : "text-red-500")}>
                                                        {answered ? userAns : '(Trống)'}
                                                    </p>
                                                </div>
                                                <div className="w-px h-10 bg-slate-100" />
                                                <div className="flex-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Đáp án đúng</p>
                                                    <p className="text-base font-bold text-emerald-600">{q.correct}</p>
                                                </div>
                                            </div>
                                            <div className="mt-6">
                                                <Button 
                                                    onClick={() => triggerMagoExplanation('Phần III (Trả lời ngắn)', idx + 1, q.text)}
                                                    className="rounded-xl font-bold bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 shadow-none gap-2 h-10 px-5"
                                                    variant="ghost"
                                                >
                                                    <Sparkles size={16} /> Giải thích bằng Mago AI
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Conditional Resizable Divider & Right Pane */}
                {showMago && (
                    <>
                        {/* Resizable Divider */}
                        <div 
                            className="w-1.5 h-full bg-slate-200 hover:bg-indigo-300 cursor-col-resize transition-colors flex items-center justify-center group shrink-0 relative z-20"
                            onMouseDown={handleMouseDown}
                        >
                            <div className="w-full h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="h-4 w-4 text-white" />
                            </div>
                        </div>

                        {/* Right Pane: Mago Side Chat */}
                        <div 
                            className="h-full bg-white shadow-2xl relative z-30 overflow-hidden flex flex-col"
                            style={{ width: `${100 - leftWidth}%` }}
                        >
                            <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 shrink-0 bg-slate-50/50 backdrop-blur-sm">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" /> Giải thích AI
                                </span>
                                <button 
                                    onClick={() => setShowMago(false)}
                                    className="p-2 hover:bg-slate-200 rounded-xl transition-all"
                                >
                                    <X className="h-4 w-4 text-slate-400" />
                                </button>
                            </div>
                            <MagoSideChat 
                                command={magoCommand} 
                                onCommandProcessed={() => setMagoCommand(null)} 
                                hideHeader={true}
                            />
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
