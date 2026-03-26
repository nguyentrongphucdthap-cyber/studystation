import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    label?: string;
}

const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-14 w-14',
};

export function Spinner({ className, size = 'md', label }: SpinnerProps) {
    return (
        <div className={cn('flex flex-col items-center gap-4', className)}>
            <div className="relative">
                {/* Outer glow/pulse */}
                <div className={cn(
                    "absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-20",
                    sizeClasses[size]
                )} />
                <Loader2 
                    className={cn(
                        'animate-spin text-primary relative z-10',
                        sizeClasses[size]
                    )} 
                />
            </div>
            {label && (
                <p className="text-sm font-bold text-gray-500 dark:text-slate-400 animate-pulse uppercase tracking-[0.2em]">{label}</p>
            )}
        </div>
    );
}

/** Full-screen loading overlay with premium book animation */
export function LoadingScreen({ label = 'Đang chuẩn bị học liệu...' }: { label?: string }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-slate-950 overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
            
            <div className="relative flex flex-col items-center max-w-xs w-full px-6">
                {/* Animated Book Stack Interaction */}
                <div className="relative h-24 w-24 mb-10">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-2 bg-gray-200 dark:bg-slate-800 rounded-full blur-md opacity-50 translate-y-12" />
                    </div>
                    
                    {/* Animated Books */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="absolute translate-y-[-10px] animate-[loading-book-1_2s_infinite_ease-in-out]">
                            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="4" y="2" width="32" height="46" rx="4" className="fill-emerald-500" />
                                <rect x="8" y="6" width="2" height="38" rx="1" fill="white" fillOpacity="0.3" />
                            </svg>
                        </div>
                        <div className="absolute translate-y-0 animate-[loading-book-2_2s_infinite_ease-in-out_0.2s]">
                            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="4" y="2" width="32" height="46" rx="4" className="fill-purple-500" />
                                <rect x="8" y="6" width="2" height="38" rx="1" fill="white" fillOpacity="0.3" />
                            </svg>
                        </div>
                        <div className="absolute translate-y-[10px] animate-[loading-book-3_2s_infinite_ease-in-out_0.4s]">
                            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="4" y="2" width="32" height="46" rx="4" className="fill-blue-500" />
                                <rect x="8" y="6" width="2" height="38" rx="1" fill="white" fillOpacity="0.3" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Progress Text */}
                <div className="flex flex-col items-center gap-3">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">StudyStation</h3>
                    <div className="flex items-center gap-2">
                        <div className="h-1 w-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="h-1 w-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="h-1 w-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                    <p className="text-[11px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-2">
                        {label}
                    </p>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes loading-book-1 {
                    0%, 100% { transform: translateY(-24px) rotate(-12deg); opacity: 0.5; }
                    50% { transform: translateY(-34px) rotate(-15deg); opacity: 1; }
                }
                @keyframes loading-book-2 {
                    0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.8; }
                    50% { transform: translateY(-10px) rotate(-2deg); opacity: 1; }
                }
                @keyframes loading-book-3 {
                    0%, 100% { transform: translateY(24px) rotate(12deg); opacity: 0.5; }
                    50% { transform: translateY(34px) rotate(15deg); opacity: 1; }
                }
            `}} />
        </div>
    );
}
