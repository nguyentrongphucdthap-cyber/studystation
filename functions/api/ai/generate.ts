/**
 * Generic AI Proxy — Cloudflare Pages Function
 * Routes all AI requests through server-side to keep API keys hidden.
 * Reads keys from env.GEMINI_API_KEY_1/2/3 (Cloudflare secrets, NOT VITE_ prefixed).
 */
// @ts-ignore
export const onRequestPost = async (context: any) => {
    try {
        const { request, env } = context;

        // Collect all available API keys from Cloudflare secrets
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

        // Parse the incoming request body
        const body = await request.json() as any;
        const model = body.model || 'gemini-2.5-flash-lite';

        // Shuffle keys for load balancing
        const shuffled = [...keys].sort(() => Math.random() - 0.5);

        let lastError: string = '';

        // Try each key; skip leaked/quota keys
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
                    const errData = await response.json() as any;
                    const msg = errData.error?.message || 'Gemini API error';

                    // Leaked or quota errors → skip to next key
                    if (
                        msg.toLowerCase().includes('leaked') ||
                        response.status === 429 ||
                        (response.status === 403 && msg.toLowerCase().includes('quota'))
                    ) {
                        console.warn(`[AI Proxy] Key ${maskedKey} unavailable (${response.status}), trying next...`);
                        lastError = msg;
                        continue;
                    }

                    return new Response(JSON.stringify({ error: msg }), {
                        status: response.status,
                        headers: corsHeaders(),
                    });
                }

                const data = await response.json() as any;

                // Handle Gemma 4 thinking model: skip 'thought' parts, return actual response
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
                lastError = fetchErr.message || 'Network error';
                if (lastError.includes('leaked') || lastError.includes('quota') || lastError.includes('rate')) {
                    continue;
                }
                throw fetchErr;
            }
        }

        // All keys exhausted
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
