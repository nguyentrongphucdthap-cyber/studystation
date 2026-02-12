import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingScreen } from '@/components/ui/Spinner';

// Lazy-loaded pages for code splitting
const LoginPage = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const PracticeHome = lazy(() => import('@/pages/practice/PracticeHome'));
const PracticeExam = lazy(() => import('@/pages/practice/PracticeExam'));
const EtestHome = lazy(() => import('@/pages/etest/EtestHome'));
const EtestExam = lazy(() => import('@/pages/etest/EtestExam'));
const VocabPage = lazy(() => import('@/pages/vocab/VocabPage'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminPractice = lazy(() => import('@/pages/admin/AdminPractice'));
const AdminEtest = lazy(() => import('@/pages/admin/AdminEtest'));
const AdminVocab = lazy(() => import('@/pages/admin/AdminVocab'));
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'));
const AdminStudents = lazy(() => import('@/pages/admin/AdminStudents'));

// Lazy-load AdminOverview from same file
const AdminOverview = lazy(() =>
    import('@/pages/admin/AdminDashboard').then((m) => ({ default: m.AdminOverview }))
);

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ToastProvider>
                    <Suspense fallback={<LoadingScreen />}>
                        <Routes>
                            {/* Public route */}
                            <Route path="/login" element={<LoginPage />} />

                            {/* Protected app shell */}
                            <Route
                                element={
                                    <ProtectedRoute>
                                        <AppLayout />
                                    </ProtectedRoute>
                                }
                            >
                                {/* Dashboard */}
                                <Route path="/" element={<Dashboard />} />

                                {/* Practice module (allows guest) */}
                                <Route path="/practice" element={<PracticeHome />} />
                                <Route path="/practice/:examId" element={<PracticeExam />} />

                                {/* E-test */}
                                <Route path="/etest" element={<EtestHome />} />
                                <Route path="/etest/:examId" element={<EtestExam />} />

                                {/* Vocab */}
                                <Route path="/vocab" element={<VocabPage />} />

                                {/* Admin (require admin role) */}
                                <Route
                                    element={
                                        <ProtectedRoute requireAdmin>
                                            <AdminDashboard />
                                        </ProtectedRoute>
                                    }
                                >
                                    <Route path="/admin" element={<AdminOverview />} />
                                    <Route path="/admin/practice" element={<AdminPractice />} />
                                    <Route path="/admin/etest" element={<AdminEtest />} />
                                    <Route path="/admin/vocab" element={<AdminVocab />} />
                                    <Route path="/admin/notifications" element={<AdminNotifications />} />
                                    <Route
                                        path="/admin/students"
                                        element={
                                            <ProtectedRoute requireSuperAdmin>
                                                <AdminStudents />
                                            </ProtectedRoute>
                                        }
                                    />
                                </Route>
                            </Route>

                            {/* Fallback */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Suspense>
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
