import { useEffect, useState } from 'react';
import { getAllExams, createExam, deleteExam, getSubjects } from '@/services/exam.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { ExamMetadata } from '@/types';
import {
    Trash2, Search, Upload, Download,
} from 'lucide-react';

export default function AdminPractice() {
    const { toast } = useToast();
    const [exams, setExams] = useState<ExamMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterSubject, setFilterSubject] = useState('all');
    const [showImport, setShowImport] = useState(false);
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

    const filtered = exams.filter((e) => {
        if (filterSubject !== 'all' && e.subjectId !== filterSubject) return false;
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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">📐 Quản lý đề thi</h2>
                <Button onClick={() => setShowImport(true)}>
                    <Upload className="h-4 w-4" /> Import JSON
                </Button>
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tìm kiếm..."
                        className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm outline-none focus:border-primary"
                    />
                </div>
                <select
                    value={filterSubject}
                    onChange={(e) => setFilterSubject(e.target.value)}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                    <option value="all">Tất cả môn</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
            </div>

            {/* Exam table */}
            <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-4 py-2.5 text-left font-medium">Đề thi</th>
                            <th className="px-4 py-2.5 text-left font-medium">Môn</th>
                            <th className="px-4 py-2.5 text-center font-medium">Thời gian</th>
                            <th className="px-4 py-2.5 text-center font-medium">Câu hỏi</th>
                            <th className="px-4 py-2.5 text-center font-medium">Lượt thi</th>
                            <th className="px-4 py-2.5 text-center font-medium">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((exam) => {
                            const subject = subjects.find((s) => s.id === exam.subjectId);
                            const totalQ = (exam.questionCount?.part1 || 0) + (exam.questionCount?.part2 || 0) + (exam.questionCount?.part3 || 0);
                            return (
                                <tr key={exam.id} className="border-t border-border transition-colors hover:bg-accent/50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium">{exam.title}</p>
                                        <p className="text-xs text-muted-foreground">{exam.id}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1 text-xs">
                                            {subject?.icon} {subject?.name || exam.subjectId}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">{exam.time} phút</td>
                                    <td className="px-4 py-3 text-center">{totalQ}</td>
                                    <td className="px-4 py-3 text-center">{exam.attemptCount || 0}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleExportJSON(exam)} title="Export JSON">
                                                <Download className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(exam.id)} className="text-red-600 hover:text-red-700" title="Xóa">
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
                    <p className="py-8 text-center text-sm text-muted-foreground">Không có đề thi nào</p>
                )}
            </div>

            {/* Import JSON Dialog */}
            <Dialog open={showImport} onClose={() => setShowImport(false)} className="max-w-2xl">
                <h3 className="text-lg font-bold mb-4">Import đề thi từ JSON</h3>
                <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='{"subjectId": "toan", "title": "Đề thi...", "time": 50, "part1": [...], ...}'
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
                message="Hành động này không thể hoàn tác. Đề thi sẽ bị xóa vĩnh viễn."
                confirmText="Xóa"
                variant="destructive"
            />
        </div>
    );
}
