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

        // Simple random rotation
        const selectedKey = keys[Math.floor(Math.random() * keys.length)];

        // Parse the incoming request body
        const body = await request.json() as any;

        // Default to gemini-3.1-flash-lite-preview if not specified
        const model = body.model || 'gemini-3.1-flash-lite-preview';
        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${selectedKey}`;

        // Build request body, forwarding system_instruction if present
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

        // Forward request to Gemini
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Referer': 'https://studystation.site/',
            },
            body: JSON.stringify(geminiBody),
        });

        const data = await response.json() as any;

        // Handle Gemma 4 thinking model: strip 'thought' parts from response
        const parts = data?.candidates?.[0]?.content?.parts;
        if (parts && parts.length > 1) {
            const nonThinkingParts = parts.filter((p: any) => !p.thought && p.text);
            if (nonThinkingParts.length > 0) {
                data.candidates[0].content.parts = nonThinkingParts;
            }
        }

        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
