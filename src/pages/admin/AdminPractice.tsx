import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllExams, createExam, deleteExam, getSubjects, getExamContent, updateExam } from '@/services/exam.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { ExamMetadata } from '@/types';
import { Trash2, Search, Upload, Wand2, ArrowLeft, ChevronRight, LayoutGrid, Plus, Pencil, Folder, FolderPlus, FileText, Home, ArrowUpLeft } from 'lucide-react';
import { SmartImportDialog } from '@/components/admin/SmartImportDialog';
import { ManualExamDialog } from '@/components/admin/ManualExamDialog';
import { cn } from '@/lib/utils';
import { downloadJSON } from '@/lib/exportUtils';
import * as folderUtils from '@/lib/folderUtils';

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
    const [currentPath, setCurrentPath] = useState<string[]>([]);
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

    const subjectFolderRegistry = useMemo(() => {
        if (!selectedSubject) return [];
        const fromRegistry = folderRegistry[selectedSubject] || [];
        const fromExams = subjectExams
            .map((e) => (e.customFolder || '').trim())
            .filter(Boolean);
        return Array.from(new Set([...fromRegistry, ...fromExams]));
    }, [folderRegistry, selectedSubject, subjectExams]);

    const currentFullPath = useMemo(() => currentPath.join('/'), [currentPath]);

    const itemsAtLevel = useMemo(() => {
        const folders = folderUtils.getSubFoldersAtLevel(subjectFolderRegistry, currentFullPath);
        const examsAtThisLevel = subjectExams.filter(e => (e.customFolder || '') === currentFullPath);
        
        // If we are searching, ignore hierarchy and show all matching exams
        if (search.trim()) {
            return {
                folders: [],
                exams: subjectExams.filter(e => e.title.toLowerCase().includes(search.toLowerCase()))
            };
        }

        return { folders, exams: examsAtThisLevel };
    }, [subjectFolderRegistry, currentFullPath, subjectExams, search]);

    useEffect(() => {
        setCurrentPath([]);
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


    const ensureUniqueFolderName = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed || trimmed.includes('/')) return null;
        if (itemsAtLevel.folders.some((f) => f.toLowerCase() === trimmed.toLowerCase())) return null;
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
                ...data,
                title: data.title,
                subjectId: data.subjectId,
                customFolder: data.customFolder || '',
                time: data.time,
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
                ...data,
                subjectId: data.subjectId || selectedSubject,
                title: data.title || 'Đề thi mới',
            });
            toast({ title: 'Thành công!', message: `Đã tạo đề "${data.title}"`, type: 'success' });
            await loadExams();
        } catch (err: any) {
            console.error('[AdminPractice] Smart Import Error:', err);
            toast({ title: 'Lỗi', message: err.message || 'Không thể tạo đề thi.', type: 'error' });
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


    const moveExamToFolder = async (exam: ExamMetadata, targetPath: string) => {
        await updateExam(exam.id, { customFolder: targetPath });
        addFolderToRegistry(exam.subjectId, targetPath);
        toast({ title: 'Đã di chuyển đề thi', type: 'success' });
        await loadExams();
    };

    const removeExamFromFolder = async (exam: ExamMetadata) => {
        await updateExam(exam.id, { customFolder: '' });
        toast({ title: 'Đã đưa về Thư mục gốc', type: 'success' });
        await loadExams();
    };

    const createFolderQuick = () => {
        const validName = ensureUniqueFolderName(newFolderName);
        if (!validName) {
            toast({ title: 'Tên thư mục không hợp lệ hoặc đã tồn tại', type: 'warning' });
            return;
        }
        const fullPath = folderUtils.joinPaths(currentFullPath, validName);
        if (selectedSubject) {
            addFolderToRegistry(selectedSubject, fullPath);
        }
        // Enter the new folder automatically?
        setCurrentPath([...currentPath, validName]);
        setNewFolderName('');
        toast({ title: `Đã tạo thư mục "${validName}"`, type: 'success' });
    };

    const renameFolder = async (folderName: string) => {
        const nextNameInput = window.prompt('Nhập tên mới cho thư mục', folderName);
        if (!nextNameInput) return;
        const nextName = nextNameInput.trim();
        if (!nextName || nextName === folderName || nextName.includes('/')) return;

        const oldPath = folderUtils.joinPaths(currentFullPath, folderName);
        const newPath = folderUtils.joinPaths(currentFullPath, nextName);

        // Update all items in registry that start with oldPath
        setFolderRegistry(prev => {
            if (!selectedSubject) return prev;
            const current = prev[selectedSubject] || [];
            const next = current.map(p => {
                if (p === oldPath) return newPath;
                if (p.startsWith(oldPath + '/')) {
                    return newPath + p.slice(oldPath.length);
                }
                return p;
            });
            return { ...prev, [selectedSubject]: next };
        });

        // Update all exams in Firestore that are inside this folder or subfolders
        const targets = subjectExams.filter(e => {
            const path = e.customFolder || '';
            return path === oldPath || path.startsWith(oldPath + '/');
        });

        setFolderActionLoading(true);
        try {
            if (targets.length) {
                await Promise.all(targets.map(exam => {
                    const oldExamPath = exam.customFolder || '';
                    const newExamPath = newPath + oldExamPath.slice(oldPath.length);
                    return updateExam(exam.id, { customFolder: newExamPath });
                }));
            }
            toast({ title: `Đã đổi tên thành "${nextName}"`, type: 'success' });
            await loadExams();
        } finally {
            setFolderActionLoading(false);
        }
    };

    const clearFolder = async (folderName: string) => {
        const fullPath = folderUtils.joinPaths(currentFullPath, folderName);
        const ok = window.confirm(`Xóa thư mục "${folderName}"? Toàn bộ đề thi bên trong sẽ được đưa ra Thư mục gốc.`);
        if (!ok) return;

        // Delete from registry
        setFolderRegistry(prev => {
            if (!selectedSubject) return prev;
            const current = prev[selectedSubject] || [];
            // Remove fullPath and all its subfolders
            const next = current.filter(p => p !== fullPath && !p.startsWith(fullPath + '/'));
            return { ...prev, [selectedSubject]: next };
        });

        // Move exams to root
        const targets = subjectExams.filter(e => {
            const path = e.customFolder || '';
            return path === fullPath || path.startsWith(fullPath + '/');
        });

        setFolderActionLoading(true);
        try {
            if (targets.length) {
                await Promise.all(targets.map(exam => updateExam(exam.id, { customFolder: '' })));
            }
            toast({ title: `Đã xóa thư mục "${folderName}"`, type: 'success' });
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
                                <p className="text-xs font-medium text-slate-500 mt-0.5">Tổng cộng {subjectExams.length} đề thi trong kho lưu trữ</p>
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

                    {/* Breadcrumbs & Modern Folder Navigation */}
                    <div className="admin-card overflow-hidden border-none p-1 bg-slate-50/30 dark:bg-slate-900/10">
                        <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                                <button
                                    onClick={() => setCurrentPath([])}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        currentPath.length === 0 
                                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                                            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                    )}
                                >
                                    <Home className="h-3.5 w-3.5" /> Gốc
                                </button>
                                {currentPath.map((folder, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                                        <button
                                            onClick={() => setCurrentPath(currentPath.slice(0, idx + 1))}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                                idx === currentPath.length - 1
                                                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                                                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                            )}
                                        >
                                            {folder}
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <FolderPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && createFolderQuick()}
                                        placeholder="Tạo thư mục con..."
                                        className="w-48 rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <Button size="sm" onClick={createFolderQuick} className="rounded-xl h-9 text-xs font-bold px-4">
                                    Tạo
                                </Button>
                            </div>
                        </div>

                        {/* macOS Finder Inspired Grid View */}
                        <div className="p-6">
                            {(itemsAtLevel.folders.length === 0 && itemsAtLevel.exams.length === 0) ? (
                                <div className="py-24 text-center flex flex-col items-center gap-4 bg-white/50 dark:bg-slate-900/10 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                                    <div className="h-20 w-20 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-200 dark:text-slate-700">
                                        <Folder className="h-10 w-10" />
                                    </div>
                                    <div>
                                        <p className="text-base font-bold text-slate-600 dark:text-slate-300">Thư mục trống</p>
                                        <p className="text-xs text-slate-400 mt-1">Chưa có đề thi hoặc thư mục con tại đây</p>
                                    </div>
                                    {currentPath.length > 0 && (
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPath(currentPath.slice(0, -1))} className="gap-2 rounded-xl border-slate-200">
                                            <ArrowUpLeft className="h-4 w-4" /> Quay lại cha
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
                                    {/* Back Button Item */}
                                    {currentPath.length > 0 && (
                                        <div 
                                            onClick={() => setCurrentPath(currentPath.slice(0, -1))}
                                            className="group cursor-pointer flex flex-col items-center gap-3 p-4 rounded-2xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800/40"
                                        >
                                            <div className="relative">
                                                <Folder className="h-16 w-16 text-slate-300 dark:text-slate-700 fill-slate-300/10" />
                                                <ArrowUpLeft className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-slate-500" />
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest italic">(Quay lại)</span>
                                        </div>
                                    )}

                                    {/* Folder items */}
                                    {itemsAtLevel.folders.map(folderName => (
                                        <div 
                                            key={folderName}
                                            onClick={() => setCurrentPath([...currentPath, folderName])}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                setContextMenu({ type: 'folder', folderName, x: e.clientX, y: e.clientY });
                                            }}
                                            className="group cursor-pointer flex flex-col items-center gap-2 p-4 rounded-2xl transition-all hover:bg-amber-50 dark:hover:bg-amber-900/10 active:scale-95"
                                        >
                                            <div className="relative">
                                                <Folder className="h-16 w-16 text-amber-500 fill-amber-500/10 transition-transform group-hover:scale-110" />
                                                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-amber-100 dark:border-amber-900/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ChevronRight className="h-3 w-3 text-amber-600" />
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center line-clamp-2 px-1">{folderName}</span>
                                        </div>
                                    ))}

                                    {/* Exam items */}
                                    {itemsAtLevel.exams.map(exam => {
                                        const totalQ = (exam.questionCount?.part1 || 0) + (exam.questionCount?.part2 || 0) + (exam.questionCount?.part3 || 0);
                                        return (
                                            <div 
                                                key={exam.id}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setContextMenu({ type: 'exam', exam, x: e.clientX, y: e.clientY });
                                                }}
                                                className="group cursor-pointer flex flex-col items-center gap-2 p-4 rounded-2xl transition-all hover:bg-indigo-50 dark:hover:bg-indigo-900/10 active:scale-95"
                                            >
                                                <div className="relative">
                                                    <FileText className="h-16 w-16 text-indigo-500 fill-indigo-500/10 transition-transform group-hover:scale-110" />
                                                    {exam.isSpecial && (
                                                        <div className="absolute top-0 right-0 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                                                    )}
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-indigo-600/10 rounded-xl transition-opacity">
                                                        <Button 
                                                            size="icon" variant="ghost" 
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/practice/${exam.id}/edit`); }}
                                                            className="h-8 w-8 bg-white dark:bg-slate-800 text-indigo-600 rounded-full shadow-lg"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="text-center space-y-1">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-2 px-1 h-8 flex items-start justify-center leading-tight">{exam.title}</span>
                                                    <div className="flex items-center justify-center gap-2 mt-1">
                                                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500">{totalQ}Q</span>
                                                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">{exam.time}'</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
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
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                                onClick={() => {
                                    setContextMenu(null);
                                    navigate(`/admin/practice/${contextMenu.exam.id}/edit`);
                                }}
                            >
                                <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                            </button>
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                                onClick={async () => {
                                    setContextMenu(null);
                                    await removeExamFromFolder(contextMenu.exam);
                                }}
                            >
                                <Home className="h-3.5 w-3.5" /> Đưa về thư mục gốc
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                            <p className="px-2 py-1 text-[10px] uppercase font-black text-slate-400">Di chuyển tới</p>
                            {itemsAtLevel.folders.length === 0 ? (
                                <p className="px-2 py-1 text-xs text-slate-400 italic">Không có thư mục con</p>
                            ) : (
                                itemsAtLevel.folders.map((fName) => (
                                    <button
                                        key={fName}
                                        className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                                        onClick={async () => {
                                            setContextMenu(null);
                                            await moveExamToFolder(contextMenu.exam, folderUtils.joinPaths(currentFullPath, fName));
                                        }}
                                    >
                                        <Folder className="h-3.5 w-3.5 text-amber-500" />
                                        Vào thư mục: {fName}
                                    </button>
                                ))
                            )}
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-rose-600 hover:bg-rose-50 inline-flex items-center gap-2"
                                onClick={() => {
                                    setContextMenu(null);
                                    setDeleteTarget(contextMenu.exam.id);
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Xóa đề thi
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <p className="px-2 py-1 text-[11px] font-bold text-slate-500 truncate">
                                Thư mục: {contextMenu.folderName}
                            </p>
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                                onClick={() => {
                                    const name = contextMenu.folderName;
                                    setContextMenu(null);
                                    setCurrentPath([...currentPath, name]);
                                }}
                            >
                                <Folder className="h-3.5 w-3.5 text-amber-500" /> Mở thư mục
                            </button>
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                                onClick={async () => {
                                    const name = contextMenu.folderName;
                                    setContextMenu(null);
                                    await renameFolder(name);
                                }}
                            >
                                <Pencil className="h-3.5 w-3.5 text-slate-400" /> Đổi tên thư mục
                            </button>
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 inline-flex items-center gap-2"
                                onClick={async () => {
                                    const name = contextMenu.folderName;
                                    setContextMenu(null);
                                    await clearFolder(name);
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Xóa thư mục
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
                initialFolderPath={currentFullPath}
            />

            <ManualExamDialog
                open={showManual}
                onClose={() => setShowManual(false)}
                onSave={handleSmartImport}
                initialSubject={selectedSubject}
                initialFolderPath={currentFullPath}
            />
        </div>
    );
}
