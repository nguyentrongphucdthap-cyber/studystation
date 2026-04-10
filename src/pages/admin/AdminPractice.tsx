import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllExams, createExam, deleteExam, getSubjects, getExamContent, updateExam } from '@/services/exam.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { ExamMetadata } from '@/types';
import {
    Trash2, Search, Upload, Download, Wand2, ArrowLeft, ChevronRight, LayoutGrid, Plus, Pencil, Folder, FolderPlus
} from 'lucide-react';
import { SmartImportDialog } from '@/components/admin/SmartImportDialog';
import { ManualExamDialog } from '@/components/admin/ManualExamDialog';
import { cn } from '@/lib/utils';
import { downloadJSON } from '@/lib/exportUtils';

const FOLDER_REGISTRY_KEY = 'admin_practice_folder_registry_v1';

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
    const [selectedFolder, setSelectedFolder] = useState<'ALL' | 'UNFILED' | string>('ALL');
    const [newFolderName, setNewFolderName] = useState('');
    const [folderRegistry, setFolderRegistry] = useState<Record<string, string[]>>(() => {
        try {
            const raw = localStorage.getItem(FOLDER_REGISTRY_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    });
    const [folderActionLoading, setFolderActionLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState<
        | { type: 'exam'; exam: ExamMetadata; x: number; y: number }
        | { type: 'folder'; folderName: string; x: number; y: number }
        | null
    >(null);

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

    const subjectExams = useMemo(() => {
        if (!selectedSubject) return [];
        return exams.filter((e) => e.subjectId === selectedSubject);
    }, [exams, selectedSubject]);

    const subjectFolderRegistry = useMemo(
        () => (selectedSubject ? (folderRegistry[selectedSubject] || []) : []),
        [folderRegistry, selectedSubject]
    );

    const folderList = useMemo(() => {
        const unique = Array.from(
            new Set(
                [
                    ...subjectFolderRegistry,
                    ...subjectExams
                        .map((e) => (e.customFolder || '').trim())
                        .filter(Boolean),
                ]
            )
        );
        return unique.sort((a, b) => a.localeCompare(b, 'vi'));
    }, [subjectExams, subjectFolderRegistry]);

    const filtered = subjectExams.filter((e) => {
        if (search.trim() && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
        if (selectedFolder === 'UNFILED') return !(e.customFolder || '').trim();
        if (selectedFolder !== 'ALL') return (e.customFolder || '').trim() === selectedFolder;
        return true;
    });

    useEffect(() => {
        setSelectedFolder('ALL');
        setContextMenu(null);
    }, [selectedSubject]);

    useEffect(() => {
        const closeContextMenu = () => setContextMenu(null);
        window.addEventListener('click', closeContextMenu);
        window.addEventListener('scroll', closeContextMenu, true);
        return () => {
            window.removeEventListener('click', closeContextMenu);
            window.removeEventListener('scroll', closeContextMenu, true);
        };
    }, []);

    useEffect(() => {
        localStorage.setItem(FOLDER_REGISTRY_KEY, JSON.stringify(folderRegistry));
    }, [folderRegistry]);

    const addFolderToRegistry = (subjectId: string, folderName: string) => {
        const next = folderName.trim();
        if (!subjectId || !next) return;
        setFolderRegistry((prev) => {
            const current = prev[subjectId] || [];
            if (current.some((f) => f.toLowerCase() === next.toLowerCase())) return prev;
            return { ...prev, [subjectId]: [...current, next] };
        });
    };

    const renameFolderInRegistry = (subjectId: string, oldName: string, nextName: string) => {
        if (!subjectId) return;
        setFolderRegistry((prev) => {
            const current = prev[subjectId] || [];
            const withoutOld = current.filter((f) => f.toLowerCase() !== oldName.toLowerCase());
            if (withoutOld.some((f) => f.toLowerCase() === nextName.toLowerCase())) return prev;
            return { ...prev, [subjectId]: [...withoutOld, nextName] };
        });
    };

    const ensureUniqueFolderName = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        if (folderList.some((f) => f.toLowerCase() === trimmed.toLowerCase())) return null;
        return trimmed;
    };

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
                customFolder: data.customFolder || '',
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
                customFolder: data.customFolder || '',
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

    const handleExportJSON = async (exam: ExamMetadata) => {
        try {
            const fullExam = await getExamContent(exam.id, true);
            if (!fullExam) {
                toast({ title: 'Lỗi', message: 'Không thể tải nội dung đề thi để export', type: 'error' });
                return;
            }
            downloadJSON(fullExam, `StudyStation_Exam_${exam.id}_${new Date().toISOString().split('T')[0]}`);
            toast({ title: 'Export hoàn tất', message: `Đã tải xuống file JSON cho đề "${exam.title}"`, type: 'success' });
        } catch (err) {
            toast({ title: 'Lỗi Export', message: String(err), type: 'error' });
        }
    };

    const moveExamToFolder = async (exam: ExamMetadata, folderName: string) => {
        const targetFolder = folderName.trim();
        await updateExam(exam.id, { customFolder: targetFolder });
        addFolderToRegistry(exam.subjectId, targetFolder);
        toast({ title: 'Đã di chuyển đề thi', type: 'success' });
        await loadExams();
    };

    const removeExamFromFolder = async (exam: ExamMetadata) => {
        await updateExam(exam.id, { customFolder: '' });
        toast({ title: 'Đã bỏ đề khỏi thư mục', type: 'success' });
        await loadExams();
    };

    const createFolderQuick = () => {
        const valid = ensureUniqueFolderName(newFolderName);
        if (!valid) {
            toast({ title: 'Tên thư mục không hợp lệ hoặc đã tồn tại', type: 'warning' });
            return;
        }
        if (selectedSubject) {
            addFolderToRegistry(selectedSubject, valid);
        }
        setSelectedFolder(valid);
        setNewFolderName('');
        toast({ title: `Đã tạo thư mục "${valid}" (sẵn sàng để di chuyển đề)`, type: 'success' });
    };

    const renameFolder = async (oldName: string) => {
        const nextNameInput = window.prompt('Nhập tên thư mục mới', oldName);
        if (!nextNameInput) return;
        const nextName = nextNameInput.trim();
        if (!nextName || nextName.toLowerCase() === oldName.toLowerCase()) return;
        if (folderList.some((f) => f.toLowerCase() === nextName.toLowerCase())) {
            toast({ title: 'Thư mục mới đã tồn tại', type: 'warning' });
            return;
        }
        const targets = subjectExams.filter((e) => (e.customFolder || '').trim() === oldName);
        setFolderActionLoading(true);
        try {
            if (targets.length) {
                await Promise.all(targets.map((exam) => updateExam(exam.id, { customFolder: nextName })));
            }
            if (selectedSubject) {
                renameFolderInRegistry(selectedSubject, oldName, nextName);
            }
            toast({ title: `Đã đổi tên thư mục "${oldName}"`, type: 'success' });
            if (selectedFolder === oldName) setSelectedFolder(nextName);
            await loadExams();
        } finally {
            setFolderActionLoading(false);
        }
    };

    const clearFolder = async (folderName: string) => {
        const ok = window.confirm(`Bỏ toàn bộ đề khỏi thư mục "${folderName}"?`);
        if (!ok) return;
        const targets = subjectExams.filter((e) => (e.customFolder || '').trim() === folderName);
        if (!targets.length) return;
        setFolderActionLoading(true);
        try {
            await Promise.all(targets.map((exam) => updateExam(exam.id, { customFolder: '' })));
            toast({ title: `Đã làm trống thư mục "${folderName}"`, type: 'success' });
            if (selectedFolder === folderName) setSelectedFolder('ALL');
            await loadExams();
        } finally {
            setFolderActionLoading(false);
        }
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
                        <div className="px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800/60 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                <Folder className="h-4 w-4 text-amber-500" />
                                Quản lý thư mục (kiểu Explorer)
                                <span className="text-[10px] font-medium normal-case text-slate-400">Chuột phải vào thư mục hoặc đề để thao tác nhanh</span>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <button
                                    onClick={() => setSelectedFolder('ALL')}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                                        selectedFolder === 'ALL'
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800'
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700'
                                    )}
                                >
                                    Tất cả ({subjectExams.length})
                                </button>
                                <button
                                    onClick={() => setSelectedFolder('UNFILED')}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                                        selectedFolder === 'UNFILED'
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800'
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700'
                                    )}
                                >
                                    Chưa phân thư mục ({subjectExams.filter((e) => !(e.customFolder || '').trim()).length})
                                </button>

                                {folderList.map((folder) => (
                                    <button
                                        key={folder}
                                        onClick={() => setSelectedFolder(folder)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setContextMenu({ type: 'folder', folderName: folder, x: e.clientX, y: e.clientY });
                                        }}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors inline-flex items-center gap-1.5',
                                            selectedFolder === folder
                                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700'
                                        )}
                                    >
                                        <Folder className="h-3.5 w-3.5" />
                                        {folder}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <div className="relative w-full max-w-sm">
                                    <FolderPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && createFolderQuick()}
                                        placeholder="Tạo thư mục mới..."
                                        className="w-full rounded-xl border border-slate-200 bg-white shadow-sm py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={createFolderQuick}
                                    className="rounded-xl border-slate-200 dark:border-slate-700"
                                >
                                    Tạo thư mục
                                </Button>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-[1.2rem]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider text-slate-500">Đề thi</th>
                                        <th className="px-6 py-4 text-center font-bold text-xs uppercase tracking-wider text-slate-500">Thư mục</th>
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
                                            <tr
                                                key={exam.id}
                                                className="transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/40 group relative"
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setContextMenu({ type: 'exam', exam, x: e.clientX, y: e.clientY });
                                                }}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-default">{exam.title}</p>
                                                        {exam.isSpecial && (
                                                            <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase tracking-tighter shadow-sm">Đặc biệt</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] font-mono text-slate-400 mt-1">{exam.id}</p>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {exam.customFolder?.trim() ? (
                                                        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                            {exam.customFolder}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">-</span>
                                                    )}
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

            {contextMenu && (
                <div
                    className="fixed z-[100] min-w-[240px] rounded-xl border border-slate-200 bg-white shadow-2xl p-2 dark:bg-slate-900 dark:border-slate-700"
                    style={{ top: contextMenu.y + 4, left: contextMenu.x + 4 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.type === 'exam' ? (
                        <div className="space-y-1">
                            <p className="px-2 py-1 text-[11px] font-bold text-slate-500 truncate">
                                {contextMenu.exam.title}
                            </p>
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={async () => {
                                    setContextMenu(null);
                                    setFolderActionLoading(true);
                                    try {
                                        await removeExamFromFolder(contextMenu.exam);
                                    } finally {
                                        setFolderActionLoading(false);
                                    }
                                }}
                            >
                                Bỏ khỏi thư mục
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                            {folderList.length === 0 ? (
                                <p className="px-2 py-1 text-xs text-slate-400">Chưa có thư mục nào</p>
                            ) : (
                                folderList.map((folder) => (
                                    <button
                                        key={folder}
                                        className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                                        onClick={async () => {
                                            setContextMenu(null);
                                            setFolderActionLoading(true);
                                            try {
                                                await moveExamToFolder(contextMenu.exam, folder);
                                            } finally {
                                                setFolderActionLoading(false);
                                            }
                                        }}
                                    >
                                        <Folder className="h-3.5 w-3.5 text-amber-500" />
                                        Chuyển tới: {folder}
                                    </button>
                                ))
                            )}
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={async () => {
                                    const folder = window.prompt('Tên thư mục mới');
                                    if (!folder || !folder.trim()) return;
                                    setContextMenu(null);
                                    setFolderActionLoading(true);
                                    try {
                                        await moveExamToFolder(contextMenu.exam, folder.trim());
                                        setSelectedFolder(folder.trim());
                                    } finally {
                                        setFolderActionLoading(false);
                                    }
                                }}
                            >
                                Tạo thư mục mới và chuyển vào
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <p className="px-2 py-1 text-[11px] font-bold text-slate-500 truncate">
                                Thư mục: {contextMenu.folderName}
                            </p>
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={async () => {
                                    const name = contextMenu.folderName;
                                    setContextMenu(null);
                                    await renameFolder(name);
                                }}
                            >
                                Đổi tên thư mục
                            </button>
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                onClick={async () => {
                                    const name = contextMenu.folderName;
                                    setContextMenu(null);
                                    await clearFolder(name);
                                }}
                            >
                                Làm trống thư mục (bỏ tất cả đề ra ngoài)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {folderActionLoading && (
                <div className="fixed inset-0 z-[90] bg-black/10 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="admin-card px-5 py-3 text-sm font-semibold text-slate-600 dark:text-slate-200">
                        Đang cập nhật thư mục...
                    </div>
                </div>
            )}

            {/* Import JSON Dialog */}
            <Dialog open={showImport} onClose={() => setShowImport(false)} className="max-w-2xl">
                <h3 className="text-lg font-bold mb-4">Import đề thi từ JSON</h3>
                <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder={selectedSubject ? `{"subjectId": "${selectedSubject}", "customFolder": "Ôn tập", "title": "...", "time": 50, ...}` : '{"subjectId": "toan", "customFolder": "Ôn tập", "title": "Đề thi...", "time": 50, "part1": [...], ...}'}
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
