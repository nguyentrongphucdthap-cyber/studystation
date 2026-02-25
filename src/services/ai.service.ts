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

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

export async function generateAIContent(messages: AIChatMessage[], options?: AIChatOptions) {
    // Collect all available API keys
    let apiKeys: string[] = [];

    if (import.meta.env.VITE_GEMINI_API_KEY) {
        apiKeys = apiKeys.concat(import.meta.env.VITE_GEMINI_API_KEY.split(',').map((k: string) => k.trim()).filter(Boolean));
    }
    if (import.meta.env.VITE_GEMINI_API_KEY_1) apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY_1);
    if (import.meta.env.VITE_GEMINI_API_KEY_2) apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY_2);
    if (import.meta.env.VITE_GEMINI_API_KEY_3) apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY_3);

    if (apiKeys.length === 0) {
        apiKeys.push(import.meta.env.VITE_FIREBASE_API_KEY || '');
    }
    apiKeys = apiKeys.filter(Boolean);
    if (apiKeys.length === 0) throw new Error('No API key found');

    // Shuffle keys so we don't always hit the same one first
    for (let i = apiKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = apiKeys[i]!;
        apiKeys[i] = apiKeys[j]!;
        apiKeys[j] = tmp;
    }

    const model = options?.model || GEMINI_MODEL;
    const requestBody: Record<string, unknown> = {
        contents: messages,
        generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxOutputTokens ?? 2048,
        },
    };
    if (options?.systemInstruction) {
        requestBody.system_instruction = {
            parts: [{ text: options.systemInstruction }],
        };
    }
    const bodyStr = JSON.stringify(requestBody);

    let lastError: Error | null = null;

    // Try each key; skip to next on quota / rate-limit errors
    for (const key of apiKeys) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: bodyStr,
            });

            if (!response.ok) {
                const errData = await response.json() as any;
                const msg = errData.error?.message || 'Failed to generate AI content';

                // Quota / rate-limit → try next key
                if (response.status === 429 || (response.status === 403 && msg.toLowerCase().includes('quota'))) {
                    console.warn(`[AI Service] Key exhausted (${response.status}), trying next key...`);
                    lastError = new Error(msg);
                    continue;
                }
                throw new Error(msg);
            }

            const data = await response.json() as any;
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text as string;
            }
            throw new Error('Unexpected AI response format');
        } catch (error: any) {
            lastError = error;
            // If it's a quota error we already continued above; for network errors, also try next key
            if (error.message?.includes('quota') || error.message?.includes('rate')) {
                console.warn('[AI Service] Retrying with next key...');
                continue;
            }
            throw error;
        }
    }

    // All keys exhausted
    console.error('[AI Service] All API keys exhausted.');
    throw lastError || new Error('All API keys have exceeded their quota.');
}

// ============================================================
// API KEY HEALTH CHECK — for admin panel
// ============================================================

export interface ApiKeyStatus {
    key: string;        // masked key for display
    index: number;
    status: 'ok' | 'quota_exceeded' | 'invalid' | 'error';
    message: string;
    model: string;
}

/** Get all configured API keys (masked for display) */
export function getApiKeys(): { maskedKey: string; fullKey: string; index: number }[] {
    const keys: { maskedKey: string; fullKey: string; index: number }[] = [];
    const envKeys = [
        import.meta.env.VITE_GEMINI_API_KEY_1,
        import.meta.env.VITE_GEMINI_API_KEY_2,
        import.meta.env.VITE_GEMINI_API_KEY_3,
    ];
    envKeys.forEach((k, i) => {
        if (k) {
            keys.push({
                fullKey: k,
                maskedKey: k.slice(0, 8) + '...' + k.slice(-4),
                index: i + 1,
            });
        }
    });
    return keys;
}

/** Check a single API key's health by sending a minimal request */
export async function checkApiKeyHealth(apiKey: string): Promise<ApiKeyStatus> {
    const model = GEMINI_MODEL;
    const masked = apiKey.slice(0, 8) + '...' + apiKey.slice(-4);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
                generationConfig: { maxOutputTokens: 5 },
            }),
        });

        if (response.ok) {
            return { key: masked, index: 0, status: 'ok', message: 'Hoạt động tốt ✓', model };
        }

        const errData = await response.json() as any;
        const msg = errData.error?.message || 'Unknown error';

        if (response.status === 429 || msg.toLowerCase().includes('quota')) {
            return { key: masked, index: 0, status: 'quota_exceeded', message: 'Hết quota', model };
        }
        if (response.status === 400 || response.status === 403) {
            return { key: masked, index: 0, status: 'invalid', message: msg.slice(0, 80), model };
        }
        return { key: masked, index: 0, status: 'error', message: msg.slice(0, 80), model };
    } catch (err: any) {
        return { key: masked, index: 0, status: 'error', message: err.message || 'Network error', model };
    }
}
