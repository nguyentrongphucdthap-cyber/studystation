import React, { useState, useRef } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Upload, Wand2 } from 'lucide-react';
import { getSubjects } from '@/services/exam.service';
import { generateAIContent } from '@/services/ai.service';
import * as mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const IMGBB_API_KEY = "cba4af8f08a1654c46570add6d3f1055";

interface SmartImportDialogProps {
    open: boolean;
    onClose: () => void;
    onImport: (data: any) => Promise<void>;
    type: 'practice' | 'etest' | 'vocab';
    initialSubjectId?: string | null;
}

// ──────────────────────────────────────────────────────────
// AI SYSTEM PROMPTS for different types
// ──────────────────────────────────────────────────────────

const PROMPTS = {
    practice: `Bạn là chuyên gia phân tích đề thi THPT Việt Nam. Nhiệm vụ: đọc đề thi và xuất ra JSON.

CẤU TRÚC ĐỀ THI:
- Phần I (I): MCQ → part1. Đáp án A. B. C. D. "correct" là index 0-3.
- Phần II (II): Đúng/Sai → part2. Mỗi câu có ý a) b) c) d). Mỗi ý là subQuestion với "correct" là true/false.
- Phần III (III): Trả lời ngắn → part3. Câu hỏi tính toán, kết quả. "correct" là string.

QUY TẮC CÔNG THỨC & VĂN BẢN (CỰC KỲ QUAN TRỌNG):
- TẤT CẢ các biểu thức toán/lý/hóa, số kèm đơn vị (VD: $10\\text{ V}$, $50\\text{ Hz}$, $0.5\\text{ m/s}$), các ký hiệu độc lập ($x$, $t$, $\\pi$, $\\Omega$), và phương trình dài (VD: $x = 100\\sqrt{2}\\cos(100\\pi t + \\pi/4)\\text{ cm}$) BẮT BUỘC phải được bọc trọn vẹn trong thẻ LaTeX \`$\`...\`$\` hoặc \`$$\`...\`$$\`. KHÔNG ĐƯỢC để nội dung toán học nằm trơ trọi dưới dạng text thường.
- Đốivới đơn vị đứng cạnh số, dùng \`\\text{}\` bên trong LaTeX, ví dụ: $100\\text{ V}$.
- NẾU HÌNH ẢNH LÀ CÔNG THỨC TOÁN HỌC: TUYỆT ĐỐI KHÔNG sao chép thẻ hình ảnh \`![...](url)\`. Thay vào đó, bạn PHẢI tự động "đọc" nội dung trong ảnh và gõ lại toàn bộ công thức đó bằng mã LaTeX. CHỈ GIỮ LẠI thẻ hình ảnh nếu đó là một biểu đồ, đồ thị, hoặc bức tranh minh họa thực sự.
- TUYỆT ĐỐI KHÔNG dùng dấu "/" để biểu diễn phân số (VD: không viết 1/2). BẮT BUỘC dùng LaTeX \`\\frac{1}{2}\` cho mọi phân số.
- Các công thức toán học phải được viết đẹp và chuẩn LaTeX (vd: dùng \`\\sqrt{}\`, \`\\pi\`, \`\\cos\`, \`\\Omega\`, v.v...).
- QUAN TRỌNG: Trong chuỗi JSON, BẤT KỲ ký tự gạch chéo ngược (\\) nào CŨNG PHẢI ĐƯỢC NHÂN ĐÔI thành (\\\\). Tức là viết \`\\\\frac\`, \`\\\\sqrt\`, \`\\\\cos\`, \`\\\\pi\`, KHÔNG BAO GIỜ viết \`\\frac\`. Việc quên nhân đôi dấu \\ sẽ làm lỗi toàn bộ hệ thống. Mọi ký hiệu LaTeX đều phải đính kèm \\\\ ở trước.
- Việc thiếu sót câu hỏi là KHÔNG CHẤP NHẬN ĐƯỢC. Đề thi có bao nhiêu câu phải TRÍCH XUẤT ĐẦY ĐỦ bấy nhiêu câu.
- TUYỆT ĐỐI KHÔNG dùng dấu ngoặc kép thẳng (") ở giữa nội dung các trường text vì sẽ làm hỏng JSON. Nếu cần trích dẫn, hãy dùng dấu nháy đơn (') hoặc ngoặc kép cong (“ ”).
- Các chuỗi phải viết trên CÙNG MỘT DÒNG. Dùng "\\\\n" nếu cần xuống dòng, TUYỆT ĐỐI KHÔNG ấn Enter tạo dòng mới bên giữa chuỗi JSON.
  + ĐẶC BIỆT (Xử lý chuỗi dọc): Nếu thấy dữ liệu bị liệt kê rời rạc theo hàng dọc (ví dụ trích xuất từ PDF bị lỗi layout thành từng dòng rời rạc, có nhiều newline ở giữa), bạn PHẢI TỰ GHÉP chúng lại thành bảng hoàn chỉnh.
  Ví dụ: "Quần thể, A, B, C, Diện tích, 25, 240, 193, Mật độ, 10, 15, 20" ->
  | Quần thể | A | B | C |
  |---|---|---|---|
  | Diện tích | 25 | 240 | 193 |
  | Mật độ | 10 | 15 | 20 |
  + Bảng Markdown chuẩn:
  | Đặc điểm | Quần thể A | Quần thể B |
  |---|---|---|
  | Diện tích | 25 ha | 240 ha |
- HÌNH ẢNH: Nếu hình ảnh là biểu đồ/đồ thị/minh họa (KHÔNG phải công thức), BẮT BUỘC phải copy y nguyên link thẻ hình (Markdown '![...](url)'). VỊ TRÍ ĐẶT ẢNH: Đặt vào cuối thuộc tính "text" của CÂU HỎI CHÍNH. TUY NHIÊN, NẾU hình ảnh đó chính là MỘT ĐÁP ÁN (A, B, C, D) hoặc nằm trong Ý TRẢ LỜI của đúng/sai, thì ĐƯỢC PHÉP dán thẻ hình ảnh đó vào mảng "options" hoặc thuộc tính "text" của "subQuestions".
- KHÔNG ĐƯỢC tự ý bỏ qua các bảng số liệu. Bảng số liệu là một phần của câu hỏi.

JSON FORMAT (PHẢI TUÂN THỦ TUYỆT ĐỐI):
{
  "part1": [{ "id": 1, "text": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..." }],
  "part2": [{ "id": 1, "text": "...", "subQuestions": [{ "id": "a", "text": "...", "correct": true }] }],
  "part3": [{ "id": 1, "text": "...", "correct": "10" }]
}
QUY TẮC CỰC KỲ QUAN TRỌNG:
1. Phải có dấu phẩy (,) ngăn cách giữa các đối tượng trong mảng và giữa các thuộc tính.
2. KHÔNG được có dấu phẩy dư ở cuối mảng hoặc cuối đối tượng.
3. Chỉ xuất JSON thuần, không giải thích gì thêm.`,

    etest: `Bạn là chuyên gia phân tích đề thi tiếng Anh. Nhiệm vụ: trích xuất nội dung và xuất JSON.
    
CẤU TRÚC:
- "passage": Nội dung bài đọc. Nếu bài đọc có BẢNG SỐ LIỆU (kể cả khi bị liệt kê rời rạc theo hàng dọc), bạn BẮT BUỘC phải dùng Markdown table để tái cấu trúc lại.

JSON FORMAT:
{
  "sections": [
    {
      "passage": "...",
      "questions": [
        { "id": 1, "text": "...", "options": ["A", "B", "C", "D"], "correct": 0 }
      ]
    }
  ]
}
Chỉ xuất JSON thuần.`,

    vocab: `Trích xuất từ vựng từ văn bản và xuất JSON.
JSON FORMAT:
{
  "words": [
    { "word": "apple", "meaning": "quả táo", "example": "I eat an apple.", "pronunciation": "/ˈæp.əl/", "partOfSpeech": "noun" }
  ]
}
Chỉ xuất JSON thuần.`
};

const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*]\(([^)]+)\)/g;

function toMarkdownImage(imageValue: unknown): string {
    if (typeof imageValue !== 'string') return '';
    const trimmed = imageValue.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('![')) return trimmed;
    return `![image](${trimmed})`;
}

function appendImageToText(text: unknown, imageValue: unknown): string {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    const markdownImage = toMarkdownImage(imageValue);
    if (!markdownImage) return normalizedText;

    const existingImages = Array.from(normalizedText.matchAll(MARKDOWN_IMAGE_REGEX), (match) => match[0]);
    if (existingImages.includes(markdownImage)) {
        return normalizedText;
    }

    return normalizedText ? `${normalizedText}\n\n${markdownImage}` : markdownImage;
}

function normalizeImportedExamData(data: any) {
    const normalized = structuredClone(data);

    if (Array.isArray(normalized.part1)) {
        normalized.part1 = normalized.part1.map((q: any) => {
            const newQ = {
                ...q,
                text: appendImageToText(q?.text, q?.image),
                options: Array.isArray(q?.options) ? q.options.slice(0, 4) : ['', '', '', ''],
            };
            delete newQ.image;
            return newQ;
        });
    }

    if (Array.isArray(normalized.part2)) {
        normalized.part2 = normalized.part2.map((q: any) => {
            const newQ = {
                ...q,
                text: appendImageToText(q?.text, q?.image),
                subQuestions: Array.isArray(q?.subQuestions) ? q.subQuestions : [],
            };
            delete newQ.image;
            return newQ;
        });
    }

    if (Array.isArray(normalized.part3)) {
        normalized.part3 = normalized.part3.map((q: any) => {
            const newQ = {
                ...q,
                text: appendImageToText(q?.text, q?.image),
            };
            delete newQ.image;
            return newQ;
        });
    }

    return normalized;
}

export function SmartImportDialog({ open, onClose, onImport, type, initialSubjectId }: SmartImportDialogProps) {
    const { toast } = useToast();
    const [step, setStep] = useState<'upload' | 'review'>('upload');
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [time, setTime] = useState(50);
    const [subjectId, setSubjectId] = useState<string>(initialSubjectId || 'toan');
    const [extractedText, setExtractedText] = useState('');
    const [jsonPreview, setJsonPreview] = useState('');
    const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const subjects = getSubjects();



    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            let text = '';
            const fileName = file.name.toLowerCase();

            if (fileName.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await (mammoth as any).convertToMarkdown({ arrayBuffer }, {
                    convertImage: (mammoth.images as any).inline((element: any) => {
                        return element.read("base64").then(async (imageBuffer: string) => {
                             try {
                                const blob = await (await fetch(`data:${element.contentType};base64,${imageBuffer}`)).blob();
                                const formData = new FormData();
                                formData.append('key', IMGBB_API_KEY);
                                formData.append('image', blob);
                                const imgRes = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
                                if (imgRes.ok) {
                                    const imgData = await imgRes.json();
                                    return { src: imgData.data.url };
                                }
                             } catch (e) {
                                console.warn("Failed to upload image to ImgBB", e);
                             }
                             return { src: `data:${element.contentType};base64,${imageBuffer}` };
                        });
                    })
                });
                text = result.value;
            } else if (fileName.endsWith('.pdf')) {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content: any = await page.getTextContent();
                    const pageText = content.items
                        .map((item: any) => item.str || '')
                        .join(' ');
                    fullText += pageText + '\n\n';
                }
                text = fullText;
            } else if (fileName.endsWith('.txt')) {
                text = await file.text();
            } else {
                throw new Error("Định dạng file không hỗ trợ. Vui lòng dùng PDF, DOCX hoặc TXT.");
            }

            if (!text || !text.trim()) throw new Error('File rỗng hoặc không thể trích xuất.');
            setExtractedText(text);
            if (!title) setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' '));
            toast({ title: '✅ Đã đọc file', type: 'info' });
        } catch (err: any) {
            toast({ title: 'Lỗi', message: err.message, type: 'error' });
        } finally {
            setLoading(false);
            setUploadProgress(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const robustJSONParse = (jsonStr: string) => {
        let cleaned = jsonStr.trim();
        
        // Remove possible markdown wrappers
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }

        try {
            return JSON.parse(cleaned);
        } catch (e: any) {
            console.warn('[SmartImport] Initial parse failed, attempting structural repair:', e.message);
            
            let repaired = cleaned;

            // 1. Fix unescaped backslashes in LaTeX (avoid breaking valid escapes)
            // Replace any single backslash that isn't part of a known explicitly requested JSON escape like \n or \t
            // We only want to keep literal \n, \t, \", \\. We should escape others.
            repaired = repaired.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
            
            // For LaTeX commands that happen to start with n, r, t (like \neq, \rightarrow, \tan)
            // If they are unescaped, JSON.parse will treat \n as newline, and \neq as <newline>eq.
            // Instead of trying to regex everything, we must ensure the prompt asks for \\.
            
            // 2. Fix unescaped newlines inside strings
            repaired = repaired.replace(/"([^"]*)"/g, (_match, p1) => {
                return '"' + p1.replace(/\n/g, '\\n') + '"';
            });
            
            // 3. Fix missing commas between objects/arrays: } { -> }, {
            repaired = repaired.replace(/\}\s*\{/g, '}, {');
            repaired = repaired.replace(/\]\s*\[/g, '], [');
            repaired = repaired.replace(/\}\s*\[/g, '}, [');
            repaired = repaired.replace(/\]\s*\{/g, '], {');
            
            // 4. Remove trailing commas before closing braces/brackets
            repaired = repaired.replace(/,\s*\}/g, '}');
            repaired = repaired.replace(/,\s*\]/g, ']');

            // 5. Try to fix truncated JSON by closing open brackets/braces
            const stack: ( '{' | '[' )[] = [];
            for (let i = 0; i < repaired.length; i++) {
                if (repaired[i] === '{') stack.push('{');
                else if (repaired[i] === '[') stack.push('[');
                else if (repaired[i] === '}') stack.pop();
                else if (repaired[i] === ']') stack.pop();
            }
            while (stack.length > 0) {
                const last = stack.pop();
                repaired += last === '{' ? '}' : ']';
            }

            try {
                return JSON.parse(repaired);
            } catch (err2: any) {
                console.error('[SmartImport] Structural repair failed:', err2.message);
                // Return original error but with better context
                const pos = err2.message.match(/position (\d+)/)?.[1] || e.message.match(/position (\d+)/)?.[1] || '?';
                throw new Error(`JSON Error: ${e.message}. Vị trí: ${pos}. Có thể file quá dài hoặc AI bị ngắt quãng.`);
            }
        }
    };

    const handleGenerateAI = async () => {
        if (!extractedText.trim()) return;
        setLoading(true);
        try {
            const response = await generateAIContent([
                { role: 'user', parts: [{ text: `NỘI DUNG:\n${extractedText}` }] }
            ], {
                systemInstruction: PROMPTS[type] || PROMPTS.practice,
                temperature: 0.1,
                maxOutputTokens: 32768, // Allow up to 32k tokens to prevent truncation of long documents
                responseMimeType: "application/json"
            });

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('AI không trả về JSON hợp lệ.');
            
            const parsed = normalizeImportedExamData(robustJSONParse(jsonMatch[0]));
            setJsonPreview(JSON.stringify(parsed, null, 2));
            setStep('review');
            toast({ title: '✅ Phân tích xong', type: 'success' });
        } catch (err: any) {
            toast({ title: 'Lỗi AI', message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleFinalImport = async () => {
        if (!title.trim() && type !== 'vocab') {
            toast({ title: 'Thiếu tiêu đề', type: 'warning' });
            return;
        }
        try {
            const data = normalizeImportedExamData(robustJSONParse(jsonPreview));
            
            // Re-index all IDs to guarantee absolute uniqueness and sequential order
            let globalId = 1;
            if (Array.isArray(data.part1)) {
                data.part1.forEach((q: any) => { q.id = globalId++; });
            }
            if (Array.isArray(data.part2)) {
                data.part2.forEach((q: any) => {
                    q.id = globalId++;
                    if (Array.isArray(q.subQuestions)) {
                        q.subQuestions.forEach((sq: any, j: number) => {
                            sq.id = String.fromCharCode(97 + j); // 'a', 'b', 'c', 'd'
                        });
                    }
                });
            }
            if (Array.isArray(data.part3)) {
                data.part3.forEach((q: any) => { q.id = globalId++; });
            }

            await onImport({
                title,
                time,
                subjectId,
                ...data
            });
            toast({ title: 'Thành công!', type: 'success' });
            onClose();
            setStep('upload');
            setExtractedText('');
            setTitle('');
        } catch (err: any) {
            toast({ title: 'Lỗi', message: err.message, type: 'error' });
        }
    };

    return (
        <Dialog open={open} onClose={onClose} className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <div className="flex items-center gap-3 p-6 border-b bg-muted/20 shrink-0">
                <div className="p-2 rounded-xl bg-primary/10 text-primary"><Wand2 className="h-5 w-5" /></div>
                <div>
                    <h3 className="text-lg font-bold">Smart Import v3.1 ({type})</h3>
                    <p className="text-sm text-muted-foreground">Tự động nhận diện cấu trúc & công thức</p>
                </div>
                <div className="ml-auto flex gap-1.5">
                    {['upload', 'review'].map((s) => (
                        <div key={s} className={`h-1.5 rounded-full ${step === s ? 'w-8 bg-primary' : 'w-4 bg-muted'}`} />
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {step === 'upload' ? (
                    <div className="space-y-5">
                        <div
                            onClick={() => !loading && fileInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 hover:bg-primary/5 cursor-pointer transition-all ${loading ? 'opacity-50' : ''}`}
                        >
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,.txt" className="hidden" />
                            {loading && uploadProgress ? (
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                            ) : (
                                <>
                                    <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                                    <p className="text-sm font-semibold">Tải lên Word hoặc PDF</p>
                                </>
                            )}
                        </div>

                        <textarea
                            value={extractedText}
                            onChange={(e) => setExtractedText(e.target.value)}
                            placeholder="Hoặc dán văn bản vào đây..."
                            rows={10}
                            className="w-full rounded-xl border p-4 text-sm font-mono outline-none focus:border-primary"
                        />

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={onClose}>Hủy</Button>
                            <Button onClick={handleGenerateAI} isLoading={loading} disabled={!extractedText.trim()}>Phân tích AI</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-xl border">
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Tiêu đề</label>
                                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-md px-3 py-1.5 text-sm" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Môn học</label>
                                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full border rounded-md px-3 py-1.5 text-sm">
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Thời gian</label>
                                <input type="number" value={time} onChange={(e) => setTime(Number(e.target.value))} className="w-full border rounded-md px-3 py-1.5 text-sm" />
                            </div>
                        </div>

                        <textarea
                            value={jsonPreview}
                            onChange={(e) => setJsonPreview(e.target.value)}
                            rows={15}
                            className="w-full rounded-xl border bg-slate-900 text-slate-100 p-4 text-xs font-mono outline-none"
                        />

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setStep('upload')}>Quay lại</Button>
                            <Button onClick={handleFinalImport} className="bg-emerald-600 hover:bg-emerald-700 text-white">Xác nhận nhập kho</Button>
                        </div>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
