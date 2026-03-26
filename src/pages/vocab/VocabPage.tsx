import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getAllVocabSets } from '@/services/vocab.service';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { VocabSet, VocabWord } from '@/types';
import { 
    BookOpen, RotateCcw, CheckCircle, Shuffle, 
    ChevronLeft, Layers, 
    Check, X, Award, Home, RefreshCw,
    Sparkles, ArrowRight, Search, SortAsc, Filter,
    ChevronDown
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/contexts/ThemeContext';

type VocabView = 'home' | 'flashcard' | 'result' | 'matching' | 'learn';

interface SelectOption {
    value: string;
    label: string;
}

interface PremiumSelectProps {
    value: string;
    onChange: (value: any) => void;
    options: SelectOption[];
    icon: React.ReactNode;
    placeholder: string;
    className?: string;
}

function PremiumSelect({ value, onChange, options, icon, placeholder, className }: PremiumSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border-none rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-sm transition-all outline-none",
                    isOpen ? "ring-2 ring-purple-500 shadow-lg" : "hover:bg-gray-50 dark:hover:bg-slate-700"
                )}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="text-gray-400 shrink-0">{icon}</div>
                    <span className="truncate dark:text-white">
                        {selectedOption && selectedOption.value !== 'default' && selectedOption.value !== 'all' 
                            ? selectedOption.label 
                            : placeholder}
                    </span>
                </div>
                <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform duration-300 shrink-0", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 p-1.5 bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl border border-white/20 dark:border-slate-800 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[11px] font-bold uppercase transition-all",
                                    value === option.value
                                        ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                                        : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                                )}
                            >
                                <span>{option.label}</span>
                                {value === option.value && <Check className="h-3 w-3" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function VocabPage() {
    const { settings } = useTheme();

    // Basic state
    const [sets, setSets] = useState<VocabSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSet, setActiveSet] = useState<VocabSet | null>(null);
    const [view, setView] = useState<VocabView>('home');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [error, setError] = useState<string | null>(null);

    // Filter & Sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'default' | 'a-z' | 'z-a' | 'progress-high' | 'progress-low' | 'words-high' | 'words-low'>('default');
    const [progressFilter, setProgressFilter] = useState<'all' | 'not-started' | 'in-progress' | 'completed'>('all');

    // Flashcard core state
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [knownIds, setKnownIds] = useState<number[]>([]);
    const [unknownIds, setUnknownIds] = useState<number[]>([]);
    const [isReviewingUnknown, setIsReviewingUnknown] = useState(false);
    const [currentWords, setCurrentWords] = useState<VocabWord[]>([]);
    const [history, setHistory] = useState<number[]>([]);
    
    // Swipe animation state
    const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    // Matching state
    const [matchWords, setMatchWords] = useState<VocabWord[]>([]);
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
    const [wrongPair, setWrongPair] = useState<string | null>(null);
    const [matchBatchIndex, setMatchBatchIndex] = useState(0);

    // Study Menu & Settings State
    const [showStudyMenu, setShowStudyMenu] = useState(false);
    const [wordCountLimit, setWordCountLimit] = useState<number | 'all'>(20);
    const [customWordCount, setCustomWordCount] = useState<string>('');

    // Learn Mode (Quiz) State
    const [quizQuestions, setQuizQuestions] = useState<{
        word: string;
        options: string[];
        correct: string;
        isEn: boolean;
        userAnswer: string | null;
    }[]>([]);
    const [quizAnswered, setQuizAnswered] = useState<Record<number, string | null>>({});

    useEffect(() => {
        getAllVocabSets()
            .then((data) => {
                setSets(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('[Vocab] Fetch error:', err);
                setError('Không thể tải danh sách từ vựng.');
                setLoading(false);
            });
    }, []);

    const categories = [
        { id: 'all', label: 'Tất cả' },
        { id: 'gdpt', label: 'GDPT' },
        { id: 'advanced_gdpt', label: 'Nâng cao' },
        { id: 'topic', label: 'Chủ đề' },
    ];

    // Helper: Get progress for a set
    const getSetProgress = useCallback((vocabSet: VocabSet) => {
        const learnedKey = `vocab_learned_${vocabSet.id}`;
        const learnedIds = JSON.parse(localStorage.getItem(learnedKey) || '[]');
        return vocabSet.words.length > 0 ? Math.round((learnedIds.length / vocabSet.words.length) * 100) : 0;
    }, []);

    const filteredAndSortedSets = useMemo(() => {
        let result = activeCategory === 'all' ? [...sets] : sets.filter((s) => s.category === activeCategory);

        // 1. Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(s => s.title.toLowerCase().includes(query));
        }

        // 2. Progress filter
        if (progressFilter !== 'all') {
            result = result.filter(s => {
                const p = getSetProgress(s);
                if (progressFilter === 'not-started') return p === 0;
                if (progressFilter === 'completed') return p === 100;
                if (progressFilter === 'in-progress') return p > 0 && p < 100;
                return true;
            });
        }

        // 3. Sorting
        result.sort((a, b) => {
            if (sortBy === 'a-z') return a.title.localeCompare(b.title);
            if (sortBy === 'z-a') return b.title.localeCompare(a.title);
            if (sortBy === 'progress-high') return getSetProgress(b) - getSetProgress(a);
            if (sortBy === 'progress-low') return getSetProgress(a) - getSetProgress(b);
            if (sortBy === 'words-high') return b.words.length - a.words.length;
            if (sortBy === 'words-low') return a.words.length - b.words.length;
            return 0;
        });

        return result;
    }, [sets, activeCategory, searchQuery, sortBy, progressFilter, getSetProgress]);

    // --- HELPER: Prioritize Unlearned ---
    const getPreparedWords = (vocabSet: VocabSet, limit: number | 'all') => {
        const learnedKey = `vocab_learned_${vocabSet.id}`;
        const learnedIds = JSON.parse(localStorage.getItem(learnedKey) || '[]');
        
        let words = [...vocabSet.words].map((w, idx) => ({ ...w, originalIndex: idx }));
        
        words.sort(() => Math.random() - 0.5); // Randomize initially

        // Sort so unlearned comes first
        words.sort((a, b) => {
            const aLearned = learnedIds.includes(a.originalIndex);
            const bLearned = learnedIds.includes(b.originalIndex);
            if (!aLearned && bLearned) return -1;
            if (aLearned && !bLearned) return 1;
            return 0; // Keep their initial random order within the group
        });

        if (limit !== 'all') {
            words = words.slice(0, Number(limit));
        }
        
        // Final shuffle so we aren't just doing all unlearned straight
        words.sort(() => Math.random() - 0.5);
        return words;
    };

    const markWordAsLearned = (setId: string, originalIndex: number) => {
        const learnedKey = `vocab_learned_${setId}`;
        const learnedIds: number[] = JSON.parse(localStorage.getItem(learnedKey) || '[]');
        if (!learnedIds.includes(originalIndex)) {
            localStorage.setItem(learnedKey, JSON.stringify([...learnedIds, originalIndex]));
        }
    };

    // --- FLASHCARD LOGIC ---
    const startFlashcard = (vocabSet: VocabSet, reviewUnknownOnly = false) => {
        setActiveSet(vocabSet);
        let words: (VocabWord & { originalIndex?: number })[] = [];
        
        if (reviewUnknownOnly) {
            words = vocabSet.words
                .map((w, i) => ({ ...w, originalIndex: i }))
                .filter((_, idx) => unknownIds.includes(idx));
        } else {
            words = getPreparedWords(vocabSet, wordCountLimit);
        }
        
        setCurrentWords(words as VocabWord[]);
        setCurrentIndex(0);
        setFlipped(false);
        setKnownIds([]);
        if (!reviewUnknownOnly) {
            setUnknownIds([]);
        }
        
        setIsReviewingUnknown(reviewUnknownOnly);
        setView('flashcard');
        setOffset({ x: 0, y: 0 });
        setSwipeDir(null);
        setHistory([]);
        setShowStudyMenu(false);
    };

    const handleUndo = () => {
        if (history.length === 0 || currentIndex === 0) return;
        
        const lastIndex = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        
        // Remove from known/unknown
        setKnownIds(prev => prev.filter(id => id !== lastIndex));
        setUnknownIds(prev => prev.filter(id => id !== lastIndex));
        
        // If it was marked as learned in localStorage, we can't easily undo that without knowing if it was already learned before this session,
        // but for the UI session, we just move the index back.
        
        setHistory(newHistory);
        setCurrentIndex(prev => prev - 1);
        setFlipped(false);
        setOffset({ x: 0, y: 0 });
        setSwipeDir(null);
    };

    const handleShuffleRemaining = () => {
        if (!activeSet) return;
        
        const remaining = currentWords.slice(currentIndex);
        const shuffled = [...remaining].sort(() => Math.random() - 0.5);
        
        const newWords = [...currentWords.slice(0, currentIndex), ...shuffled];
        setCurrentWords(newWords);
        
        // Visual feedback
        setOffset({ x: 0, y: -20 });
        setTimeout(() => setOffset({ x: 0, y: 0 }), 200);
    };

    const handleNextCard = (known: boolean) => {
        if (!activeSet || !currentWords[currentIndex]) return;
        
        const wordObj = currentWords[currentIndex] as VocabWord & { originalIndex?: number };
        const finalIndex = wordObj.originalIndex !== undefined ? wordObj.originalIndex : currentIndex;
        
        setHistory(prev => [...prev, finalIndex]);
        
        if (known) {
            setKnownIds(prev => [...prev, finalIndex]);
            setSwipeDir('right');
            markWordAsLearned(activeSet.id, finalIndex);
        } else {
            setUnknownIds(prev => [...prev, finalIndex]);
            setSwipeDir('left');
        }

        // Delay to allow animation
        setTimeout(() => {
            if (currentIndex < currentWords.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setFlipped(false);
                setOffset({ x: 0, y: 0 });
                setSwipeDir(null);
            } else {
                setView('result');
            }
        }, 400);
    };

    // Swipe interaction
    const onStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (swipeDir) return;
        setIsDragging(true);
        const touch = 'touches' in e ? (e.touches[0] || e) : e;
        if (!touch) return;
        dragStart.current = { x: (touch as any).clientX - offset.x, y: (touch as any).clientY - offset.y };
    };

    const onMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging || swipeDir) return;
        const touch = 'touches' in e ? (e.touches[0] || e) : e;
        if (!touch) return;
        const x = (touch as any).clientX - dragStart.current.x;
        const y = (touch as any).clientY - dragStart.current.y;
        setOffset({ x, y });
    };

    const onEnd = () => {
        if (!isDragging || swipeDir) return;
        setIsDragging(false);
        
        if (offset.x > 120) {
            handleNextCard(true);
        } else if (offset.x < -120) {
            handleNextCard(false);
        } else {
            setOffset({ x: 0, y: 0 });
        }
    };

    // --- MATCHING LOGIC ---
    const startMatching = (vocabSet: VocabSet) => {
        const words = getPreparedWords(vocabSet, wordCountLimit);
        setActiveSet(vocabSet);
        setCurrentWords(words as VocabWord[]);
        setMatchBatchIndex(0);
        
        // Take first batch
        const batch = words.slice(0, 6);
        setMatchWords(batch as VocabWord[]);
        
        setSelectedWord(null);
        setMatchedPairs(new Set());
        setWrongPair(null);
        setView('matching');
        setShowStudyMenu(false);
    };

    const mixedTiles = useMemo(() => {
        const tiles: { type: 'word' | 'meaning', text: string, id: string }[] = [];
        matchWords.forEach(w => {
            tiles.push({ type: 'word', text: w.word, id: w.word });
            tiles.push({ type: 'meaning', text: w.meaning, id: w.meaning });
        });
        return tiles.sort(() => Math.random() - 0.5);
    }, [matchWords]);

    const handleMatchClick = useCallback((item: string) => {
        if (matchedPairs.has(item) || wrongPair) return;

        if (!selectedWord) {
            setSelectedWord(item);
        } else {
            const pair = matchWords.find(
                (w) => (w.word === selectedWord && w.meaning === item) || (w.meaning === selectedWord && w.word === item)
            );
            if (pair) {
                setMatchedPairs(new Set([...matchedPairs, pair.word, pair.meaning]));
                markWordAsLearned(activeSet!.id, currentWords.indexOf(pair));
                
                // If batch completed
                if (matchedPairs.size + 2 === matchWords.length * 2) {
                    const nextIndex = matchBatchIndex + 6;
                    if (nextIndex < currentWords.length) {
                        setTimeout(() => {
                            setMatchBatchIndex(nextIndex);
                            const nextBatch = currentWords.slice(nextIndex, nextIndex + 6);
                            setMatchWords(nextBatch);
                            setMatchedPairs(new Set());
                            setSelectedWord(null);
                        }, 600);
                    } else {
                        setTimeout(() => setView('result'), 800);
                    }
                }
            } else {
                setWrongPair(item);
                setTimeout(() => setWrongPair(null), 600);
            }
            setSelectedWord(null);
        }
    }, [selectedWord, matchedPairs, matchWords, matchBatchIndex, currentWords, wrongPair]);

    // --- LEARN MODE LOGIC ---
    const startLearn = (vocabSet: VocabSet) => {
        const words = getPreparedWords(vocabSet, wordCountLimit);
        setActiveSet(vocabSet);
        setCurrentWords(words as VocabWord[]);
        
        const questions = words.map(w => {
            const isEn = Math.random() > 0.5;
            const correct = isEn ? w.meaning : w.word;
            
            // Generate wrong options
            const others = vocabSet.words
                .filter(other => other.word !== w.word)
                .map(other => isEn ? other.meaning : other.word)
                .sort(() => Math.random() - 0.5)
                .slice(0, 3);
            
            const options = [correct, ...others].sort(() => Math.random() - 0.5);
            
            return {
                word: isEn ? w.word : w.meaning,
                options,
                correct,
                isEn,
                userAnswer: null
            };
        });

        setQuizQuestions(questions);
        setQuizAnswered({});
        setCurrentIndex(0);
        setKnownIds([]);
        setUnknownIds([]);
        setView('learn');
        setShowStudyMenu(false);
    };

    const handleQuizAnswer = (answer: string) => {
        if (quizAnswered[currentIndex]) return;
        
        const q = quizQuestions[currentIndex];
        if (!q || !activeSet) return;
        const isCorrect = answer === q.correct;
        
        setQuizAnswered(prev => ({ ...prev, [currentIndex]: answer }));
        
        const wordObj = currentWords[currentIndex] as VocabWord & { originalIndex?: number };
        const finalIndex = wordObj.originalIndex !== undefined ? wordObj.originalIndex : currentIndex;

        if (isCorrect) {
            setKnownIds(prev => [...prev, finalIndex]);
            markWordAsLearned(activeSet!.id, finalIndex);
        } else {
            setUnknownIds(prev => [...prev, finalIndex]);
        }

        if (settings.autoSkipLearn) {
            const duration = (settings.autoSkipLearnDuration || 2) * 1000;
            setTimeout(() => {
                handleNextQuizQuestion();
            }, duration);
        }
    };

    const handleNextQuizQuestion = () => {
        if (currentIndex < quizQuestions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setView('result');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20 animate-pulse">
            <Spinner size="lg" label="Đang tải dữ liệu..." />
        </div>
    );

    if (error) {
        return (
            <div className="text-center py-20 px-6 page-fade-in">
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-3xl p-8 max-w-md mx-auto text-red-600 dark:text-red-400">
                    <X className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-black uppercase tracking-widest text-sm mb-2">Đã xảy ra lỗi</p>
                    <p className="text-sm font-medium mb-6 opacity-80">{error}</p>
                    <Button
                        variant="ghost"
                        className="text-red-600 hover:bg-red-100 mx-auto font-bold rounded-xl"
                        onClick={() => window.location.reload()}
                    >
                        Tải lại trang
                    </Button>
                </div>
            </div>
        );
    }

    // ==================== HOME VIEW ====================
    if (view === 'home') {
        return (
            <div className="space-y-8 page-fade-in pb-12">
                <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl rounded-[32px] p-8 md:p-12 shadow-soft border border-white dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                        <Sparkles className="h-32 w-32 text-purple-600" />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="bg-purple-600 p-2 rounded-xl text-white">
                                <BookOpen className="h-6 w-6" />
                            </span>
                            <span className="text-[11px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                                Vocabulary Station
                            </span>
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                            Học từ vựng <br/> 
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">Flashcards 2.0</span>
                        </h2>
                        <p className="text-gray-500 dark:text-slate-400 mt-4 text-sm md:text-lg font-medium max-w-lg">
                            Nâng tầm từ vựng với hệ thống thẻ thông minh, vuốt để phân loại và theo dõi tiến độ học tập hàng ngày.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3 relative z-10">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center justify-center min-w-[100px]">
                            <span className="text-2xl font-black text-purple-600">{sets.length}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Bộ từ</span>
                        </div>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-4 rounded-[20px] font-bold text-sm shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Home className="h-5 w-5" /> 🏠 Home
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/50 dark:bg-slate-900/30 p-2 rounded-3xl border border-gray-100 dark:border-slate-800">
                    <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={cn(
                                    'rounded-2xl px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap',
                                    activeCategory === cat.id
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-200 dark:shadow-none'
                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
                                )}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-center">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="Tìm bộ từ vựng..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-800 border-none rounded-2xl text-[13px] font-bold focus:ring-2 focus:ring-purple-500 shadow-sm outline-none dark:text-white"
                            />
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            <PremiumSelect 
                                value={sortBy}
                                onChange={setSortBy}
                                icon={<SortAsc className="h-3.5 w-3.5" />}
                                placeholder="Sắp xếp"
                                className="flex-1 sm:w-36"
                                options={[
                                    { value: 'default', label: 'Mặc định' },
                                    { value: 'a-z', label: 'A → Z' },
                                    { value: 'z-a', label: 'Z → A' },
                                    { value: 'progress-high', label: 'Tiến độ ↑' },
                                    { value: 'progress-low', label: 'Tiến độ ↓' },
                                    { value: 'words-high', label: 'Số lượng từ ↑' },
                                    { value: 'words-low', label: 'Số lượng từ ↓' },
                                ]}
                            />

                            <PremiumSelect 
                                value={progressFilter}
                                onChange={setProgressFilter}
                                icon={<Filter className="h-3.5 w-3.5" />}
                                placeholder="Trạng thái"
                                className="flex-1 sm:w-36"
                                options={[
                                    { value: 'all', label: 'Tất cả' },
                                    { value: 'not-started', label: 'Chưa làm' },
                                    { value: 'in-progress', label: 'Đang làm' },
                                    { value: 'completed', label: 'Đã xong' },
                                ]}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {filteredAndSortedSets.map((vocabSet) => (
                        <div key={vocabSet.id} className="group relative cursor-pointer" onClick={() => { setActiveSet(vocabSet); setShowStudyMenu(true); }}>
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-[24px] translate-y-1 opacity-0 group-hover:opacity-10 transition-all duration-500 blur-lg" />
                            <div className="relative bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col h-full overflow-hidden">
                                <div className="absolute -top-4 -right-4 w-16 h-16 bg-purple-50 dark:bg-purple-900/10 rounded-full group-hover:scale-150 transition-transform duration-700 z-0" />
                                
                                <div className="flex-1 relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className={cn(
                                            "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shrink-0",
                                            vocabSet.category === 'gdpt' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/20" :
                                            vocabSet.category === 'advanced_gdpt' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/20" :
                                            "bg-purple-100 text-purple-600 dark:bg-purple-900/20"
                                        )}>
                                            {vocabSet.category}
                                        </span>
                                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                            <Layers className="h-3 w-3 text-gray-400" />
                                            <span className="text-[10px] font-black text-gray-600 dark:text-slate-300">
                                                {vocabSet.words.length} 
                                            </span>
                                        </div>
                                    </div>

                                    {(() => {
                                        const progress = getSetProgress(vocabSet);
                                        return (
                                            <div className="mb-3">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tiến độ</span>
                                                    <span className="text-[9px] font-black text-emerald-500">{progress}%</span>
                                                </div>
                                                <div className="h-1 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <h3 className="text-[15px] font-black text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors leading-snug line-clamp-2">
                                        {vocabSet.title}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredAndSortedSets.length === 0 && (
                        <div className="col-span-full py-20 text-center">
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Không tìm thấy bộ từ vựng nào</p>
                        </div>
                    )}
                </div>

                {/* Study Menu Modal */}
                {showStudyMenu && activeSet && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowStudyMenu(false)} />
                        <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden animate-slide-up">
                            <div className="p-8 sm:p-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{activeSet.title}</h3>
                                        <p className="text-sm text-gray-500 font-medium">Chọn chế độ và số lượng từ muốn học</p>
                                    </div>
                                    <button onClick={() => setShowStudyMenu(false)} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full text-gray-500">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">Số lượng từ vựng</span>
                                        <div className="flex flex-wrap gap-2">
                                            {[20, 30, 'all'].map((count) => (
                                                <button
                                                    key={count}
                                                    onClick={() => setWordCountLimit(count as any)}
                                                    className={cn(
                                                        "px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
                                                        wordCountLimit === count 
                                                            ? "bg-purple-600 text-white shadow-lg shadow-purple-200 dark:shadow-none" 
                                                            : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200"
                                                    )}
                                                >
                                                    {count === 'all' ? 'Tất cả' : `${count} từ`}
                                                </button>
                                            ))}
                                            <input 
                                                type="number" 
                                                placeholder="Khác..."
                                                value={customWordCount}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setCustomWordCount(val);
                                                    if (val && parseInt(val) > 0) {
                                                        setWordCountLimit(Math.min(parseInt(val), activeSet.words.length));
                                                    } else {
                                                        setWordCountLimit(20);
                                                    }
                                                }}
                                                className="w-24 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                min={1}
                                                max={activeSet.words.length}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        <button 
                                            onClick={() => startFlashcard(activeSet)}
                                            className="flex items-center gap-4 p-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-3xl hover:scale-[1.02] active:scale-[0.98] transition-all group"
                                        >
                                            <div className="bg-purple-500/20 p-3 rounded-2xl group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                                <Layers className="h-6 w-6 text-purple-600 group-hover:text-white" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-black text-lg">Flashcards</div>
                                                <div className="text-xs opacity-60 font-medium">Vuốt để ghi nhớ từ vựng</div>
                                            </div>
                                        </button>

                                        <button 
                                            onClick={() => startLearn(activeSet)}
                                            className="flex items-center gap-4 p-5 bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-3xl hover:border-purple-600 transition-all group"
                                        >
                                            <div className="bg-blue-500/10 p-3 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-colors text-blue-600">
                                                <CheckCircle className="h-6 w-6" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-black text-lg text-gray-900 dark:text-white">Learn</div>
                                                <div className="text-xs text-gray-500 font-medium">Học qua trắc nghiệm 4 đáp án</div>
                                            </div>
                                        </button>

                                        <button 
                                            onClick={() => startMatching(activeSet)}
                                            className="flex items-center gap-4 p-5 bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-3xl hover:border-indigo-600 transition-all group"
                                        >
                                            <div className="bg-indigo-500/10 p-3 rounded-2xl group-hover:bg-indigo-500 group-hover:text-white transition-colors text-indigo-600">
                                                <Shuffle className="h-6 w-6" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-black text-lg text-gray-900 dark:text-white">Ghép từ</div>
                                                <div className="text-xs text-gray-500 font-medium">Nối cặp từ và nghĩa tương ứng</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        );
    }

    // ==================== FLASHCARD VIEW ====================
    if (view === 'flashcard' && activeSet) {
        const word = currentWords[currentIndex];
        if (!word) {
            setView('home');
            return null;
        }
        
        const progress = Math.round(((currentIndex + 1) / currentWords.length) * 100);
        const rotationY = flipped ? 180 : 0;
        const rotateZ = (offset.x / 10);
        
        // Stack cards - we show the next up to 3 cards behind
        const stackCards = [1, 2, 3].map(i => {
            const idx = currentIndex + i;
            if (idx < currentWords.length) return currentWords[idx];
            return null;
        });

        return (
            <div className="flex flex-col items-center page-fade-in relative max-w-2xl mx-auto h-[85vh] md:h-[80vh]">
                {/* Navbar */}
                <div className="w-full flex items-center justify-between mb-8 px-4">
                    <button onClick={() => setView('home')} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90">
                        <Home className="h-5 w-5 text-gray-600 dark:text-slate-300" />
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Đang học bộ</span>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{activeSet.title}</h4>
                    </div>
                    <div className="w-11" /> {/* Spacer */}
                </div>

                {/* Progress Bar */}
                <div className="w-full px-6 mb-12">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-gray-400">TIẾN ĐỘ {currentIndex + 1}/{currentWords.length}</span>
                        <div className="flex gap-4">
                            <span className="text-[10px] font-black text-emerald-500 uppercase">{knownIds.length} ĐÃ THUỘC</span>
                            <span className="text-[10px] font-black text-red-500 uppercase">{unknownIds.length} CHƯA THUỘC</span>
                        </div>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white dark:border-slate-700">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                {/* Swipe Corner Indicators (Screen Corners, not on card) */}
                <div 
                    className="fixed top-0 left-0 w-64 h-64 bg-orange-500/20 rounded-br-full blur-3xl pointer-events-none transition-opacity duration-300 z-0"
                    style={{ opacity: Math.max(0, -offset.x / 200) }}
                />
                <div 
                    className="fixed top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-bl-full blur-3xl pointer-events-none transition-opacity duration-300 z-0"
                    style={{ opacity: Math.max(0, offset.x / 200) }}
                />
                <div 
                    className="fixed bottom-0 left-0 w-64 h-64 bg-orange-500/10 rounded-tr-full blur-3xl pointer-events-none transition-opacity duration-300 z-0"
                    style={{ opacity: Math.max(0, -offset.x / 300) }}
                />
                <div 
                    className="fixed bottom-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-tl-full blur-3xl pointer-events-none transition-opacity duration-300 z-0"
                    style={{ opacity: Math.max(0, offset.x / 300) }}
                />

                {/* Cards Container */}
                <div className="relative w-full max-w-[320px] aspect-[3/4.2] perspective-1000 select-none">
                    
                    {/* Fake cards for depth (Stacked back) */}
                    {stackCards.map((card, idx) => card && (
                        <div 
                            key={`stack-${idx}`}
                            className={cn(
                                "absolute inset-0 bg-white dark:bg-slate-900 rounded-[32px] border border-gray-100 dark:border-slate-800 shadow-lg pointer-events-none transition-transform duration-500",
                                idx === 0 ? "flashcard-stack-1" : idx === 1 ? "flashcard-stack-2" : "flashcard-stack-3"
                            )}
                        />
                    ))}

                    {/* Active Card */}
                    <div
                        onMouseDown={onStart}
                        onMouseMove={onMove}
                        onMouseUp={onEnd}
                        onMouseLeave={onEnd}
                        onTouchStart={onStart}
                        onTouchMove={onMove}
                        onTouchEnd={onEnd}
                        onClick={() => setFlipped(!flipped)}
                        className={cn(
                            "absolute inset-0 preserve-3d cursor-grab active:cursor-grabbing z-10 will-change-transform",
                            swipeDir === 'right' && "animate-swipe-right",
                            swipeDir === 'left' && "animate-swipe-left",
                            !swipeDir && !isDragging && "transition-all duration-300 ease-out"
                        )}
                        style={{
                            "--swipe-x" : `${offset.x}px`,
                            "--swipe-y" : `${offset.y}px`,
                            "--swipe-rotate" : `${rotateZ}deg`,
                            transform: swipeDir 
                                ? undefined 
                                : `translate3d(${offset.x}px, ${offset.y}px, 0) rotateZ(${rotateZ}deg) rotateY(${rotationY}deg)`,
                            boxShadow: isDragging ? '0 20px 40px -10px rgba(0,0,0,0.15)' : '0 10px 30px -10px rgba(0,0,0,0.1)',
                        } as React.CSSProperties}
                    >
                        {/* Front Side */}
                        <div 
                            className="absolute inset-0 bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-white dark:border-slate-800 backface-hidden flex flex-col items-center justify-center text-center shadow-card overflow-hidden"
                        >
                            <div className="flex flex-col items-center">
                                <span className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-4 py-1.5 rounded-full">
                                    {word.partOfSpeech || 'Vocabulary'}
                                </span>
                                <h3 className="text-4xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                                    {word.word}
                                </h3>
                                {word.pronunciation && (
                                    <p className="text-gray-400 font-medium tracking-wide">
                                        {word.pronunciation}
                                    </p>
                                )}
                            </div>
                            
                            <div className="mt-12 flex flex-col items-center gap-2">
                                <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                                    <RefreshCw className="h-5 w-5 text-gray-400" />
                                </div>
                                <span className="text-[10px] uppercase font-black tracking-widest text-gray-300">Nhấn thẻ để xem nghĩa</span>
                            </div>
                        </div>

                        {/* Back Side (Differentiated color) */}
                        <div 
                            className="absolute inset-0 bg-blue-50 dark:bg-indigo-950/40 rounded-[32px] p-8 border border-blue-100 dark:border-indigo-900/30 backface-hidden rotate-y-180 flex flex-col items-center justify-center text-center shadow-card overflow-hidden"
                        >
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <span className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-1.5 rounded-full">
                                    Nghĩa của từ
                                </span>
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-6 leading-tight">
                                    {word.meaning}
                                </h3>
                                {word.example && (
                                    <div className="relative">
                                        <div className="absolute -left-2 top-0 text-3xl text-indigo-100 font-serif opacity-30">“</div>
                                        <p className="text-sm md:text-base text-gray-500 dark:text-slate-400 font-medium italic px-4 leading-relaxed">
                                            {word.example}
                                        </p>
                                        <div className="absolute -right-2 bottom-0 text-3xl text-indigo-100 font-serif opacity-30">”</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Controls */}
                <div className="flex items-center gap-12 mt-12 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-10 py-5 rounded-[40px] border border-white dark:border-slate-800 shadow-soft">
                    <button 
                        onClick={handleUndo}
                        disabled={history.length === 0}
                        className={cn(
                            "group flex flex-col items-center gap-2 transition-opacity",
                            history.length === 0 && "opacity-30 cursor-not-allowed"
                        )}
                    >
                        <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-gray-100 dark:border-slate-800 group-hover:bg-gray-100 dark:group-hover:bg-slate-700 group-hover:scale-110 transition-all">
                            <RotateCcw className="h-6 w-6 text-gray-500" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-gray-600 dark:group-hover:text-slate-300 transition-colors uppercase">Quay lại</span>
                    </button>
                    
                    <button 
                        onClick={() => setFlipped(!flipped)}
                        className="p-5 bg-purple-600 text-white rounded-3xl shadow-lg hover:shadow-purple-200 dark:shadow-none hover:scale-110 active:scale-95 transition-all"
                    >
                        <RefreshCw className={cn("h-6 w-6", flipped && "rotate-180 transition-transform duration-500")} />
                    </button>

                    <button 
                        onClick={handleShuffleRemaining}
                        className="group flex flex-col items-center gap-2"
                    >
                        <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-gray-100 dark:border-slate-800 group-hover:bg-purple-500 group-hover:scale-110 transition-all">
                            <Shuffle className="h-6 w-6 text-purple-500 group-hover:text-white" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-purple-500 transition-colors uppercase">Xáo trộn</span>
                    </button>
                </div>
            </div>
        );
    }

    // ==================== LEARN VIEW (QUIZ) ====================
    if (view === 'learn' && activeSet) {
        const q = quizQuestions[currentIndex];
        if (!q) return null;
        const progress = Math.round(((currentIndex + 1) / quizQuestions.length) * 100);
        const userAnswer = quizAnswered[currentIndex];

        return (
            <div className={cn(
                "flex flex-col items-center page-fade-in relative max-w-2xl mx-auto min-h-[80vh]",
                userAnswer && !settings.autoSkipLearn && "pb-32 md:pb-0"
            )}>
                {/* Navbar */}
                <div className="w-full flex items-center justify-between mb-8 px-4">
                    <button onClick={() => setView('home')} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90">
                        <Home className="h-5 w-5 text-gray-600 dark:text-slate-300" />
                    </button>
                    <div className="flex flex-col items-center text-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Chế độ trắc nghiệm</span>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{activeSet.title}</h4>
                    </div>
                    <div className="w-11" />
                </div>

                {/* Progress Bar */}
                <div className="w-full px-6 mb-12">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-gray-400">CÂU HỎI {currentIndex + 1}/{quizQuestions.length}</span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase">{knownIds.length} ĐÚNG</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white dark:border-slate-700">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                {/* Question Card */}
                <div className="w-full px-6 flex-1 flex flex-col items-center">
                    <div 
                        className="w-full bg-white dark:bg-slate-900 rounded-[40px] border border-white dark:border-slate-800 shadow-card flex flex-col items-center justify-center text-center mb-10 overflow-hidden relative"
                        style={{ height: '220px', minHeight: '220px' }}
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-5">
                            <Sparkles className="h-20 w-20 text-purple-600" />
                        </div>
                        <span className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-1.5 rounded-full">
                            {q.isEn ? 'English' : 'Tiếng Việt'}
                        </span>
                        <h3 
                            className="font-black text-gray-900 dark:text-white leading-tight px-6"
                            style={{ 
                                fontSize: q.word.length > 30 ? '1.25rem' : q.word.length > 20 ? '1.75rem' : q.word.length > 10 ? '2.25rem' : '3rem'
                            }}
                        >
                            {q.word}
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        {q.options.map((opt, i) => {
                            const isCorrect = opt === q.correct;
                            const isSelected = userAnswer === opt;
                            const showCorrect = userAnswer && isCorrect;
                            const showWrong = isSelected && !isCorrect;

                            return (
                                <button
                                    key={i}
                                    disabled={!!userAnswer}
                                    onClick={() => handleQuizAnswer(opt)}
                                    className={cn(
                                        "p-6 rounded-[28px] border-2 text-base font-black transition-all duration-300 transform active:scale-95",
                                        "flex items-center justify-center text-center relative overflow-hidden",
                                        !userAnswer && "border-gray-100 bg-white dark:bg-slate-800 hover:border-purple-600 hover:shadow-xl",
                                        showCorrect && "quiz-option-correct",
                                        showWrong && "quiz-option-wrong",
                                        userAnswer && !isSelected && !isCorrect && "opacity-40 border-gray-100"
                                    )}
                                >
                                    {opt}
                                </button>
                            );
                        })}
                    </div>

                    {userAnswer && !settings.autoSkipLearn && (
                        <>
                            {/* Desktop Continue Button */}
                            <div className="hidden md:flex w-full justify-center mt-8 cursor-pointer z-10 animate-fade-in relative">
                                <Button onClick={handleNextQuizQuestion} size="lg" className="rounded-2xl px-12 py-6 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xl shadow-purple-600/30">
                                    Tiếp tục <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </div>

                            {/* Mobile Sticky Continue Button */}
                            <div className="md:hidden fixed bottom-6 left-6 right-6 z-[100] animate-slide-up">
                                <Button 
                                    onClick={handleNextQuizQuestion} 
                                    className="w-full h-16 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-lg font-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                                >
                                    Tiếp tục <ArrowRight className="h-6 w-6" />
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ==================== MATCHING VIEW ====================
    if (view === 'matching' && activeSet) {
        const totalInBatch = matchWords.length;
        const matchedInBatch = matchedPairs.size / 2;
        const progressInBatch = Math.round((matchedInBatch / totalInBatch) * 100);

        return (
            <div className="mx-auto max-w-4xl page-fade-in pb-12">
                <div className="flex items-center justify-between mb-8 px-4">
                    <button onClick={() => setView('home')} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
                        <ChevronLeft className="h-5 w-5" /> Thoát
                    </button>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 px-5 py-2 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                        <span className="text-sm font-black text-indigo-600 uppercase tracking-widest">Ghép từ • Đợt {Math.floor(matchBatchIndex / 6) + 1}</span>
                    </div>
                    <div className="hidden sm:block text-right">
                        <span className="text-[10px] font-black text-gray-400 block uppercase">Hoàn thành</span>
                        <span className="text-lg font-black text-gray-900 dark:text-white">{matchBatchIndex + matchedInBatch}/{currentWords.length}</span>
                    </div>
                </div>

                <div className="w-full px-4 mb-10">
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden p-0">
                        <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progressInBatch}%` }} />
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 px-4 w-full">
                    {mixedTiles.map((tile) => {
                        const isWord = tile.type === 'word';
                        return (
                            <button
                                key={`${tile.type}-${tile.id}`}
                                disabled={matchedPairs.has(tile.id) || !!wrongPair}
                                onClick={() => handleMatchClick(tile.id)}
                                className={cn(
                                    'group h-24 rounded-[28px] border-2 p-4 font-bold transition-all duration-300 relative overflow-hidden flex items-center justify-center text-center',
                                    isWord ? 'text-sm' : 'text-[13px]',
                                    matchedPairs.has(tile.id) ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 opacity-40 scale-95' :
                                    wrongPair === tile.id ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 animate-shake' :
                                    selectedWord === tile.id ? 'border-indigo-600 bg-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20 scale-105' :
                                    'border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-indigo-600 hover:shadow-lg'
                                )}
                            >
                                {matchedPairs.has(tile.id) && (
                                    <div className="absolute top-2 right-2">
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                )}
                                {tile.text}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ==================== RESULT VIEW ====================
    if (view === 'result' && activeSet) {
        const total = isReviewingUnknown ? currentWords.length : activeSet.words.length;
        const correct = knownIds.length;
        const percent = Math.round((correct / total) * 100);

        return (
            <div className="mx-auto max-w-xl text-center py-10 page-fade-in flex flex-col items-center">
                <div className="relative mb-8">
                    <div className="w-32 h-32 bg-gray-900 dark:bg-white rounded-[40px] flex items-center justify-center rotate-6 shadow-2xl">
                        <Award className="h-16 w-16 text-white dark:text-gray-900" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2 rounded-2xl font-black text-xl shadow-lg">
                        {percent}%
                    </div>
                </div>

                <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2 leading-tight">Tuyệt vời!</h2>
                <p className="text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs mb-8">
                    Bạn đã hoàn thành bộ: {activeSet.title}
                </p>

                <div className="w-full bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-gray-100 dark:border-slate-800 shadow-soft mb-12 flex flex-col items-center">
                    <div className="grid grid-cols-2 gap-12 w-full max-w-sm mb-6">
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-emerald-600">{knownIds.length}</span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Đã thuộc</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-red-500">{unknownIds.length}</span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chưa thuộc</span>
                        </div>
                    </div>
                    <div className="w-full h-3 bg-gray-50 dark:bg-slate-800 rounded-full flex overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${(knownIds.length / total) * 100}%` }} />
                        <div className="h-full bg-red-400" style={{ width: `${(unknownIds.length / total) * 100}%` }} />
                    </div>
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                    <Button 
                        onClick={() => setView('home')} 
                        variant="outline" 
                        className="rounded-2xl px-8 py-6 h-auto font-bold text-base border-gray-200 dark:border-slate-700 hover:bg-gray-50 active:scale-95"
                    >
                        <Home className="mr-2 h-5 w-5" /> Về trang chủ
                    </Button>
                    
                    {unknownIds.length > 0 && (
                        <Button 
                            onClick={() => startFlashcard(activeSet, true)} 
                            className="rounded-2xl px-8 py-6 h-auto font-bold text-base bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 active:scale-95"
                        >
                            <RefreshCw className="mr-2 h-5 w-5" /> Ôn lại từ chưa thuộc
                        </Button>
                    )}

                    <Button 
                        onClick={() => startFlashcard(activeSet)} 
                        className="rounded-2xl px-8 py-6 h-auto font-bold text-base bg-gray-900 dark:bg-white dark:text-gray-900 shadow-lg active:scale-95"
                    >
                        <RotateCcw className="mr-2 h-5 w-5" /> Học lại từ đầu
                    </Button>
                </div>
            </div>
        );
    }

    return null;
}
