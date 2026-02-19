import { useEffect, useState } from 'react';
import { getAllEtestExams, createEtestExam, deleteEtestExam } from '@/services/etest.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import type { EtestExam } from '@/types';
import { Trash2, Upload, Search, Wand2 } from 'lucide-react';
import { SmartImportDialog } from '@/components/admin/SmartImportDialog';

export default function AdminEtest() {
    const { toast } = useToast();
    const [exams, setExams] = useState<EtestExam[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showImport, setShowImport] = useState(false);
    const [showSmartImport, setShowSmartImport] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    useEffect(() => { loadExams(); }, []);
    async function loadExams() { setLoading(true); setExams(await getAllEtestExams()); setLoading(false); }

    const filtered = search.trim()
        ? exams.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
        : exams;

    const handleImport = async () => {
        try {
            const data = JSON.parse(jsonInput);
            await createEtestExam({ title: data.title, tag: data.tag, time: data.time, sections: data.sections });
            toast({ title: 'Đã tạo bài E-test!', type: 'success' });
            setShowImport(false); setJsonInput('');
            await loadExams();
        } catch { toast({ title: 'JSON không hợp lệ', type: 'error' }); }
    };

    const handleSmartImport = async (data: any) => {
        try {
            await createEtestExam({ title: data.title, tag: data.tag, time: data.time || 60, sections: data.sections });
            toast({ title: 'Đã tạo bài E-test!', type: 'success' });
            await loadExams();
        } catch (err) {
            toast({ title: 'Lỗi', message: 'Không thể tạo bài E-test.', type: 'error' });
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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">📝 Quản lý E-test</h2>
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
            <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-4 py-2.5 text-left font-medium">Bài đọc</th>
                            <th className="px-4 py-2.5 text-center font-medium">Tag</th>
                            <th className="px-4 py-2.5 text-center font-medium">Thời gian</th>
                            <th className="px-4 py-2.5 text-center font-medium">Passages</th>
                            <th className="px-4 py-2.5 text-center font-medium">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((exam) => (
                            <tr key={exam.id} className="border-t border-border hover:bg-accent/50">
                                <td className="px-4 py-3 font-medium">{exam.title}</td>
                                <td className="px-4 py-3 text-center"><span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{exam.tag || '—'}</span></td>
                                <td className="px-4 py-3 text-center">{exam.time} min</td>
                                <td className="px-4 py-3 text-center">{exam.sections?.length || 0}</td>
                                <td className="px-4 py-3 text-center">
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(exam.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Không có bài E-test nào</p>}
            </div>
            <Dialog open={showImport} onClose={() => setShowImport(false)} className="max-w-2xl">
                <h3 className="text-lg font-bold mb-4">Import E-test</h3>
                <textarea value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} rows={10} placeholder="Paste JSON..." className="w-full rounded-lg border border-input bg-background p-3 text-sm font-mono outline-none focus:border-primary" />
                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowImport(false)}>Hủy</Button>
                    <Button onClick={handleImport}>Import</Button>
                </div>
            </Dialog>
            <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && handleDelete(deleteTarget)} title="Xóa bài E-test?" message="Không thể hoàn tác." confirmText="Xóa" variant="destructive" />

            <SmartImportDialog
                open={showSmartImport}
                onClose={() => setShowSmartImport(false)}
                onImport={handleSmartImport}
                type="etest"
            />
        </div>
    );
}
