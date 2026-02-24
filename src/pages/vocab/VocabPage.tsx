import { useEffect, useState, useMemo, useCallback } from 'react';
import { getAllVocabSets } from '@/services/vocab.service';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { VocabSet, VocabWord } from '@/types';
import { BookOpen, RotateCcw, CheckCircle, Shuffle, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

type VocabView = 'home' | 'flashcard' | 'matching' | 'result';

export default function VocabPage() {
    const [sets, setSets] = useState<VocabSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSet, setActiveSet] = useState<VocabSet | null>(null);
    const [view, setView] = useState<VocabView>('home');
    const [activeCategory, setActiveCategory] = useState<string>('all');

    // Flashcard state
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [learnedIds, setLearnedIds] = useState<Set<number>>(new Set());
    const [error, setError] = useState<string | null>(null);

    // Matching state
    const [matchWords, setMatchWords] = useState<VocabWord[]>([]);
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
    const [wrongPair, setWrongPair] = useState<string | null>(null);

    useEffect(() => {
        getAllVocabSets()
            .then((data) => {
                setSets(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('[Vocab] Fetch error:', err);
                setError('Không thể tải danh sách từ vựng. Chỉ thành viên chính thức mới có quyền truy cập phần này.');
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

    const startFlashcard = (vocabSet: VocabSet) => {
        setActiveSet(vocabSet);
        setCurrentIndex(0);
        setFlipped(false);
        setLearnedIds(new Set());
        setView('flashcard');
    };

    const startMatching = (vocabSet: VocabSet) => {
        const words = vocabSet.words.slice(0, 6); // Max 6 for matching
        setActiveSet(vocabSet);
        setMatchWords(words);
        setSelectedWord(null);
        setMatchedPairs(new Set());
        setWrongPair(null);
        setView('matching');
    };

    const shuffledMeanings = useMemo(() => {
        return [...matchWords].sort(() => Math.random() - 0.5);
    }, [matchWords]);

    const handleMatchClick = useCallback((item: string, _type: 'word' | 'meaning') => {
        if (matchedPairs.has(item)) return;

        if (!selectedWord) {
            setSelectedWord(item);
        } else {
            // Check if match
            const pair = matchWords.find(
                (w) => (w.word === selectedWord && w.meaning === item) || (w.meaning === selectedWord && w.word === item)
            );
            if (pair) {
                setMatchedPairs(new Set([...matchedPairs, pair.word, pair.meaning]));
                if (matchedPairs.size + 2 === matchWords.length * 2) {
                    setTimeout(() => setView('result'), 500);
                }
            } else {
                setWrongPair(item);
                setTimeout(() => setWrongPair(null), 600);
            }
            setSelectedWord(null);
        }
    }, [selectedWord, matchedPairs, matchWords]);

    if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" label="Đang tải..." /></div>;

    if (error) {
        return (
            <div className="text-center py-20 px-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600 max-w-md mx-auto">
                    <p className="font-semibold mb-2">Lỗi truy cập</p>
                    <p className="text-sm opacity-90 mb-4">{error}</p>
                    <Button
                        variant="ghost"
                        className="text-red-600 hover:bg-red-100 mx-auto"
                        onClick={() => window.location.href = '/'}
                    >
                        Quay lại trang chủ
                    </Button>
                </div>
            </div>
        );
    }

    // ==================== HOME ====================
    if (view === 'home') {
        return (
            <div className="space-y-8">
                {/* Header section */}
                <div className="bg-white/70 backdrop-blur-xl rounded-[32px] p-8 md:p-10 shadow-soft border border-white flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Flashcards</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm md:text-lg font-medium opacity-90">
                            Học từ vựng thông minh qua thẻ ghi nhớ.
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                            <span className="px-3 py-1 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-black rounded-full border border-purple-100 dark:border-purple-500/20 uppercase tracking-wider">
                                {sets.length} Bộ từ vựng
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-soft hover:shadow-medium active:scale-95 shrink-0 self-start md:self-center border border-gray-100 dark:border-gray-700"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        Quay lại
                    </button>
                </div>

                <div className="flex flex-wrap gap-2.5 mb-2">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={cn(
                                'rounded-[14px] px-5 py-2 text-xs font-black uppercase tracking-widest transition-all duration-300',
                                activeCategory === cat.id
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                                    : 'bg-white/80 border border-white text-gray-500 hover:bg-white hover:text-purple-600'
                            )}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {filteredSets.length === 0 ? (
                    <div className="py-20 text-center bg-white/50 rounded-[32px] border border-dashed border-gray-200">
                        <p className="text-gray-400 font-bold uppercase tracking-widest">Không có bộ từ vựng nào</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSets.map((vocabSet) => (
                            <div key={vocabSet.id} className="bg-white/80 backdrop-blur-md p-6 rounded-[28px] border border-white shadow-soft hover:shadow-heavy hover:-translate-y-1 transition-all duration-500 flex flex-col justify-between group">
                                <div className="mb-6">
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                        <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors tracking-tight leading-snug">
                                            {vocabSet.title}
                                        </h3>
                                        <div className="shrink-0 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 text-[10px] font-black px-2.5 py-1 rounded-lg border border-purple-100 dark:border-purple-500/20 shadow-sm">
                                            {vocabSet.words.length} WORDS
                                        </div>
                                    </div>
                                    <p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium">Bắt đầu học ngay bộ từ vựng này để nâng cao kiến thức.</p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => startFlashcard(vocabSet)}
                                        className="flex-1 px-4 py-3 text-[13px] font-bold border border-gray-100 rounded-2xl hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <Layers className="h-4 w-4" /> Flashcard
                                    </button>
                                    <button
                                        onClick={() => startMatching(vocabSet)}
                                        className="flex-1 px-4 py-3 text-[13px] font-bold bg-white border border-gray-100 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                                    >
                                        <Shuffle className="h-4 w-4" /> Ghép từ
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ==================== FLASHCARD ====================
    if (view === 'flashcard' && activeSet) {
        const word = activeSet.words[currentIndex];
        if (!word) return null;
        const progress = Math.round(((currentIndex + 1) / activeSet.words.length) * 100);

        return (
            <div className="mx-auto max-w-md">
                <button onClick={() => setView('home')} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4" /> {activeSet.title}
                </button>

                {/* Progress */}
                <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>{currentIndex + 1} / {activeSet.words.length}</span>
                        <span>{learnedIds.size} đã thuộc</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                        <div className="h-full rounded-full bg-purple-600 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                {/* Card */}
                <div
                    onClick={() => setFlipped(!flipped)}
                    className="group cursor-pointer rounded-2xl border border-border bg-card p-8 shadow-lg transition-all hover:shadow-xl min-h-[280px] flex flex-col items-center justify-center text-center"
                >
                    {flipped ? (
                        <>
                            <p className="text-2xl font-bold text-purple-600 mb-2">{word.meaning}</p>
                            {word.example && <p className="text-sm text-muted-foreground italic">"{word.example}"</p>}
                            {word.pronunciation && <p className="text-xs text-muted-foreground mt-2">{word.pronunciation}</p>}
                        </>
                    ) : (
                        <>
                            <p className="text-3xl font-bold mb-2">{word.word}</p>
                            {word.partOfSpeech && <p className="text-xs text-muted-foreground italic">({word.partOfSpeech})</p>}
                            <p className="mt-4 text-xs text-muted-foreground">Nhấn để lật thẻ</p>
                        </>
                    )}
                </div>

                {/* Navigation */}
                <div className="mt-4 flex justify-between">
                    <Button
                        variant="outline"
                        disabled={currentIndex === 0}
                        onClick={() => { setCurrentIndex((p) => p - 1); setFlipped(false); }}
                    >
                        <ChevronLeft className="h-4 w-4" /> Trước
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setLearnedIds(new Set([...learnedIds, currentIndex]));
                            if (currentIndex < activeSet.words.length - 1) {
                                setCurrentIndex((p) => p + 1); setFlipped(false);
                            } else {
                                setView('result');
                            }
                        }}
                    >
                        <CheckCircle className="h-4 w-4 text-emerald-600" /> Đã thuộc
                    </Button>
                    <Button
                        variant="outline"
                        disabled={currentIndex === activeSet.words.length - 1}
                        onClick={() => { setCurrentIndex((p) => p + 1); setFlipped(false); }}
                    >
                        Tiếp <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }

    // ==================== MATCHING ====================
    if (view === 'matching') {
        return (
            <div className="mx-auto max-w-lg">
                <button onClick={() => setView('home')} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4" /> Quay lại
                </button>
                <h2 className="mb-4 text-lg font-bold text-center">Ghép từ - nghĩa</h2>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        {matchWords.map((w) => (
                            <button
                                key={w.word}
                                disabled={matchedPairs.has(w.word)}
                                onClick={() => handleMatchClick(w.word, 'word')}
                                className={cn(
                                    'w-full rounded-lg border p-3 text-sm font-medium transition-all',
                                    matchedPairs.has(w.word) ? 'border-emerald-300 bg-emerald-50 text-emerald-600 opacity-50' :
                                        selectedWord === w.word ? 'border-purple-500 bg-purple-50 text-purple-700 shadow' :
                                            'border-border hover:bg-accent'
                                )}
                            >
                                {w.word}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        {shuffledMeanings.map((w) => (
                            <button
                                key={w.meaning}
                                disabled={matchedPairs.has(w.meaning)}
                                onClick={() => handleMatchClick(w.meaning, 'meaning')}
                                className={cn(
                                    'w-full rounded-lg border p-3 text-sm transition-all',
                                    matchedPairs.has(w.meaning) ? 'border-emerald-300 bg-emerald-50 text-emerald-600 opacity-50' :
                                        wrongPair === w.meaning ? 'border-red-500 bg-red-50 text-red-700 animate-shake' :
                                            selectedWord === w.meaning ? 'border-purple-500 bg-purple-50 text-purple-700 shadow' :
                                                'border-border hover:bg-accent'
                                )}
                            >
                                {w.meaning}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ==================== RESULT ====================
    return (
        <div className="mx-auto max-w-md text-center py-10">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">Hoàn thành!</h2>
            <p className="text-sm text-muted-foreground mb-2">{activeSet?.title}</p>
            {learnedIds.size > 0 && <p className="text-sm text-emerald-600 font-medium">{learnedIds.size}/{activeSet?.words.length} từ đã thuộc</p>}
            <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" onClick={() => { setView('home'); setActiveSet(null); }}>
                    <BookOpen className="h-4 w-4" /> Bộ khác
                </Button>
                <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => { if (activeSet) startFlashcard(activeSet); }}>
                    <RotateCcw className="h-4 w-4" /> Học lại
                </Button>
            </div>
        </div>
    );
}
