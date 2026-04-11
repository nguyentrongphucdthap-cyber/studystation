/**
 * Smart Import Utilities
 * Helper functions for PDF extraction and data sanitization
 */

/** Wait for a PDF object to be resolved asynchronously */
export async function getPdfObjAsync(page: any, key: string, maxRetries = 200): Promise<any> {
    const isGlobal = key.startsWith('g_');
    const objs = isGlobal ? (page as any).commonObjs : page.objs;
    if (!objs) return null;

    // Check if resolved synchronously
    try {
        const data = objs.get(key);
        if (data !== undefined && data !== null) return data;
    } catch (e) { /* Pending */ }

    return new Promise((resolve) => {
        let attempts = 0;
        
        const check = () => {
            try {
                const data = objs.get(key);
                if (data !== undefined && data !== null) {
                    return resolve(data);
                }
            } catch (e) { /* Still waiting */ }

            attempts++;
            if (attempts >= maxRetries) {
                console.warn(`[PDF] Timeout waiting for ${key}`);
                return resolve(null);
            }
            setTimeout(check, 100);
        };

        // Attempt callback first if supported
        try {
            objs.get(key, (data: any) => resolve(data));
        } catch (e) {
            // If callback fails or isn't supported, start polling
            check();
        }
    });
}

/** Sanitize object for Firestore: remove undefined, functions, symbols and infinity/NaN */
export function sanitizeForFirestore(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'function' || typeof obj === 'symbol') return null;
    if (typeof obj !== 'object') {
        if (typeof obj === 'number') {
            if (!Number.isFinite(obj)) return 0;
        }
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(v => sanitizeForFirestore(v)).filter(v => v !== undefined);
    }
    
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
        const val = obj[key];
        const sanitized = sanitizeForFirestore(val);
        if (sanitized !== undefined && sanitized !== null) {
            cleaned[key] = sanitized;
        }
    });
    return cleaned;
}

/** Robustly parse JSON from AI, handling common formatting errors */
export function robustJSONParse(jsonStr: string): any {
    let cleaned = jsonStr.trim();
    
    // 1. Trích xuất khối JSON hợp lệ đầu tiên (loại bỏ lời dẫn hoặc lời kết của AI)
    // Tìm cặp ngoặc nhọn { } hoặc ngoặc vuông [ ] cân bằng đầu tiên
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIdx = -1;
    let endIdx = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIdx = firstBrace;
        // Tìm ngoặc đóng tương ứng
        let depth = 0;
        for (let i = startIdx; i < cleaned.length; i++) {
            if (cleaned[i] === '{') depth++;
            else if (cleaned[i] === '}') {
                depth--;
                if (depth === 0) {
                    endIdx = i + 1;
                    break;
                }
            }
        }
    } else if (firstBracket !== -1) {
        startIdx = firstBracket;
        let depth = 0;
        for (let i = startIdx; i < cleaned.length; i++) {
            if (cleaned[i] === '[') depth++;
            else if (cleaned[i] === ']') {
                depth--;
                if (depth === 0) {
                    endIdx = i + 1;
                    break;
                }
            }
        }
    }

    if (startIdx !== -1 && endIdx !== -1) {
        cleaned = cleaned.substring(startIdx, endIdx);
    } else if (cleaned.startsWith('```')) {
        // Fallback cho markdown nếu không tìm thấy cặp ngoặc cân bằng toàn vẹn
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    try {
        return JSON.parse(cleaned);
    } catch (e: any) {
        console.warn('[SmartImport] Initial parse failed, attempting repair:', e.message);
        
        let repaired = cleaned;

        // 2. Sửa lỗi dấu gạch chéo ngược cho LaTeX (nhân đôi nếu cần)
        repaired = repaired.replace(/(\\+)(?!["\\/bfnrtu])/g, (match) => {
            return match.length % 2 === 1 ? match + '\\' : match;
        });
        
        // 3. Loại bỏ các ký tự thoát AI tự chế làm hỏng LaTeX
        repaired = repaired.replace(/\\+([\[\]_^])/g, '$1');
        
        // 4. Sửa lỗi xuống dòng chưa được escape trong chuỗi
        repaired = repaired.replace(/"([^"]*)"/g, (_match, p1) => {
            return '"' + p1.replace(/\n/g, '\\n') + '"';
        });
        
        // 5. Bổ sung dấu phẩy thiếu giữa các khối
        repaired = repaired.replace(/\}\s*\{/g, '}, {');
        repaired = repaired.replace(/\]\s*\[/g, '], [');
        repaired = repaired.replace(/\}\s*\[/g, '}, [');
        repaired = repaired.replace(/\]\s*\{/g, '], {');
        
        // 6. Xóa dấu phẩy thừa cuối mảng/object
        repaired = repaired.replace(/,\s*\}/g, '}');
        repaired = repaired.replace(/,\s*\]/g, ']');

        // 7. Đóng các ngoặc bị thiếu do AI bị ngắt quãng (Cực kỳ quan trọng cho file dài)
        const stack: ( '{' | '[' )[] = [];
        for (let i = 0; i < repaired.length; i++) {
            if (repaired[i] === '{') stack.push('{');
            else if (repaired[i] === '[') stack.push('[');
            else if (repaired[i] === '}') {
                if (stack[stack.length - 1] === '{') stack.pop();
            }
            else if (repaired[i] === ']') {
                if (stack[stack.length - 1] === '[') stack.pop();
            }
        }
        while (stack.length > 0) {
            const last = stack.pop();
            repaired += last === '{' ? '}' : ']';
        }

        try {
            return JSON.parse(repaired);
        } catch (err2: any) {
            console.error('[SmartImport] Repair failed:', err2.message);
            // Cung cấp thông báo lỗi tiếng Việt dễ hiểu
            const pos = err2.message.match(/position (\d+)/)?.[1] || '?';
            throw new Error(`Lỗi JSON: ${e.message}. Vị trí lỗi: ${pos}. Có thể file quá dài hoặc AI bị ngắt quãng.`);
        }
    }
}

/** Helper to convert PDF image data to Blob */
export async function convertPdfImageToBlob(imgData: any): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = imgData.width;
    canvas.height = imgData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context không khả dụng');

    if (imgData.bitmap) {
        ctx.drawImage(imgData.bitmap, 0, 0);
    } else {
        const imageData = ctx.createImageData(imgData.width, imgData.height);
        const data = imgData.data;
        const rgba = imageData.data;
        
        if (data.length === imgData.width * imgData.height * 3) {
            for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
                rgba[j] = data[i];
                rgba[j+1] = data[i+1];
                rgba[j+2] = data[i+2];
                rgba[j+3] = 255;
            }
        } else if (data.length === imgData.width * imgData.height) {
            for (let i = 0, j = 0; i < data.length; i++, j += 4) {
                rgba[j] = rgba[j+1] = rgba[j+2] = data[i];
                rgba[j+3] = 255;
            }
        } else {
            rgba.set(data);
        }
        ctx.putImageData(imageData, 0, 0);
    }

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Không thể tạo blob từ canvas'));
        }, 'image/png');
    });
}

/** Normalize imported exam data to match expected structure */
export function normalizeImportedExamData(data: any): any {
    if (!data || typeof data !== 'object') return {};
    
    // Ensure basic metadata exists
    const normalized = {
        title: data.title || '',
        subjectId: data.subjectId || '',
        time: parseInt(data.time) || 60,
        part1: Array.isArray(data.part1) ? data.part1 : [],
        part2: Array.isArray(data.part2) ? data.part2 : [],
        part3: Array.isArray(data.part3) ? data.part3 : [],
        customFolder: data.customFolder || '',
        isSpecial: !!data.isSpecial,
        allowedEmails: Array.isArray(data.allowedEmails) ? data.allowedEmails : []
    };

    // Normalize Part 1 (Multiple Choice)
    normalized.part1 = normalized.part1.map((q: any) => ({
        id: q.id || '',
        // Support both AI's and internal keys
        question: q.question || q.text || '',
        options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
        answer: q.answer !== undefined ? q.answer : (q.correct !== undefined ? q.correct : ''),
        explanation: q.explanation || '',
        image: q.image || null
    }));

    // Normalize Part 2 (True/False)
    normalized.part2 = normalized.part2.map((q: any) => ({
        id: q.id || '',
        question: q.question || q.text || '',
        subQuestions: Array.isArray(q.subQuestions) ? q.subQuestions.map((sq: any) => ({
            id: sq.id || '',
            text: sq.text || '',
            answer: sq.answer === true || sq.answer === 'true' || sq.answer === 'Đúng' ? 'Đúng' : 'Sai'
        })) : [],
        explanation: q.explanation || '',
        image: q.image || null
    }));

    // Normalize Part 3 (Short Answer)
    normalized.part3 = normalized.part3.map((q: any) => ({
        id: q.id || '',
        question: q.question || q.text || '',
        answer: q.answer || q.correct || '',
        explanation: q.explanation || '',
        image: q.image || null
    }));

    // Backward compatibility for Vocab/E-test if needed
    if (Array.isArray((data as any).words)) {
        (normalized as any).words = (data as any).words;
    }
    if (Array.isArray((data as any).sections)) {
        (normalized as any).sections = (data as any).sections;
    }

    return normalized;
}
