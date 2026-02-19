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

        const selectedKey = keys[Math.floor(Math.random() * keys.length)];
        const { text, type } = await request.json() as { text: string, type: string };

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

        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${selectedKey}`;

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            return new Response(JSON.stringify({
                error: data.error?.message || 'Gemini API call failed',
                details: data
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!aiText) {
            throw new Error('AI failed to generate response content');
        }

        return new Response(JSON.stringify({ text: aiText }), {
            status: 200,
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
