import { useEffect, useState } from 'react';
import { getAllAllowedUsers, addAllowedUser, updateUserRole, deleteAllowedUser } from '@/services/auth.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import type { AllowedUser } from '@/types';
import { Users, Plus, Trash2, Search, Shield, ShieldCheck, User } from 'lucide-react';

const roleOptions = [
    { value: 'user', label: 'Học sinh', icon: User, color: 'bg-blue-100 text-blue-700' },
    { value: 'admin', label: 'Admin', icon: Shield, color: 'bg-amber-100 text-amber-700' },
    { value: 'super-admin', label: 'Super Admin', icon: ShieldCheck, color: 'bg-red-100 text-red-700' },
];

export default function AdminStudents() {
    const { toast } = useToast();
    const [users, setUsers] = useState<AllowedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({ email: '', role: 'user' });
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    useEffect(() => { loadUsers(); }, []);
    async function loadUsers() { setLoading(true); setUsers(await getAllAllowedUsers()); setLoading(false); }

    const filtered = search.trim() ? users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())) : users;

    const handleAdd = async () => {
        if (!addForm.email.trim()) { toast({ title: 'Nhập email', type: 'warning' }); return; }
        await addAllowedUser(addForm.email.trim(), addForm.role);
        toast({ title: 'Đã thêm!', type: 'success' });
        setShowAdd(false);
        setAddForm({ email: '', role: 'user' });
        await loadUsers();
    };

    const handleRoleChange = async (email: string, newRole: string) => {
        await updateUserRole(email, newRole);
        toast({ title: `Đã cập nhật role → ${newRole}`, type: 'success' });
        await loadUsers();
    };

    const handleDelete = async (email: string) => {
        await deleteAllowedUser(email);
        toast({ title: 'Đã xóa', type: 'success' });
        await loadUsers();
        setDeleteTarget(null);
    };

    if (loading) return <div className="flex justify-center py-10"><Spinner size="md" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2"><Users className="h-5 w-5" /> Quản lý học sinh ({users.length})</h2>
                <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Thêm</Button>
            </div>
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm email / tên..." className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm outline-none focus:border-primary" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-4 py-2.5 text-left font-medium">Email</th>
                            <th className="px-4 py-2.5 text-left font-medium">Tên</th>
                            <th className="px-4 py-2.5 text-center font-medium">Role</th>
                            <th className="px-4 py-2.5 text-center font-medium">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((u) => {
                            const role = roleOptions.find((r) => u.role.includes(r.value)) || roleOptions[0];
                            return (
                                <tr key={u.email} className="border-t border-border hover:bg-accent/50">
                                    <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                                    <td className="px-4 py-3">{u.name || '—'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleRoleChange(u.email, e.target.value)}
                                            className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border-0 cursor-pointer', role?.color)}
                                        >
                                            {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u.email)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Không tìm thấy</p>}
            </div>
            <Dialog open={showAdd} onClose={() => setShowAdd(false)}>
                <h3 className="text-lg font-bold mb-4">Thêm học sinh</h3>
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-sm font-medium">Email</label>
                        <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Role</label>
                        <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary">
                            {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAdd(false)}>Hủy</Button>
                    <Button onClick={handleAdd}>Thêm</Button>
                </div>
            </Dialog>
            <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && handleDelete(deleteTarget)} title="Xóa người dùng?" message="Người dùng sẽ không thể truy cập nữa." confirmText="Xóa" variant="destructive" />
        </div>
    );
}
