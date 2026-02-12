import { useEffect, useState } from 'react';
import { getAllNotifications, createNotification, deleteNotification } from '@/services/notification.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import type { Notification, NotificationCategory } from '@/types';
import { Plus, Trash2, Bell } from 'lucide-react';

const categoryOptions: { value: NotificationCategory; label: string; color: string }[] = [
    { value: 'new', label: 'Mới', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'update', label: 'Cập nhật', color: 'bg-blue-100 text-blue-700' },
    { value: 'fix', label: 'Sửa lỗi', color: 'bg-amber-100 text-amber-700' },
    { value: 'remove', label: 'Xóa', color: 'bg-red-100 text-red-700' },
    { value: 'edit', label: 'Chỉnh sửa', color: 'bg-purple-100 text-purple-700' },
    { value: 'info', label: 'Thông tin', color: 'bg-gray-100 text-gray-700' },
];

export default function AdminNotifications() {
    const { toast } = useToast();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [form, setForm] = useState({ title: '', content: '', category: 'info' as NotificationCategory });

    useEffect(() => { load(); }, []);
    async function load() { setLoading(true); setNotifications(await getAllNotifications()); setLoading(false); }

    const handleCreate = async () => {
        if (!form.title.trim()) { toast({ title: 'Vui lòng nhập tiêu đề', type: 'warning' }); return; }
        await createNotification({ title: form.title, content: form.content, category: form.category, author: '' });
        toast({ title: 'Đã tạo thông báo!', type: 'success' });
        setShowCreate(false);
        setForm({ title: '', content: '', category: 'info' });
        await load();
    };

    const handleDelete = async (id: string) => {
        await deleteNotification(id);
        toast({ title: 'Đã xóa', type: 'success' });
        await load();
        setDeleteTarget(null);
    };

    if (loading) return <div className="flex justify-center py-10"><Spinner size="md" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2"><Bell className="h-5 w-5" /> Thông báo</h2>
                <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Tạo mới</Button>
            </div>
            <div className="space-y-3">
                {notifications.map((n) => {
                    const cat = categoryOptions.find((c) => c.value === n.category);
                    return (
                        <div key={n.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', cat?.color || 'bg-gray-100 text-gray-700')}>{n.category}</span>
                                    <span className="text-xs text-muted-foreground">{n.createdAt?.substring(0, 10)}</span>
                                </div>
                                <p className="text-sm font-semibold">{n.title}</p>
                                {n.content && <p className="text-xs text-muted-foreground mt-0.5">{n.content}</p>}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(n.id)} className="text-red-600 flex-shrink-0"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    );
                })}
                {notifications.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Không có thông báo</p>}
            </div>
            <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
                <h3 className="text-lg font-bold mb-4">Tạo thông báo mới</h3>
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-sm font-medium">Tiêu đề</label>
                        <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Nội dung</label>
                        <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Loại</label>
                        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as NotificationCategory })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary">
                            {categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreate(false)}>Hủy</Button>
                    <Button onClick={handleCreate}>Tạo</Button>
                </div>
            </Dialog>
            <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && handleDelete(deleteTarget)} title="Xóa thông báo?" message="Không thể hoàn tác." confirmText="Xóa" variant="destructive" />
        </div>
    );
}
