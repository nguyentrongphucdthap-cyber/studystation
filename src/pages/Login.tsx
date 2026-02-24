import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { loginWithGoogle } from '@/services/auth.service';

export default function LoginPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (isLoading) {
        return (
            <div className="login-bg min-h-screen flex items-center justify-center">
                <div className="w-full max-w-[420px] px-5">
                    <div className="bg-white rounded-[20px] p-8 shadow-lg border border-gray-200 text-center">
                        <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                        <p className="font-medium text-gray-800">Đang kiểm tra bảo mật...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        const result = await loginWithGoogle();
        setLoading(false);
        if (!result.success && result.error) {
            setError(result.error);
        }
    };

    return (
        <div className="login-bg min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-100/40 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-100/40 blur-[120px]" />
            </div>

            <div className="w-full max-w-[440px] px-6 relative z-10">
                <div className="bg-white/80 backdrop-blur-2xl rounded-[32px] p-10 md:px-10 shadow-heavy border border-white/60 text-center page-fade-in">
                    {/* Icon */}
                    <div className="mb-8">
                        <div className="w-16 h-16 bg-blue-600 rounded-[22px] mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <span className="text-white text-2xl font-bold">S</span>
                        </div>

                        <h1 className="text-[28px] font-bold text-gray-900 mb-2 tracking-tight">StudyStation</h1>
                        <p className="text-gray-500 text-[15px] font-medium mb-6 italic opacity-80">"Elevate Your Learning Journey"</p>

                        <div className="text-[13px] text-blue-700 bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 mb-8 font-medium">
                            🔒 Truy cập giới hạn cho tài khoản Whitelist
                        </div>
                    </div>

                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full py-4 px-6 rounded-2xl border border-white bg-white hover:bg-gray-50 text-gray-700 font-bold text-[16px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-soft hover:shadow-medium hover:-translate-y-0.5 disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                                <path d="M12 4.63c1.69 0 3.26.58 4.54 1.8l3.29-3.29C17.45 1.14 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        )}
                        Tiếp tục với Google
                    </button>

                    {/* Error message */}
                    {error && (
                        <div className="mt-5 p-4 rounded-2xl bg-red-50 border border-red-100 text-left text-[14px] text-red-800 font-medium">
                            ❌ {error}
                        </div>
                    )}

                    {/* Register section */}
                    <div className="mt-8 pt-6 border-t border-gray-100 text-[14px] text-gray-400 font-medium">
                        Bạn chưa có tài khoản?{' '}
                        <a
                            href="https://forms.gle/DiTJpf85bScCrzxT8"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 font-bold hover:underline underline-offset-4"
                        >
                            Đăng ký tham gia
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
