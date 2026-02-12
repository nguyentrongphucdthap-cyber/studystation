import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/ui/Spinner';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
    children: ReactNode;
    /** Require admin role */
    requireAdmin?: boolean;
    /** Require super-admin role */
    requireSuperAdmin?: boolean;
    /** Allow guest access (e.g., Practice module) */
    allowGuest?: boolean;
}

export function ProtectedRoute({
    children,
    requireAdmin = false,
    requireSuperAdmin = false,
    allowGuest = false,
}: ProtectedRouteProps) {
    const { isAuthenticated, isLoading, isAdmin, isSuperAdmin, isGuest } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <LoadingScreen />;
    }

    // Not authenticated → redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Guest not allowed on this route
    if (isGuest && !allowGuest) {
        return <Navigate to="/practice" replace />;
    }

    // Admin required but user is not admin
    if (requireAdmin && !isAdmin) {
        return <Navigate to="/" replace />;
    }

    // Super-admin required but user is not
    if (requireSuperAdmin && !isSuperAdmin) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
