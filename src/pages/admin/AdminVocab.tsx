import { useEffect, useState } from 'react';
import { getAllVocabSets, createVocabSet, deleteVocabSet } from '@/services/vocab.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { VocabSet } from '@/types';
import { Trash2, Upload, Search, Wand2, Download } from 'lucide-react';
import { downloadJSON } from '@/lib/exportUtils';
import { SmartImportDialog } from '@/components/admin/SmartImportDialog';

export default function AdminVocab() {
    const { toast } = useToast();
    const [sets, setSets] = useState<VocabSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showImport, setShowImport] = useState(false);
    const [showSmartImport, setShowSmartImport] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    useEffect(() => { loadSets(); }, []);
    async function loadSets() { setLoading(true); setSets(await getAllVocabSets()); setLoading(false); }

    const filtered = search.trim() ? sets.filter((s) => s.title.toLowerCase().includes(search.toLowerCase())) : sets;

    const handleImport = async () => {
        try {
            const data = JSON.parse(jsonInput);
            await createVocabSet({ title: data.title, category: data.category || 'topic', words: data.words });
            toast({ title: 'Đã tạo bộ từ vựng!', type: 'success' });
            setShowImport(false); setJsonInput('');
            await loadSets();
        } catch { toast({ title: 'JSON không hợp lệ', type: 'error' }); }
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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">📖 Quản lý Từ vựng</h2>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowSmartImport(true)} className="border-primary text-primary hover:bg-primary/10">
                        <Wand2 className="h-4 w-4" /> AI Smart Import
                    </Button>
                    <Button onClick={() => setShowImport(true)}><Upload className="h-4 w-4" /> Import</Button>
                </div>
            </div>
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm..." className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((set) => (
                    <div key={set.id} className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-sm font-semibold">{set.title}</h3>
                            <div className="flex gap-1 -mt-1 -mr-1">
                                <Button variant="ghost" size="icon" onClick={() => handleExportJSON(set)} className="text-blue-600" title="Export JSON"><Download className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(set.id)} className="text-red-600" title="Xóa"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        </div>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700 font-medium">{set.category}</span>
                            <span>{set.words.length} từ</span>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Không có bộ từ vựng nào</p>}
            </div>
            <Dialog open={showImport} onClose={() => setShowImport(false)} className="max-w-2xl">
                <h3 className="text-lg font-bold mb-4">Import Vocab Set</h3>
                <textarea value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} rows={10} placeholder='{"title":"...", "category":"gdpt", "words":[{"word":"...", "meaning":"..."}]}' className="w-full rounded-lg border border-input bg-background p-3 text-sm font-mono outline-none focus:border-primary" />
                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowImport(false)}>Hủy</Button>
                    <Button onClick={handleImport}>Import</Button>
                </div>
            </Dialog>
            <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && handleDelete(deleteTarget)} title="Xóa bộ từ vựng?" message="Không thể hoàn tác." confirmText="Xóa" variant="destructive" />

            <SmartImportDialog
                open={showSmartImport}
                onClose={() => setShowSmartImport(false)}
                onImport={handleSmartImport}
                type="vocab"
            />
        </div>
    );
}
