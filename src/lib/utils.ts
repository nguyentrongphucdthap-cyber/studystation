import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Detect device type (desktop vs mobile) */
export function getDeviceType(): 'desktop' | 'mobile' {
    const ua = navigator.userAgent;
    if (/Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
        return 'mobile';
    }
    return 'desktop';
}

/** Generate a unique session ID */
export function generateSessionId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Format datetime to Vietnam timezone (UTC+7) */
export function formatVietnamTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Format seconds to mm:ss */
export function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Trigger MathJax to re-render */
export function renderMathJax() {
    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise().catch((err: Error) =>
            console.warn('[MathJax] Typeset error:', err)
        );
    }
}

// Extend Window type for MathJax
declare global {
    interface Window {
        MathJax?: {
            typesetPromise: () => Promise<void>;
            typeset?: () => void;
        };
    }
}

/** Format relative active time in Vietnamese */
export function formatRelativeActiveTime(timestamp: string | number | Date | undefined): string {
    if (!timestamp) return 'Chưa có thông tin';

    const d = typeof timestamp === 'string' ? new Date(timestamp) : (typeof timestamp === 'number' ? new Date(timestamp) : timestamp);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();

    if (diffMs < 60000) return 'Vừa hoạt động';

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `Hoạt động ${diffMins} phút trước`;

    const diffHours = Math.floor(diffMins / 60);
    const minsRemaining = diffMins % 60;
    
    // Format: "Hoạt động X giờ Y phút trước (hh:mm)"
    const timeStr = d.toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
    });

    if (diffHours < 24) {
        return `Hoạt động ${diffHours} giờ ${minsRemaining} phút trước (${timeStr})`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
        return `Hoạt động ${diffDays} ngày trước (${timeStr})`;
    }

    return `Hoạt động ngày ${d.toLocaleDateString('vi-VN')} (${timeStr})`;
}
