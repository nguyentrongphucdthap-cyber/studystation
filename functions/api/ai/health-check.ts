/**
 * AI Health Check — Cloudflare Pages Function
 * Checks each API key's health from server-side (for admin panel).
 */
// @ts-ignore
export const onRequestPost = async (context: any) => {
    try {
        const { env } = context;
        const model = 'gemini-2.5-flash-lite';

        const keys = [
            { key: env.GEMINI_API_KEY_1, index: 1 },
            { key: env.GEMINI_API_KEY_2, index: 2 },
            { key: env.GEMINI_API_KEY_3, index: 3 },
        ].filter(k => k.key);

        if (keys.length === 0) {
            return new Response(JSON.stringify({ error: 'No keys configured' }), {
                status: 500,
                headers: corsHeaders(),
            });
        }

        const results = [];

        for (const { key, index } of keys) {
            const masked = key.slice(0, 8) + '...' + key.slice(-4);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Referer': 'https://studystation.site/',
                    },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
                        generationConfig: { maxOutputTokens: 5 },
                    }),
                });

                if (response.ok) {
                    results.push({ key: masked, index, status: 'ok', message: 'Hoạt động tốt ✓', model });
                    continue;
                }

                const errData = await response.json() as any;
                const msg = errData.error?.message || 'Unknown error';

                if (msg.toLowerCase().includes('leaked')) {
                    results.push({ key: masked, index, status: 'leaked', message: '⚠️ Key bị lộ (leaked) — cần thay thế ngay!', model });
                } else if (response.status === 429 || msg.toLowerCase().includes('quota')) {
                    results.push({ key: masked, index, status: 'quota_exceeded', message: 'Hết quota', model });
                } else if (response.status === 400 || response.status === 403) {
                    results.push({ key: masked, index, status: 'invalid', message: msg.slice(0, 80), model });
                } else {
                    results.push({ key: masked, index, status: 'error', message: msg.slice(0, 80), model });
                }
            } catch (err: any) {
                results.push({ key: masked, index, status: 'error', message: err.message || 'Network error', model });
            }
        }

        return new Response(JSON.stringify({ results }), {
            status: 200,
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

// @ts-ignore
export const onRequestOptions = async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
};
