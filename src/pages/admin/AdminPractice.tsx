import { useEffect, useState } from 'react';
import { getAllExams, createExam, deleteExam, getSubjects } from '@/services/exam.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { ExamMetadata } from '@/types';
import {
    Trash2, Search, Upload, Download, Wand2, ArrowLeft, ChevronRight, LayoutGrid, Plus
} from 'lucide-react';
import { SmartImportDialog } from '@/components/admin/SmartImportDialog';
import { ManualExamDialog } from '@/components/admin/ManualExamDialog';
import { cn } from '@/lib/utils';

export default function AdminPractice() {
    const { toast } = useToast();
    const [exams, setExams] = useState<ExamMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [showSmartImport, setShowSmartImport] = useState(false);
    const [showManual, setShowManual] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [importLoading, setImportLoading] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const subjects = getSubjects();

    useEffect(() => { loadExams(); }, []);

    async function loadExams() {
        setLoading(true);
        const data = await getAllExams();
        setExams(data);
        setLoading(false);
    }

    const getExamCountForSubject = (subjectId: string) => {
        return exams.filter(e => e.subjectId === subjectId).length;
    };

    const filtered = exams.filter((e) => {
        if (selectedSubject && e.subjectId !== selectedSubject) return false;
        if (search.trim() && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const handleImportJSON = async () => {
        try {
            setImportLoading(true);
            const data = JSON.parse(jsonInput);
            if (!data.subjectId || !data.title || !data.time) {
                toast({ title: 'Lỗi', message: 'JSON thiếu trường subjectId, title, hoặc time', type: 'error' });
                return;
            }
            await createExam({
                title: data.title,
                subjectId: data.subjectId,
                time: data.time,
                part1: data.part1 || [],
                part2: data.part2 || [],
                part3: data.part3 || [],
            });
            toast({ title: 'Thành công!', message: `Đã tạo đề "${data.title}"`, type: 'success' });
            setShowImport(false);
            setJsonInput('');
            await loadExams();
        } catch (err) {
            toast({ title: 'Lỗi', message: 'JSON không hợp lệ', type: 'error' });
        } finally {
            setImportLoading(false);
        }
    };

    const handleSmartImport = async (data: any) => {
        try {
            await createExam({
                title: data.title,
                subjectId: data.subjectId || selectedSubject,
                time: data.time || 50,
                part1: data.part1 || [],
                part2: data.part2 || [],
                part3: data.part3 || [],
            });
            toast({ title: 'Thành công!', message: `Đã tạo đề "${data.title}"`, type: 'success' });
            await loadExams();
        } catch (err) {
            toast({ title: 'Lỗi', message: 'Không thể tạo đề thi.', type: 'error' });
            throw err;
        }
    };

    const handleDelete = async (examId: string) => {
        try {
            await deleteExam(examId);
            toast({ title: 'Đã xóa', type: 'success' });
            await loadExams();
        } catch {
            toast({ title: 'Lỗi xóa đề', type: 'error' });
        }
        setDeleteTarget(null);
    };

    const handleExportJSON = (_exam: ExamMetadata) => {
        toast({ title: 'Export', message: 'Đang xây dựng tính năng...', type: 'info' });
    };

    if (loading) return <div className="flex justify-center py-10"><Spinner size="md" label="Đang tải..." /></div>;

    const currentSubject = subjects.find(s => s.id === selectedSubject);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <button
                        onClick={() => setSelectedSubject(null)}
                        className={cn("hover:text-primary transition-colors", !selectedSubject && "text-foreground font-bold")}
                    >
                        Quản lý đề thi
                    </button>
                    {selectedSubject && (
                        <>
                            <ChevronRight className="h-4 w-4" />
                            <span className="text-foreground font-bold flex items-center gap-1">
                                {currentSubject?.icon} {currentSubject?.name}
                            </span>
                        </>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowManual(true)} className="gap-1">
                        <Plus className="h-4 w-4" /> Thêm đề thủ công
                    </Button>
                    <Button variant="outline" onClick={() => setShowSmartImport(true)} className="border-primary text-primary hover:bg-primary/10">
                        <Wand2 className="h-4 w-4" /> AI Smart Import
                    </Button>
                    <Button onClick={() => setShowImport(true)}>
                        <Upload className="h-4 w-4" /> Import JSON
                    </Button>
                </div>
            </div>

            {selectedSubject === null ? (
                /* Subject Grid View */
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <LayoutGrid className="h-5 w-5 text-primary" /> Chọn môn học
                        </h3>
                        <div className="relative w-full max-w-xs">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                placeholder="Tìm kiếm nhanh..."
                                className="w-full rounded-lg border border-input bg-background py-1.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {subjects.map((sub) => {
                            const count = getExamCountForSubject(sub.id);
                            return (
                                <button
                                    key={sub.id}
                                    onClick={() => setSelectedSubject(sub.id)}
                                    className="group relative flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center transition-all hover:border-primary hover:shadow-xl hover:-translate-y-1"
                                >
                                    <div className={cn(
                                        "flex h-16 w-16 items-center justify-center rounded-2xl text-4xl shadow-inner transition-transform group-hover:scale-110",
                                        "bg-accent/50"
                                    )}>
                                        {sub.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm tracking-tight">{sub.name}</p>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1 bg-muted px-2 py-0.5 rounded-full inline-block">
                                            {count} đề thi
                                        </p>
                                    </div>
                                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* Subject Detail Table View */
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setSelectedSubject(null)} className="rounded-full">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    {currentSubject?.icon} Đề thi {currentSubject?.name}
                                </h3>
                                <p className="text-xs text-muted-foreground">Tổng cộng {filtered.length} đề thi trong kho lưu trữ</p>
                            </div>
                        </div>
                        <div className="relative w-full max-w-xs">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                placeholder="Tìm kiếm trong môn..."
                                className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-5 py-4 text-left font-bold text-xs uppercase tracking-wider">Đề thi</th>
                                    <th className="px-5 py-4 text-center font-bold text-xs uppercase tracking-wider">Thời gian</th>
                                    <th className="px-5 py-4 text-center font-bold text-xs uppercase tracking-wider">Câu hỏi</th>
                                    <th className="px-5 py-4 text-center font-bold text-xs uppercase tracking-wider">Lượt thi</th>
                                    <th className="px-5 py-4 text-right font-bold text-xs uppercase tracking-wider">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered.map((exam) => {
                                    const totalQ = (exam.questionCount?.part1 || 0) + (exam.questionCount?.part2 || 0) + (exam.questionCount?.part3 || 0);
                                    return (
                                        <tr key={exam.id} className="transition-colors hover:bg-accent/30 group">
                                            <td className="px-5 py-4">
                                                <p className="font-bold text-primary group-hover:underline cursor-default">{exam.title}</p>
                                                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{exam.id}</p>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {exam.time} phút
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-center font-medium">{totalQ}</td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-muted-foreground">{exam.attemptCount || 0}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-all">
                                                    <Button variant="ghost" size="icon" onClick={() => handleExportJSON(exam)} title="Export JSON" className="h-8 w-8">
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(exam.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8" title="Xóa">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filtered.length === 0 && (
                            <div className="py-20 text-center flex flex-col items-center gap-2">
                                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground italic">
                                    <Search className="h-6 w-6" />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">Không tìm thấy công việc nào phù hợp</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Import JSON Dialog */}
            <Dialog open={showImport} onClose={() => setShowImport(false)} className="max-w-2xl">
                <h3 className="text-lg font-bold mb-4">Import đề thi từ JSON</h3>
                <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder={selectedSubject ? `{"subjectId": "${selectedSubject}", "title": "...", "time": 50, ...}` : '{"subjectId": "toan", "title": "Đề thi...", "time": 50, "part1": [...], ...}'}
                    rows={12}
                    className="w-full rounded-lg border border-input bg-background p-3 text-sm font-mono outline-none focus:border-primary"
                />
                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowImport(false)}>Hủy</Button>
                    <Button onClick={handleImportJSON} isLoading={importLoading}>Import</Button>
                </div>
            </Dialog>

            {/* Delete confirm */}
            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
                title="Xóa đề thi?"
                message="Hành động này không thể hoàn tác. Đề thi sẽ bị xóa vĩnh viễn khỏi hệ thống."
                confirmText="Xóa bỏ"
                variant="destructive"
            />

            <SmartImportDialog
                open={showSmartImport}
                onClose={() => setShowSmartImport(false)}
                onImport={handleSmartImport}
                type="practice"
                initialSubjectId={selectedSubject}
            />

            <ManualExamDialog
                open={showManual}
                onClose={() => setShowManual(false)}
                onSave={handleSmartImport}
                initialSubject={selectedSubject}
            />
        </div>
    );
}
