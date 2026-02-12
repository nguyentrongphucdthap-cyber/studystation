import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { loginWithGoogle, loginWithUsername, submitRegistration } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { AlertDialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, UserPlus, LogIn } from 'lucide-react';

type View = 'login' | 'register';

export default function LoginPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();
    const [view, setView] = useState<View>('login');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [alert, setAlert] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        open: false, title: '', message: '', type: 'info',
    });

    // Login form
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // Register form
    const [regData, setRegData] = useState({
        fullName: '',
        birthDate: '',
        gender: 'Nam',
        classRoom: '',
        username: '',
        password: '',
        confirmPassword: '',
    });

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
                <Spinner size="lg" label="Đang kiểm tra đăng nhập..." />
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    const handleUsernameLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !password) return;
        setLoading(true);
        const result = await loginWithUsername(username.trim(), password);
        setLoading(false);
        if (result.success) {
            navigate('/');
        } else {
            setAlert({ open: true, title: 'Lỗi đăng nhập', message: result.error || '', type: 'error' });
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        const result = await loginWithGoogle();
        setLoading(false);
        if (result.success) {
            navigate('/');
        } else if (result.error) {
            setAlert({ open: true, title: 'Lỗi', message: result.error, type: 'error' });
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (regData.password !== regData.confirmPassword) {
            setAlert({ open: true, title: 'Lỗi', message: 'Mật khẩu xác nhận không khớp.', type: 'error' });
            return;
        }
        if (regData.password.length < 6) {
            setAlert({ open: true, title: 'Lỗi', message: 'Mật khẩu phải có ít nhất 6 ký tự.', type: 'error' });
            return;
        }
        setLoading(true);
        const result = await submitRegistration(regData);
        setLoading(false);
        if (result.success) {
            setAlert({ open: true, title: 'Thành công!', message: 'Tạo tài khoản thành công. Đang đăng nhập...', type: 'success' });
            setTimeout(() => navigate('/'), 1500);
        } else {
            setAlert({ open: true, title: 'Lỗi đăng ký', message: result.error || '', type: 'error' });
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
            {/* Background decoration */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl dark:bg-blue-800/20" />
                <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-800/20" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-purple-200/20 blur-3xl dark:bg-purple-900/10" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="mb-8 text-center">
                    <div className="mb-3 text-6xl">📚</div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                        StudyStation
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Nền tảng luyện thi trực tuyến
                    </p>
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-border/50 bg-card/80 p-6 shadow-2xl backdrop-blur-xl">
                    {/* Tab switcher */}
                    <div className="mb-6 flex rounded-lg bg-muted p-1">
                        <button
                            onClick={() => setView('login')}
                            className={cn(
                                'flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all',
                                view === 'login'
                                    ? 'bg-background text-foreground shadow'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <LogIn className="h-4 w-4" /> Đăng nhập
                        </button>
                        <button
                            onClick={() => setView('register')}
                            className={cn(
                                'flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all',
                                view === 'register'
                                    ? 'bg-background text-foreground shadow'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <UserPlus className="h-4 w-4" /> Đăng ký
                        </button>
                    </div>

                    {view === 'login' ? (
                        /* ==================== LOGIN FORM ==================== */
                        <form onSubmit={handleUsernameLogin} className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-foreground">
                                    Tên đăng nhập
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nhập tên đăng nhập"
                                    required
                                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-foreground">
                                    Mật khẩu
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Nhập mật khẩu"
                                        required
                                        className="w-full rounded-lg border border-input bg-background px-4 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                                Đăng nhập
                            </Button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">hoặc</span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                size="lg"
                                onClick={handleGoogleLogin}
                                isLoading={loading}
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Đăng nhập bằng Google
                            </Button>
                        </form>
                    ) : (
                        /* ==================== REGISTER FORM ==================== */
                        <form onSubmit={handleRegister} className="space-y-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium">Họ và tên</label>
                                <input
                                    type="text"
                                    value={regData.fullName}
                                    onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                                    required
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Ngày sinh</label>
                                    <input
                                        type="date"
                                        value={regData.birthDate}
                                        onChange={(e) => setRegData({ ...regData, birthDate: e.target.value })}
                                        required
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Giới tính</label>
                                    <select
                                        value={regData.gender}
                                        onChange={(e) => setRegData({ ...regData, gender: e.target.value })}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option>Nam</option>
                                        <option>Nữ</option>
                                        <option>Khác</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Lớp</label>
                                <input
                                    type="text"
                                    value={regData.classRoom}
                                    onChange={(e) => setRegData({ ...regData, classRoom: e.target.value })}
                                    placeholder="Ví dụ: 12A1"
                                    required
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Tên đăng nhập</label>
                                <input
                                    type="text"
                                    value={regData.username}
                                    onChange={(e) => setRegData({ ...regData, username: e.target.value })}
                                    placeholder="Chỉ dùng chữ cái và số"
                                    required
                                    pattern="[a-zA-Z0-9]+"
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Mật khẩu</label>
                                <input
                                    type="password"
                                    value={regData.password}
                                    onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                                    placeholder="Ít nhất 6 ký tự"
                                    required
                                    minLength={6}
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Xác nhận mật khẩu</label>
                                <input
                                    type="password"
                                    value={regData.confirmPassword}
                                    onChange={(e) => setRegData({ ...regData, confirmPassword: e.target.value })}
                                    required
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                                <UserPlus className="h-4 w-4" /> Tạo tài khoản
                            </Button>
                        </form>
                    )}
                </div>

                <p className="mt-4 text-center text-xs text-muted-foreground">
                    © 2024 StudyStation. Made with ❤️
                </p>
            </div>

            <AlertDialog
                open={alert.open}
                onClose={() => setAlert({ ...alert, open: false })}
                title={alert.title}
                message={alert.message}
                type={alert.type}
            />
        </div>
    );
}
