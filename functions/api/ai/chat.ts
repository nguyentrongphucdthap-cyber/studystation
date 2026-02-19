// @ts-ignore
export const onRequestPost = async (context: any) => {
    try {
        const { request, env } = context;
        const keys = [env.AI_API_KEY_1, env.AI_API_KEY_2, env.AI_API_KEY_3].filter(Boolean);

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

        // Default to Gemini 1.5 Flash if not specified
        const model = body.model || 'gemini-1.5-flash';
        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${selectedKey}`;

        // Forward request to Gemini
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: body.contents,
                generationConfig: body.generationConfig,
                safetySettings: body.safetySettings,
            }),
        });

        const data = await response.json();

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
