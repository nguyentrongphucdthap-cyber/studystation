import React, { useState, useRef } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { Upload, Wand2, Eye, Code, Shield, Mail, FolderOpen, Clock, FileText } from 'lucide-react';
import { getAllExams } from '@/services/exam.service';
import { LatexContent } from '@/components/ui/LatexContent';
import { FormattedText } from '@/components/ui/FormattedText';
import { generateAIContent } from '@/services/ai.service';
import * as mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
// Configure PDF.js worker securely for Vite
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
const pdfjsOPS = (pdfjs as any).OPS || {};

import { 
    robustJSONParse, 
    sanitizeForFirestore, 
    getPdfObjAsync, 
    convertPdfImageToBlob,
    normalizeImportedExamData
} from '@/lib/smartImportUtils';

const IMGBB_API_KEY = "cba4af8f08a1654c46570add6d3f1055";

interface SmartImportDialogProps {
    open: boolean;
    onClose: () => void;
    onImport: (data: any) => Promise<void>;
    type: 'practice' | 'etest' | 'vocab';
    initialSubjectId?: string | null;
    initialFolderPath?: string;
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
- ĐẶC BIỆT VỚI HÓA HỌC: Các công thức hóa học, phương trình phản ứng BẮT BUỘC phải dùng lệnh \`\\ce{...}\` và bọc trong cặp dấu $...$. Ví dụ: \`$\\ce{H2O}$\`, \`$\\ce{Fe + CuSO4 -> FeSO4 + Cu}$\`. TUYỆT ĐỐI không viết trơn như H2O hay Fe + CuSO4.
- CẤU HÌNH ELECTRON: Tương tự hóa học, bọc trong $...$, ví dụ \`$1s^{2} 2s^{2} 2p^{6}$\`. Với cấu hình thu gọn có ngoặc vuông, TUYỆT ĐỐI KHÔNG thêm gạch chéo ngược cho ngoặc vuông. Viết đúng là: \`$[Ne] 3s^{2} 3p^{5}$\`. KHÔNG viết \`\\[Ne\\]\`.
- Đối với đơn vị đứng cạnh số, dùng \`\\text{}\` bên trong LaTeX, ví dụ: $100\\text{ V}$.
- NẾU HÌNH ẢNH LÀ CÔNG THỨC TOÁN/HÓA HỌC: TUYỆT ĐỐI KHÔNG sao chép thẻ hình ảnh \`![...](url)\`. Thay vào đó, bạn PHẢI tự động "đọc" nội dung trong ảnh và gõ lại toàn bộ công thức đó bằng mã LaTeX chuẩn. CHỈ GIỮ LẠI thẻ hình ảnh nếu đó là một biểu đồ, đồ thị, hoặc bức tranh minh họa thực sự.
- TUYỆT ĐỐI KHÔNG dùng dấu "/" để biểu diễn phân số (VD: không viết 1/2). BẮT BUỘC dùng LaTeX \`\\frac{1}{2}\` cho mọi phân số.
- Các công thức toán học phải được viết đẹp và chuẩn LaTeX (vd: dùng \`\\sqrt{}\`, \`\\pi\`, \`\\cos\`, \`\\Omega\`, v.v...).
- QUAN TRỌNG: Trong chuỗi JSON, BẤT KỲ ký tự gạch chéo ngược (\\) nào CŨNG PHẢI ĐƯỢC NHÂN ĐÔI thành (\\\\). Tức là viết \`\\\\ce\`, \`\\\\frac\`, \`\\\\sqrt\`, KHÔNG BAO GIỜ viết \`\\ce\`, \`\\frac\`. Việc quên nhân đôi dấu \\ sẽ làm lỗi toàn bộ hệ thống.
- Tuyệt đối KHÔNG được "thoát" (escape) các dấu ngoặc vuông \`[\` và \`]\` bằng gạch chéo ngược.
- DỮ LIỆU ĐẦY ĐỦ: Việc thiếu sót câu hỏi là KHÔNG CHẤP NHẬN ĐƯỢC. Bạn PHẢI trích xuất 100% số lượng câu hỏi có trong văn bản. Nếu văn bản quá dài, hãy nỗ lực chia nhỏ để không bỏ sót bất kỳ câu nào. Mỗi lần bỏ sót một câu hỏi là bạn đã thất bại nhiệm vụ.
- TUYỆT ĐỐI KHÔNG dùng dấu ngoặc kép thẳng (") ở giữa nội dung các trường text vì sẽ làm hỏng JSON. Nếu cần trích dẫn, hãy dùng dấu nháy đơn (') hoặc ngoặc kép cong (“ ”).
- Các chuỗi phải viết trên CÙNG MỘT DÒNG. Dùng "\\\\n" nếu cần xuống dòng, TUYỆT ĐỐI KHÔNG ấn Enter tạo dòng mới bên giữa chuỗi JSON.
- ĐẶC BIỆT (Xử lý chuỗi dọc): Nếu thấy dữ liệu bị liệt kê rời rạc theo hàng dọc (ví dụ trích xuất từ PDF bị lỗi layout thành từng dòng rời rạc, có nhiều newline ở giữa), bạn PHẢI TỰ GHÉP chúng lại thành cấu trúc hoàn chỉnh (bảng hoặc đoạn văn).
  Ví dụ: "Quần thể, A, B, C, Diện tích, 25, 240, 193, Mật độ, 10, 15, 20" ->
  | Quần thể | A | B | C |
  |---|---|---|---|
  | Diện tích | 25 | 240 | 193 |
  | Mật độ | 10 | 15 | 20 |
  + Bảng Markdown chuẩn:
  | Đặc điểm | Quần thể A | Quần thể B |
  |---|---|---|
  | Diện tích | 25 ha | 240 ha |
- HÌNH ẢNH (QUAN TRỌNG NHẤT): Trong văn bản gốc có chứa các mã định danh dạng \`[[ANH_X.._Y..]]\`. Trong đó X và Y là tọa độ phần trăm (%) tính từ góc trên bên trái của trang giấy.
- QUY TẮC GÁN ẢNH: 
    + Nếu một mã nằm cùng "hàng" với văn bản (Y tương đương) nhưng X lớn (ví dụ X > 60), nó thường là hình minh họa nằm BÊN PHẢI đoạn văn hoặc câu hỏi đó. Hãy gán ảnh này vào ngay chính câu hỏi đó.
    + Nếu một mã nằm ở đầu hoặc cuối câu hỏi, hãy giữ lại nó trong trường "image" hoặc chèn vào văn bản.
- LOẠI BỎ LOGO: Nếu mã có Y < 8 (Header) hoặc Y > 92 (Footer), hoặc X < 8 hoặc X > 92, hãy cân nhắc xem đó có phải Logo nhãn hiệu không. Nếu đúng hãy BỎ QUA hoàn toàn.
- KHÔNG ĐƯỢC tự ý bỏ qua các bảng số liệu. Bảng số liệu là một phần của câu hỏi.

JSON FORMAT:
{
  "title": "...",
  "time": 50,
  "part1": [
    { "question": "...", "options": ["A", "B", "C", "D"], "answer": 0 }
  ],
  "part2": [
    { "question": "...", "subQuestions": [
      { "text": "a) ...", "answer": true },
      { "text": "b) ...", "answer": false },
      { "text": "c) ...", "answer": true },
      { "text": "d) ...", "answer": false }
    ]}
  ],
  "part3": [
    { "question": "...", "answer": "đáp án" }
  ]
}
QUY TẮC ĐỊNH DẠNG (BẮT BUỘC):
- Giữ nguyên định dạng gạch chân (__word__) và in đậm (**word**) từ văn bản gốc.
- CHỈ TRÍCH XUẤT CÁC CÂU HỎI TRỰC TIẾP, BỎ QUA CÁC ĐOẠN VĂN DẪN NẾU CHÚNG KHÔNG PHẢI LÀ MỘT PHẦN CỦA CÂU HỎI.
Chỉ xuất JSON thuần.`,

    etest: `Bạn là chuyên gia phân tích đề thi tiếng Anh. Nhiệm vụ: trích xuất nội dung và xuất JSON.
    
CẤU TRÚC:
- "passage": Nội dung bài đọc. Nếu bài đọc có BẢNG SỐ LIỆU (kể cả khi bị liệt kê rời rạc theo hàng dọc), bạn BẮT BUỘC phải dùng Markdown table để tái cấu trúc lại.
- HÌNH ẢNH: Bạn PHẢI giữ lại nguyên vẹn các mã định danh dạng \`[[IMG_N]]\` và đặt chúng vào đúng vị trí trong "passage" hoặc "text" của câu hỏi. KHÔNG được xóa bỏ các mã này trừ khi đó là logo trang trí (Header/Footer).

JSON FORMAT:
{
  "title": "...",
  "time": 50,
  "sections": [
    {
      "passage": "...",
      "questions": [
        { "id": 1, "question": "...", "options": ["A", "B", "C", "D"], "answer": 0 }
      ]
    }
  ]
}
QUY TẮC ĐỊNH DẠNG (BẮT BUỘC):
- BẮT BUỘC giữ nguyên định dạng gạch chân (__word__) và in đậm (**word**) từ văn bản gốc, đặc biệt là trong các câu hỏi tìm lỗi sai hoặc câu hỏi về từ vựng.
- Nếu câu hỏi yêu cầu "chọn từ có phần gạch chân phát âm khác", hãy đảm bảo phần gạch chân đó được bao bởi dấu __.
Chỉ xuất JSON thuần.`,

    vocab: `Bạn là trợ lý học tập thông minh. Nhiệm vụ: trích xuất danh sách thẻ học (flashcards) từ văn bản và xuất JSON.
    
QUY TẮC CẤU TRÚC THẺ (QUAN TRỌNG):
- "word" (Mặt trước): Là thuật ngữ, từ vựng, câu hỏi hoặc công thức cần học.
- "meaning" (Mặt sau): Là định nghĩa, lời giải, nội dung trả lời cho mặt trước.
- "example": Ví dụ minh họa (nếu có).
- "notes": Ghi chú, chú thích bổ sung.
- "pronunciation": Phiên âm (ưu tiên môn Tiếng Anh). 
- "partOfSpeech": Loại từ (danh từ, động từ...) hoặc phân loại thẻ (định nghĩa, định lý...).

QUY TẮC NỘI DUNG & CÔNG THỨC:
- TẤT CẢ công thức toán, lý, hóa BẮT BUỘC bọc trong cặp dấu $...$ hoặc $$...$$.
- Hỗ trợ đa môn học: Toán, Lý, Hóa, Sinh, Sử, Địa, Tiếng Anh...
- Nếu là môn Tiếng Anh: Hãy trích xuất đầy đủ phiên âm và loại từ.
- Nếu là các môn tự nhiên: Tập trung vào công thức và định nghĩa chính xác.

JSON FORMAT:
{
  "title": "Tiêu đề bộ thẻ phù hợp",
  "category": "Tag1, Tag2 (ngăn cách bởi dấu phẩy)",
  "words": [
    { 
      "question": "Term/Question/Formula", 
      "meaning": "Definition/Answer", 
      "example": "Contextual example", 
      "notes": "Extra info",
      "pronunciation": "/.../", 
      "partOfSpeech": "noun/verb/theorem/...",
      "image": "URL hình ảnh nếu có (từ thẻ Markdown ![...](url), hãy trích xuất đúng phần url vào đây)"
    }
  ]
}
Chỉ xuất JSON thuần.`
};



// ──────────────────────────────────────────────────────────
// PREVIEW COMPONENTS
// ──────────────────────────────────────────────────────────

const QuestionPreview = ({ question, index, type }: { question: any, index: number, type: string }) => {
    return (
        <div className="p-4 rounded-xl border bg-white shadow-sm space-y-3">
            <div className="flex gap-2">
                <span className="font-bold text-indigo-600 shrink-0">Câu {index + 1}:</span>
                <div className="flex-1 overflow-hidden">
                    <LatexContent content={question.text || question.question || question.word || ''} />
                </div>
            </div>

            {type === 'part1' && question.options && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-8">
                    {['A', 'B', 'C', 'D'].map((opt, i) => (
                        <div key={opt} className={cn(
                            "p-2 rounded-lg border text-sm flex gap-2",
                            (question.correct === i || question.answer === i || question.answer === opt) ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-100"
                        )}>
                            <span className="font-bold">{opt}.</span>
                            <LatexContent content={question.options[i] || ''} />
                        </div>
                    ))}
                </div>
            )}

            {type === 'part2' && question.subQuestions && (
                <div className="pl-8 space-y-3">
                    {question.subQuestions.map((sub: any, subIdx: number) => (
                        <div key={subIdx} className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-sm">
                            <div className="flex gap-2 mb-2">
                                <span className="font-bold text-slate-500">{String.fromCharCode(97 + subIdx)}.</span>
                                <LatexContent content={sub.text || ''} />
                            </div>
                            <div className="flex gap-4 pl-6">
                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", (sub.correct === true || sub.answer === 'Đúng') ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>Đúng</span>
                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", (sub.correct === false || sub.answer === 'Sai') ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>Sai</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {type === 'part3' && (
                <div className="pl-8">
                    <div className="p-2 rounded-lg border border-emerald-100 bg-emerald-50/50 text-sm italic text-emerald-700">
                        Đáp án: <LatexContent content={String(question.correct || question.answer || '')} />
                    </div>
                </div>
            )}

            {question.explanation && (
                <div className="mt-2 pl-8 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-dashed">
                    <span className="font-bold uppercase block mb-1">Giải thích:</span>
                    <FormattedText text={question.explanation} />
                </div>
            )}
        </div>
    );
};

const ExamPreview = ({ data }: { data: any }) => {
    if (!data) return <div className="p-10 text-center text-slate-400">Không có dữ liệu hiển thị</div>;

    return (
        <div className="space-y-8 pb-10">
            {data.part1?.length > 0 && (
                <div className="space-y-4">
                    <h4 className="font-black text-sm uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <span className="h-px flex-1 bg-slate-100" />
                        PHẦN 1: Trắc nghiệm (A, B, C, D)
                        <span className="h-px flex-1 bg-slate-100" />
                    </h4>
                    {data.part1.map((q: any, i: number) => <QuestionPreview key={i} question={q} index={i} type="part1" />)}
                </div>
            )}

            {data.part2?.length > 0 && (
                <div className="space-y-4">
                    <h4 className="font-black text-sm uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <span className="h-px flex-1 bg-slate-100" />
                        PHẦN 2: Đúng / Sai
                        <span className="h-px flex-1 bg-slate-100" />
                    </h4>
                    {data.part2.map((q: any, i: number) => <QuestionPreview key={i} question={q} index={i} type="part2" />)}
                </div>
            )}

            {data.part3?.length > 0 && (
                <div className="space-y-4">
                    <h4 className="font-black text-sm uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <span className="h-px flex-1 bg-slate-100" />
                        PHẦN 3: Trả lời ngắn
                        <span className="h-px flex-1 bg-slate-100" />
                    </h4>
                    {data.part3.map((q: any, i: number) => <QuestionPreview key={i} question={q} index={i} type="part3" />)}
                </div>
            )}

            {/* Vocab Preview */}
            {data.words?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.words.map((w: any, i: number) => (
                        <div key={i} className="p-4 rounded-xl border bg-white shadow-sm flex gap-4">
                            {w.image && <img src={w.image} className="w-16 h-16 rounded-lg object-cover bg-slate-100" alt="" />}
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-indigo-600">{w.word}</span>
                                    {w.partOfSpeech && <span className="text-[10px] bg-slate-100 px-1.5 rounded uppercase font-bold text-slate-500">{w.partOfSpeech}</span>}
                                </div>
                                {w.pronunciation && <p className="text-xs text-slate-400 mb-1">{w.pronunciation}</p>}
                                <p className="text-sm font-medium">{w.meaning}</p>
                                {w.example && <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-1.5 rounded italic">"{w.example}"</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* E-test Preview */}
            {data.sections?.map((s: any, si: number) => (
                <div key={si} className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    <h4 className="font-bold text-indigo-600">Bài đọc {si + 1}</h4>
                    <div className="bg-white p-4 rounded-xl border text-sm leading-relaxed whitespace-pre-wrap overflow-hidden">
                        <LatexContent content={s.passage || ''} />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {s.questions?.map((q: any, qi: number) => <QuestionPreview key={qi} question={q} index={qi} type="part1" />)}
                    </div>
                </div>
            ))}
        </div>
    );
};

export function SmartImportDialog({ open, onClose, onImport, type, initialSubjectId, initialFolderPath }: SmartImportDialogProps) {
    const { toast } = useToast();
    const [step, setStep] = useState<'upload' | 'review'>('upload');
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [time, setTime] = useState(50);
    const [subjectId] = useState<string>(initialSubjectId || 'toan');
    const [customFolder, setCustomFolder] = useState(initialFolderPath || '');
    const [isSpecial, setIsSpecial] = useState(false);
    const [allowedEmails, setAllowedEmails] = useState('');
    const [availableFolders, setAvailableFolders] = useState<string[]>([]);
    const [extractedText, setExtractedText] = useState('');
    const [jsonPreview, setJsonPreview] = useState('');
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
    const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (open) {
            loadAvailableFolders();
        }
    }, [open, subjectId]);

    const loadAvailableFolders = async () => {
        try {
            const allExams = await getAllExams();
            const filtered = allExams.filter(e => e.subjectId === subjectId);
            const folders = Array.from(new Set(filtered.map(e => (e.customFolder || '').trim()).filter(Boolean)));
            setAvailableFolders(folders.sort((a, b) => a.localeCompare(b, 'vi')));
        } catch (err) {
            console.error("Failed to load folders:", err);
        }
    };



    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            let text = '';
            const fileName = file.name.toLowerCase();

            if (fileName.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await (mammoth as any).convertToHtml({ arrayBuffer }, {
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
                text = result.value
                    .replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**')
                    .replace(/<b>([\s\S]*?)<\/b>/g, '**$1**')
                    .replace(/<em>([\s\S]*?)<\/em>/g, '*$1*')
                    .replace(/<i>([\s\S]*?)<\/i>/g, '*$1*')
                    .replace(/<u>([\s\S]*?)<\/u>/g, '<u>$1</u>')
                    .replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n')
                    .replace(/<br\s*\/?>/g, '\n');
            } else if (fileName.endsWith('.pdf')) {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                let fullTextParts: string[] = [];
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const operatorList = await page.getOperatorList();
                    
                    const pageItems: { 
                        type: 'text' | 'image', 
                        content: string, 
                        x: number, 
                        y: number, 
                        topY: number, 
                        height: number 
                    }[] = [];
                    const pageWidth = page.view[2];
                    const pageHeight = page.view[3];
                    
                    textContent.items.forEach((item: any) => {
                        const h = item.height || 10;
                        pageItems.push({
                            type: 'text',
                            content: item.str,
                            x: item.transform[4],
                            y: item.transform[5],
                            topY: item.transform[5] + h,
                            height: h
                        });
                    });
                    
                    let currentTransform = [1, 0, 0, 1, 0, 0];
                    const imageTasks: Promise<void>[] = [];

                    for (let j = 0; j < operatorList.fnArray.length; j++) {
                        const fn = operatorList.fnArray[j];
                        const args = operatorList.argsArray[j];
                        
                        if (fn === pdfjsOPS.transform) {
                            currentTransform = args;
                        } else if (fn === pdfjsOPS.paintImageXObject || fn === pdfjsOPS.paintInlineImageXObject) {
                            const imgKey = args[0];
                            const imgWidth = Math.abs(currentTransform[0] || 1);
                            const imgHeight = Math.abs(currentTransform[3] || 1);
                            const posX = currentTransform[4] || 0;
                            const posY = currentTransform[5] || 0;

                            const isHeader = posY > (pageHeight || 842) * 0.9;
                            const isFooter = posY < (pageHeight || 842) * 0.05;
                            const isSmall = imgWidth < 60 && imgHeight < 60;

                            if ((isHeader || isFooter) && isSmall) continue;

                            const itemIndex = pageItems.length;
                            const sideX = Math.round((posX / (pageWidth || 595)) * 100);
                            const sideY = Math.round((1 - (posY / (pageHeight || 842))) * 100);
                            
                            pageItems.push({
                                type: 'image',
                                content: `[[PENDING_IMG_${itemIndex}]]`,
                                x: posX,
                                y: posY,
                                topY: posY + imgHeight,
                                height: imgHeight
                            });

                            const uploadTask = (async () => {
                                try {
                                    const imgData = await getPdfObjAsync(page, imgKey);
                                    if (!imgData) throw new Error('No imgData');
                                    
                                    const blob = await convertPdfImageToBlob(imgData);
                                    const formData = new FormData();
                                    formData.append('key', IMGBB_API_KEY);
                                    formData.append('image', blob);
                                    
                                    const imgRes = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
                                    if (imgRes.ok) {
                                        const imgJson = await imgRes.json();
                                    if (pageItems[itemIndex]) {
                                        pageItems[itemIndex].content = `![image](${imgJson.data.url}) [[ANH_X${sideX}_Y${sideY}]]`;
                                    }
                                    } else {
                                        throw new Error('Upload fail');
                                    }
                                } catch (err) {
                                    console.error('Lỗi upload:', err);
                                    if (pageItems[itemIndex]) {
                                        pageItems[itemIndex].content = `![lỗi]() [[ANH_X${sideX}_Y${sideY}]]`;
                                    }
                                }
                            })();
                            imageTasks.push(uploadTask);
                        }
                    }
                    
                    if (imageTasks.length > 0) {
                        await Promise.all(imageTasks).catch(e => console.warn("Some images failed", e));
                    }
                    
                    pageItems.sort((a, b) => {
                        if (Math.abs(b.topY - a.topY) > 15) {
                            return b.topY - a.topY;
                        }
                        return a.x - b.x;
                    });
                    
                    const pageContent = pageItems.map(item => item.content).join(' ');
                    fullTextParts.push(pageContent);
                }
                text = fullTextParts.join('\n\n');
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

    const handleGenerateAI = async () => {
        if (!extractedText.trim()) return;
        setLoading(true);
        try {
            // 1. Thay thế hình ảnh bằng Placeholder v2 (Super Robust) có kèm Hint vị trí
            const foundImages: string[] = [];
            // Regex linh hoạt cho cả cũ (Vị trí) và mới (X..Y..)
            const textWithPlaceholders = extractedText.replace(/(!\[.*?\]\(.*?\))/g, (_match, markdown) => {
                const placeholder = `[[IMG_${foundImages.length}]]`;
                foundImages.push(markdown);
                return placeholder;
            });


            const response = await generateAIContent([
                { role: 'user', parts: [{ text: `NỘI DUNG TRÍCH XUẤT:\n${textWithPlaceholders}\n\nLƯU Ý: Tuyệt đối giữ lại các mã [[IMG_N]] trong kết quả JSON.` }] }
            ], {
                systemInstruction: PROMPTS[type] || PROMPTS.practice,
                temperature: 0.1,
                maxOutputTokens: 32768,
                responseMimeType: "application/json"
            });

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('AI không trả về JSON hợp lệ.');
            
            // 2.3 parse
            let parsed = robustJSONParse(jsonMatch[0]);

            // 3. Khôi phục URL hình ảnh từ Placeholder (Hỗ trợ cả trường hợp AI thêm khoảng trắng hoặc xóa bớt hint)
            const restoreImages = (obj: any) => {
                if (!obj || typeof obj !== 'object') return;
                Object.keys(obj).forEach(key => {
                    if (typeof obj[key] === 'string') {
                        // Regex linh hoạt bắt IMG_N bất kể phần hint vị trí phía sau
                        obj[key] = obj[key].replace(/\[\[\s*IMG_(\d+)[^\]]*\]\]/gi, (_match: string, index: string) => {
                            const idx = parseInt(index);
                            return foundImages[idx] || _match;
                        });
                    } else if (typeof obj[key] === 'object') {
                        restoreImages(obj[key]);
                    }
                });
            };
            restoreImages(parsed);

            // 4. Chuẩn hóa dữ liệu lần cuối
            parsed = normalizeImportedExamData(parsed);

            // 5. Cập nhật metadata từ JSON nếu AI có gợi ý (biệt là tiêu đề bộ thẻ)
            if (parsed.title) setTitle(parsed.title);
            
            setJsonPreview(JSON.stringify(parsed, null, 2));
            setStep('review');
            setActiveTab('preview');
            toast({ title: '✅ Phân tích xong', type: 'success' });
        } catch (err: any) {
            toast({ title: 'Lỗi AI', message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleFinalImport = async () => {
        try {
            const data = robustJSONParse(jsonPreview);
            
            // Re-index all IDs if it's an exam (not vocab)
            if (type !== 'vocab') {
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
            }

            const cleanPayload = sanitizeForFirestore({
                ...data,
                title: title.trim(),
                time,
                subjectId,
                customFolder: (customFolder || '').trim(),
                isSpecial,
                allowedEmails: (allowedEmails || '').split(',').map(e => e.trim()).filter(Boolean)
            });

            console.log("[SmartImport] Final Payload:", cleanPayload);
            try {
                await onImport(cleanPayload);
            } catch (importErr: any) {
                console.error("[SmartImport] onImport Error:", importErr);
                throw new Error(importErr?.message || 'Lỗi khi lưu dữ liệu vào hệ thống.');
            }
            toast({ title: 'Thành công!', type: 'success' });
            onClose();
            // Reset state
            setStep('upload');
            setExtractedText('');
            setJsonPreview('');
            setTitle('');
            setCustomFolder(initialFolderPath || '');
            setIsSpecial(false);
            setAllowedEmails('');
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
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="flex items-center justify-between mb-4 border-b pb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800">Kiểm tra kết quả</h3>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Smart AI Import Engine</p>
                                </div>
                            </div>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button
                                    onClick={() => setActiveTab('preview')}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all",
                                        activeTab === 'preview' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <Eye className="h-3.5 w-3.5" /> Xem trước
                                </button>
                                <button
                                    onClick={() => setActiveTab('code')}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all",
                                        activeTab === 'code' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <Code className="h-3.5 w-3.5" /> JSON Code
                                </button>
                            </div>
                        </div>

                        {/* Metadata Settings Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6 p-4 bg-muted/30 rounded-2xl border shrink-0">
                            <div className="md:col-span-4">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                                    <FileText className="h-3 w-3" /> Tiêu đề đề thi
                                </label>
                                <input 
                                    type="text" 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)} 
                                    className="w-full rounded-xl border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Thời gian (phút)
                                </label>
                                <input 
                                    type="number" 
                                    value={time} 
                                    onChange={(e) => setTime(parseInt(e.target.value) || 0)} 
                                    className="w-full rounded-xl border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                                    <FolderOpen className="h-3 w-3" /> Thư mục lưu trữ
                                </label>
                                <div className="flex gap-1">
                                    <select 
                                        className="flex-1 rounded-xl border-slate-200 bg-white px-1 py-2 text-[11px] focus:ring-2 focus:ring-indigo-500/20 outline-none max-w-[100px]"
                                        onChange={(e) => setCustomFolder(e.target.value)}
                                        value={availableFolders.includes(customFolder) ? customFolder : ""}
                                    >
                                        <option value="">(Ngoài cùng)</option>
                                        {availableFolders.map(f => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </select>
                                    <input 
                                        type="text" 
                                        value={customFolder} 
                                        onChange={(e) => setCustomFolder(e.target.value)} 
                                        placeholder="Tên mới..."
                                        className="flex-[2] rounded-xl border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-3 flex flex-col justify-end">
                                <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border cursor-pointer hover:bg-slate-50 transition-colors h-[38px]">
                                    <input 
                                        type="checkbox" 
                                        checked={isSpecial} 
                                        onChange={(e) => setIsSpecial(e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600"
                                    />
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        <Shield className={cn("h-4 w-4", isSpecial ? "text-indigo-600" : "text-slate-400")} />
                                        Đề thi đặc biệt
                                    </span>
                                </label>
                            </div>

                            {/* Special Emails Config */}
                            {isSpecial && (
                                <div className="md:col-span-12 animate-in slide-in-from-top-2 duration-300">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                                        <Mail className="h-3 w-3" /> Email được truy cập (cách nhau bởi dấu phẩy)
                                    </label>
                                    <textarea 
                                        value={allowedEmails} 
                                        onChange={(e) => setAllowedEmails(e.target.value)}
                                        placeholder="user1@gmail.com, user2@gmail.com..."
                                        className="w-full rounded-xl border-slate-200 bg-white px-3 py-2 text-[11px] focus:ring-2 focus:ring-indigo-500/20 outline-none h-16 transition-all"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Tab Content Area */}
                        <div className="flex-1 overflow-y-auto px-1 min-h-[300px]">
                            {activeTab === 'preview' ? (
                                <div className="animate-in fade-in duration-300">
                                    <ExamPreview data={robustJSONParse(jsonPreview)} />
                                </div>
                            ) : (
                                <div className="h-full animate-in fade-in duration-300 flex flex-col min-h-[300px]">
                                    <textarea
                                        value={jsonPreview}
                                        onChange={(e) => setJsonPreview(e.target.value)}
                                        className="flex-1 w-full rounded-2xl border-slate-200 bg-slate-900 text-indigo-300 p-6 text-xs font-mono outline-none shadow-inner min-h-[300px]"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-between items-center bg-white pt-4 border-t sticky bottom-0 shrink-0">
                            <Button variant="ghost" onClick={() => setStep('upload')} className="text-slate-500">Quay lại</Button>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={onClose} className="rounded-xl border-slate-200">Hủy</Button>
                                <Button onClick={handleFinalImport} className="admin-btn-primary rounded-xl px-10 shadow-lg shadow-indigo-200">Xác nhận lưu đề</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
