import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAllAccessRequests, approveAccessRequest, rejectAccessRequest, undoAccessRequestDecision } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { CheckCircle2, XCircle, Search, UserCheck, MessageSquare, Clock, Filter, ListChecks, History, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { AccessRequest } from '@/types';
import { cn } from '@/lib/utils';
import { formatRelativeActiveTime } from '@/lib/utils';

export default function AdminAccessRequests() {
    const { isSuperAdmin, isAdmin, user: currentUser } = useAuth();
    const { toast } = useToast();
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [note, setNote] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        loadRequests();
    }, []);

    async function loadRequests() {
        setLoading(true);
        try {
            const data = await getAllAccessRequests();
            setRequests(data);
        } catch (err) {
            console.error('[AdminAccessRequests] Error loading requests:', err);
            toast({ title: 'Lỗi tải dữ liệu', type: 'error' });
        } finally {
            setLoading(false);
        }
    }

    const handleApprove = async (id: string) => {
        setProcessingId(id);
        try {
            await approveAccessRequest(id, currentUser!.email, note);
            toast({ title: 'Đã duyệt yêu cầu!', type: 'success' });
            setNote('');
            await loadRequests();
        } catch (err) {
            toast({ title: 'Lỗi khi duyệt', type: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        setProcessingId(id);
        try {
            await rejectAccessRequest(id, currentUser!.email, note);
            toast({ title: 'Đã từ chối!', type: 'success' });
            setNote('');
            await loadRequests();
        } catch (err) {
            toast({ title: 'Lỗi khi từ chối', type: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    const handleUndo = async (req: AccessRequest) => {
        if (!isSuperAdmin && !isAdmin) return;
        setProcessingId(req.id);
        try {
            // Revert to untouched pending state and rollback granted access when applicable
            await undoAccessRequestDecision(req.id);
            toast({ title: 'Đã hoàn tác yêu cầu về trạng thái chờ', type: 'success' });
            await loadRequests();
        } catch (err) {
            toast({ title: 'Lỗi khi hoàn tác', type: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    const filtered = requests.filter(r => {
        const matchesSearch = r.email.toLowerCase().includes(search.toLowerCase()) || 
                             (r.displayName || '').toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
        return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (loading) return <div className="flex justify-center py-20"><Spinner size="md" /></div>;

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="admin-card overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900/40">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
                            <ListChecks className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Yêu cầu truy cập</h2>
                            <p className="text-sm font-medium text-slate-500 mt-0.5 flex items-center gap-2">
                                <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm", pendingCount > 0 ? "bg-amber-100 text-amber-600 animate-pulse ring-4 ring-amber-50" : "bg-slate-100 text-slate-500")}>
                                    {pendingCount} ĐANG CHỜ
                                </span>
                                <span className="text-slate-300">•</span>
                                <span>Tổng {requests.length} yêu cầu</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm email / tên người gửi..." className="w-full rounded-xl border-none bg-white dark:bg-slate-800 shadow-sm py-2.5 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/50" />
                    </div>

                    <div className="flex flex-wrap bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm">
                        <FilterButton active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} label="Đang chờ" count={pendingCount} icon={Clock} color="text-amber-500" />
                        <FilterButton active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')} label="Đã duyệt" icon={ShieldCheck} color="text-emerald-500" />
                        <FilterButton active={statusFilter === 'rejected'} onClick={() => setStatusFilter('rejected')} label="Từ chối" icon={ShieldAlert} color="text-rose-500" />
                        <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="Tất cả" icon={Filter} color="text-slate-500" />
                    </div>
                </div>
            </div>

            {/* Content Table */}
            <div className="admin-card overflow-hidden border-none p-1">
                <div className="overflow-x-auto rounded-[1.2rem]">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider text-slate-500">Người gửi</th>
                                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider text-slate-500">Lời nhắn / Lý do</th>
                                <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider text-slate-500">Người xử lý</th>
                                <th className="px-6 py-4 text-right font-bold text-xs uppercase tracking-wider text-slate-500">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/20">
                            {filtered.map((req) => (
                                <tr key={req.id} className="transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/40 group relative">
                                    <td className="px-6 py-4">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="flex items-center gap-3">
                                            <div className="shrink-0">
                                                {req.photoURL ? (
                                                    <img src={req.photoURL} alt={req.displayName || ''} className="h-10 w-10 rounded-xl border border-slate-200 shadow-sm" />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold uppercase ring-2 ring-white">
                                                        {(req.displayName || req.email).charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{req.displayName || 'Khách'}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <p className="text-[11px] font-medium text-slate-400">{req.email}</p>
                                                    <span className="text-[10px] text-slate-300">•</span>
                                                    <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                                                        <Clock className="h-2.5 w-2.5" /> {formatRelativeActiveTime(req.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="max-w-xs xl:max-w-md">
                                            {req.status === 'pending' ? (
                                                <div className={cn("inline-flex items-start gap-2 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100/50 italic text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed shadow-inner")}>
                                                    <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-indigo-400 opacity-50" />
                                                    {req.message || 'Không có lời nhắn.'}
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-block shadow-sm", req.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')}>
                                                        {req.status === 'approved' ? 'Đã phê duyệt' : 'Đã từ chối'}
                                                    </div>
                                                    {req.reviewNote && (
                                                        <p className="text-xs italic text-slate-500 mt-1 pl-1 border-l-2 border-slate-200">Ghi chú: {req.reviewNote}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {req.status !== 'pending' ? (
                                            <div className="space-y-1">
                                                <p className="text-[11px] font-black text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                                    <UserCheck className="h-3.5 w-3.5 text-indigo-500" /> {req.reviewedBy}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-400 ml-5">{new Date(req.reviewedAt!).toLocaleString('vi-VN')}</p>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] font-medium text-slate-300 italic">Đang chờ xử lý...</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {req.status === 'pending' ? (
                                            <div className="flex justify-end gap-2">
                                                <div className="relative group/note">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Ghi chú phản hồi (tùy chọn)..." 
                                                        className="h-10 w-0 group-hover/note:w-48 focus:w-48 rounded-xl bg-slate-50 border-none px-3 text-xs font-medium outline-none transition-all shadow-inner focus:ring-1 focus:ring-indigo-500/30" 
                                                        onChange={(e) => setNote(e.target.value)}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover/note:opacity-0 transition-opacity">
                                                        <MessageSquare className="h-4 w-4 text-slate-300" />
                                                    </div>
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-10 w-10 text-emerald-500 bg-emerald-50 hover:bg-emerald-600 hover:text-white rounded-xl shadow-sm transition-all"
                                                    onClick={() => handleApprove(req.id)}
                                                    disabled={processingId === req.id}
                                                >
                                                    {processingId === req.id ? <Spinner size="sm" /> : <CheckCircle2 className="h-5 w-5" />}
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-10 w-10 text-rose-500 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl shadow-sm transition-all"
                                                    onClick={() => handleReject(req.id)}
                                                    disabled={processingId === req.id}
                                                >
                                                    {processingId === req.id ? <Spinner size="sm" /> : <XCircle className="h-5 w-5" />}
                                                </Button>
                                            </div>
                                        ) : (
                                            (isSuperAdmin || isAdmin) && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="rounded-xl gap-1.5 h-8 font-black text-[10px] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 uppercase tracking-widest border border-transparent hover:border-indigo-100 transition-all opacity-0 group-hover:opacity-100"
                                                    onClick={() => handleUndo(req)}
                                                    disabled={processingId === req.id}
                                                >
                                                    {processingId === req.id ? <Spinner size="sm" /> : <History className="h-3 w-3" />} Hoàn tác
                                                </Button>
                                            )
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="py-24 text-center flex flex-col items-center gap-3 bg-white dark:bg-slate-900/20">
                            <div className="h-16 w-16 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-200 dark:text-slate-700 shadow-inner">
                                <Search className="h-8 w-8" />
                            </div>
                            <p className="text-sm font-bold text-slate-500 italic">Không tìm thấy yêu cầu nào phù hợp</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function FilterButton({ active, onClick, label, count, icon: Icon, color }: { active: boolean, onClick: () => void, label: string, count?: number, icon: any, color: string }) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                active ? "bg-slate-50 dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-400 hover:text-indigo-500 group"
            )}
        >
            <Icon className={cn("h-3.5 w-3.5", active ? color : "opacity-40 group-hover:opacity-100")} />
            <span>{label}</span>
            {count !== undefined && count > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[9px] font-black">{count}</span>
            )}
        </button>
    );
}
