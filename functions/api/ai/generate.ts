/**
 * Generic AI Proxy - Cloudflare Pages Function
 * Routes all AI requests through server-side to keep API keys hidden.
 * Uses Gemini 3.1 Flash Preview for all requests.
 */
// @ts-ignore
export const onRequestPost = async (context: any) => {
    try {
        const { request, env } = context;

        const keys = [
            env.GEMINI_API_KEY_1,
            env.GEMINI_API_KEY_2,
            env.GEMINI_API_KEY_3,
        ].filter(Boolean);

        if (keys.length === 0) {
            return new Response(JSON.stringify({ error: 'No AI keys configured on server' }), {
                status: 500,
                headers: corsHeaders(),
            });
        }

        const body = await request.json() as any;
        // Force a single model across the whole system.
        const model = 'gemini-3.1-flash-lite-preview';

        let lastError = 'Gemini API error';
        const shuffled = [...keys].sort(() => Math.random() - 0.5);

        for (const key of shuffled) {
            const maskedKey = key.slice(0, 8) + '...' + key.slice(-4);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

            try {
                const geminiBody: Record<string, unknown> = {
                    contents: body.contents,
                    generationConfig: body.generationConfig,
                };
                if (body.system_instruction) {
                    geminiBody.system_instruction = body.system_instruction;
                }
                if (body.safetySettings) {
                    geminiBody.safetySettings = body.safetySettings;
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Referer': 'https://studystation.site/',
                    },
                    body: JSON.stringify(geminiBody),
                });

                if (!response.ok) {
                    const { message } = await readApiError(response);
                    lastError = message;

                    if (shouldRetryWithAnotherKey(response.status, message)) {
                        console.warn(
                            `[AI Proxy] Retry next key (model=${model}, key=${maskedKey}, status=${response.status})`
                        );
                        continue;
                    }

                    return new Response(JSON.stringify({ error: message }), {
                        status: response.status,
                        headers: corsHeaders(),
                    });
                }

                const data = await response.json() as any;

                const parts = data?.candidates?.[0]?.content?.parts;
                if (parts && parts.length > 1) {
                    const nonThinkingParts = parts.filter((p: any) => !p.thought && p.text);
                    if (nonThinkingParts.length > 0) {
                        data.candidates[0].content.parts = nonThinkingParts;
                    }
                }

                return new Response(JSON.stringify(data), {
                    status: 200,
                    headers: corsHeaders(),
                });
            } catch (fetchErr: any) {
                const message = fetchErr?.message || 'Network error';
                lastError = message;

                if (shouldRetryWithAnotherKey(0, message)) {
                    continue;
                }
                throw fetchErr;
            }
        }

        return new Response(JSON.stringify({
            error: lastError || 'All API keys are currently unavailable'
        }), {
            status: 503,
            headers: corsHeaders(),
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: corsHeaders(),
        });
    }
};

function corsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

// Handle CORS preflight
// @ts-ignore
export const onRequestOptions = async () => {
    return new Response(null, {
        status: 204,
        headers: corsHeaders(),
    });
};

function isLocationNotSupported(message: string): boolean {
    return /user location is not supported/i.test(message);
}

function isModelUnsupported(message: string): boolean {
    return /(is not found for api version|not supported for generatecontent|model.*not found)/i.test(message);
}

function shouldRetryWithAnotherKey(status: number, message: string): boolean {
    const msg = String(message || '').toLowerCase();

    if (!msg) return status === 429;
    if (msg.includes('leaked')) return true;
    if (msg.includes('quota')) return true;
    if (msg.includes('rate')) return true;
    if (isLocationNotSupported(msg)) return true;
    if (isModelUnsupported(msg)) return true;
    if (status === 429) return true;
    if (status === 503) return true;
    if (status === 403 && (msg.includes('permission') || msg.includes('forbidden'))) return true;

    return false;
}

async function readApiError(response: Response): Promise<{ message: string }> {
    try {
        const data = await response.json() as any;
        const message = data?.error?.message || `Gemini API error (${response.status})`;
        return { message };
    } catch {
        return { message: `Gemini API error (${response.status})` };
    }
}
