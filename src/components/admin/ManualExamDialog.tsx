import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { getSubjects } from '@/services/exam.service';
import { Trash2, ChevronRight, ChevronLeft, Save, PlusCircle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LatexContent } from '@/components/ui/LatexContent';

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

    const [part1, setPart1] = useState<any[]>([]);
    const [part2, setPart2] = useState<any[]>([]);
    const [part3, setPart3] = useState<any[]>([]);

    const addPart1 = () => {
        setPart1([...part1, {
            id: part1.length + 1,
            text: '',
            options: ['', '', '', ''],
            correct: 0,
            explanation: ''
        }]);
    };

    const addPart2 = () => {
        setPart2([...part2, {
            id: part2.length + 1,
            text: '',
            subQuestions: [
                { id: 'a', text: '', correct: true },
                { id: 'b', text: '', correct: true },
                { id: 'c', text: '', correct: true },
                { id: 'd', text: '', correct: true },
            ]
        }]);
    };

    const addPart3 = () => {
        setPart3([...part3, {
            id: part3.length + 1,
            text: '',
            correct: '',
            explanation: ''
        }]);
    };

    const handleFinalSave = async () => {
        if (!meta.title) return;
        setLoading(true);
        try {
            await onSave({
                ...meta,
                part1,
                part2,
                part3,
            });
            onClose();
            setStep(1);
            setPart1([]); setPart2([]); setPart3([]);
            setMeta({ title: '', subjectId: initialSubject || subjects[0]?.id || '', time: 50 });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold flex items-center gap-2">✍️ Soạn đề thủ công</h3>
                    <div className="flex gap-1.5">
                        {[1, 2].map(i => (
                            <div key={i} className={cn("h-1.5 rounded-full transition-all", step === i ? "bg-primary w-10" : "bg-muted w-4")} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                {step === 1 ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1">
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Tên đề thi</label>
                                <input value={meta.title} onChange={e => setMeta({...meta, title: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Môn học</label>
                                <select value={meta.subjectId} onChange={e => setMeta({...meta, subjectId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Thời gian</label>
                                <input type="number" value={meta.time} onChange={e => setMeta({...meta, time: parseInt(e.target.value) || 0})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
                            </div>
                        </div>

                        {/* Part 1 */}
                        <section className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-blue-600">Phần I: Trắc nghiệm khách quan</h4>
                                <Button onClick={addPart1} size="sm" variant="outline" className="rounded-full"><PlusCircle className="h-4 w-4 mr-1" /> Thêm</Button>
                            </div>
                            {part1.map((q, idx) => (
                                <div key={idx} className="p-4 border rounded-xl bg-slate-50 relative group">
                                    <button onClick={() => setPart1(part1.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100"><X size={16} /></button>
                                    <textarea value={q.text} onChange={e => {
                                        const newP = [...part1]; newP[idx].text = e.target.value; setPart1(newP);
                                    }} className="w-full mb-3 p-2 text-sm border rounded" placeholder="Câu hỏi..." />
                                    <div className="grid grid-cols-2 gap-2">
                                        {q.options.map((opt: string, oIdx: number) => (
                                            <div key={oIdx} className="flex items-center gap-2">
                                                <input type="radio" checked={q.correct === oIdx} onChange={() => {
                                                    const newP = [...part1]; newP[idx].correct = oIdx; setPart1(newP);
                                                }} />
                                                <input value={opt} onChange={e => {
                                                    const newP = [...part1]; newP[idx].options[oIdx] = e.target.value; setPart1(newP);
                                                }} className="flex-1 p-1 text-sm border rounded" placeholder={`Lựa chọn ${String.fromCharCode(65+oIdx)}`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </section>

                        {/* Part 2 */}
                        <section className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-emerald-600">Phần II: Đúng/Sai</h4>
                                <Button onClick={addPart2} size="sm" variant="outline" className="rounded-full"><PlusCircle className="h-4 w-4 mr-1" /> Thêm</Button>
                            </div>
                            {part2.map((q, idx) => (
                                <div key={idx} className="p-4 border rounded-xl bg-slate-50 relative group">
                                    <button onClick={() => setPart2(part2.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100"><X size={16} /></button>
                                    <textarea value={q.text} onChange={e => {
                                        const newP = [...part2]; newP[idx].text = e.target.value; setPart2(newP);
                                    }} className="w-full mb-3 p-2 text-sm border rounded" placeholder="Đoạn văn/Câu hỏi chung..." />
                                    <div className="space-y-2">
                                        {q.subQuestions.map((sq: any, sIdx: number) => (
                                            <div key={sIdx} className="flex items-center gap-3 bg-white p-2 rounded border">
                                                <span className="text-xs font-bold">{sq.id})</span>
                                                <input value={sq.text} onChange={e => {
                                                    const newP = [...part2]; newP[idx].subQuestions[sIdx].text = e.target.value; setPart2(newP);
                                                }} className="flex-1 text-sm border-none outline-none" placeholder="Ý hỏi..." />
                                                <div className="flex gap-1 shrink-0">
                                                    <button onClick={() => {
                                                        const newP = [...part2]; newP[idx].subQuestions[sIdx].correct = true; setPart2(newP);
                                                    }} className={`w-8 h-6 rounded text-xs font-bold ${sq.correct === true ? 'bg-emerald-500 text-white' : 'bg-slate-100'}`}>Đ</button>
                                                    <button onClick={() => {
                                                        const newP = [...part2]; newP[idx].subQuestions[sIdx].correct = false; setPart2(newP);
                                                    }} className={`w-8 h-6 rounded text-xs font-bold ${sq.correct === false ? 'bg-red-500 text-white' : 'bg-slate-100'}`}>S</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </section>

                        {/* Part 3 */}
                        <section className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-violet-600">Phần III: Trả lời ngắn</h4>
                                <Button onClick={addPart3} size="sm" variant="outline" className="rounded-full"><PlusCircle className="h-4 w-4 mr-1" /> Thêm</Button>
                            </div>
                            {part3.map((q, idx) => (
                                <div key={idx} className="p-4 border rounded-xl bg-slate-50 relative group">
                                    <button onClick={() => setPart3(part3.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100"><X size={16} /></button>
                                    <textarea value={q.text} onChange={e => {
                                        const newP = [...part3]; newP[idx].text = e.target.value; setPart3(newP);
                                    }} className="w-full mb-2 p-2 text-sm border rounded" placeholder="Câu hỏi..." />
                                    <input value={q.correct} onChange={e => {
                                        const newP = [...part3]; newP[idx].correct = e.target.value; setPart3(newP);
                                    }} className="w-full p-2 text-sm border rounded font-bold" placeholder="Đáp án đúng..." />
                                </div>
                            ))}
                        </section>
                    </div>
                ) : (
                    <div className="text-center py-20 space-y-4">
                        <div className="text-6xl">🎉</div>
                        <h4 className="text-2xl font-bold">Xác nhận lưu đề!</h4>
                        <p className="text-muted-foreground">Tổng cộng {part1.length + part2.length + part3.length} câu hỏi đã được soạn.</p>
                    </div>
                )}
            </div>

            <div className="p-6 border-t bg-muted/20 flex justify-between">
                <Button variant="ghost" onClick={onClose}>Hủy</Button>
                <div className="flex gap-2">
                    {step === 1 ? (
                        <Button onClick={() => setStep(2)}>Tiếp theo</Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setStep(1)}>Quay lại</Button>
                            <Button onClick={handleFinalSave} isLoading={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">Lưu đề thi</Button>
                        </>
                    )}
                </div>
            </div>
        </Dialog>
    );
}
