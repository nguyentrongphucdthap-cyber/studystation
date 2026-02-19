import React, { useState, useRef } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Upload, Wand2, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { uploadToImgBB } from '@/services/image.service';
import { parseExamText } from '@/utils/examParser';
import { getSubjects } from '@/services/exam.service';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface SmartImportDialogProps {
    open: boolean;
    onClose: () => void;
    onImport: (data: any) => Promise<void>;
    type: 'practice' | 'etest' | 'vocab';
    initialSubjectId?: string | null;
}

export function SmartImportDialog({ open, onClose, onImport, type, initialSubjectId }: SmartImportDialogProps) {
    const { toast } = useToast();
    const [step, setStep] = useState<'upload' | 'review'>('upload');
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [time, setTime] = useState(50);
    const [subjectId, setSubjectId] = useState<string>(initialSubjectId || 'toan');
    const [extractedText, setExtractedText] = useState('');
    const [generatedText, setGeneratedText] = useState('');
    const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const subjects = getSubjects();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setUploadProgress(null);
        try {
            let text = '';
            if (file.name.endsWith('.pdf')) {
                text = await extractTextFromPDF(file);
            } else if (file.name.endsWith('.docx')) {
                text = await extractTextFromDocxWithImages(file);
            } else {
                text = await file.text();
            }

            if (!text || text.trim().length === 0) {
                throw new Error('File rỗng hoặc không có nội dung có thể trích xuất.');
            }

            setExtractedText(text);
            toast({ title: 'Đã đọc file', message: 'Nội dung đã được trích xuất thành công.', type: 'info' });
        } catch (err: any) {
            console.error('[SmartImport] Error:', err);
            toast({
                title: 'Lỗi đọc file',
                message: err.message || 'Không thể trích xuất nội dung.',
                type: 'error'
            });
        } finally {
            setLoading(false);
            setUploadProgress(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const extractTextFromDocxWithImages = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();

        const options = {
            convertImage: (mammoth.images as any).imgElement(async (element: any) => {
                setUploadProgress(prev => ({ current: (prev?.current || 0) + 1, total: 0 }));

                const buffer = await element.read();
                const blob = new Blob([buffer], { type: element.contentType });

                try {
                    const result = await uploadToImgBB(blob);
                    return {
                        src: result.url
                    };
                } catch (err) {
                    console.error('Failed to upload docx image:', err);
                    return { src: "" };
                }
            })
        };

        const result = await (mammoth as any).convertToMarkdown({ arrayBuffer }, options);
        return result.value;
    };

    const extractTextFromPDF = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((item: any) => item.str).join(' ') + '\n';

            // Note: PDF image extraction is complex in browser, 
            // staying with text-only for PDF in this version to ensure stability.
        }
        return text;
    };

    const handleGenerateAI = async () => {
        if (!extractedText.trim()) return;

        setLoading(true);
        setUploadProgress({ current: 0, total: 1 }); // Re-use progress for chunks count

        try {
            // 1. Split text into chunks (around 4000 chars each, preferably at double newlines)
            const CHUNK_SIZE = 4000;
            const textToProcess = extractedText.trim();
            const chunks: string[] = [];

            let currentIdx = 0;
            while (currentIdx < textToProcess.length) {
                let endIdx = currentIdx + CHUNK_SIZE;
                if (endIdx < textToProcess.length) {
                    // Try to find a good breaking point (double newline)
                    const nextBreak = textToProcess.indexOf('\n\n', endIdx - 500);
                    if (nextBreak !== -1 && nextBreak < endIdx + 500) {
                        endIdx = nextBreak + 2;
                    }
                }
                chunks.push(textToProcess.substring(currentIdx, endIdx));
                currentIdx = endIdx;
            }

            setUploadProgress({ current: 0, total: chunks.length });

            // 2. Call AI API in parallel for all chunks
            const results = await Promise.all(chunks.map(async (chunk, index) => {
                const res = await fetch('/api/ai/generate-exam', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: chunk, type })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `Lỗi ở phần ${index + 1}`);

                setUploadProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
                return data.text;
            }));

            // 3. Merge results with delimiter
            const joinedText = results.filter(Boolean).join('\n--------------------------------------------------\n');

            setGeneratedText(joinedText);
            setStep('review');
            toast({
                title: 'Thành công',
                message: `AI đã xử lý xong ${chunks.length} phần dữ liệu!`,
                type: 'success'
            });
        } catch (err: any) {
            console.error('[AI Optimization] Error:', err);
            toast({ title: 'Lỗi AI', message: err.message, type: 'error' });
        } finally {
            setLoading(false);
            setUploadProgress(null);
        }
    };

    const handleFinalImport = async () => {
        if (!title.trim()) {
            toast({ title: 'Thiếu thông tin', message: 'Vui lòng nhập tên đề thi.', type: 'warning' });
            return;
        }

        try {
            setLoading(true);
            const questions = parseExamText(generatedText);

            if (questions.length === 0) {
                throw new Error('Không trích xuất được câu hỏi nào từ nội dung trên. Vui lòng kiểm tra định dạng.');
            }

            // Wrap questions into full exam object
            const examData = {
                title,
                time,
                subjectId,
                part1: questions.map((q, idx) => ({
                    id: idx + 1,
                    ...q
                }))
            };

            await onImport(examData);
            toast({ title: 'Thành công', message: `Đã tạo đề "${title}" với ${questions.length} câu hỏi.`, type: 'success' });

            onClose();
            setStep('upload');
            setExtractedText('');
            setGeneratedText('');
            setTitle('');
        } catch (err: any) {
            toast({ title: 'Lỗi Import', message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} className="max-w-4xl">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Wand2 className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold">Soạn đề thông minh v2.0</h3>
                    <p className="text-sm text-muted-foreground">Tự động trích xuất Ảnh & Công thức từ Word/PDF</p>
                </div>
            </div>

            {step === 'upload' ? (
                <div className="space-y-4">
                    <div
                        onClick={() => !loading && fileInputRef.current?.click()}
                        className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-10 transition-all hover:bg-accent cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".pdf,.docx,.txt"
                            className="hidden"
                        />
                        {loading && uploadProgress ? (
                            <div className="flex flex-col items-center animate-pulse">
                                {uploadProgress.total > 1 ? (
                                    <>
                                        <Wand2 className="h-10 w-10 text-primary mb-2" />
                                        <p className="text-sm font-medium">AI đang xử lý phần {uploadProgress.current}/{uploadProgress.total}...</p>
                                    </>
                                ) : (
                                    <>
                                        <ImageIcon className="h-10 w-10 text-primary mb-2" />
                                        <p className="text-sm font-medium">Đang xử lý hình ảnh ({uploadProgress.current})...</p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                <Upload className="mb-4 h-10 w-10 text-muted-foreground group-hover:text-primary" />
                                <p className="text-sm font-medium">Click để tải lên đề Word/PDF</p>
                                <p className="text-xs text-muted-foreground mt-1">Hỗ trợ trích xuất ảnh trực tiếp từ Word</p>
                            </>
                        )}
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Hoặc dán văn bản kèm ảnh</span></div>
                    </div>

                    <textarea
                        value={extractedText}
                        onChange={(e) => setExtractedText(e.target.value)}
                        placeholder="Dán nội dung từ Word/Web vào đây (bao gồm cả link ảnh)..."
                        rows={10}
                        className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-primary transition-all font-mono"
                    />

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose}>Hủy</Button>
                        <Button
                            onClick={handleGenerateAI}
                            isLoading={loading}
                            disabled={!extractedText.trim()}
                            className="bg-gradient-to-r from-primary to-purple-600 border-none text-white px-8"
                        >
                            <Wand2 className="h-4 w-4 mr-2" /> Soạn đề với Gemini 2.5
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-500" /> Kết quả cấu trúc hóa (Review)
                        </h4>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>Quay lại</Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border">
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Tên đề thi</label>
                            <input
                                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ví dụ: Đề thi thử THPT Quốc gia 2025"
                                className="w-full bg-background border px-3 py-2 rounded outline-none focus:border-primary text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Môn học</label>
                            <select
                                value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
                                className="w-full bg-background border px-3 py-2 rounded outline-none focus:border-primary text-sm"
                            >
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Thời gian</label>
                            <input
                                type="number" value={time} onChange={(e) => setTime(Number(e.target.value))}
                                className="w-full bg-background border px-3 py-2 rounded outline-none focus:border-primary text-sm"
                            />
                        </div>
                    </div>

                    <div className="relative group">
                        <textarea
                            value={generatedText}
                            onChange={(e) => setGeneratedText(e.target.value)}
                            rows={15}
                            className="w-full rounded-lg border border-input bg-slate-950 text-slate-200 p-4 text-sm font-mono outline-none focus:border-primary leading-relaxed"
                        />
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded">
                                * = Đáp án đúng | LaTeX: $...$ | Image: ![...]
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg bg-blue-50 p-3 border border-blue-200 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div className="text-[11px] text-blue-800 space-y-1">
                            <p><strong>Mẹo:</strong> Anh có thể chỉnh sửa trực tiếp nội dung trên. Đảm bảo mỗi câu bắt đầu với <code className="bg-blue-200 px-1 rounded">[Question]</code>.</p>
                            <p>Các công thức $\LaTeX$ sẽ được tự động hiển thị trên giao diện bài thi.</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setStep('upload')}>Hủy</Button>
                        <Button
                            onClick={handleFinalImport}
                            isLoading={loading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            Xác nhận & Nhập kho dữ liệu
                        </Button>
                    </div>
                </div>
            )}
        </Dialog>
    );
}

