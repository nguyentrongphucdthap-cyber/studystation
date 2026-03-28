import { useEffect, useState } from 'react';
import { getAllVocabSets, createVocabSet, deleteVocabSet, updateVocabSet } from '@/services/vocab.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { VocabSet } from '@/types';
import { Trash2, Upload, Search, Wand2, Download, Book, FileJson, Edit2, Plus, FileSpreadsheet, X } from 'lucide-react';
import { downloadJSON } from '@/lib/exportUtils';
import { SmartImportDialog } from '@/components/admin/SmartImportDialog';
import { FlashcardEditorDialog } from '@/components/admin/FlashcardEditorDialog';
import { parseFlashcardsCSV, downloadCSVSample } from '@/services/flashcard-import.service';

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

    // Form states for import
    const [importData, setImportData] = useState<any>(null);
    const [editTarget, setEditTarget] = useState<VocabSet | null>(null);

    useEffect(() => { loadSets(); }, []);
    async function loadSets() { setLoading(true); setSets(await getAllVocabSets()); setLoading(false); }

    const filtered = search.trim() ? sets.filter((s) => s.title.toLowerCase().includes(search.toLowerCase())) : sets;

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
            
            await createVocabSet({ title, category: category || 'topic', words });
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
                await createVocabSet(data as any);
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
            await createVocabSet({ title: data.title, category: data.category || 'topic', words: data.words });
            toast({ title: 'Đã tạo bộ từ vựng!', type: 'success' });
            await loadSets();
        } catch (err) {
            toast({ title: 'Lỗi', message: 'Không thể tạo bộ từ vựng.', type: 'error' });
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

    const handleExportJSON = (set: VocabSet) => {
        downloadJSON(set, `StudyStation_Flashcards_${set.id}_${new Date().toISOString().split('T')[0]}`);
        toast({ title: 'Export hoàn tất', message: `Đã tải xuống file JSON cho bộ "${set.title}"`, type: 'success' });
    };

    if (loading) return <div className="flex justify-center py-10"><Spinner size="md" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Book className="h-6 w-6 text-purple-600" /> Quản lý Bộ thẻ học
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Hỗ trợ các môn học Tự nhiên & Xã hội với LaTeX.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button 
                        variant="outline" 
                        onClick={() => setShowSmartImport(true)} 
                        className="border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-900/50 dark:hover:bg-purple-900/20 font-bold rounded-xl"
                    >
                        <Wand2 className="h-4 w-4" /> AI Smart Import
                    </Button>
                    <Button 
                        variant="outline"
                        onClick={() => setShowImport(true)} 
                        className="border-gray-200 dark:border-slate-800 font-bold rounded-xl shadow-sm"
                    >
                        <Upload className="h-4 w-4" /> Import Data
                    </Button>
                    <Button onClick={openEditorForCreate} className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-100">
                        <Plus className="h-4 w-4" /> Thêm thủ công
                    </Button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-soft max-w-md flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400 ml-2" />
                <input 
                    type="text" 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    placeholder="Tìm kiếm bộ thẻ..." 
                    className="flex-1 bg-transparent border-none outline-none text-sm p-2" 
                />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((set) => (
                    <div key={set.id} className="group relative">
                        <div className="absolute inset-0 bg-purple-600 opacity-0 group-hover:opacity-5 blur-xl transition-opacity rounded-[24px]" />
                        <div className="relative rounded-[24px] border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-start justify-between mb-4">
                                <h3 className="text-[15px] font-black text-gray-900 dark:text-white leading-tight pr-8">{set.title}</h3>
                                <div className="flex gap-1 absolute top-4 right-4 group-hover:opacity-100 md:opacity-0 transition-opacity">
                                    <Button variant="ghost" size="icon" onClick={() => openEditorForEdit(set)} className="h-8 w-8 text-amber-600 hover:bg-amber-50" title="Chỉnh sửa chi tiết">
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleExportJSON(set)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="Export JSON">
                                        <Download className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(set.id)} className="h-8 w-8 text-red-600 hover:bg-red-50" title="Xóa">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="bg-purple-100 text-purple-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                    {set.category || 'Chủ đề'}
                                </span>
                                <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                                    • {set.words.length} thẻ
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-[32px]">
                        <Book className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Không có bộ thẻ nào</p>
                    </div>
                )}
            </div>

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
                    {/* JSON Import Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                <FileJson className="h-3 w-3" /> JSON Format
                            </h4>
                        </div>
                        <textarea 
                            value={jsonInput} 
                            onChange={handleJsonChange} 
                            rows={8} 
                            placeholder='{"title":"...", "words":[{"word":"...", "meaning":"..."}]}' 
                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-[13px] font-mono outline-none focus:border-purple-600 transition-colors resize-none" 
                        />
                        <Button onClick={handleImport} disabled={!importData} className="w-full bg-slate-900 text-white font-bold rounded-xl py-6 shadow-xl disabled:opacity-50">
                            Xác nhận JSON Import
                        </Button>
                    </div>

                    {/* CSV Import Section */}
                    <div className="space-y-4 flex flex-col justify-between">
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                <FileSpreadsheet className="h-3 w-3" /> CSV / EXCEL Format
                            </h4>
                            <div className="p-6 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50 text-center space-y-4 flex-1 flex flex-col justify-center">
                                <div className="p-4 rounded-full bg-emerald-50 text-emerald-600 w-fit mx-auto group-hover:scale-110 transition-transform">
                                    <FileSpreadsheet className="h-8 w-8" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-600 mb-1">Kéo thả file .csv hoặc click để chọn</p>
                                    <p className="text-[10px] text-gray-400 font-medium">File cần có tiêu đề cột: Front, Back, Notes</p>
                                </div>
                                <input 
                                    type="file" 
                                    accept=".csv" 
                                    onChange={handleCsvImport}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    style={{ display: 'none' }}
                                    id="csv-file-input"
                                />
                                <Button 
                                    variant="outline" 
                                    className="rounded-xl font-bold border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                >
                                    <label htmlFor="csv-file-input" className="cursor-pointer">
                                        Chọn file từ máy tính
                                    </label>
                                </Button>
                            </div>
                        </div>
                        <Button 
                            variant="ghost" 
                            onClick={downloadCSVSample}
                            className="text-emerald-600 hover:bg-emerald-50 font-bold text-xs"
                        >
                            <Download className="h-3 w-3 mr-2" />
                            Tải file CSV mẫu (.csv)
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
            />

            <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && handleDelete(deleteTarget)} title="Xóa bộ thẻ ghi nhớ?" message="Tất cả dữ liệu trong bộ thẻ này sẽ biến mất vĩnh viễn khỏi hệ thống." confirmText="Xóa vĩnh viễn" variant="destructive" />

            <SmartImportDialog
                open={showSmartImport}
                onClose={() => setShowSmartImport(false)}
                onImport={handleSmartImport}
                type="vocab"
            />
        </div>
    );
}
