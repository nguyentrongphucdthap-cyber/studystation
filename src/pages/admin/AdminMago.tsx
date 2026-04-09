import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
    Gift, Coins, Trophy, History, Plus, Trash2,
    Activity, Clock
} from 'lucide-react';
import { 
    GiftcodeData, GiftcodeHistoryData, MagocoinData,
    createGiftcode, deleteGiftcode, getAllGiftcodes,
    getGiftcodeHistory, getMagocoinLeaderboard, updateMagocoins 
} from '@/services/magocoin.service';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { Navigate } from 'react-router-dom';

export default function AdminMago() {
    const { role, isSuperAdmin, user } = useAuth();
    const isBoss = (role as string).includes('boss');
    
    // Authorization check
    if (!isSuperAdmin && !isBoss) {
        return <Navigate to="/admin" replace />;
    }

    const [activeTab, setActiveTab] = useState<'create' | 'leaderboard' | 'history'>('create');

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                    <Coins className="h-6 w-6 text-amber-500" />
                    Quản lý Magocoin & Giftcode
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Cấp phát Magocoin, tạo mã quà tặng và quản lý bảng xếp hạng.
                </p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('create')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        activeTab === 'create' 
                            ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                >
                    <Gift className="h-4 w-4" /> Cấp phát & Giftcode
                </button>
                
                {isSuperAdmin && (
                    <>
                        <button
                            onClick={() => setActiveTab('leaderboard')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                                activeTab === 'leaderboard' 
                                    ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm" 
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            )}
                        >
                            <Trophy className="h-4 w-4" /> Bảng Xếp Hạng
                        </button>
                        
                        <button
                            onClick={() => setActiveTab('history')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                                activeTab === 'history' 
                                    ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm" 
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            )}
                        >
                            <History className="h-4 w-4" /> Lịch Sử Giftcode
                        </button>
                    </>
                )}
            </div>

            {/* Tab Contents */}
            <div className="mt-6">
                {activeTab === 'create' && <TabCreate userEmail={user?.email || ''} />}
                {activeTab === 'leaderboard' && isSuperAdmin && <TabLeaderboard />}
                {activeTab === 'history' && isSuperAdmin && <TabHistory />}
            </div>
        </div>
    );
}

function TabCreate({ userEmail }: { userEmail: string }) {
    // Self-claim state
    const [claimAmount, setClaimAmount] = useState<number>(10);
    const [claiming, setClaiming] = useState(false);

    // Giftcode state
    const [code, setCode] = useState('');
    const [amount, setAmount] = useState(1);
    const [maxUses, setMaxUses] = useState(50);
    const [expiresTime, setExpiresTime] = useState('');
    const [creating, setCreating] = useState(false);

    // Handle Self Claim
    const handleSelfClaim = async () => {
        if (!claimAmount || claimAmount <= 0) return alert('Số tiền không hợp lệ!');
        if (!confirm(`Bạn muốn tự cấp trực tiếp ${claimAmount} Magocoin vào tài khoản của mình?`)) return;
        
        try {
            setClaiming(true);
            await updateMagocoins(userEmail, claimAmount);
            alert(`Thành công! Đã cộng ${claimAmount} Magocoin vào tài khoản.`);
        } catch (err: any) {
            console.error('[AdminMago] Fail self-claim:', err);
            alert('Lỗi: ' + (err.message || 'Không thể cấp coin.'));
        } finally {
            setClaiming(false);
        }
    };

    // Handle Create Giftcode
    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCode = code.trim().toUpperCase();
        if (!cleanCode) return alert('Vui lòng nhập mã code');
        if (amount <= 0) return alert('Số lượng tiền thưởng phải lớn hơn 0');
        if (maxUses <= 0) return alert('Giới hạn lượt dùng phải từ 1 lượt trở lên');

        try {
            setCreating(true);
            let expireDate = undefined;
            if (expiresTime) {
                const date = new Date(expiresTime);
                if (date <= new Date()) return alert('Hạn sử dụng phải ở tương lai!');
                expireDate = date.toISOString();
            }

            await createGiftcode(cleanCode, amount, maxUses, expireDate);
            alert(`Tạo mã ${cleanCode} thành công!`);
            setCode('');
            setAmount(1);
            setMaxUses(50);
            setExpiresTime('');
        } catch (err: any) {
            alert(err.message || 'Lỗi tạo giftcode');
        } finally {
            setCreating(false);
        }
    };

    const genRandomCode = () => {
        const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
        setCode(`MAGO-${randomString}`);
    };

            </div>

            {/* Danh sách Giftcode ( Boss cũng xem được ở đây ) */}
            <div className="lg:col-span-2">
                <GiftcodeList />
            </div>
        </div>
    );
}

function GiftcodeList() {
    const [codes, setCodes] = useState<GiftcodeData[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getAllGiftcodes();
            setCodes(data);
        } catch (err: any) {
            console.error('[AdminMago] Error loading codes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (code: string) => {
        if (!confirm(`Xác nhận xoá vĩnh viễn mã ${code}? Người dùng sẽ không thể sử dụng mã này nữa.`)) return;
        try {
            await deleteGiftcode(code);
            setCodes(prev => prev.filter(c => c.code !== code));
        } catch (err: any) {
            alert('Lỗi: ' + err.message);
        }
    };

    if (loading) return (
        <div className="admin-card p-12 flex flex-col items-center gap-4">
            <Spinner size="md" />
            <p className="text-sm text-slate-500">Đang tải danh sách mã code...</p>
        </div>
    );

    return (
        <div className="admin-card overflow-hidden border-t-4 border-indigo-400">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="font-bold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-500" />
                    Mã Code Đã Phát & Trạng Thái
                </h3>
                <button onClick={loadData} className="text-xs text-indigo-500 hover:underline">Làm mới</button>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-500 text-xs uppercase font-bold sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-4 py-3">Mã Code</th>
                            <th className="px-4 py-3 text-center">Trạng Thái</th>
                            <th className="px-4 py-3 text-right">Thưởng</th>
                            <th className="px-4 py-3 text-center">Đã Dùng / Max</th>
                            <th className="px-4 py-3">Hạn Dùng</th>
                            <th className="px-4 py-3 text-center">Xoá</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {codes.map(c => {
                            const isExpired = c.expiresAt && new Date() > new Date(c.expiresAt);
                            const isFull = c.currentUses >= c.maxUses;
                            const isDead = isExpired || isFull;

                            let statusBadge = (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                                    HOẠT ĐỘNG
                                </span>
                            );

                            if (isExpired) {
                                statusBadge = (
                                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-md text-[10px] font-bold border border-rose-200 dark:border-rose-800">
                                        HẾT HẠN
                                    </span>
                                );
                            } else if (isFull) {
                                statusBadge = (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-md text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                                        HẾT LƯỢT
                                    </span>
                                );
                            }
                            
                            return (
                                <tr key={c.code} className={`border-b border-slate-50 dark:border-slate-800 transition-colors ${isDead ? 'opacity-70 bg-slate-50/50 dark:bg-slate-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                    <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                        {c.code}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {statusBadge}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-amber-500">{c.amount} 🪙</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={isFull ? 'text-rose-500 font-bold' : ''}>{c.currentUses}</span> / {c.maxUses}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">
                                        {c.expiresAt ? new Date(c.expiresAt).toLocaleString('vn-VN') : (
                                            <span className="text-slate-400 italic">Vô hạn</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => handleDelete(c.code)} className="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {codes.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">Chưa có mã code nào được tạo.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
}

function TabLeaderboard() {
    const [data, setData] = useState<MagocoinData[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLeaderboard = () => {
        setLoading(true);
        getMagocoinLeaderboard(100)
            .then(d => {
                setData(d);
                setLoading(false);
            })
            .catch(err => {
                console.error('[AdminMago] Error leaderboard:', err);
                alert('Lỗi tải bảng xếp hạng: ' + err.message + '\n\nNếu đây là lỗi "Missing Index", vui lòng click vào link trong console để tạo index Firestore.');
                setLoading(false);
            });
    };

    useEffect(() => {
        loadLeaderboard();
    }, []);

    if (loading) return <Spinner size="lg" className="mx-auto my-12" />;

    return (
        <div className="admin-card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500"/> Bảng xếp hạng phú hộ Server (Top 100)</h3>
                <button onClick={loadLeaderboard} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <Plus className="h-4 w-4 rotate-45 transform" title="Tải lại" />
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-500 text-xs uppercase font-bold tracking-wider">
                            <th className="px-6 py-3">#</th>
                            <th className="px-6 py-3">Tài khoản (Email)</th>
                            <th className="px-6 py-3 text-right">Số Dư (🪙)</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {data.map((user, i) => (
                            <tr key={user.email} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-400">
                                    {i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{user.email}</td>
                                <td className="px-6 py-4 text-right font-bold text-amber-600 dark:text-amber-400">
                                    {Number(user.balance).toLocaleString('vn-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">Chưa có ai sở hữu Magocoin!</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function TabHistory() {
    const [codes, setCodes] = useState<GiftcodeData[]>([]);
    const [history, setHistory] = useState<GiftcodeHistoryData[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [c, h] = await Promise.all([
                getAllGiftcodes(),
                getGiftcodeHistory(150)
            ]);
            setCodes(c);
            setHistory(h);
        } catch (err: any) {
            console.error('[AdminMago] Error loading history:', err);
            alert('Lỗi tải dữ liệu: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (code: string) => {
        if (!confirm(`Xác nhận xoá vĩnh viễn mã ${code}? Người dùng sẽ không thể sử dụng mã này nữa.`)) return;
        await deleteGiftcode(code);
        setCodes(prev => prev.filter(c => c.code !== code));
    };

    if (loading) return <Spinner size="lg" className="mx-auto my-12" />;

    return (
        <div className="space-y-6">
            {/* List Active Giftcodes */}
            <GiftcodeList />

            {/* History logs */}
            <div className="admin-card overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="font-bold">Lịch Sử Nhập Code Gần Đây</h3>
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-500 text-xs uppercase font-bold sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3">Thời gian</th>
                                <th className="px-4 py-3">Người Nhập</th>
                                <th className="px-4 py-3">Mã Code</th>
                                <th className="px-4 py-3 text-right">Nhận Được</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {history.map(h => (
                                <tr key={h.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                                        <Clock className="w-3 h-3 inline mr-1" />
                                        {new Date(h.timestamp).toLocaleString('vn-VN')}
                                    </td>
                                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">{h.redeemedBy}</td>
                                    <td className="px-4 py-2.5 font-mono text-indigo-500">{h.code}</td>
                                    <td className="px-4 py-2.5 text-right font-bold text-amber-500">+{h.amount} 🪙</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
