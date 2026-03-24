import { useEffect, useState } from 'react';
import { getAllVocabSets, createVocabSet, deleteVocabSet } from '@/services/vocab.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { VocabSet } from '@/types';
import { Trash2, Upload, Search, Wand2, Download, Book, FileJson, CheckCircle } from 'lucide-react';
import { downloadJSON } from '@/lib/exportUtils';
import { SmartImportDialog } from '@/components/admin/SmartImportDialog';
import { cn } from '@/lib/utils';

export default function AdminVocab() {
    const { toast } = useToast();
    const [sets, setSets] = useState<VocabSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showImport, setShowImport] = useState(false);
    const [showSmartImport, setShowSmartImport] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    // Form states for import
    const [importData, setImportData] = useState<any>(null);

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

    const handleImport = async () => {
        try {
            if (!importData) throw new Error();
            const { title, category, words } = importData;
            if (!title || !words) throw new Error();
            
            await createVocabSet({ title, category: category || 'topic', words });
            toast({ title: 'Đã tạo bộ từ vựng!', type: 'success' });
            setShowImport(false); 
            setJsonInput('');
            setImportData(null);
            await loadSets();
        } catch { 
            toast({ title: 'Dữ liệu không hợp lệ', message: 'Yêu cầu title và words trong JSON.', type: 'error' }); 
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

    const handleExportJSON = (set: VocabSet) => {
        downloadJSON(set, `StudyStation_Vocab_${set.id}_${new Date().toISOString().split('T')[0]}`);
        toast({ title: 'Export hoàn tất', message: `Đã tải xuống file JSON cho bộ "${set.title}"`, type: 'success' });
    };

    if (loading) return <div className="flex justify-center py-10"><Spinner size="md" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Book className="h-6 w-6 text-purple-600" /> Quản lý Từ vựng
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Cung cấp tài nguyên học tập phong phú cho học sinh.</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        onClick={() => setShowSmartImport(true)} 
                        className="border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-900/50 dark:hover:bg-purple-900/20 font-bold rounded-xl"
                    >
                        <Wand2 className="h-4 w-4" /> AI Smart Import
                    </Button>
                    <Button onClick={() => setShowImport(true)} className="bg-gray-900 dark:bg-slate-100 dark:text-gray-900 font-bold rounded-xl shadow-lg">
                        <Upload className="h-4 w-4" /> Import JSON
                    </Button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-soft max-w-md flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400 ml-2" />
                <input 
                    type="text" 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    placeholder="Tìm kiếm bộ từ vựng..." 
                    className="flex-1 bg-transparent border-none outline-none text-sm p-2" 
                />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((set) => (
                    <div key={set.id} className="group relative">
                        <div className="absolute inset-0 bg-purple-600 opacity-0 group-hover:opacity-5 blur-xl transition-opacity rounded-[24px]" />
                        <div className="relative rounded-[24px] border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-medium hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-start justify-between mb-4">
                                <h3 className="text-[15px] font-black text-gray-900 dark:text-white leading-tight pr-8">{set.title}</h3>
                                <div className="flex gap-1 absolute top-4 right-4 group-hover:opacity-100 md:opacity-0 transition-opacity">
                                    <Button variant="ghost" size="icon" onClick={() => handleExportJSON(set)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="Export JSON">
                                        <Download className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(set.id)} className="h-8 w-8 text-red-600 hover:bg-red-50" title="Xóa">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                    set.category === 'gdpt' ? "bg-blue-100 text-blue-600" :
                                    set.category === 'advanced_gdpt' ? "bg-amber-100 text-amber-600" :
                                    "bg-purple-100 text-purple-600"
                                )}>
                                    {set.category}
                                </span>
                                <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                                    • {set.words.length} từ
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-[32px]">
                        <Book className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Không có bộ từ vựng nào</p>
                    </div>
                )}
            </div>

            <Dialog open={showImport} onClose={() => setShowImport(false)} className="max-w-4xl rounded-[32px]">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-purple-100 p-3 rounded-2xl">
                        <FileJson className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">Import Vocabulary Set</h3>
                        <p className="text-xs text-gray-400 font-medium">Nhập mã JSON vào ô bên dưới để tạo bộ từ mới.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="relative">
                            <textarea 
                                value={jsonInput} 
                                onChange={handleJsonChange} 
                                rows={12} 
                                placeholder='{"title":"...", "category":"topic", "words":[{"word":"...", "meaning":"..."}]}' 
                                className="w-full rounded-2xl border border-gray-200 bg-gray-50 dark:bg-slate-100 p-4 text-[13px] font-mono outline-none focus:border-purple-600 transition-colors" 
                            />
                        </div>
                    </div>

                    <div className={cn(
                        "rounded-2xl border-2 border-dashed p-6 flex flex-col transition-all",
                        importData ? "border-emerald-200 bg-emerald-50/30" : "border-gray-100 bg-gray-50/50"
                    )}>
                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Preview New Set</h4>
                        {importData ? (
                            <div className="space-y-3">
                                <div>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase">Tiêu đề</span>
                                    <p className="text-sm font-black text-gray-900">{importData.title}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase">Danh mục</span>
                                    <p className="text-[13px] font-bold text-gray-600">{importData.category || 'topic'}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase">Số lượng từ</span>
                                    <p className="text-sm font-bold text-gray-600">{importData.words?.length || 0} từ vựng</p>
                                </div>
                                <div className="pt-4 border-t border-emerald-100">
                                    <div className="flex items-center gap-2 text-emerald-600">
                                        <CheckCircle className="h-5 w-5" />
                                        <span className="text-[11px] font-black uppercase">Sẵn sàng để Import</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                                <FileJson className="h-10 w-10 text-gray-300 mb-3" />
                                <p className="text-xs font-bold text-gray-400">Dữ liệu không hợp lệ hoặc đang trống</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setShowImport(false)} className="rounded-xl px-6 font-bold border-gray-200">Hủy</Button>
                    <Button onClick={handleImport} disabled={!importData} className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl px-10 shadow-lg shadow-purple-100 disabled:opacity-50">
                        Xác nhận Import
                    </Button>
                </div>
            </Dialog>

            <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && handleDelete(deleteTarget)} title="Xóa bộ từ vựng?" message="Tất cả dữ liệu trong bộ từ này sẽ biến mất vĩnh viễn." confirmText="Xóa vĩnh viễn" variant="destructive" />

            <SmartImportDialog
                open={showSmartImport}
                onClose={() => setShowSmartImport(false)}
                onImport={handleSmartImport}
                type="vocab"
            />
        </div>
    );
}
