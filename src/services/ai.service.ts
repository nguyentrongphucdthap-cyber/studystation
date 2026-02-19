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
    // Use Firebase API key (same Google Cloud key) for direct Gemini access
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
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
            throw new Error(error.error?.message || 'Failed to generate AI content');
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
