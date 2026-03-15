import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExamContent, updateExam, getSubjects } from '@/services/exam.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { LaTeXEditor } from '@/components/ui/LaTeXEditor';
import { LatexContent } from '@/components/ui/LatexContent';
import type { Exam, Part1Question, Part2Question, Part3Question } from '@/types';
import {
    ArrowLeft, Save, Plus, Trash2, Edit3, Check,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EditExamPage() {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [exam, setExam] = useState<Exam | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Editable fields
    const [title, setTitle] = useState('');
    const [time, setTime] = useState(50);
    const [subjectId, setSubjectId] = useState('');
    const [part1, setPart1] = useState<Part1Question[]>([]);
    const [part2, setPart2] = useState<Part2Question[]>([]);
    const [part3, setPart3] = useState<Part3Question[]>([]);

    // Track which question is being edited
    const [editingQ, setEditingQ] = useState<{ part: number; id: number } | null>(null);

    // Collapse sections
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const subjects = getSubjects();

    useEffect(() => {
        async function load() {
            if (!examId) return;
            const data = await getExamContent(examId);
            if (!data) {
                toast({ title: 'Không tìm thấy đề thi', type: 'error' });
                navigate('/admin/practice');
                return;
            }
            setExam(data);
            setTitle(data.title);
            setTime(data.time);
            setSubjectId(data.subjectId);
            setPart1(data.part1 || []);
            setPart2(data.part2 || []);
            setPart3(data.part3 || []);
            setLoading(false);
        }
        load();
    }, [examId]);

    const handleSave = async () => {
        if (!examId) return;
        setSaving(true);
        try {
            await updateExam(examId, { title, time, subjectId, part1, part2, part3 });
            toast({ title: 'Đã lưu thành công!', type: 'success' });
        } catch (err) {
            toast({ title: 'Lỗi khi lưu', message: String(err), type: 'error' });
        }
        setSaving(false);
    };

    // ---- Part 1 helpers ----
    const addP1Question = () => {
        const newId = (part1.reduce((m, q) => Math.max(m, q.id), 0)) + 1;
        const q: Part1Question = {
            id: newId,
            text: '',
            options: ['', '', '', ''],
            correct: 0,
        };
        setPart1([...part1, q]);
        setEditingQ({ part: 1, id: newId });
    };

    const removeP1Question = (id: number) => setPart1(part1.filter(q => q.id !== id));

    const updateP1 = (id: number, updates: Partial<Part1Question>) => {
        setPart1(part1.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    // ---- Part 2 helpers ----
    const addP2Question = () => {
        const newId = (part2.reduce((m, q) => Math.max(m, q.id), 0)) + 1;
        const q: Part2Question = {
            id: newId,
            text: '',
            subQuestions: [
                { id: 'a', text: '', correct: false },
                { id: 'b', text: '', correct: false },
                { id: 'c', text: '', correct: false },
                { id: 'd', text: '', correct: false },
            ],
        };
        setPart2([...part2, q]);
        setEditingQ({ part: 2, id: newId });
    };

    const removeP2Question = (id: number) => setPart2(part2.filter(q => q.id !== id));

    const updateP2 = (id: number, updates: Partial<Part2Question>) => {
        setPart2(part2.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const updateP2Sub = (qId: number, subId: string, updates: { text?: string; correct?: boolean }) => {
        setPart2(part2.map(q =>
            q.id === qId
                ? { ...q, subQuestions: q.subQuestions.map(sq => sq.id === subId ? { ...sq, ...updates } : sq) }
                : q
        ));
    };

    // ---- Part 3 helpers ----
    const addP3Question = () => {
        const newId = (part3.reduce((m, q) => Math.max(m, q.id), 0)) + 1;
        const q: Part3Question = { id: newId, text: '', correct: '' };
        setPart3([...part3, q]);
        setEditingQ({ part: 3, id: newId });
    };

    const removeP3Question = (id: number) => setPart3(part3.filter(q => q.id !== id));

    const updateP3 = (id: number, updates: Partial<Part3Question>) => {
        setPart3(part3.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const toggleCollapse = (key: string) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

    if (loading) return (
        <div className="flex justify-center py-20">
            <Spinner size="lg" label="Đang tải đề thi..." />
        </div>
    );

    if (!exam) return null;

    const isEditingQ = (part: number, id: number) => editingQ?.part === part && editingQ?.id === id;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="admin-card p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin/practice')} className="rounded-full shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full text-xl font-black text-slate-800 dark:text-slate-100 bg-transparent outline-none border-b-2 border-transparent focus:border-indigo-400 pb-0.5 transition-colors"
                            placeholder="Tên đề thi..."
                        />
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <select
                                value={subjectId}
                                onChange={e => setSubjectId(e.target.value)}
                                className="text-xs font-bold text-slate-500 bg-transparent outline-none cursor-pointer border-none"
                            >
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                            </select>
                            <span className="text-slate-300">|</span>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    value={time}
                                    onChange={e => setTime(parseInt(e.target.value) || 0)}
                                    className="w-12 text-xs font-bold text-slate-500 bg-transparent outline-none border-none text-center"
                                />
                                <span className="text-xs text-slate-400">phút</span>
                            </div>
                            <span className="text-xs text-slate-400 font-medium">ID: {examId}</span>
                        </div>
                    </div>
                </div>
                <Button onClick={handleSave} isLoading={saving} className="admin-btn-primary gap-2 px-5 rounded-xl shrink-0">
                    <Save className="h-4 w-4" /> Lưu tất cả
                </Button>
            </div>

            {/* PART 1 */}
            <div className="admin-card overflow-hidden">
                <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleCollapse('p1')}
                >
                    <h3 className="font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold">PHẦN 1</span>
                        Trắc nghiệm khách quan
                        <span className="text-sm font-normal text-slate-400">({part1.length} câu)</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={e => { e.stopPropagation(); addP1Question(); }}
                            size="sm" variant="outline"
                            className="gap-1 text-xs rounded-xl h-8 border-dashed"
                        >
                            <Plus className="h-3.5 w-3.5" /> Thêm câu
                        </Button>
                        {collapsed['p1'] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                    </div>
                </div>

                {!collapsed['p1'] && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {part1.length === 0 && (
                            <p className="py-8 text-center text-sm text-slate-400 italic">Chưa có câu hỏi — nhấn "Thêm câu" để bắt đầu</p>
                        )}
                        {part1.map((q, idx) => (
                            <div key={q.id} className="p-4">
                                {/* Question header row */}
                                <div className="flex items-start gap-2 mb-2">
                                    <span className="shrink-0 w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        {isEditingQ(1, q.id) ? (
                                            <LaTeXEditor
                                                value={q.text}
                                                onChange={v => updateP1(q.id, { text: v })}
                                                placeholder="Nội dung câu hỏi... hỗ trợ LaTeX: $\frac{a}{b}$, \ce{H2O}..."
                                                rows={3}
                                                label="Câu hỏi"
                                            />
                                        ) : (
                                            <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 py-1">
                                                {q.text ? <LatexContent content={q.text} /> : <span className="text-slate-400 italic">(chưa có nội dung)</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isEditingQ(1, q.id) ? (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ(null)} className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                                                <Check className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ({ part: 1, id: q.id })} className="h-7 w-7 text-slate-400 hover:text-indigo-600 rounded-lg">
                                                <Edit3 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => removeP1Question(q.id)} className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-lg">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Options */}
                                {isEditingQ(1, q.id) ? (
                                    <div className="ml-9 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                                        {q.options.map((opt, oIdx) => (
                                            <div key={oIdx} className="flex items-start gap-2">
                                                <label className="flex items-center gap-1.5 mt-2 cursor-pointer shrink-0">
                                                    <input
                                                        type="radio"
                                                        name={`p1-correct-${q.id}`}
                                                        checked={q.correct === oIdx}
                                                        onChange={() => updateP1(q.id, { correct: oIdx as 0 | 1 | 2 | 3 })}
                                                        className="accent-indigo-600"
                                                    />
                                                    <span className={cn(
                                                        'w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center',
                                                        q.correct === oIdx ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                                    )}>
                                                        {String.fromCharCode(65 + oIdx)}
                                                    </span>
                                                </label>
                                                <textarea
                                                    value={opt}
                                                    onChange={e => {
                                                        const opts = [...q.options] as [string, string, string, string];
                                                        opts[oIdx] = e.target.value;
                                                        updateP1(q.id, { options: opts });
                                                    }}
                                                    placeholder={`Lựa chọn ${String.fromCharCode(65 + oIdx)}`}
                                                    rows={1}
                                                    className="flex-1 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 resize-none font-mono"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="ml-9 grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                                        {q.options.map((opt, oIdx) => (
                                            <div key={oIdx} className={cn(
                                                'flex items-start gap-2 rounded-lg px-2 py-1 text-sm',
                                                q.correct === oIdx ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-600 dark:text-slate-400'
                                            )}>
                                                <span className={cn(
                                                    'w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5',
                                                    q.correct === oIdx ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                                                )}>
                                                    {String.fromCharCode(65 + oIdx)}
                                                </span>
                                                {opt ? <LatexContent content={opt} /> : <span className="text-slate-300">—</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* PART 2 */}
            <div className="admin-card overflow-hidden">
                <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleCollapse('p2')}
                >
                    <h3 className="font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 text-xs font-bold">PHẦN 2</span>
                        Trắc nghiệm Đúng/Sai
                        <span className="text-sm font-normal text-slate-400">({part2.length} câu)</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={e => { e.stopPropagation(); addP2Question(); }}
                            size="sm" variant="outline"
                            className="gap-1 text-xs rounded-xl h-8 border-dashed"
                        >
                            <Plus className="h-3.5 w-3.5" /> Thêm câu
                        </Button>
                        {collapsed['p2'] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                    </div>
                </div>

                {!collapsed['p2'] && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {part2.length === 0 && (
                            <p className="py-8 text-center text-sm text-slate-400 italic">Chưa có câu hỏi</p>
                        )}
                        {part2.map((q, idx) => (
                            <div key={q.id} className="p-4">
                                <div className="flex items-start gap-2 mb-3">
                                    <span className="shrink-0 w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 flex items-center justify-center text-xs font-bold mt-0.5">
                                        {(part1.length) + idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        {isEditingQ(2, q.id) ? (
                                            <LaTeXEditor
                                                value={q.text}
                                                onChange={v => updateP2(q.id, { text: v })}
                                                placeholder="Ngữ cảnh/đề câu hỏi đúng sai..."
                                                rows={2}
                                                label="Đề bài"
                                            />
                                        ) : (
                                            <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 py-1">
                                                {q.text ? <LatexContent content={q.text} /> : <span className="text-slate-400 italic">(chưa có nội dung)</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isEditingQ(2, q.id) ? (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ(null)} className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                                                <Check className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ({ part: 2, id: q.id })} className="h-7 w-7 text-slate-400 hover:text-indigo-600 rounded-lg">
                                                <Edit3 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => removeP2Question(q.id)} className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-lg">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Sub-questions */}
                                <div className="ml-9 space-y-2">
                                    {q.subQuestions.map(sq => (
                                        <div key={sq.id} className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/30 p-2 border border-slate-100 dark:border-slate-700">
                                            <span className="uppercase font-bold text-xs text-slate-500 mt-1 w-4 shrink-0">{sq.id})</span>
                                            {isEditingQ(2, q.id) ? (
                                                <div className="flex-1 flex gap-2 items-start">
                                                    <textarea
                                                        value={sq.text}
                                                        onChange={e => updateP2Sub(q.id, sq.id, { text: e.target.value })}
                                                        placeholder="Nội dung ý..."
                                                        rows={1}
                                                        className="flex-1 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:border-indigo-400 resize-none font-mono"
                                                    />
                                                    <div className="flex gap-1 shrink-0 mt-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateP2Sub(q.id, sq.id, { correct: true })}
                                                            className={cn('px-2 py-1 text-xs font-bold rounded-lg transition-all', sq.correct ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100')}
                                                        >Đ</button>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateP2Sub(q.id, sq.id, { correct: false })}
                                                            className={cn('px-2 py-1 text-xs font-bold rounded-lg transition-all', !sq.correct ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-rose-100')}
                                                        >S</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex items-start gap-2">
                                                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                                                        {sq.text ? <LatexContent content={sq.text} /> : <span className="text-slate-400 italic">—</span>}
                                                    </span>
                                                    <span className={cn('shrink-0 px-2 py-0.5 text-xs font-bold rounded', sq.correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                                                        {sq.correct ? 'Đúng' : 'Sai'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* PART 3 */}
            <div className="admin-card overflow-hidden">
                <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleCollapse('p3')}
                >
                    <h3 className="font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 text-xs font-bold">PHẦN 3</span>
                        Trả lời ngắn
                        <span className="text-sm font-normal text-slate-400">({part3.length} câu)</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={e => { e.stopPropagation(); addP3Question(); }}
                            size="sm" variant="outline"
                            className="gap-1 text-xs rounded-xl h-8 border-dashed"
                        >
                            <Plus className="h-3.5 w-3.5" /> Thêm câu
                        </Button>
                        {collapsed['p3'] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                    </div>
                </div>

                {!collapsed['p3'] && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {part3.length === 0 && (
                            <p className="py-8 text-center text-sm text-slate-400 italic">Chưa có câu hỏi</p>
                        )}
                        {part3.map((q, idx) => (
                            <div key={q.id} className="p-4">
                                <div className="flex items-start gap-2">
                                    <span className="shrink-0 w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 flex items-center justify-center text-xs font-bold mt-0.5">
                                        {part1.length + part2.length + idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0 space-y-3">
                                        {isEditingQ(3, q.id) ? (
                                            <>
                                                <LaTeXEditor
                                                    value={q.text}
                                                    onChange={v => updateP3(q.id, { text: v })}
                                                    placeholder="Nội dung câu hỏi..."
                                                    rows={3}
                                                    label="Câu hỏi"
                                                />
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Đáp án đúng</label>
                                                    <input
                                                        type="text"
                                                        value={q.correct}
                                                        onChange={e => updateP3(q.id, { correct: e.target.value })}
                                                        placeholder="Đáp án... (nhiều phương án ngăn cách bằng |)"
                                                        className="text-sm bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-400 font-mono"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-1">
                                                <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                                    {q.text ? <LatexContent content={q.text} /> : <span className="text-slate-400 italic">(chưa có nội dung)</span>}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs text-slate-400 font-semibold">Đáp án:</span>
                                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                                                        {q.correct || '—'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isEditingQ(3, q.id) ? (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ(null)} className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                                                <Check className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ({ part: 3, id: q.id })} className="h-7 w-7 text-slate-400 hover:text-indigo-600 rounded-lg">
                                                <Edit3 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => removeP3Question(q.id)} className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-lg">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Sticky save bar */}
            <div className="sticky bottom-4 z-20 flex justify-center">
                <div className="admin-card px-6 py-3 flex items-center gap-4">
                    <span className="text-sm text-slate-500 font-medium">
                        Tổng: <strong className="text-slate-800 dark:text-slate-200">{part1.length + part2.length + part3.length}</strong> câu
                    </span>
                    <Button onClick={handleSave} isLoading={saving} className="admin-btn-primary gap-2 px-5 rounded-xl">
                        <Save className="h-4 w-4" /> Lưu tất cả thay đổi
                    </Button>
                </div>
            </div>
        </div>
    );
}
