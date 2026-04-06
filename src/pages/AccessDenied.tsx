import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { submitAccessRequest, getAccessRequest } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ShieldAlert, ShieldCheck, CheckCircle2, XCircle, LogOut, Send, Zap, Heart, Shield } from 'lucide-react';
import type { AccessRequest } from '@/types';

export default function AccessDenied() {
    const { user, logout } = useAuth();
    const { toast } = useToast();
    const [message, setMessage] = useState('');
    const [request, setRequest] = useState<AccessRequest | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.email) {
            loadRequest();
        }
    }, [user?.email]);

    async function loadRequest() {
        try {
            const req = await getAccessRequest(user!.email);
            setRequest(req);
        } catch (err) {
            console.error('[AccessDenied] Error loading request:', err);
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = async () => {
        if (!user?.email) return;
        setSubmitting(true);
        try {
            await submitAccessRequest(user.email, user.displayName, user.photoURL, message);
            toast({
                title: 'Đã gửi yêu cầu!',
                message: 'Vui lòng chờ Boss phê duyệt quyền truy cập của bạn.',
                type: 'success'
            });
            await loadRequest();
        } catch (err) {
            toast({
                title: 'Lỗi gửi yêu cầu',
                message: 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.',
                type: 'error'
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-rose-100/30 dark:bg-rose-900/10 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-20%] w-[50%] h-[50%] rounded-full bg-indigo-100/30 dark:bg-indigo-900/10 blur-[100px]" />
            </div>

            <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10 animate-in fade-in zoom-in duration-700">
                {/* Left Side: Info & Marketing */}
                <div className="flex flex-col justify-center space-y-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-black uppercase tracking-wider shadow-sm">
                            <ShieldAlert className="h-3.5 w-3.5" /> Truy cập bị từ chối
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white leading-tight tracking-tight">
                            Chào mừng bạn đến với <span className="text-indigo-600 dark:text-indigo-400">StudyStation</span>
                        </h1>
                        <p className="text-lg text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-md">
                            Nền tảng học tập thông minh, lưu trữ và ôn luyện kiến thức tối ưu dành riêng cho cộng đồng học sinh tài năng.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <FeatureItem 
                            icon={CheckCircle2} 
                            title="3 KHÔNG ĐẶC QUYỀN" 
                            desc="🚫 Không quảng cáo | 🔓 Không giới hạn | 💰 Không thu phí"
                            color="text-emerald-500"
                            bgColor="bg-emerald-50"
                        />
                        <FeatureItem 
                            icon={Zap} 
                            title="Hệ thống đề thi đa dạng" 
                            desc="Hàng ngàn câu hỏi luyện thi bám sát cấu trúc đề minh họa."
                            color="text-amber-500"
                            bgColor="bg-amber-50"
                        />
                        <FeatureItem 
                            icon={Heart} 
                            title="Học tập không giới hạn" 
                            desc="Tất cả tính năng đều được mở khả dụng cho người dùng đã được duyệt."
                            color="text-rose-500"
                            bgColor="bg-rose-50"
                        />
                    </div>
                </div>

                {/* Right Side: Request Card */}
                <div className="admin-card p-8 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border-white/60 dark:border-slate-800 flex flex-col shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                        <Shield className="h-40 w-40 text-slate-900 dark:text-white" />
                    </div>

                    <div className="relative z-10 h-full flex flex-col">
                        <div className="flex items-center gap-4 mb-8">
                            {user?.photoURL ? (
                                <img src={user.photoURL} className="h-14 w-14 rounded-2xl border-2 border-white shadow-md shadow-indigo-100" />
                            ) : (
                                <div className="h-14 w-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl shadow-md">
                                    {user?.displayName?.charAt(0) || user?.email.charAt(0)}
                                </div>
                            )}
                            <div>
                                <h3 className="font-black text-slate-800 dark:text-white leading-none mb-1">{user?.displayName || 'Thành viên mới'}</h3>
                                <p className="text-xs font-medium text-slate-400">{user?.email}</p>
                            </div>
                        </div>

                        {!request ? (
                            <div className="space-y-6 flex-1">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Lời nhắn (không bắt buộc)</label>
                                    <textarea 
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Ví dụ: Mình là học sinh lớp 12A1 muốn tham gia luyện thi..."
                                        className="w-full h-32 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-none shadow-inner"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Button 
                                        onClick={handleSubmit} 
                                        isLoading={submitting} 
                                        className="w-full admin-btn-primary py-6 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 dark:shadow-none"
                                    >
                                        <Send className="h-5 w-5" /> Gửi yêu cầu truy cập
                                    </Button>
                                    <p className="text-[11px] text-center text-slate-400 font-medium italic">Vui lòng chờ Boss duyệt danh sách. Điều này thường mất vài giờ.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                {request.status === 'pending' && (
                                    <>
                                        <div className="h-20 w-20 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500 mb-2 relative">
                                            <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
                                            <Zap className="h-8 w-8" />
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-xl font-black text-slate-800 dark:text-white">Yêu cầu đang chờ duyệt</h4>
                                            <p className="text-sm text-slate-500 max-w-[240px] font-medium mx-auto italic">Boss đang kiểm tra thông tin của bạn. Vui lòng quay lại sau!</p>
                                        </div>
                                    </>
                                )}
                                {request.status === 'rejected' && (
                                    <>
                                        <div className="h-20 w-20 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500 mb-2">
                                            <XCircle className="h-10 w-10" />
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-xl font-black text-rose-600">Yêu cầu bị từ chối</h4>
                                            {request.reviewNote && (
                                                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs font-bold italic">
                                                    "{request.reviewNote}"
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                                {request.status === 'approved' && (
                                    <>
                                        <div className="h-20 w-20 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 mb-2">
                                            <ShieldCheck className="h-10 w-10" />
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-xl font-black text-emerald-600">Chúc mừng! Bạn đã được duyệt</h4>
                                            <p className="text-sm text-slate-500 font-medium">Làm mới trang để bắt đầu hành trình học tập.</p>
                                            <Button onClick={() => window.location.href = '/'} className="mt-4 bg-emerald-600 hover:bg-emerald-700 rounded-xl px-8">Vào Trang Chủ</Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="mt-auto pt-8 flex justify-center">
                            <button onClick={logout} className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-widest">
                                <LogOut className="h-3.5 w-3.5" /> Đăng xuất tài khoản
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FeatureItem({ icon: Icon, title, desc, color, bgColor }: { icon: any, title: string, desc: string, color: string, bgColor: string }) {
    return (
        <div className="flex items-start gap-4 p-4 rounded-[20px] bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/5 hover:border-indigo-100 transition-colors group">
            <div className={`p-2.5 rounded-xl ${bgColor} ${color} shadow-sm group-hover:scale-110 transition-transform`}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <h5 className="text-[13px] font-black text-slate-800 dark:text-slate-200 tracking-wide mb-0.5">{title}</h5>
                <p className="text-xs text-slate-500 font-medium italic">{desc}</p>
            </div>
        </div>
    );
}
