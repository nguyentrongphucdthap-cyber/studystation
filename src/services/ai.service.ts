/**
 * AI Service
 * Calls Gemini API directly using Firebase API key.
 * Falls back to backend proxy if available.
 */

export interface AIChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export interface AIChatOptions {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    systemInstruction?: string;
}

const GEMINI_MODEL = 'gemini-2.0-flash';

export async function generateAIContent(messages: AIChatMessage[], options?: AIChatOptions) {
    // Check for multiple dedicated Gemini keys (e.g., VITE_GEMINI_API_KEY_1, _2, _3)
    // or a single VITE_GEMINI_API_KEY which could be comma-separated
    let apiKeys: string[] = [];

    if (import.meta.env.VITE_GEMINI_API_KEY) {
        apiKeys = apiKeys.concat(import.meta.env.VITE_GEMINI_API_KEY.split(',').map((k: string) => k.trim()).filter(Boolean));
    }
    if (import.meta.env.VITE_GEMINI_API_KEY_1) apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY_1);
    if (import.meta.env.VITE_GEMINI_API_KEY_2) apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY_2);
    if (import.meta.env.VITE_GEMINI_API_KEY_3) apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY_3);

    // Pick a random key if multiple are available
    let apiKey = '';
    if (apiKeys.length > 0) {
        apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
    } else {
        // Fallback to Firebase API key
        apiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
    }

    if (!apiKey) throw new Error('No API key found');

    const model = options?.model || GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const requestBody: Record<string, unknown> = {
            contents: messages,
            generationConfig: {
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxOutputTokens ?? 2048,
            },
        };

        // Add system instruction if provided
        if (options?.systemInstruction) {
            requestBody.system_instruction = {
                parts: [{ text: options.systemInstruction }],
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.json() as any;
            const msg = error.error?.message || 'Failed to generate AI content';
            if (response.status === 403) {
                console.error('[AI Service] 403 Error: API access is blocked. Please ensure "Generative Language API" is enabled in your Google Cloud Console and the API key is valid.');
            }
            throw new Error(msg);
        }

        const data = await response.json() as any;

        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text as string;
        }

        throw new Error('Unexpected AI response format');
    } catch (error) {
        console.error('[AI Service] Error:', error);
        throw error;
    }
}
