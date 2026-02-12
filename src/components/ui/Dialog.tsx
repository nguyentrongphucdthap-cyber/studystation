import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './Button';

interface DialogProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    closeOnOverlay?: boolean;
}

export function Dialog({ open, onClose, children, className, closeOnOverlay = true }: DialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open) onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={closeOnOverlay ? onClose : undefined}
            />
            {/* Content */}
            <div
                ref={dialogRef}
                className={cn(
                    'relative z-10 w-full max-w-lg rounded-xl bg-card p-6 shadow-2xl',
                    'animate-in zoom-in-95 duration-200',
                    className
                )}
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
                >
                    <X className="h-4 w-4" />
                </button>
                {children}
            </div>
        </div>
    );
}

// ============================================================
// ALERT DIALOG (replaces customDialog.alert)
// ============================================================

export type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: AlertType;
    confirmText?: string;
}

const alertIcons: Record<AlertType, string> = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
};

const alertColors: Record<AlertType, string> = {
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function AlertDialog({ open, onClose, title, message, type = 'info', confirmText = 'OK' }: AlertDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} className="max-w-sm text-center">
            <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl', alertColors[type])}>
                {alertIcons[type]}
            </div>
            <h3 className="mb-2 text-lg font-bold text-card-foreground">{title}</h3>
            <p className="mb-6 text-sm text-muted-foreground">{message}</p>
            <Button onClick={onClose} className="w-full">
                {confirmText}
            </Button>
        </Dialog>
    );
}

// ============================================================
// CONFIRM DIALOG (replaces customDialog.confirm)
// ============================================================

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
}

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    variant = 'default',
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} className="max-w-sm">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl dark:bg-amber-900/30">
                ⚠️
            </div>
            <h3 className="mb-2 text-lg font-bold text-card-foreground">{title}</h3>
            <p className="mb-6 text-sm text-muted-foreground">{message}</p>
            <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                    {cancelText}
                </Button>
                <Button
                    variant={variant === 'destructive' ? 'destructive' : 'default'}
                    onClick={() => {
                        onConfirm();
                        onClose();
                    }}
                    className="flex-1"
                >
                    {confirmText}
                </Button>
            </div>
        </Dialog>
    );
}
