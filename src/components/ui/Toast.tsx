import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

// ============================================================
// TOAST TYPES
// ============================================================

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    title: string;
    message?: string;
    type: ToastType;
    duration: number;
}

interface ToastContextType {
    toast: (opts: { title: string; message?: string; type?: ToastType; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

// ============================================================
// TOAST PROVIDER
// ============================================================

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback(
        ({ title, message, type = 'info', duration = 4000 }: { title: string; message?: string; type?: ToastType; duration?: number }) => {
            const id = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            setToasts((prev) => [...prev.slice(-4), { id, title, message, type, duration }]);
        },
        []
    );

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
                {toasts.map((t) => (
                    <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// ============================================================
// TOAST ITEM
// ============================================================

const toastIconMap: Record<ToastType, typeof CheckCircle> = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const toastColorMap: Record<ToastType, string> = {
    success: 'border-emerald-500/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
    error: 'border-red-500/50 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    warning: 'border-amber-500/50 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
    info: 'border-blue-500/50 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    const [isExiting, setIsExiting] = useState(false);
    const Icon = toastIconMap[toast.type];

    useEffect(() => {
        const timer = setTimeout(() => setIsExiting(true), toast.duration - 300);
        const dismissTimer = setTimeout(onDismiss, toast.duration);
        return () => {
            clearTimeout(timer);
            clearTimeout(dismissTimer);
        };
    }, [toast.duration, onDismiss]);

    return (
        <div
            className={cn(
                'flex w-80 items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm transition-all duration-300',
                toastColorMap[toast.type],
                isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
            )}
        >
            <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message && <p className="mt-1 text-xs opacity-80">{toast.message}</p>}
            </div>
            <button onClick={onDismiss} className="flex-shrink-0 opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
