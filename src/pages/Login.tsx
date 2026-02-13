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
        <div className="login-bg min-h-screen flex items-center justify-center">
            <div className="w-full max-w-[420px] px-5">
                <div className="bg-white rounded-[20px] p-8 md:px-8 shadow-lg border border-gray-200 text-center page-fade-in">
                    {/* Icon */}
                    <div className="mb-6">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl mx-auto mb-4 flex items-center justify-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                <polyline points="10 17 15 12 10 7" />
                                <line x1="15" y1="12" x2="3" y2="12" />
                            </svg>
                        </div>

                        <h1 className="text-[26px] font-bold text-gray-900 mb-2">StudyStation Login</h1>
                        <div className="text-[13px] text-yellow-700 bg-yellow-50 p-2.5 rounded-lg border border-yellow-100 mb-6">
                            ⚠️ Chỉ dành cho tài khoản được cấp quyền (whitelist).
                        </div>
                    </div>

                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full py-3.5 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 text-gray-700 font-semibold text-[15px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                                <path d="M12 4.63c1.69 0 3.26.58 4.54 1.8l3.29-3.29C17.45 1.14 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        )}
                        Đăng nhập bằng Google
                    </button>

                    {/* Error message */}
                    {error && (
                        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-left text-[13px] text-red-800">
                            {error}
                        </div>
                    )}

                    {/* Register section */}
                    <div className="mt-6 pt-5 border-t border-gray-200 text-[14px] text-gray-500">
                        Bạn chưa có tài khoản?{' '}
                        <a
                            href="https://forms.gle/DiTJpf85bScCrzxT8"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 font-semibold hover:underline"
                        >
                            Đăng ký truy cập
                        </a>
                    </div>
                </div>
            </div>

            {/* Credits footer */}
            <div className="fixed bottom-5 left-0 w-full text-center text-[12px] text-gray-400 pointer-events-none">
                <p>Designed & Developed by <strong className="text-gray-500 font-semibold">Trọng Phúc</strong> | From Concept to Content by <strong className="text-gray-500 font-semibold">Phương Kiều</strong></p>
            </div>
        </div>
    );
}
