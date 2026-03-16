import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAllAllowedUsers, addAllowedUser, updateUserRole, deleteAllowedUser, updateUserClasses } from '@/services/auth.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import type { AllowedUser, ActivityLog } from '@/types';
import { Users, Plus, Trash2, Search, Shield, ShieldCheck, User, Tags, Activity, History, Clock } from 'lucide-react';
import { formatRelativeActiveTime } from '@/lib/utils';
import { getUserActivityLogsByEmail } from '@/services/auth.service';

const roleOptions = [
    { value: 'user', label: 'Học sinh', icon: User, color: 'bg-blue-100 text-blue-700' },
    { value: 'admin', label: 'Admin', icon: Shield, color: 'bg-amber-100 text-amber-700' },
    { value: 'super-admin', label: 'Super Admin', icon: ShieldCheck, color: 'bg-red-100 text-red-700' },
];

export default function AdminStudents() {
    const { toast } = useToast();
    const { isSuperAdmin, isTeacher, user: currentUserProfile } = useAuth();
    const [users, setUsers] = useState<AllowedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({ email: '', role: 'user' });
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [trackingUser, setTrackingUser] = useState<AllowedUser | null>(null);
    const [trackingLogs, setTrackingLogs] = useState<ActivityLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    useEffect(() => { loadUsers(); }, []);
    
    async function loadUsers() { 
        setLoading(true); 
        const allUsers = await getAllAllowedUsers();
        
        if (isSuperAdmin) {
            setUsers(allUsers);
        } else if (isTeacher) {
            // Find current teacher's meta
            const teacherMeta = allUsers.find(u => u.email === currentUserProfile?.email);
            const assigned = teacherMeta?.assignedClasses || [];
            
            // Filter list: only students in assigned classes
            const myStudents = allUsers.filter(u => {
                // Must be a normal user (student)
                if (u.role !== 'user') return false;
                // Must be in one of the teacher's classes
                return (u.classes || []).some(c => assigned.includes(c));
            });
            setUsers(myStudents);
        } else {
            setUsers([]);
        }
        setLoading(false); 
    }

    const filtered = search.trim() ? users.filter((u: AllowedUser) => u.email.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())) : users;

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

    const handleUpdateClasses = async (email: string, classesStr: string) => {
        const classes = classesStr.split(',').map(s => s.trim()).filter(Boolean);
        await updateUserClasses(email, classes);
        toast({ title: 'Đã cập nhật lớp', type: 'success' });
        await loadUsers();
    };

    const handleDelete = async (email: string) => {
        await deleteAllowedUser(email);
        toast({ title: 'Đã xóa', type: 'success' });
        await loadUsers();
        setDeleteTarget(null);
    };

    const handleTrackUser = async (user: AllowedUser) => {
        setTrackingUser(user);
        setLoadingLogs(true);
        try {
            const logs = await getUserActivityLogsByEmail(user.email);
            setTrackingLogs(logs as ActivityLog[]);
        } catch (error: any) {
            console.error('[Track] Error loading logs for', user.email, ':', error);
            // If it's an index error, the error message often contains a link
            const message = error?.message || '';
            if (message.includes('index')) {
                toast({ title: 'Thiếu Index Firestore', type: 'error', message: 'Vui lòng kiểm tra console để tạo index.' });
            } else {
                toast({ title: 'Lỗi tải log', type: 'error' });
            }
        }
        setLoadingLogs(false);
    };

    if (loading) return <div className="flex justify-center py-10"><Spinner size="md" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between admin-card p-4">
                <div className="flex items-center gap-3 pl-2">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg dark:bg-indigo-900/30 dark:text-indigo-400">
                        <Users className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Quản lý học sinh</h2>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">Tổng cộng {users.length} tài khoản</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="relative w-full max-w-xs sm:w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm email / tên..." className="w-full rounded-xl border-none bg-slate-50 dark:bg-slate-800 shadow-inner py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
                    </div>
                    <Button onClick={() => setShowAdd(true)} className="admin-btn-primary rounded-xl gap-2 font-semibold whitespace-nowrap"><Plus className="h-4 w-4" /> Thêm mới</Button>
                </div>
            </div>

            <div className="admin-card overflow-hidden border-none p-1">
                <div className="overflow-x-auto rounded-[1.2rem]">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider text-slate-500">Học sinh</th>
                                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider text-slate-500">Lớp học</th>
                                {isSuperAdmin && <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider text-slate-500">Hoạt động</th>}
                                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider text-slate-500">Phân quyền</th>
                                {isSuperAdmin && <th className="px-6 py-4 text-center font-bold text-xs uppercase tracking-wider text-slate-500">Thay đổi quyền</th>}
                                <th className="px-6 py-4 text-right font-bold text-xs uppercase tracking-wider text-slate-500">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/20">
            {filtered.map((u: AllowedUser) => {
                                const roleId = roleOptions.find((r) => u.role === r.value)?.value || 'user';
                                const role = roleOptions.find((r) => r.value === roleId);
                                const RoleIcon = role?.icon || User;
                                const roleColor = role?.color || 'bg-slate-100 text-slate-700';
                                const roleLabel = role?.label || 'Không xác định';

                                return (
                                    <tr key={u.email} className="transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/40 group relative">
                                        <td className="px-6 py-4">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 font-bold uppercase shrink-0 shadow-sm">
                                                    {u.email.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{u.name || 'Người dùng chưa cập nhật tên'}</p>
                                                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {(u.classes || []).map((c: string) => (
                                                        <span key={c} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold border border-blue-100">{c}</span>
                                                    ))}
                                                    {(u.classes || []).length === 0 && <span className="text-[10px] text-slate-400 italic">Chưa xếp lớp</span>}
                                                </div>
                                                <div className="relative">
                                                    <Tags className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                                    <input 
                                                        type="text" 
                                                        defaultValue={(u.classes || []).join(', ')}
                                                        onBlur={(e) => handleUpdateClasses(u.email, e.target.value)}
                                                        placeholder="Nhập lớp (VD: 10A1, 10A2)..."
                                                        className="w-full text-[11px] bg-slate-50 border-none rounded-md pl-7 pr-2 py-1 outline-none focus:ring-1 focus:ring-blue-500/30"
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                                        <Clock className="h-3 w-3 text-indigo-500" />
                                                        {formatRelativeActiveTime(u.lastActive)}
                                                    </span>
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <div className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold text-[11px] shadow-sm', roleColor)}>
                                                <RoleIcon className="h-3 w-3" />
                                                {roleLabel}
                                            </div>
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-block relative">
                                                    <select
                                                        value={u.role}
                                                        onChange={(e) => handleRoleChange(u.email, e.target.value)}
                                                        className={cn("appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 pl-3 pr-8 text-xs font-semibold shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer hover:border-indigo-300 transition-colors", roleColor)}
                                                    >
                                                        {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                    </div>
                                                </div>
                                            </td>
                                        )}
                                         <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                                {isSuperAdmin && (
                                                    <Button variant="ghost" size="icon" onClick={() => handleTrackUser(u)} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 h-8 w-8 rounded-lg" title="Xem lịch sử hoạt động">
                                                        <Activity className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u.email)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 h-8 w-8 rounded-lg" title="Xóa người dùng">
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
                            <p className="text-sm font-bold text-slate-500">Không tìm thấy người dùng nào</p>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={showAdd} onClose={() => setShowAdd(false)}>
                <div className="p-1">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                            <Plus className="h-5 w-5" />
                        </div>
                        Thêm học sinh mới
                    </h3>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Địa chỉ Email</label>
                            <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="email@example.com" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Phân quyền (Role)</label>
                            <div className="relative">
                                <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner cursor-pointer">
                                    {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl font-semibold border-slate-200 text-slate-600 hover:bg-slate-100">Hủy bỏ</Button>
                        <Button onClick={handleAdd} className="admin-btn-primary rounded-xl font-semibold px-6">Thêm người dùng</Button>
                    </div>
                </div>
            </Dialog>
            <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && handleDelete(deleteTarget)} title="Xóa người dùng?" message="Người dùng sẽ không thể truy cập nữa." confirmText="Xóa" variant="destructive" />

            {/* Activity Tracking Dialog */}
            <Dialog open={!!trackingUser} onClose={() => setTrackingUser(null)}>
                <div className="p-1 max-w-2xl w-full">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                                <Activity className="h-5 w-5" />
                            </div>
                            Nhật ký: {trackingUser?.name || trackingUser?.email}
                        </h3>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {loadingLogs ? (
                            <div className="flex justify-center py-10"><Spinner size="md" /></div>
                        ) : trackingLogs.length > 0 ? (
                            <div className="space-y-3">
                                {trackingLogs.map((log) => (
                                    <div key={log.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 flex items-start justify-between gap-4">
                                        <div className="flex gap-3">
                                            <div className="mt-1 p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                <History className="h-3.5 w-3.5 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{log.moduleLabel || log.moduleName}</p>
                                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{log.deviceType || 'Unknown Device'}</p>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-bold text-indigo-500 whitespace-nowrap bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
                                            {formatRelativeActiveTime(log.timestamp)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                                <History className="h-8 w-8 opacity-20" />
                                <p className="text-sm font-bold">Chưa có nhật ký hoạt động nào</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex justify-end">
                        <Button onClick={() => setTrackingUser(null)} className="rounded-xl font-semibold px-6">Đóng</Button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
