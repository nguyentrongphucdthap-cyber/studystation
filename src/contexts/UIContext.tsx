import { createContext, useContext, useState, ReactNode } from 'react';

interface UIContextType {
    isTakingExam: boolean;
    setTakingExam: (val: boolean) => void;
    isHubForcedVisible: boolean;
    setHubForcedVisible: (val: boolean) => void;
    magoCommand: string | null;
    triggerMago: (command: string | null) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
    const [isTakingExam, setTakingExam] = useState(false);
    const [isHubForcedVisible, setHubForcedVisible] = useState(false);
    const [magoCommand, triggerMago] = useState<string | null>(null);

    return (
        <UIContext.Provider value={{ 
            isTakingExam, setTakingExam, 
            isHubForcedVisible, setHubForcedVisible,
            magoCommand, triggerMago 
        }}>
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
