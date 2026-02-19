import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { getSubjects } from '@/services/exam.service';
import { Trash2, ChevronRight, ChevronLeft, Save, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Question {
    id: string;
    text: string;
    options?: string[];
    answer: string;
    explanation?: string;
    type: 'mcq' | 'tf' | 'short';
}

interface ManualExamDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialSubject?: string | null;
}

export function ManualExamDialog({ open, onClose, onSave, initialSubject }: ManualExamDialogProps) {
    const subjects = getSubjects();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [meta, setMeta] = useState({
        title: '',
        subjectId: initialSubject || subjects[0]?.id || '',
        time: 50,
    });

    const [part1, setPart1] = useState<Question[]>([]);
    const [part2, setPart2] = useState<Question[]>([]);
    const [part3, setPart3] = useState<Question[]>([]);

    const addQuestion = (part: number) => {
        const newQ: Question = {
            id: Date.now().toString(),
            text: '',
            options: ['', '', '', ''],
            answer: '',
            type: part === 1 ? 'mcq' : part === 2 ? 'tf' : 'short',
        };
        if (part === 1) setPart1([...part1, newQ]);
        else if (part === 2) {
            newQ.options = ['Đúng', 'Sai'];
            setPart2([...part2, newQ]);
        }
        else setPart3([...part3, newQ]);
    };

    const removeQuestion = (part: number, id: string) => {
        if (part === 1) setPart1(part1.filter(q => q.id !== id));
        else if (part === 2) setPart2(part2.filter(q => q.id !== id));
        else setPart3(part3.filter(q => q.id !== id));
    };

    const updateQuestion = (part: number, id: string, updates: Partial<Question>) => {
        const setter = part === 1 ? setPart1 : part === 2 ? setPart2 : setPart3;
        const list = part === 1 ? part1 : part === 2 ? part2 : part3;
        setter(list.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const handleFinalSave = async () => {
        if (!meta.title) return alert('Vui lòng nhập tiêu đề');
        setLoading(true);
        try {
            await onSave({
                ...meta,
                part1,
                part2,
                part3,
            });
            onClose();
            // Reset form
            setStep(1);
            setPart1([]);
            setPart2([]);
            setPart3([]);
            setMeta({ title: '', subjectId: initialSubject || subjects[0]?.id || '', time: 50 });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const QuestionItem = ({ q, part }: { q: Question, part: number }) => (
        <div className="p-4 border border-border rounded-xl space-y-3 bg-muted/30">
            <div className="flex justify-between items-start">
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest">
                    Câu hỏi {q.id.slice(-3)}
                </span>
                <Button variant="ghost" size="icon" onClick={() => removeQuestion(part, q.id)} className="text-red-500 h-6 w-6">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            <textarea
                value={q.text}
                onChange={(e) => updateQuestion(part, q.id, { text: e.target.value })}
                placeholder="Nhập nội dung câu hỏi..."
                className="w-full bg-background border border-input rounded-lg p-2 text-sm outline-none focus:border-primary min-h-[60px]"
            />

            {part === 1 && (
                <div className="grid grid-cols-2 gap-2">
                    {q.options?.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <input
                                type="radio"
                                name={`ans-${q.id}`}
                                checked={q.answer === String.fromCharCode(65 + idx)}
                                onChange={() => updateQuestion(part, q.id, { answer: String.fromCharCode(65 + idx) })}
                            />
                            <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                    const newOpts = [...(q.options || [])];
                                    newOpts[idx] = e.target.value;
                                    updateQuestion(part, q.id, { options: newOpts });
                                }}
                                placeholder={`Lựa chọn ${String.fromCharCode(65 + idx)}`}
                                className="flex-1 bg-background border border-input rounded-md px-2 py-1 text-sm"
                            />
                        </div>
                    ))}
                </div>
            )}

            {part === 2 && (
                <div className="flex gap-4">
                    {['Đúng', 'Sai'].map((label) => (
                        <label key={label} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name={`ans-${q.id}`}
                                checked={q.answer === label}
                                onChange={() => updateQuestion(part, q.id, { answer: label })}
                            />
                            <span className="text-sm">{label}</span>
                        </label>
                    ))}
                </div>
            )}

            {part === 3 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Đáp án đúng (ngăn cách bằng dấu | nếu có nhiều phương án):</p>
                    <input
                        type="text"
                        value={q.answer}
                        onChange={(e) => updateQuestion(part, q.id, { answer: e.target.value })}
                        placeholder="VD: 10 | 10.0"
                        className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
                    />
                </div>
            )}
        </div>
    );

    return (
        <Dialog open={open} onClose={onClose} className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-border bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        ✍️ Thêm đề thi mới
                    </h3>
                    <div className="flex gap-1">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={cn(
                                "h-1.5 w-8 rounded-full transition-all",
                                step === i ? "bg-primary w-12" : "bg-muted"
                            )} />
                        ))}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                    {step === 1 ? 'Thông tin cơ bản' : step === 2 ? 'Nội dung câu hỏi' : 'Hoàn tất'}
                </p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tên đề thi</label>
                            <input
                                type="text"
                                value={meta.title}
                                onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                                placeholder="VD: Đề thi thử THPT Quốc gia 2024 - Môn Toán"
                                className="w-full text-lg font-bold bg-background border border-input rounded-xl px-4 py-3 outline-none focus:border-primary shadow-sm"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Môn học</label>
                                <select
                                    value={meta.subjectId}
                                    onChange={(e) => setMeta({ ...meta, subjectId: e.target.value })}
                                    className="w-full bg-background border border-input rounded-xl px-4 py-3 outline-none focus:border-primary shadow-sm"
                                >
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Thời gian (phút)</label>
                                <input
                                    type="number"
                                    value={meta.time}
                                    onChange={(e) => setMeta({ ...meta, time: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-background border border-input rounded-xl px-4 py-3 outline-none focus:border-primary shadow-sm"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                        <section className="space-y-4">
                            <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur py-2 z-10 border-b border-border/50">
                                <h4 className="font-bold flex items-center gap-2">Part 1: Trắc nghiệm khách quan</h4>
                                <Button onClick={() => addQuestion(1)} size="sm" variant="outline" className="gap-1 rounded-full border-dashed">
                                    <PlusCircle className="h-4 w-4" /> Thêm câu hỏi
                                </Button>
                            </div>
                            <div className="space-y-4">
                                {part1.map(q => <QuestionItem key={q.id} q={q} part={1} />)}
                                {part1.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground italic border border-dashed rounded-xl">Chưa có câu hỏi cho Phần 1</p>}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur py-2 z-10 border-b border-border/50">
                                <h4 className="font-bold flex items-center gap-2">Part 2: Trắc nghiệm Đúng/Sai</h4>
                                <Button onClick={() => addQuestion(2)} size="sm" variant="outline" className="gap-1 rounded-full border-dashed">
                                    <PlusCircle className="h-4 w-4" /> Thêm câu hỏi
                                </Button>
                            </div>
                            <div className="space-y-4">
                                {part2.map(q => <QuestionItem key={q.id} q={q} part={2} />)}
                                {part2.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground italic border border-dashed rounded-xl">Chưa có câu hỏi cho Phần 2</p>}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur py-2 z-10 border-b border-border/50">
                                <h4 className="font-bold flex items-center gap-2">Part 3: Trắc nghiệm trả lời ngắn</h4>
                                <Button onClick={() => addQuestion(3)} size="sm" variant="outline" className="gap-1 rounded-full border-dashed">
                                    <PlusCircle className="h-4 w-4" /> Thêm câu hỏi
                                </Button>
                            </div>
                            <div className="space-y-4">
                                {part3.map(q => <QuestionItem key={q.id} q={q} part={3} />)}
                                {part3.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground italic border border-dashed rounded-xl">Chưa có câu hỏi cho Phần 3</p>}
                            </div>
                        </section>
                    </div>
                )}

                {step === 3 && (
                    <div className="text-center py-10 space-y-6 animate-in fade-in zoom-in-95">
                        <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center text-5xl mx-auto border-4 border-primary">
                            ✅
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-2xl font-bold">Sẵn sàng lưu trữ!</h4>
                            <p className="text-muted-foreground">
                                Đề thi <b>{meta.title}</b> đã được soạn thảo thành công với tổng số {part1.length + part2.length + part3.length} câu hỏi.
                            </p>
                        </div>
                        <div className="bg-muted p-4 rounded-xl text-left text-sm max-w-md mx-auto">
                            <div className="flex justify-between border-b pb-2 mb-2">
                                <span>Trắc nghiệm (Part 1):</span>
                                <span className="font-bold">{part1.length} câu</span>
                            </div>
                            <div className="flex justify-between border-b pb-2 mb-2">
                                <span>Đúng/Sai (Part 2):</span>
                                <span className="font-bold">{part2.length} câu</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Trả lời ngắn (Part 3):</span>
                                <span className="font-bold">{part3.length} câu</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border bg-muted/20 flex justify-between items-center">
                <Button variant="ghost" onClick={onClose}>Hủy bỏ</Button>
                <div className="flex gap-3">
                    {step > 1 && (
                        <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1">
                            <ChevronLeft className="h-4 w-4" /> Quay lại
                        </Button>
                    )}
                    {step < 3 ? (
                        <Button onClick={() => setStep(step + 1)} className="gap-1 min-w-[120px]">
                            Tiếp theo <ChevronRight className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button onClick={handleFinalSave} isLoading={loading} className="gap-1 min-w-[120px] bg-green-600 hover:bg-green-700">
                            <Save className="h-4 w-4" /> Lưu đề thi
                        </Button>
                    )}
                </div>
            </div>
        </Dialog>
    );
}
