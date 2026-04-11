import { useEffect, useMemo, useState } from 'react';
import { getAllEtestExams, createEtestExam, deleteEtestExam, updateEtestExam } from '@/services/etest.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { EtestExam } from '@/types';
import { 
    Trash2, Search, ChevronRight, 
    FileText, Plus, Pencil, Folder, FolderPlus, Home, ArrowUpLeft 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartImportDialog } from '@/components/admin/SmartImportDialog';
import * as folderUtils from '@/lib/folderUtils';

const ETEST_FOLDER_REGISTRY_KEY = 'admin_etest_folder_registry_v1';

export default function AdminEtest() {
    const { toast } = useToast();
    const [exams, setExams] = useState<EtestExam[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showImport, setShowImport] = useState(false);
    const [showSmartImport, setShowSmartImport] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const [newFolderName, setNewFolderName] = useState('');
    const [folderRegistry, setFolderRegistry] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem(ETEST_FOLDER_REGISTRY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    });
    const [folderActionLoading, setFolderActionLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState<
        | { type: 'exam'; exam: EtestExam; x: number; y: number }
        | { type: 'folder'; folderName: string; x: number; y: number }
        | null
    >(null);

    useEffect(() => { loadExams(); }, []);
    async function loadExams() { setLoading(true); setExams(await getAllEtestExams()); setLoading(false); }

    const currentFullPath = useMemo(() => currentPath.join('/'), [currentPath]);

    const activeFolderRegistry = useMemo(() => {
        const fromRegistry = folderRegistry;
        const fromExams = exams.map(e => (e.customFolder || '').trim()).filter(Boolean);
        return Array.from(new Set([...fromRegistry, ...fromExams]));
    }, [folderRegistry, exams]);

    const itemsAtLevel = useMemo(() => {
        const folders = folderUtils.getSubFoldersAtLevel(activeFolderRegistry, currentFullPath);
        const examsAtThisLevel = exams.filter(e => (e.customFolder || '') === currentFullPath);
        
        if (search.trim()) {
            return {
                folders: [],
                exams: exams.filter(e => e.title.toLowerCase().includes(search.toLowerCase()))
            };
        }
        return { folders, exams: examsAtThisLevel };
    }, [activeFolderRegistry, currentFullPath, exams, search]);

    useEffect(() => {
        localStorage.setItem(ETEST_FOLDER_REGISTRY_KEY, JSON.stringify(folderRegistry));
    }, [folderRegistry]);

    useEffect(() => {
        const closeContextMenu = () => setContextMenu(null);
        window.addEventListener('click', closeContextMenu);
        window.addEventListener('scroll', closeContextMenu, true);
        return () => {
            window.removeEventListener('click', closeContextMenu);
            window.removeEventListener('scroll', closeContextMenu, true);
        };
    }, []);

    const addFolderToRegistry = (folderName: string) => {
        const next = folderName.trim();
        if (!next) return;
        setFolderRegistry((prev) => {
            if (prev.some((f) => f.toLowerCase() === next.toLowerCase())) return prev;
            return [...prev, next];
        });
    };

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;
        const fullPath = folderUtils.joinPaths(currentFullPath, newFolderName.trim());
        addFolderToRegistry(fullPath);
        setNewFolderName('');
        toast({ title: 'Đã tạo thư mục', type: 'success' });
    };

    const renameFolder = async (oldNameAtLevel: string) => {
        const next = prompt('Nhập tên mới cho thư mục:', oldNameAtLevel);
        if (!next || next === oldNameAtLevel) return;

        setFolderActionLoading(true);
        try {
            const oldPath = folderUtils.joinPaths(currentFullPath, oldNameAtLevel);
            const newPath = folderUtils.joinPaths(currentFullPath, next);

            const examsToUpdate = exams.filter(e => (e.customFolder || '').startsWith(oldPath));
            for (const exam of examsToUpdate) {
                const relative = exam.customFolder!.slice(oldPath.length);
                await updateEtestExam(exam.id, { customFolder: newPath + relative });
            }

            setFolderRegistry(prev => prev.map(p => p.startsWith(oldPath) ? newPath + p.slice(oldPath.length) : p));
            await loadExams();
            toast({ title: 'Đã đổi tên thư mục', type: 'success' });
        } catch (err) {
            toast({ title: 'Lỗi khi đổi tên', type: 'error' });
        } finally {
            setFolderActionLoading(false);
        }
    };

    const clearFolder = async (folderNameAtLevel: string) => {
        if (!confirm(`Bạn có muốn xóa thư mục "${folderNameAtLevel}"? Các bài đọc bên trong sẽ được chuyển ra ngoài Thư mục gốc.`)) return;
        
        setFolderActionLoading(true);
        try {
            const targetPath = folderUtils.joinPaths(currentFullPath, folderNameAtLevel);
            const examsToMove = exams.filter(e => (e.customFolder || '').startsWith(targetPath));
            for (const exam of examsToMove) {
                await updateEtestExam(exam.id, { customFolder: '' });
            }

            setFolderRegistry(prev => prev.filter(p => !p.startsWith(targetPath)));
            await loadExams();
            toast({ title: 'Đã xóa thư mục', message: 'Dữ liệu đã được đưa về Thư mục gốc.', type: 'success' });
        } catch (err) {
            toast({ title: 'Lỗi khi xóa', type: 'error' });
        } finally {
            setFolderActionLoading(false);
        }
    };

    const moveExamToFolder = async (exam: EtestExam, targetPath: string) => {
        await updateEtestExam(exam.id, { customFolder: targetPath });
        addFolderToRegistry(targetPath);
        await loadExams();
        toast({ title: 'Đã di chuyển bài đọc', type: 'success' });
    };

    const handleImport = async () => {
        try {
            const data = JSON.parse(jsonInput);
            await createEtestExam({ 
                title: data.title, 
                tag: data.tag || '', 
                time: data.time || 60, 
                sections: data.sections || [],
                customFolder: currentFullPath
            });
            toast({ title: 'Đã tạo bài E-test!', type: 'success' });
            setShowImport(false); setJsonInput('');
            await loadExams();
        } catch { toast({ title: 'JSON không hợp lệ', type: 'error' }); }
    };

    const handleSmartImport = async (data: any) => {
        try {
            await createEtestExam({ 
                ...data,
                title: data.title, 
                tag: data.tag || '', 
                time: data.time || 60, 
                sections: data.sections || [],
                customFolder: currentFullPath
            });
            toast({ title: 'Đã tạo bài E-test!', type: 'success' });
            await loadExams();
        } catch (err: any) {
            console.error('[AdminEtest] Smart Import Error:', err);
            toast({ title: 'Lỗi', message: err.message || 'Không thể tạo bài E-test.', type: 'error' });
            throw err;
        }
    };

    const handleDelete = async (id: string) => {
        await deleteEtestExam(id);
        toast({ title: 'Đã xóa', type: 'success' });
        await loadExams();
        setDeleteTarget(null);
    };

    if (loading) return <div className="flex justify-center py-10"><Spinner size="md" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Header / Search Area */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between admin-card p-4">
                <div>
                     <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText className="h-6 w-6 text-blue-600" /> Quản lý E-test
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Tổng cộng {exams.length} bài đọc trong kho lưu trữ</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" value={search} onChange={(e) => setSearch(e.target.value)} 
                            placeholder="Tìm kiếm bài đọc..." 
                            className="w-full rounded-xl border-none bg-slate-50 dark:bg-slate-800 py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/50" 
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowSmartImport(true)} className="rounded-xl border-blue-200 text-blue-600 font-bold h-10">
                            AI Smart
                        </Button>
                        <Button onClick={() => setShowImport(true)} className="bg-blue-600 hover:bg-blue-700 h-10 w-10 p-0 rounded-xl shadow-lg">
                            <Plus className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Explorer Toolbar / Breadcrumbs */}
            <div className="admin-card p-1">
                <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                        <button
                            onClick={() => setCurrentPath([])}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                currentPath.length === 0 
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
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
                                            ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
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
                                type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                                placeholder="Thư mục mới..."
                                className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-1.5 pl-9 pr-3 text-xs focus:ring-2 focus:ring-blue-500/30 w-40"
                            />
                        </div>
                    </div>
                </div>

                {/* Grid View */}
                <div className="p-4 bg-slate-50/20 dark:bg-slate-900/10 min-h-[400px]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                        {/* Up-level button */}
                        {currentPath.length > 0 && !search.trim() && (
                            <button
                                onClick={() => setCurrentPath(currentPath.slice(0, -1))}
                                className="group flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200"
                            >
                                <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500">
                                    <ArrowUpLeft className="h-6 w-6" />
                                </div>
                                <span className="text-[11px] font-bold text-slate-400">Trở lên</span>
                            </button>
                        )}

                        {/* Folders */}
                        {itemsAtLevel.folders.map((folderName) => (
                            <div 
                                key={folderName} 
                                className="group relative" 
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ type: 'folder', folderName, x: e.clientX, y: e.clientY });
                                }}
                            >
                                <button
                                    onClick={() => setCurrentPath([...currentPath, folderName])}
                                    className="w-full flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200"
                                >
                                    <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 transition-transform group-hover:scale-110">
                                        <Folder className="h-8 w-8 fill-current" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate w-full text-center px-1">
                                        {folderName}
                                    </span>
                                </button>
                            </div>
                        ))}

                        {/* E-test Exams */}
                        {itemsAtLevel.exams.map((exam) => (
                            <div 
                                key={exam.id} 
                                className="group relative"
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ type: 'exam', exam, x: e.clientX, y: e.clientY });
                                }}
                            >
                                <div
                                    className="w-full h-full flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border border-transparent group-hover:bg-white dark:group-hover:bg-slate-800 group-hover:border-slate-200 text-center"
                                >
                                    <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 transition-transform group-hover:scale-110">
                                        <FileText className="h-8 w-8" />
                                    </div>
                                    <div className="space-y-0.5 w-full">
                                        <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">
                                            {exam.title}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                            {exam.time}m • {exam.sections?.length || 0} Passages
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Empty State */}
                    {itemsAtLevel.folders.length === 0 && itemsAtLevel.exams.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                            <FileText className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-sm font-bold uppercase tracking-widest">Thư mục trống</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-[100] min-w-[180px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-1 animate-in fade-in zoom-in duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    {contextMenu.type === 'exam' ? (
                        <div className="space-y-0.5">
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                                onClick={async () => {
                                    await moveExamToFolder(contextMenu.exam, folderUtils.joinPaths(currentFullPath, ''));
                                }}
                            >
                                <Home className="h-3.5 w-3.5" /> Đưa về gốc
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-rose-600 hover:bg-rose-50 inline-flex items-center gap-2"
                                onClick={() => {
                                    setDeleteTarget(contextMenu.exam.id);
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Xóa bài đọc
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                                onClick={() => setCurrentPath([...currentPath, contextMenu.folderName])}
                            >
                                <Folder className="h-3.5 w-3.5 text-amber-500" /> Mở thư mục
                            </button>
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                                onClick={() => renameFolder(contextMenu.folderName)}
                            >
                                <Pencil className="h-3.5 w-3.5 text-slate-400" /> Đổi tên
                            </button>
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-rose-600 hover:bg-rose-50 inline-flex items-center gap-2"
                                onClick={() => clearFolder(contextMenu.folderName)}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Xóa thư mục
                            </button>
                        </div>
                    )}
                </div>
            )}

            {folderActionLoading && (
                <div className="fixed inset-0 z-[110] bg-black/10 backdrop-blur-[1px] flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-200">
                    <div className="admin-card px-4 py-2">Đang xử lý thư mục...</div>
                </div>
            )}

            <Dialog open={showImport} onClose={() => setShowImport(false)} className="max-w-2xl rounded-[32px]">
                <h3 className="text-xl font-black mb-4">Import E-test</h3>
                <textarea value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} rows={10} placeholder="Paste JSON..." className="w-full rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 p-4 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none" />
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowImport(false)} className="rounded-xl font-bold border-gray-200">Hủy</Button>
                    <Button onClick={handleImport} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-8 shadow-lg shadow-blue-200 dark:shadow-none">Import</Button>
                </div>
            </Dialog>

            <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && handleDelete(deleteTarget)} title="Xóa bài E-test?" message="Không thể hoàn tác." confirmText="Xóa vĩnh viễn" variant="destructive" />

            <SmartImportDialog
                open={showSmartImport}
                onClose={() => setShowSmartImport(false)}
                onImport={handleSmartImport}
                type="etest"
                initialFolderPath={currentFullPath}
            />
        </div>
    );
}
