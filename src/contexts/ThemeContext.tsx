import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ── Types ──
export interface ThemeSettings {
    mode: 'light' | 'dark';
    accentColor: string;
    fontSize: 'small' | 'medium' | 'large';
    customBackground?: string;
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

    // Font size
    root.style.fontSize = FONT_SIZES[settings.fontSize] || '16px';
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
