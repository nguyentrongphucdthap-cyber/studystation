import { useEffect, useMemo, useState } from 'react';
import { getAllVocabSets, createVocabSet, deleteVocabSet, updateVocabSet } from '@/services/vocab.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { VocabSet } from '@/types';
import { 
    Trash2, Search, Upload, Download, ChevronRight, 
    Book, FileJson, Edit2, Plus, FileSpreadsheet, X, Pencil, Folder, 
    FolderPlus, Home, ArrowUpLeft 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartImportDialog } from '@/components/admin/SmartImportDialog';
import { FlashcardEditorDialog } from '@/components/admin/FlashcardEditorDialog';
import { parseFlashcardsCSV, downloadCSVSample } from '@/services/flashcard-import.service';
import * as folderUtils from '@/lib/folderUtils';

const VOCAB_FOLDER_REGISTRY_KEY = 'admin_vocab_folder_registry_v1';

export default function AdminVocab() {
    const { toast } = useToast();
    const [sets, setSets] = useState<VocabSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showImport, setShowImport] = useState(false);
    const [showSmartImport, setShowSmartImport] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
    const [jsonInput, setJsonInput] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const [newFolderName, setNewFolderName] = useState('');
    const [folderRegistry, setFolderRegistry] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem(VOCAB_FOLDER_REGISTRY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    });
    const [folderActionLoading, setFolderActionLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState<
        | { type: 'set'; set: VocabSet; x: number; y: number }
        | { type: 'folder'; folderName: string; x: number; y: number }
        | null
    >(null);

    // Form states for import
    const [importData, setImportData] = useState<any>(null);
    const [editTarget, setEditTarget] = useState<VocabSet | null>(null);

    useEffect(() => { loadSets(); }, []);
    async function loadSets() { setLoading(true); setSets(await getAllVocabSets()); setLoading(false); }

    const currentFullPath = useMemo(() => currentPath.join('/'), [currentPath]);

    const activeFolderRegistry = useMemo(() => {
        const fromRegistry = folderRegistry;
        const fromSets = sets.map(s => (s.customFolder || '').trim()).filter(Boolean);
        return Array.from(new Set([...fromRegistry, ...fromSets]));
    }, [folderRegistry, sets]);

    const itemsAtLevel = useMemo(() => {
        const folders = folderUtils.getSubFoldersAtLevel(activeFolderRegistry, currentFullPath);
        const setsAtThisLevel = sets.filter(s => (s.customFolder || '') === currentFullPath);
        
        if (search.trim()) {
            return {
                folders: [],
                sets: sets.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
            };
        }
        return { folders, sets: setsAtThisLevel };
    }, [activeFolderRegistry, currentFullPath, sets, search]);

    useEffect(() => {
        localStorage.setItem(VOCAB_FOLDER_REGISTRY_KEY, JSON.stringify(folderRegistry));
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

            // Update all sets in this folder and subfolders
            const setsToUpdate = sets.filter(s => (s.customFolder || '').startsWith(oldPath));
            for (const set of setsToUpdate) {
                const relative = set.customFolder!.slice(oldPath.length);
                await updateVocabSet(set.id, { customFolder: newPath + relative });
            }

            // Update registry
            setFolderRegistry(prev => prev.map(p => p.startsWith(oldPath) ? newPath + p.slice(oldPath.length) : p));
            await loadSets();
            toast({ title: 'Đã đổi tên thư mục', type: 'success' });
        } catch (err) {
            toast({ title: 'Lỗi khi đổi tên', type: 'error' });
        } finally {
            setFolderActionLoading(false);
        }
    };

    const clearFolder = async (folderNameAtLevel: string) => {
        if (!confirm(`Bạn có muốn xóa thư mục "${folderNameAtLevel}"? Các bộ thẻ bên trong sẽ được chuyển ra ngoài Thư mục gốc.`)) return;
        
        setFolderActionLoading(true);
        try {
            const targetPath = folderUtils.joinPaths(currentFullPath, folderNameAtLevel);
            
            // Move sets to root
            const setsToMove = sets.filter(s => (s.customFolder || '').startsWith(targetPath));
            for (const set of setsToMove) {
                await updateVocabSet(set.id, { customFolder: '' });
            }

            // Remove from registry
            setFolderRegistry(prev => prev.filter(p => !p.startsWith(targetPath)));
            await loadSets();
            toast({ title: 'Đã xóa thư mục', message: 'Các bộ thẻ đã được đưa về Thư mục gốc.', type: 'success' });
        } catch (err) {
            toast({ title: 'Lỗi khi xóa', type: 'error' });
        } finally {
            setFolderActionLoading(false);
        }
    };

    const moveSetToFolder = async (set: VocabSet, targetPath: string) => {
        await updateVocabSet(set.id, { customFolder: targetPath });
        addFolderToRegistry(targetPath);
        await loadSets();
        toast({ title: 'Đã di chuyển bộ thẻ', type: 'success' });
    };

    const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setJsonInput(val);
        try {
            const parsed = JSON.parse(val);
            setImportData(parsed);
        } catch {
            setImportData(null);
        }
    };

    const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const result = await parseFlashcardsCSV(file);
            if (result.errors.length > 0) {
                toast({ 
                    title: 'Lưu ý khi Import', 
                    message: `Đã import được ${result.data.length} thẻ, nhưng có ${result.errors.length} lỗi.`, 
                    type: 'warning' 
                });
            }
            
            if (result.data.length > 0) {
                setEditorMode('create');
                setEditTarget({
                    id: '',
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    category: 'Chủ đề',
                    words: result.data,
                    customFolder: currentFullPath
                } as any);
                setShowEditor(true);
                setShowImport(false);
            } else {
                toast({ title: 'Lỗi', message: 'Không tìm thấy dữ liệu hợp lệ trong file.', type: 'error' });
            }
        } catch (err) {
            toast({ title: 'Lỗi', message: 'Không thể đọc file CSV.', type: 'error' });
        }
    };

    const handleImport = async () => {
        try {
            if (!importData) throw new Error();
            const { title, category, words } = importData;
            if (!title || !words) throw new Error();
            
            await createVocabSet({ title, category: category || 'topic', words, customFolder: currentFullPath });
            toast({ title: 'Đã tạo bộ thẻ!', type: 'success' });
            setShowImport(false); 
            setJsonInput('');
            setImportData(null);
            await loadSets();
        } catch { 
            toast({ title: 'Dữ liệu không hợp lệ', message: 'Yêu cầu title và words trong JSON.', type: 'error' }); 
        }
    };

    const handleSaveFromEditor = async (data: Partial<VocabSet>) => {
        try {
            if (editorMode === 'edit' && editTarget) {
                await updateVocabSet(editTarget.id, data);
                toast({ title: 'Đã cập nhật bộ thẻ!', type: 'success' });
            } else {
                await createVocabSet({ ...data, customFolder: currentFullPath } as any);
                toast({ title: 'Đã tạo bộ thẻ học mới!', type: 'success' });
            }
            setShowEditor(false);
            setEditTarget(null);
            await loadSets();
        } catch (err) {
            toast({ title: 'Lỗi', message: 'Không thể lưu bộ thẻ.', type: 'error' });
        }
    };

    const handleSmartImport = async (data: any) => {
        try {
            await createVocabSet({ 
                ...data,
                title: data.title, 
                category: data.category || 'topic', 
                words: data.words || [],
                customFolder: currentFullPath
            });
            toast({ title: 'Đã tạo bộ từ vựng!', type: 'success' });
            await loadSets();
        } catch (err: any) {
            console.error('[AdminVocab] Smart Import Error:', err);
            toast({ title: 'Lỗi', message: err.message || 'Không thể tạo bộ từ vựng.', type: 'error' });
            throw err;
        }
    };

    const handleDelete = async (id: string) => {
        await deleteVocabSet(id);
        toast({ title: 'Đã xóa', type: 'success' });
        await loadSets();
        setDeleteTarget(null);
    };

    const openEditorForCreate = () => {
        setEditorMode('create');
        setEditTarget(null);
        setShowEditor(true);
    };

    const openEditorForEdit = (set: VocabSet) => {
        setEditorMode('edit');
        setEditTarget(set);
        setShowEditor(true);
    };


    if (loading) return <div className="flex justify-center py-10"><Spinner size="md" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Header / Search Area */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between admin-card p-4">
                <div>
                     <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Book className="h-6 w-6 text-purple-600" /> Quản lý Bộ thẻ học
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Tổng cộng {sets.length} bộ thẻ trong kho lưu trữ</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" value={search} onChange={(e) => setSearch(e.target.value)} 
                            placeholder="Tìm kiếm bộ thẻ..." 
                            className="w-full rounded-xl border-none bg-slate-50 dark:bg-slate-800 py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-purple-500/50" 
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowSmartImport(true)} className="rounded-xl border-purple-200 text-purple-600 font-bold h-10">
                            AI Smart
                        </Button>
                        <Button onClick={openEditorForCreate} title="Thêm thủ công" className="bg-purple-600 hover:bg-purple-700 h-10 w-10 p-0 rounded-xl shadow-lg">
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
                                    ? "bg-purple-600 text-white shadow-md"
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
                                            ? "bg-purple-500 text-white shadow-md"
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
                                className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-1.5 pl-9 pr-3 text-xs focus:ring-2 focus:ring-purple-500/30 w-40"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="h-8 text-xs font-bold gap-1.5 rounded-lg">
                            <Upload className="h-3.5 w-3.5" /> Import
                        </Button>
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

                        {/* Vocab Sets */}
                        {itemsAtLevel.sets.map((set) => (
                            <div 
                                key={set.id} 
                                className="group relative"
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ type: 'set', set, x: e.clientX, y: e.clientY });
                                }}
                            >
                                <button
                                    onClick={() => openEditorForEdit(set)}
                                    className="w-full h-full flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 text-center"
                                >
                                    <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 transition-transform group-hover:scale-110">
                                        <Book className="h-8 w-8" />
                                    </div>
                                    <div className="space-y-0.5 w-full">
                                        <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">
                                            {set.title}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                            {set.words.length} thẻ • {set.category || 'Topic'}
                                        </p>
                                    </div>
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Empty State */}
                    {itemsAtLevel.folders.length === 0 && itemsAtLevel.sets.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                            <Book className="h-12 w-12 mb-4 opacity-20" />
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
                    {contextMenu.type === 'set' ? (
                        <div className="space-y-0.5">
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                                onClick={() => {
                                    openEditorForEdit(contextMenu.set);
                                }}
                            >
                                <Edit2 className="h-3.5 w-3.5" /> Chỉnh sửa
                            </button>
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                                onClick={async () => {
                                    await moveSetToFolder(contextMenu.set, '');
                                }}
                            >
                                <Home className="h-3.5 w-3.5" /> Đưa về gốc
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                            <button
                                className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-rose-600 hover:bg-rose-50 inline-flex items-center gap-2"
                                onClick={() => setDeleteTarget(contextMenu.set.id)}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Xóa bộ thẻ
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

            <Dialog open={showImport} onClose={() => setShowImport(false)} className="max-w-4xl rounded-[32px]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-3 rounded-2xl">
                            <Upload className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">Import Flashcards</h3>
                            <p className="text-xs text-gray-400 font-medium">Hỗ trợ định dạng JSON hoặc CSV (Excel).</p>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={() => setShowImport(false)} className="rounded-full h-10 w-10 p-0 text-gray-400 hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <FileJson className="h-3 w-3" /> JSON Format
                        </h4>
                        <textarea 
                            value={jsonInput} onChange={handleJsonChange} rows={8} 
                            placeholder='{"title":"...", "words":[{"word":"...", "meaning":"..."}]}' 
                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-[13px] font-mono outline-none focus:border-purple-600 transition-colors resize-none" 
                        />
                        <Button onClick={handleImport} disabled={!importData} className="w-full bg-slate-900 text-white font-bold rounded-xl py-6 shadow-xl disabled:opacity-50">
                            Xác nhận JSON Import
                        </Button>
                    </div>

                    <div className="space-y-4 flex flex-col justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <FileSpreadsheet className="h-3 w-3" /> CSV / EXCEL Format
                        </h4>
                        <div className="p-6 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50 text-center space-y-4 flex-1 flex flex-col justify-center relative">
                            <div className="p-4 rounded-full bg-emerald-50 text-emerald-600 w-fit mx-auto transition-transform">
                                <FileSpreadsheet className="h-8 w-8" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-600 mb-1">Kéo thả file .csv hoặc click để chọn</p>
                                <p className="text-[10px] text-gray-400 font-medium">Tiêu đề: Front, Back, Notes</p>
                            </div>
                            <input 
                                type="file" accept=".csv" onChange={handleCsvImport}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>
                        <Button variant="ghost" onClick={downloadCSVSample} className="text-emerald-600 hover:bg-emerald-50 font-bold text-xs uppercase tracking-widest">
                            <Download className="h-3 w-3 mr-2" /> Tải mẫu (.csv)
                        </Button>
                    </div>
                </div>
            </Dialog>

            <FlashcardEditorDialog
                open={showEditor}
                onClose={() => setShowEditor(false)}
                onSave={handleSaveFromEditor}
                initialData={editTarget || undefined}
                mode={editorMode}
                initialFolderPath={currentFullPath}
            />

            <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && handleDelete(deleteTarget)} title="Xóa bộ thẻ ghi nhớ?" message="Tất cả dữ liệu trong bộ thẻ này sẽ biến mất vĩnh viễn khỏi hệ thống." confirmText="Xóa vĩnh viễn" variant="destructive" />

            <SmartImportDialog
                open={showSmartImport}
                onClose={() => setShowSmartImport(false)}
                onImport={handleSmartImport}
                type="vocab"
                initialFolderPath={currentFullPath}
            />
        </div>
    );
}
