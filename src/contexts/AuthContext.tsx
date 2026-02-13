import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { UserProfile, UserRole } from '@/types';
import {
    onAuthChange,
    checkWhitelist,
    setEntryToken,
    setUserRole,
    checkIsAdmin as isAdmin,
    checkIsSuperAdmin as isSuperAdmin,
    checkIsGuest as isGuest,
    setupSession,
    registerSession,
    startPresence,
    syncUserProfile,
    logoutUser,
} from '@/services/auth.service';

// ============================================================
// CONTEXT TYPE
// ============================================================

interface AuthContextType {
    user: UserProfile | null;
    firebaseUser: User | null;
    role: UserRole;
    isAuthenticated: boolean;
    isLoading: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isGuest: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================
// PROVIDER
// ============================================================

export function AuthProvider({ children }: { children: ReactNode }) {
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [role, setRole] = useState<UserRole>('user');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthChange(async (fbUser) => {
            if (fbUser) {
                // User is signed in
                const profile: UserProfile = {
                    uid: fbUser.uid,
                    email: fbUser.email || '',
                    displayName: fbUser.displayName,
                    photoURL: fbUser.photoURL,
                };
                setFirebaseUser(fbUser);
                setUser(profile);

                // Check whitelist & role
                const { isAllowed, role: userRole } = await checkWhitelist(fbUser.email || '');
                const finalRole = isAllowed ? (userRole as UserRole) : 'guest';
                console.log('[Auth] User authenticated:', fbUser.email, 'Role:', finalRole);
                setRole(finalRole);
                setUserRole(finalRole);

                // Setup session & entry token
                setEntryToken();
                const { sessionId, deviceType } = setupSession();
                await registerSession(fbUser.email || '', sessionId, deviceType);

                // Start presence tracking & sync profile
                await startPresence();
                await syncUserProfile(fbUser);
            } else {
                // User signed out
                setFirebaseUser(null);
                setUser(null);
                setRole('user');
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = useCallback(async () => {
        await logoutUser();
        setUser(null);
        setFirebaseUser(null);
        setRole('user');
    }, []);

    const value: AuthContextType = {
        user,
        firebaseUser,
        role,
        isAuthenticated: !!user,
        isLoading,
        isAdmin: isAdmin(role),
        isSuperAdmin: isSuperAdmin(role),
        isGuest: isGuest(role),
        logout: handleLogout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================
// HOOK
// ============================================================

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
