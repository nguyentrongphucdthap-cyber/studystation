import { cn } from '@/lib/utils';

interface SpinnerProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    label?: string;
}

const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-12 w-12 border-4',
};

export function Spinner({ className, size = 'md', label }: SpinnerProps) {
    return (
        <div className={cn('flex flex-col items-center gap-3', className)}>
            <div
                className={cn(
                    'animate-spin rounded-full border-primary/30 border-t-primary',
                    sizeClasses[size]
                )}
            />
            {label && (
                <p className="text-sm text-muted-foreground animate-pulse">{label}</p>
            )}
        </div>
    );
}

/** Full-screen loading overlay */
export function LoadingScreen({ label = 'Đang tải...' }: { label?: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
            <div className="text-center">
                {/* Logo icon */}
                <div className="mb-6 text-6xl">📚</div>
                <Spinner size="lg" label={label} />
            </div>
        </div>
    );
}
