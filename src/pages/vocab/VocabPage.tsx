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

    // Matching state
    const [matchWords, setMatchWords] = useState<VocabWord[]>([]);
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
    const [wrongPair, setWrongPair] = useState<string | null>(null);

    useEffect(() => {
        getAllVocabSets().then((data) => { setSets(data); setLoading(false); });
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

    // ==================== HOME ====================
    if (view === 'home') {
        return (
            <div>
                {/* Back button */}
                <button
                    onClick={() => window.location.href = '/'}
                    className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors duration-300 mb-6 group"
                >
                    <svg className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="font-medium">Quay lại Menu</span>
                </button>

                <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Từ vựng</h2>
                <p className="text-gray-500 mb-6">{sets.length} bộ từ vựng</p>

                <div className="flex flex-wrap gap-2 mb-6">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                                activeCategory === cat.id ? 'bg-purple-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            )}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {filteredSets.length === 0 ? (
                    <div className="py-16 text-center"><p className="text-gray-400">Không có bộ từ vựng nào</p></div>
                ) : (
                    <ul className="space-y-4">
                        {filteredSets.map((vocabSet) => (
                            <li key={vocabSet.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-base font-semibold text-gray-800">{vocabSet.title}</h3>
                                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700">
                                        {vocabSet.words.length} từ
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => startFlashcard(vocabSet)} className="flex-1 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-1">
                                        <Layers className="h-3 w-3" /> Flashcard
                                    </button>
                                    <button onClick={() => startMatching(vocabSet)} className="flex-1 px-3 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-1">
                                        <Shuffle className="h-3 w-3" /> Ghép
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
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
