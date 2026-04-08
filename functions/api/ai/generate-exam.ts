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

        const { text } = await request.json() as { text: string, type: string };

        const systemPrompt = `Bạn là một chuyên gia soạn đề thi trắc nghiệm. Nhiệm vụ của bạn là phân tích nội dung người dùng cung cấp và chuyển đổi thành đề thi theo định dạng văn bản cấu trúc.

Định dạng yêu cầu:
[Question]
Nội dung câu hỏi...
Nếu có hình ảnh trong nội dung gốc, hãy giữ nguyên thẻ Markdown image: ![...](...)
SỬ DỤNG LaTeX cho mọi công thức:
- Toán học: dùng $...$ hoặc $$...$$ (ví dụ: $\\frac{a}{b}$)
- Hóa học: LUÔN DÙNG ký hiệu $\\ce{...}$ CÓ NGOẶC NHỌN (ví dụ: $\\ce{H2SO4}$, $\\ce{C17H35COONa}$)
*LƯU Ý: Tuyệt đối không viết \ce thiếu ngoặc nhọn như \ceH2O.*
A. Lựa chọn 1
B. Lựa chọn 2
*C. Lựa chọn đúng (bắt đầu bằng dấu *)
D. Lựa chọn 4
[Explanation]
Giải thích ngắn gọn, đơn giản về cách làm hoặc lý do chọn đáp án (không quá 2 câu).
--------------------------------------------------

Quy tắc quan trọng:
1. Mỗi câu hỏi cách nhau bởi dòng kẻ "--------------------------------------------------".
2. KHÔNG trả về JSON. Chỉ trả về văn bản theo đúng cấu trúc trên.
3. Giữ nguyên các đường link hình ảnh (Markdown) được cung cấp trong văn bản gốc.
4. Đảm bảo hỗ trợ tốt các ký hiệu khoa học.`;

        const model = 'gemini-3.1-flash-preview';
        let lastError = 'Gemini API error';
        const shuffled = [...keys].sort(() => Math.random() - 0.5);

        for (const selectedKey of shuffled) {
            const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${selectedKey}`;

            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Referer': 'https://studystation.site/',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${systemPrompt}\n\nNỘI DUNG CẦN XỬ LÝ:\n${text}` }]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        topP: 0.8,
                    }
                })
            });

            const data = await response.json() as any;

            if (!response.ok) {
                const msg = data?.error?.message || `Gemini API call failed (${response.status})`;
                lastError = msg;
                if (shouldRetry(response.status, msg)) {
                    continue;
                }
                return new Response(JSON.stringify({ error: msg, details: data }), {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const parts = data.candidates?.[0]?.content?.parts;
            let aiText = '';
            if (parts && parts.length > 0) {
                for (let i = parts.length - 1; i >= 0; i--) {
                    if (!parts[i].thought && parts[i].text) {
                        aiText = parts[i].text;
                        break;
                    }
                }
                if (!aiText) aiText = parts[parts.length - 1]?.text || '';
            }
            if (!aiText) {
                lastError = 'AI failed to generate response content';
                continue;
            }

            return new Response(JSON.stringify({ text: aiText }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: lastError }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('[Backend Error]', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
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
