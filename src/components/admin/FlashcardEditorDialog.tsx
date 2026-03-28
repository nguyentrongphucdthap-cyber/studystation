import { useState, useRef, useEffect } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { 
    Plus, Trash2, Type, 
    ChevronDown, Eye, EyeOff,
    Pencil, Save, 
    AlertCircle, Layers
} from 'lucide-react';
import { FormattedText } from '@/components/ui/FormattedText';
import { getSubjects } from '@/services/exam.service';
import type { VocabSet, VocabWord } from '@/types';

interface FlashcardEditorDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: Partial<VocabSet>) => void;
    initialData?: VocabSet;
    mode: 'create' | 'edit';
}

export function FlashcardEditorDialog({ open, onClose, onSave, initialData, mode }: FlashcardEditorDialogProps) {
    const subjects = getSubjects();
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [category, setCategory] = useState(initialData?.category || '');
    const [subjectId, setSubjectId] = useState(initialData?.subjectId || '');
    const [words, setWords] = useState<VocabWord[]>(initialData?.words || [{ word: '', meaning: '', notes: '' }]);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [activeField, setActiveField] = useState<{ index: number, field: keyof VocabWord } | null>(null);

    const textAreaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

    useEffect(() => {
        if (open) {
            setTitle(initialData?.title || '');
            setDescription(initialData?.description || '');
            setCategory(initialData?.category || '');
            setSubjectId(initialData?.subjectId || '');
            setWords(initialData?.words || [{ word: '', meaning: '', notes: '' }]);
        }
    }, [open, initialData]);

    const addWord = () => {
        setWords([...words, { word: '', meaning: '', notes: '' }]);
    };

    const removeWord = (index: number) => {
        if (words.length <= 1) return;
        setWords(words.filter((_: VocabWord, i: number) => i !== index));
    };

    const updateWord = (index: number, field: keyof VocabWord, value: string) => {
        const newWords = [...words];
        newWords[index] = { ...newWords[index], [field]: value } as VocabWord;
        setWords(newWords);
    };

    const insertLaTeX = (syntax: string) => {
        if (!activeField) return;
        const { index, field } = activeField;
        const key = `${index}-${field}`;
        const textarea = textAreaRefs.current[key];
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = (words[index] as any)[field] as string;
        const before = text.substring(0, start);
        const after = text.substring(end);
        
        const newValue = before + syntax + after;
        updateWord(index, field, newValue);
        
        // Refocus and set cursor position
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + syntax.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleSave = () => {
        if (!title.trim()) return;
        onSave({
            title,
            description,
            category,
            subjectId,
            words,
            updatedAt: new Date().toISOString()
        });
    };

    const laTexSymbols = [
        { label: 'Inline Math', syntax: '$  $', title: 'Công thức nội dòng' },
        { label: 'Block Math', syntax: '$$  $$', title: 'Công thức khối' },
        { label: 'Căn bậc 2', syntax: '\\sqrt{}', title: 'Căn bậc 2' },
        { label: 'Phân số', syntax: '\\frac{}{}', title: 'Phân số' },
        { label: 'Mũ', syntax: '^{}', title: 'Số mũ' },
        { label: 'Chỉ số', syntax: '_{}', title: 'Chỉ số dưới' },
        { label: 'Nhân', syntax: '\\cdot', title: 'Dấu nhân' },
        { label: 'Vô hạn', syntax: '\\infty', title: 'Vô hạn' },
        { label: 'Hy Lạp', syntax: '\\alpha', title: 'Alpha' },
        { label: 'Tổng', syntax: '\\sum_{}^{}', title: 'Tổng sigma' },
        { label: 'Tích phân', syntax: '\\int_{}^{}', title: 'Tích phân' },
    ];

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            className="max-w-5xl h-[90vh] flex flex-col p-0 rounded-[32px] overflow-hidden"
        >
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "p-3 rounded-2xl",
                        mode === 'create' ? "bg-purple-100 text-purple-600" : "bg-amber-100 text-amber-600"
                    )}>
                        {mode === 'create' ? <Plus className="h-6 w-6" /> : <Pencil className="h-6 w-6" />}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                            {mode === 'create' ? 'Tạo bộ thẻ mới' : 'Chỉnh sửa bộ thẻ'}
                        </h2>
                        <p className="text-xs text-gray-400 font-medium">Nhập thủ công các thẻ ghi nhớ của bạn</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={onClose} className="rounded-xl font-bold border-gray-200">Hủy</Button>
                    <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl px-8 shadow-lg shadow-purple-200 dark:shadow-none">
                        <Save className="h-4 w-4 mr-2" />
                        Lưu bộ thẻ
                    </Button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 custom-scrollbar">
                {/* Metadata Section */}
                <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-12">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center gap-2">
                            <Type className="h-3 w-3" /> Thông tin cơ bản
                        </h3>
                    </div>
                    
                    <div className="md:col-span-7 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-600 dark:text-gray-400 ml-1">Tiêu đề bộ thẻ</label>
                            <input 
                                placeholder="Ví dụ: Công thức Vật lí 12 - Chương 1"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full flex h-10 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 px-3 py-2 text-sm font-bold ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-600 dark:text-gray-400 ml-1">Mô tả chi tiết (Tùy chọn)</label>
                            <textarea
                                placeholder="Mô tả nội dung của bộ thẻ này..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full min-h-[100px] rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-600 dark:text-gray-400 ml-1">Môn học</label>
                            <div className="relative">
                                <select
                                    value={subjectId}
                                    onChange={(e) => setSubjectId(e.target.value)}
                                    className="w-full appearance-none rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 p-3.5 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer"
                                >
                                    <option value="">Chọn môn học...</option>
                                    {subjects.map(s => (
                                        <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-600 dark:text-gray-400 ml-1">Thẻ (Tag/Chủ đề)</label>
                            <input 
                                placeholder="Ví dụ: Dao động cơ, Sóng ánh sáng..."
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full flex h-10 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 px-3 py-2 text-sm font-bold ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>
                </section>

                <hr className="border-gray-100 dark:border-slate-800" />

                {/* LaTeX Toolbar - Sticky */}
                <div className="sticky top-0 z-10 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 -mx-8 px-8 flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 mr-4 border-r border-gray-100 dark:border-slate-800 pr-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Công cụ Math</span>
                    </div>
                    {laTexSymbols.map((s) => (
                        <button
                            key={s.label}
                            onClick={() => insertLaTeX(s.syntax)}
                            className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                            title={s.title}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Cards Section */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                            <Layers className="h-3 w-3" /> Danh sách thẻ ({words.length})
                        </h3>
                        <Button 
                            onClick={addWord} 
                            variant="outline" 
                            size="sm"
                            className="rounded-xl font-bold border-purple-100 text-purple-600 hover:bg-purple-50"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Thêm thẻ
                        </Button>
                    </div>

                    <div className="space-y-6">
                        {words.map((word: VocabWord, index: number) => (
                            <div 
                                key={index} 
                                className={cn(
                                    "group p-6 rounded-[32px] border transition-all duration-300",
                                    previewIndex === index 
                                        ? "bg-purple-50/30 border-purple-200 dark:bg-purple-900/5 dark:border-purple-800"
                                        : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-purple-200"
                                )}
                            >
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-black text-gray-400">
                                            {index + 1}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setPreviewIndex(previewIndex === index ? null : index)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
                                                    previewIndex === index 
                                                        ? "bg-purple-600 text-white" 
                                                        : "bg-gray-100 dark:bg-slate-800 text-gray-400 hover:text-purple-600"
                                                )}
                                            >
                                                {previewIndex === index ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                {previewIndex === index ? 'Đóng xem trước' : 'Xem trước'}
                                            </button>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => removeWord(index)}
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>

                                {previewIndex === index ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="space-y-3">
                                            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest bg-purple-100 px-2 py-1 rounded-md">Mặt trước</span>
                                            <div className="min-h-[140px] p-6 rounded-3xl bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900/30 flex flex-col items-center justify-center text-center">
                                                {word.image && <img src={word.image} alt="Front" className="max-h-32 object-contain mb-4 rounded-xl" />}
                                                <FormattedText text={word.word || 'Chưa nhập nội dung...'} />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-100 px-2 py-1 rounded-md">Mặt sau</span>
                                            <div className="min-h-[140px] p-6 rounded-3xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/30 flex flex-col items-center justify-center text-center space-y-3">
                                                {word.image && <img src={word.image} alt="Back" className="max-h-32 object-contain mb-2 rounded-xl" />}
                                                <div className="text-2xl font-black text-gray-900 dark:text-white py-2">
                                                    <FormattedText text={word.meaning || 'Chưa nhập nội dung...'} />
                                                </div>
                                                {word.notes && (
                                                    <div className="mt-2 w-full max-w-sm bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-4 flex items-start gap-3 text-left">
                                                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg shrink-0 mt-0.5">
                                                            <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                                        </div>
                                                        <div className="text-[13px] text-gray-600 dark:text-slate-300 font-medium">
                                                            <FormattedText text={word.notes} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nội dung mặt trước</label>
                                                <textarea 
                                                    ref={(el) => { if (el) textAreaRefs.current[`${index}-word`] = el; }}
                                                    placeholder="Câu hỏi hoặc công thức..."
                                                    value={word.word}
                                                    onFocus={() => setActiveField({ index, field: 'word' })}
                                                    onChange={(e) => updateWord(index, 'word', e.target.value)}
                                                    className="w-full min-h-[120px] rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/30 p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nội dung mặt sau</label>
                                                <textarea 
                                                    ref={(el) => { if (el) textAreaRefs.current[`${index}-meaning`] = el; }}
                                                    placeholder="Câu trả lời hoặc định nghĩa..."
                                                    value={word.meaning}
                                                    onFocus={() => setActiveField({ index, field: 'meaning' })}
                                                    onChange={(e) => updateWord(index, 'meaning', e.target.value)}
                                                    className="w-full min-h-[120px] rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/30 p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ghi chú / Thuyết minh đại lượng</label>
                                                <textarea 
                                                    ref={(el) => { if (el) textAreaRefs.current[`${index}-notes`] = el; }}
                                                    placeholder="Giải thích các đại lượng (ví dụ: v là vận tốc, t là thời gian)..."
                                                    value={word.notes || ''}
                                                    onFocus={() => setActiveField({ index, field: 'notes' })}
                                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateWord(index, 'notes', e.target.value)}
                                                    className="w-full min-h-[80px] rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/30 p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Hình ảnh (Tuỳ chọn)</label>
                                                <div className="flex flex-col gap-2 relative">
                                                    <input 
                                                        placeholder="Nhập URL hình ảnh (vd: https://...)"
                                                        value={word.image || ''}
                                                        onChange={(e) => updateWord(index, 'image', e.target.value)}
                                                        className="w-full flex h-[46px] rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/30 px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                                    />
                                                    {word.image && (
                                                        <div className="h-16 w-16 p-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                                            <img src={word.image} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="py-10 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-[40px] group hover:border-purple-200 transition-all cursor-pointer" onClick={addWord}>
                        <div className="p-4 rounded-full bg-purple-50 dark:bg-purple-900/10 text-purple-600 group-hover:scale-110 transition-transform mb-3">
                            <Plus className="h-8 w-8" />
                        </div>
                        <p className="font-black text-gray-400 uppercase tracking-widest text-[11px]">Thêm 1 thẻ mới</p>
                    </div>
                </section>

                <div className="flex items-center gap-4 bg-amber-50 dark:bg-amber-900/10 p-4 px-6 rounded-3xl border border-amber-100 dark:border-amber-900/20">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-500">
                        <b>Mẹo:</b> Sử dụng thanh công cụ bên trên hoặc gõ trực tiếp cú pháp LaTeX (ví dụ: $E=mc^2$) để hiển thị công thức đẹp mắt. Xem trước kết quả bằng nút "Xem trước" bên dưới mỗi thẻ.
                    </p>
                </div>
            </div>
        </Dialog>
    );
}
