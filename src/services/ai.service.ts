/**
 * AI Service
 * - Production: Routes through Cloudflare Workers proxy (/api/ai/generate)
 *   → API keys stay server-side, never exposed in client JS bundle
 * - Local dev: Calls Gemini API directly using .env.local keys
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
    responseMimeType?: string;
}

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

/** Check if running in local dev environment */
function isLocalDev(): boolean {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export async function generateAIContent(messages: AIChatMessage[], options?: AIChatOptions) {
    // In production → use server-side proxy (keys hidden)
    if (!isLocalDev()) {
        return generateViaProxy(messages, options);
    }

    // In local dev → call Gemini directly using .env.local keys
    return generateDirectly(messages, options);
}

// ============================================================
// PRODUCTION: Server-side proxy
// ============================================================

async function generateViaProxy(messages: AIChatMessage[], options?: AIChatOptions): Promise<string> {
    const model = options?.model || GEMINI_MODEL;
    const requestBody: Record<string, unknown> = {
        model,
        contents: messages,
        generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxOutputTokens ?? 8192,
            ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {})
        },
    };
    if (options?.systemInstruction) {
        requestBody.system_instruction = {
            parts: [{ text: options.systemInstruction }],
        };
    }

    console.log('[AI Service] Using server-side proxy');

    const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errData = await response.json() as any;
        throw new Error(errData.error || 'AI proxy request failed');
    }

    const data = await response.json() as any;
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text as string;
    }
    throw new Error('Unexpected AI response format');
}

// ============================================================
// LOCAL DEV: Direct Gemini API calls
// ============================================================

async function generateDirectly(messages: AIChatMessage[], options?: AIChatOptions): Promise<string> {
    // Collect all available API keys from .env.local
    // Use dynamic access to prevent Vite from embedding keys in production bundle
    let apiKeys: string[] = [];

    const env = import.meta.env;
    const keyNames = ['VITE_GEMINI_API_KEY', 'VITE_GEMINI_API_KEY_1', 'VITE_GEMINI_API_KEY_2', 'VITE_GEMINI_API_KEY_3'];
    for (const name of keyNames) {
        const val = env[name];
        if (val) {
            if (name === 'VITE_GEMINI_API_KEY') {
                apiKeys = apiKeys.concat(val.split(',').map((k: string) => k.trim()).filter(Boolean));
            } else {
                apiKeys.push(val);
            }
        }
    }

    if (apiKeys.length === 0) {
        console.warn('[AI Service] No Gemini keys found, falling back to Firebase key.');
        apiKeys.push(env['VITE_FIREBASE_API_KEY'] || '');
    } else {
        console.log(`[AI Service] Found ${apiKeys.length} Gemini keys (local dev).`);
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
            maxOutputTokens: options?.maxOutputTokens ?? 8192,
            ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {})
        },
    };
    if (options?.systemInstruction) {
        requestBody.system_instruction = {
            parts: [{ text: options.systemInstruction }],
        };
    }
    const bodyStr = JSON.stringify(requestBody);

    let lastError: Error | null = null;

    // Try each key; skip to next on quota / rate-limit / leaked errors
    for (const key of apiKeys) {
        const maskedKey = key.slice(0, 8) + '...' + key.slice(-4);
        console.log(`[AI Service] Attempting request with key: ${maskedKey}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                referrerPolicy: 'strict-origin-when-cross-origin',
                body: bodyStr,
            });

            if (!response.ok) {
                const errData = await response.json() as any;
                const msg = errData.error?.message || 'Failed to generate AI content';

                // Leaked key → skip immediately
                if (msg.toLowerCase().includes('leaked')) {
                    console.warn(`[AI Service] Key ${maskedKey} is LEAKED, skipping...`);
                    lastError = new Error(msg);
                    continue;
                }
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
            // If it's a quota/rate/leaked error we already continued above; for network errors, also try next key
            if (error.message?.includes('quota') || error.message?.includes('rate') || error.message?.includes('leaked')) {
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
    status: 'ok' | 'quota_exceeded' | 'invalid' | 'leaked' | 'error';
    message: string;
    model: string;
}

/** Get all configured API keys (masked for display) — LOCAL DEV ONLY */
export function getApiKeys(): { maskedKey: string; fullKey: string; index: number }[] {
    // In production, keys are on the server — use checkApiKeysViaProxy instead
    if (!isLocalDev()) return [];

    const keys: { maskedKey: string; fullKey: string; index: number }[] = [];
    const env = import.meta.env;
    const keyNames = ['VITE_GEMINI_API_KEY_1', 'VITE_GEMINI_API_KEY_2', 'VITE_GEMINI_API_KEY_3'];
    keyNames.forEach((name, i) => {
        const k = env[name];
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

/** Check a single API key's health by sending a minimal request — LOCAL DEV ONLY */
export async function checkApiKeyHealth(apiKey: string): Promise<ApiKeyStatus> {
    const model = GEMINI_MODEL;
    const masked = apiKey.slice(0, 8) + '...' + apiKey.slice(-4);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            referrerPolicy: 'strict-origin-when-cross-origin',
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

        // Leaked key detection
        if (msg.toLowerCase().includes('leaked')) {
            return { key: masked, index: 0, status: 'leaked', message: '⚠️ Key bị lộ (leaked) — cần thay thế ngay!', model };
        }
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

/** Check all API keys via server-side proxy — PRODUCTION */
export async function checkApiKeysViaProxy(): Promise<ApiKeyStatus[]> {
    try {
        const response = await fetch('/api/ai/health-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error('Health check request failed');
        }

        const data = await response.json() as any;
        return data.results || [];
    } catch (err: any) {
        console.error('[AI Service] Health check proxy error:', err);
        return [{ key: 'N/A', index: 0, status: 'error', message: err.message || 'Proxy error', model: GEMINI_MODEL }];
    }
}
