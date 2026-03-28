import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ── Types ──
export interface ThemeSettings {
    mode: 'light' | 'dark';
    accentColor: string;
    fontSize: 'small' | 'medium' | 'large';
    customBackground?: string;
    bgEnabled: boolean;           // bật/tắt hình nền khi làm bài
    bgOpacity: number;            // 0–1, độ trong suốt của hình nền
    bgDarkness: number;           // 0–0.9, độ tối overlay
    examPadding: 'compact' | 'normal' | 'spacious'; // độ dãn vùng làm bài
    fontFamily: 'Be Vietnam Pro' | 'Roboto' | 'Times New Roman' | 'Montserrat (Đậm)';
    autoHideHub: boolean;          // tự động ẩn Flow khi làm bài
    autoSkipLearn: boolean;        // tự động bỏ qua Flashcard Learn
    autoSkipLearnDuration: number; // số giây chờ trước khi tự qua câu (1-10)
    enableMusicBackground: boolean; // đổi nền theo ảnh bài hát
}

interface ThemeContextType {
    settings: ThemeSettings;
    updateSetting: (key: keyof ThemeSettings, value: any) => void;
    resetToDefaults: () => void;
}

const THEME_KEY = 'hub_theme';

const DEFAULT_SETTINGS: ThemeSettings = {
    mode: 'light',
    accentColor: '#3b82f6',
    fontSize: 'medium',
    customBackground: undefined,
    bgEnabled: true,
    bgOpacity: 1,
    bgDarkness: 0,
    examPadding: 'normal',
    fontFamily: 'Be Vietnam Pro',
    autoHideHub: true,
    autoSkipLearn: false,
    autoSkipLearnDuration: 2,
    enableMusicBackground: true,
};

const FONT_SIZES: Record<string, string> = {
    small: '14px',
    medium: '16px',
    large: '18px',
};

// ── Apply theme to DOM ──
function applyThemeToDOM(settings: ThemeSettings) {
    const root = document.documentElement;

    // Dark mode
    root.classList.toggle('dark', settings.mode === 'dark');

    // Accent color — also compute RGB for alpha variants
    root.style.setProperty('--accent-color', settings.accentColor);

    // Parse hex to RGB for rgba() usage
    const hex = settings.accentColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);

    // Convert hex to HSL hue for dynamic gradients
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    const d = max - min;
    if (d !== 0) {
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else if (max === b) h = (r - g) / d + 4;
        h /= 6;
    }
    root.style.setProperty('--accent-hue', Math.round(h * 360).toString());

    // Font size
    root.style.fontSize = FONT_SIZES[settings.fontSize] || '16px';

    // Font Family
    if (settings.fontFamily === 'Roboto') {
        document.body.style.fontFamily = '"Roboto", sans-serif';
        document.body.style.fontWeight = 'normal';
    } else if (settings.fontFamily === 'Times New Roman') {
        document.body.style.fontFamily = '"Times New Roman", Times, serif';
        document.body.style.fontWeight = 'normal';
    } else if (settings.fontFamily === 'Montserrat (Đậm)') {
        document.body.style.fontFamily = '"Montserrat", sans-serif';
        document.body.style.fontWeight = '700';
    } else {
        // Mặc định
        document.body.style.fontFamily = '"Be Vietnam Pro", "Plus Jakarta Sans", sans-serif';
        document.body.style.fontWeight = 'normal';
    }
}

// ── Context ──
const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<ThemeSettings>(() => {
        try {
            const saved = localStorage.getItem(THEME_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch { /* ignore */ }
        return DEFAULT_SETTINGS;
    });

    // Apply on mount + whenever settings change
    useEffect(() => {
        applyThemeToDOM(settings);
    }, [settings]);

    const updateSetting = useCallback((key: keyof ThemeSettings, value: any) => {
        setSettings(prev => {
            const updated = { ...prev, [key]: value };
            try { localStorage.setItem(THEME_KEY, JSON.stringify(updated)); } catch { /* */ }
            return updated;
        });
    }, []);

    const resetToDefaults = useCallback(() => {
        setSettings(DEFAULT_SETTINGS);
        try { localStorage.setItem(THEME_KEY, JSON.stringify(DEFAULT_SETTINGS)); } catch { /* */ }
    }, []);

    return (
        <ThemeContext.Provider value={{ settings, updateSetting, resetToDefaults }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}