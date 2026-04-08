// @ts-ignore
export const onRequestPost = async (context: any) => {
    try {
        const { request, env } = context;
        const keys = [env.GEMINI_API_KEY_1, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3].filter(Boolean);

        if (keys.length === 0) {
            return new Response(JSON.stringify({ error: 'No AI keys configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await request.json() as any;
        const model = 'gemini-3.1-flash-preview';

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

        let lastError = 'Gemini API error';
        const shuffled = [...keys].sort(() => Math.random() - 0.5);

        for (const selectedKey of shuffled) {
            const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${selectedKey}`;
            try {
                const response = await fetch(GEMINI_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Referer': 'https://studystation.site/',
                    },
                    body: JSON.stringify(geminiBody),
                });

                const data = await response.json() as any;

                if (!response.ok) {
                    const msg = data?.error?.message || `Gemini API error (${response.status})`;
                    lastError = msg;

                    if (shouldRetry(response.status, msg)) {
                        continue;
                    }

                    return new Response(JSON.stringify({ error: msg }), {
                        status: response.status,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                const parts = data?.candidates?.[0]?.content?.parts;
                if (parts && parts.length > 1) {
                    const nonThinkingParts = parts.filter((p: any) => !p.thought && p.text);
                    if (nonThinkingParts.length > 0) {
                        data.candidates[0].content.parts = nonThinkingParts;
                    }
                }

                return new Response(JSON.stringify(data), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
            } catch (error: any) {
                const msg = error?.message || 'Network error';
                lastError = msg;
                if (shouldRetry(0, msg)) continue;
                throw error;
            }
        }

        return new Response(JSON.stringify({ error: lastError }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

function shouldRetry(status: number, message: string): boolean {
    const msg = String(message || '').toLowerCase();
    if (!msg) return status === 429;
    return (
        status === 429 ||
        status === 503 ||
        msg.includes('quota') ||
        msg.includes('rate') ||
        msg.includes('leaked') ||
        msg.includes('temporar') ||
        msg.includes('unavailable') ||
        msg.includes('timeout') ||
        /user location is not supported/i.test(msg) ||
        /(is not found for api version|not supported for generatecontent|model.*not found)/i.test(msg)
    );
}
