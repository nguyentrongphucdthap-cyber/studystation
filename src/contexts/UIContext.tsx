import { createContext, useContext, useState, ReactNode } from 'react';

interface UIContextType {
    isTakingExam: boolean;
    setTakingExam: (val: boolean) => void;
    isHubForcedVisible: boolean;
    setHubForcedVisible: (val: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
    const [isTakingExam, setTakingExam] = useState(false);
    const [isHubForcedVisible, setHubForcedVisible] = useState(false);

    return (
        <UIContext.Provider value={{ isTakingExam, setTakingExam, isHubForcedVisible, setHubForcedVisible }}>
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
}
