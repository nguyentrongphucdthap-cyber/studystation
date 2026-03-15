import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllExams, createExam, deleteExam, getSubjects } from '@/services/exam.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { ExamMetadata } from '@/types';
import {
    Trash2, Search, Upload, Download, Wand2, ArrowLeft, ChevronRight, LayoutGrid, Plus, Pencil
} from 'lucide-react';
import { SmartImportDialog } from '@/components/admin/SmartImportDialog';
import { ManualExamDialog } from '@/components/admin/ManualExamDialog';
import { cn } from '@/lib/utils';

export default function AdminPractice() {
    const navigate = useNavigate();
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between admin-card p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 font-semibold px-2">
                    <button
                        onClick={() => setSelectedSubject(null)}
                        className={cn("hover:text-indigo-600 transition-colors uppercase tracking-wider text-xs", !selectedSubject && "text-slate-800 font-bold dark:text-slate-200")}
                    >
                        Quản lý đề thi
                    </button>
                    {selectedSubject && (
                        <>
                            <ChevronRight className="h-4 w-4" />
                            <span className="text-indigo-600 font-bold flex items-center gap-1 uppercase tracking-wider text-xs">
                                {currentSubject?.icon} {currentSubject?.name}
                            </span>
                        </>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setShowManual(true)} className="gap-1 rounded-xl border-slate-200 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        <Plus className="h-4 w-4" /> Thêm đề thủ công
                    </Button>
                    <Button variant="outline" onClick={() => setShowSmartImport(true)} className="gap-1 rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 shadow-sm dark:border-indigo-800 dark:hover:bg-indigo-900/30">
                        <Wand2 className="h-4 w-4" /> AI Smart Import
                    </Button>
                    <Button onClick={() => setShowImport(true)} className="admin-btn-primary rounded-xl gap-2 font-semibold">
                        <Upload className="h-4 w-4" /> Import JSON
                    </Button>
                </div>
            </div>

            {selectedSubject === null ? (
                /* Subject Grid View */
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg dark:bg-indigo-900/30 dark:text-indigo-400">
                                <LayoutGrid className="h-5 w-5" />
                            </div>
                            Chọn môn học
                        </h3>
                        <div className="relative w-full max-w-xs">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                placeholder="Tìm kiếm nhanh..."
                                className="w-full rounded-xl border-none bg-white shadow-sm py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 dark:bg-slate-800"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                        {subjects.map((sub) => {
                            const count = getExamCountForSubject(sub.id);
                            return (
                                <button
                                    key={sub.id}
                                    onClick={() => setSelectedSubject(sub.id)}
                                    className="admin-card group relative flex flex-col items-center gap-4 p-6 text-center border-none"
                                >
                                    <div className={cn(
                                        "flex h-16 w-16 items-center justify-center rounded-2xl text-4xl shadow-inner transition-transform group-hover:scale-110",
                                        "bg-slate-50 dark:bg-slate-800/50"
                                    )}>
                                        {sub.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200 tracking-tight">{sub.name}</p>
                                        <p className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 mt-1.5 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full inline-block">
                                            {count} đề thi
                                        </p>
                                    </div>
                                    <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-indigo-500 opacity-0 transition-opacity group-hover:opacity-100 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* Subject Detail Table View */
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between admin-card p-4">
                        <div className="flex items-center gap-4 pl-2">
                            <Button variant="ghost" size="icon" onClick={() => setSelectedSubject(null)} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10 shrink-0">
                                <ArrowLeft className="h-5 w-5 text-slate-500" />
                            </Button>
                            <div>
                                <h3 className="text-xl font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                                    {currentSubject?.icon} Đề thi {currentSubject?.name}
                                </h3>
                                <p className="text-xs font-medium text-slate-500 mt-0.5">Tổng cộng {filtered.length} đề thi trong kho lưu trữ</p>
                            </div>
                        </div>
                        <div className="relative w-full max-w-xs">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                placeholder="Tìm kiếm trong môn..."
                                className="w-full rounded-xl border-none bg-white shadow-sm py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 dark:bg-slate-800"
                            />
                        </div>
                    </div>

                    <div className="admin-card overflow-hidden border-none p-1">
                        <div className="overflow-x-auto rounded-[1.2rem]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider text-slate-500">Đề thi</th>
                                        <th className="px-6 py-4 text-center font-bold text-xs uppercase tracking-wider text-slate-500">Thời gian</th>
                                        <th className="px-6 py-4 text-center font-bold text-xs uppercase tracking-wider text-slate-500">Câu hỏi</th>
                                        <th className="px-6 py-4 text-center font-bold text-xs uppercase tracking-wider text-slate-500">Lượt thi</th>
                                        <th className="px-6 py-4 text-right font-bold text-xs uppercase tracking-wider text-slate-500">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/20">
                                    {filtered.map((exam) => {
                                        const totalQ = (exam.questionCount?.part1 || 0) + (exam.questionCount?.part2 || 0) + (exam.questionCount?.part3 || 0);
                                        return (
                                            <tr key={exam.id} className="transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/40 group relative">
                                                <td className="px-6 py-4">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <p className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-default">{exam.title}</p>
                                                    <p className="text-[10px] font-mono text-slate-400 mt-1">{exam.id}</p>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-800/50">
                                                        {exam.time} phút
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-300">{totalQ}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-md bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{exam.attemptCount || 0}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end gap-2 opacity-40 group-hover:opacity-100 transition-all">
                                                        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/practice/${exam.id}/edit`)} title="Chỉnh sửa đề thi" className="h-8 w-8 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 text-slate-400">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleExportJSON(exam)} title="Export JSON" className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 text-slate-400">
                                                            <Download className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(exam.id)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 h-8 w-8 rounded-lg" title="Xóa">
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
                                <div className="py-24 text-center flex flex-col items-center gap-3 bg-white dark:bg-slate-900/20">
                                    <div className="h-16 w-16 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-300 dark:text-slate-600 shadow-inner">
                                        <Search className="h-6 w-6" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-500">Không tìm thấy đề thi nào phù hợp</p>
                                </div>
                            )}
                        </div>
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
