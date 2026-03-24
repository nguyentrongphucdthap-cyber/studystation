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
    Sparkles, ArrowRight
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/contexts/ThemeContext';

type VocabView = 'home' | 'flashcard' | 'result' | 'matching' | 'learn';

export default function VocabPage() {
    const { settings } = useTheme();

    // Basic state
    const [sets, setSets] = useState<VocabSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSet, setActiveSet] = useState<VocabSet | null>(null);
    const [view, setView] = useState<VocabView>('home');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [error, setError] = useState<string | null>(null);

    // Flashcard core state
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [knownIds, setKnownIds] = useState<number[]>([]);
    const [unknownIds, setUnknownIds] = useState<number[]>([]);
    const [isReviewingUnknown, setIsReviewingUnknown] = useState(false);
    const [currentWords, setCurrentWords] = useState<VocabWord[]>([]);
    
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
        { id: 'topic', label: 'Theo chủ đề' },
    ];

    const filteredSets = activeCategory === 'all' ? sets : sets.filter((s) => s.category === activeCategory);

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
        setShowStudyMenu(false);
    };

    const handleNextCard = (known: boolean) => {
        if (!activeSet || !currentWords[currentIndex]) return;
        
        const wordObj = currentWords[currentIndex] as VocabWord & { originalIndex?: number };
        const finalIndex = wordObj.originalIndex !== undefined ? wordObj.originalIndex : currentIndex;
        
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
        
        if (offset.x > 100) {
            handleNextCard(true);
        } else if (offset.x < -100) {
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
            setTimeout(() => {
                handleNextQuizQuestion();
            }, 2000);
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

                <div className="flex flex-wrap gap-2 mb-2 p-1 bg-gray-100 dark:bg-slate-800 w-fit rounded-2xl border border-gray-200 dark:border-slate-700">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={cn(
                                'rounded-[14px] px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-300',
                                activeCategory === cat.id
                                    ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-white shadow-md'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-slate-200'
                            )}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSets.map((vocabSet) => (
                        <div key={vocabSet.id} className="group relative cursor-pointer" onClick={() => { setActiveSet(vocabSet); setShowStudyMenu(true); }}>
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-[32px] translate-y-2 opacity-0 group-hover:opacity-20 transition-all duration-500 blur-xl" />
                            <div className="relative bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-gray-100 dark:border-slate-800 shadow-card hover:shadow-heavy transition-all duration-500 flex flex-col h-full overflow-hidden">
                                <div className="absolute -top-6 -right-6 w-24 h-24 bg-purple-50 dark:bg-purple-900/10 rounded-full group-hover:scale-150 transition-transform duration-700" />
                                
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                            vocabSet.category === 'gdpt' ? "bg-blue-100 text-blue-600" :
                                            vocabSet.category === 'advanced_gdpt' ? "bg-amber-100 text-amber-600" :
                                            "bg-purple-100 text-purple-600"
                                        )}>
                                            {vocabSet.category}
                                        </span>
                                        <span className="text-gray-300 dark:text-slate-700">|</span>
                                        <span className="text-[11px] font-bold text-gray-400">
                                            {vocabSet.words.length} Vocabulary Cards
                                        </span>
                                    </div>
                                    {(() => {
                                        const learnedKey = `vocab_learned_${vocabSet.id}`;
                                        const learnedIds = JSON.parse(localStorage.getItem(learnedKey) || '[]');
                                        const progress = vocabSet.words.length > 0 ? Math.round((learnedIds.length / vocabSet.words.length) * 100) : 0;
                                        return (
                                            <div className="mb-4">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold text-gray-400">TIẾN ĐỘ HỌC</span>
                                                    <span className="text-[10px] font-black text-emerald-500">{progress}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors leading-tight mb-3">
                                        {vocabSet.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-slate-400 font-medium line-clamp-2">
                                        Bắt đầu hành trình chinh phục từ vựng với các chế độ học tập đa dạng.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
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
                            "absolute inset-0 preserve-3d cursor-grab active:cursor-grabbing transition-shadow duration-300 z-10",
                            swipeDir === 'right' && "animate-swipe-right",
                            swipeDir === 'left' && "animate-swipe-left",
                            !swipeDir && !isDragging && "transition-transform duration-300"
                        )}
                        style={{
                            "--swipe-x" : `${offset.x}px`,
                            "--swipe-y" : `${offset.y}px`,
                            "--swipe-rotate" : `${rotateZ}deg`,
                            transform: swipeDir 
                                ? undefined 
                                : `translate3d(${offset.x}px, ${offset.y}px, 0) rotateZ(${rotateZ}deg) rotateY(${rotationY}deg)`,
                            boxShadow: isDragging ? '0 20px 40px -10px rgba(0,0,0,0.15)' : '0 10px 30px -10px rgba(0,0,0,0.1)'
                        } as React.CSSProperties}
                    >
                        {/* Front Side */}
                        <div className="absolute inset-0 bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-white dark:border-slate-800 backface-hidden flex flex-col items-center justify-center text-center shadow-card overflow-hidden">
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

                            {/* Swipe Indicators */}
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-0 flex flex-col items-center transition-opacity" style={{ opacity: Math.max(0, -offset.x / 100) }}>
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-2">
                                    <X className="h-6 w-6" />
                                </div>
                                <span className="text-[10px] font-black text-red-500 uppercase">CHƯA THUỘC</span>
                            </div>
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 flex flex-col items-center transition-opacity" style={{ opacity: Math.max(0, offset.x / 100) }}>
                                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
                                    <Check className="h-6 w-6" />
                                </div>
                                <span className="text-[10px] font-black text-emerald-500 uppercase">ĐÃ THUỘC</span>
                            </div>
                        </div>

                        {/* Back Side */}
                        <div className="absolute inset-0 bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-white dark:border-slate-800 backface-hidden rotate-y-180 flex flex-col items-center justify-center text-center shadow-card overflow-hidden">
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
                        onClick={() => handleNextCard(false)}
                        className="group flex flex-col items-center gap-2"
                    >
                        <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-red-100 dark:border-red-900/30 group-hover:bg-red-500 group-hover:scale-110 transition-all">
                            <X className="h-6 w-6 text-red-500 group-hover:text-white" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-red-500 transition-colors uppercase">Chưa thuộc</span>
                    </button>
                    
                    <button 
                        onClick={() => setFlipped(!flipped)}
                        className="p-5 bg-purple-600 text-white rounded-3xl shadow-lg hover:shadow-purple-200 dark:shadow-none hover:scale-105 active:scale-95 transition-all"
                    >
                        <Shuffle className="h-6 w-6" />
                    </button>

                    <button 
                        onClick={() => handleNextCard(true)}
                        className="group flex flex-col items-center gap-2"
                    >
                        <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-emerald-100 dark:border-emerald-900/30 group-hover:bg-emerald-500 group-hover:scale-110 transition-all">
                            <Check className="h-6 w-6 text-emerald-500 group-hover:text-white" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-emerald-500 transition-colors uppercase">Đã thuộc</span>
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
            <div className="flex flex-col items-center page-fade-in relative max-w-2xl mx-auto min-h-[80vh]">
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
                    <div className="w-full bg-white dark:bg-slate-900 p-10 rounded-[40px] border border-white dark:border-slate-800 shadow-card flex flex-col items-center justify-center text-center mb-10 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-6 opacity-5">
                            <Sparkles className="h-20 w-20 text-purple-600" />
                        </div>
                        <span className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-1.5 rounded-full">
                            {q.isEn ? 'English' : 'Tiếng Việt'}
                        </span>
                        <h3 className="text-4xl font-black text-gray-900 dark:text-white leading-tight">
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
                        <div className="w-full flex justify-center mt-8 cursor-pointer z-10 animate-fade-in relative">
                            <Button onClick={handleNextQuizQuestion} size="lg" className="rounded-2xl px-12 py-6 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xl shadow-purple-600/30">
                                Tiếp tục <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
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
                                    wrongPair === tile.id ? 'border-red-500 bg-red-50 text-red-700 animate-shake' :
                                    selectedWord === tile.id ? 'border-indigo-600 bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-105' :
                                    'border-gray-100 bg-white dark:bg-slate-800 hover:border-indigo-600 hover:shadow-lg'
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
                    <div className="w-full h-3 bg-gray-50 rounded-full flex overflow-hidden">
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
