import { useState, useEffect, useRef } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
    sendMagoMessage, 
    saveMagoResponse, 
    subscribeToMagoMessages,
    MAGO_SYSTEM_PROMPT,
    getMagoTeachingSystemPrompt
} from '@/services/chat.service';
import { generateAIContent, type AIChatMessage } from '@/services/ai.service';
import { subscribeToMagocoins } from '@/services/magocoin.service';
import MagoText from '@/components/MagoText';
import { cn } from '@/lib/utils';

interface MagoSideChatProps {
    command?: string | null;
    onCommandProcessed?: () => void;
    hideHeader?: boolean;
}

export default function MagoSideChat({ command, onCommandProcessed, hideHeader = false }: MagoSideChatProps) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [balance, setBalance] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Subscribe to Mago messages and Magocoins
    useEffect(() => {
        if (!user?.email) return;
        
        const unsub = subscribeToMagoMessages((msgs) => {
            setMessages(msgs);
        });

        const unsubCoins = subscribeToMagocoins(user.email, (bal) => {
            setBalance(bal);
        });

        return () => {
            unsub();
            unsubCoins();
        };
    }, [user?.email]);

    // Handle incoming command (Auto-explanation)
    useEffect(() => {
        if (command && user?.email && !isTyping) {
            handleSend(command);
            onCommandProcessed?.();
        }
    }, [command, user?.email]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || !user?.email) return;

        setIsTyping(true);
        try {
            // 1. Send user message to Firebase (deducts coin automatically)
            await sendMagoMessage(trimmed);

            // 2. Prepare history for AI (last 10 messages)
            const historyForAI: AIChatMessage[] = messages.slice(-10).map((m) => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.text || '' }]
            }));
            
            historyForAI.push({
                role: 'user',
                parts: [{ text: trimmed }]
            });

            // 3. Generate response
            const teachingPrompt = await getMagoTeachingSystemPrompt(user.email);
            const systemPrompt = `${MAGO_SYSTEM_PROMPT}${teachingPrompt}\n\nBạn đang ở trong cửa sổ xem lại bài thi. Hãy giải thích ngắn gọn, súc tích và chính xác.`;
            
            const response = await generateAIContent(historyForAI, {
                systemInstruction: systemPrompt
            });

            // 4. Save AI response to Firebase
            await saveMagoResponse(response);
        } catch (err: any) {
            console.error('[MagoSideChat] Error:', err);
            let errorMsg = 'Mago đang gặp chút sự cố...';
            if (err.message === 'MAGO_LIMIT_REACHED') {
                errorMsg = 'Bạn đã hết Magocoin rồi 🧙‍♂️';
            }
            // Error handling similar to MagoChatPage
            await saveMagoResponse(errorMsg);
        } finally {
            setIsTyping(false);
            setInput('');
        }
    };

    return (
        <div className={cn(
            "flex flex-col bg-slate-50 animate-in slide-in-from-right duration-300 flex-1 min-h-0",
            !hideHeader && "h-full border-l border-border"
        )}>
            {/* Header */}
            {!hideHeader && (
                <div className="p-4 border-b bg-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Mago A.I</h3>
                            <p className="text-[10px] text-slate-400 font-medium">Trợ lý giải thích bài thi</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-full border border-amber-100">
                        <span className="text-xs font-bold text-amber-700">{balance}</span>
                        <img src="https://i.ibb.co/XkN95yrC/Gemini-Generated-Image-vpnvrgvpnvrgvpnv-removebg-preview.png" alt="coin" className="w-3.5 h-3.5" />
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && !isTyping && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                        <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center p-3 grayscale opacity-30">
                            <img src="/mago.png" alt="Mago" className="w-full h-full object-contain" />
                        </div>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                            Nhấn nút "Giải thích" ở câu hỏi <br/> hoặc nhắn tin để bắt đầu.
                        </p>
                    </div>
                )}

                {messages.map((msg, idx) => {
                    const isMago = msg.role === 'mago';
                    return (
                        <div key={idx} className={cn("flex flex-col", isMago ? "items-start" : "items-end")}>
                            <div className={cn(
                                "max-w-[90%] p-3 rounded-2xl text-sm shadow-sm",
                                isMago ? "bg-white text-slate-700 rounded-tl-none border border-slate-100" : "bg-indigo-600 text-white rounded-tr-none"
                            )}>
                                {isMago ? (
                                    <div className="prose prose-sm max-w-none">
                                        <MagoText text={msg.text} />
                                    </div>
                                ) : (
                                    <div className="font-medium whitespace-pre-wrap">{msg.text}</div>
                                )}
                            </div>
                            <span className="text-[10px] text-slate-300 mt-1 px-1">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    );
                })}

                {isTyping && (
                    <div className="flex items-start gap-2">
                        <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 flex gap-1">
                            <span className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce" />
                            <span className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <span className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                    className="flex gap-2"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Hỏi Mago về đề thi này..."
                        className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    />
                    <button 
                        type="submit"
                        disabled={!input.trim() || isTyping}
                        className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
