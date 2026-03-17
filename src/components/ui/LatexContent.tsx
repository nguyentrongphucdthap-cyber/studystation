import React, { useMemo } from 'react';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/mhchem.min.js';
import { InlineMath, BlockMath } from 'react-katex';

interface LatexContentProps {
    content: string;
    className?: string;
    block?: boolean; // force block rendering
}

type Token =
    | { type: 'text'; value: string }
    | { type: 'inline-math'; value: string }
    | { type: 'block-math'; value: string }
    | { type: 'chem'; value: string }
    | { type: 'table'; rows: string[][] };

// ─── BƯỚC 1: TIỀN XỬ LÝ KÝ HIỆU TOÁN HỌC THÔ ───────────────────────────────
//
// Mục tiêu: nhận diện các pattern như T_nc, 10^5, E_k^2 viết tự do trong văn bản
// và bọc chúng vào $...$ để KaTeX render đúng, KHÔNG động vào các block LaTeX đã có.
//
// Regex nhận diện các khối LaTeX/math hiện có (để bỏ qua, không xử lý):
//   $$...$$              block math
//   $...$                inline math (không có newline, không có $ bên trong)
//   \[...\]              block math LaTeX chuẩn
//   \(...\)              inline math LaTeX chuẩn
//   \ce{...}             công thức hóa học (mhchem)
//   \begin{env}...\end{env}  môi trường LaTeX

const EXISTING_MATH_REGEX = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\\ce\{(?:[^{}]|\{[^{}]*\})*\}|\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\})/g;

/**
 * Kiểm tra chuỗi có chứa ký tự ngoài ASCII không (ví dụ: tiếng Việt có dấu).
 * Nếu có → cần bọc trong \text{...} để KaTeX render bằng font văn bản, không phải font toán.
 */
function needsTextWrap(s: string): boolean {
    return /[^\x00-\x7F]/.test(s);
}

/**
 * Chuyển đổi các pattern sub/superscript thô trong đoạn text thuần.
 *
 * Ví dụ hỗ trợ:
 *   T_nc         → $T_{nc}$
 *   T_sôi        → $T_{\text{sôi}}$   (tiếng Việt → \text{})
 *   10^5         → $10^{5}$
 *   E_k^2        → $E_{k}^{2}$        (chained: cả sub lẫn sup)
 *   v_0^2        → $v_{0}^{2}$
 *   a_1+a_2      → $a_{1}$+$a_{2}$   (tách riêng từng token)
 *   H_2O         → $H_{2}$O          (O không có sup/sub → text)
 *
 * KHÔNG chuyển những gì đã nằm trong $...$, $$...$$, v.v.
 */
function convertBareSubSup(text: string): string {
    // Pattern: [\p{L}\p{N}]+ là base, theo sau bởi ít nhất 1 cặp [_^][\p{L}\p{N}]+
    // Cờ `u` bật Unicode property escapes → nhận diện đủ ký tự Unicode/tiếng Việt
    return text.replace(
        /([\p{L}\p{N}[\]]+)((?:[_^][\p{L}\p{N}[\]]+)+)/gu,
        (_match, base: string, rest: string): string => {
            // Base: bọc \text{} nếu có ký tự tiếng Việt / có dấu
            const latexBase = needsTextWrap(base) ? `\\text{${base}}` : base;

            // Phân tích từng cặp _sub hoặc ^sup từ phần `rest`
            let latexExtra = '';
            let i = 0;
            while (i < rest.length) {
                const op = rest[i]; // '_' hoặc '^'
                let j = i + 1;
                // Lấy ký tự tiếp theo cho đến khi gặp _ hoặc ^ khác
                while (j < rest.length && rest[j] !== '_' && rest[j] !== '^') j++;
                const val = rest.slice(i + 1, j);
                // Giá trị sub/sup: bọc \text{} nếu tiếng Việt
                const latexVal = needsTextWrap(val) ? `\\text{${val}}` : val;
                latexExtra += op === '_' ? `_{${latexVal}}` : `^{${latexVal}}`;
                i = j;
            }

            return `$${latexBase}${latexExtra}$`;
        }
    );
}

/**
 * Bước tiền xử lý chính:
 * - Tách nội dung theo các khối LaTeX đã có (giữ nguyên)
 * - Áp dụng convertBareSubSup() cho phần text thuần giữa các khối
 */
function preprocessMathPatterns(content: string): string {
    const parts: string[] = [];
    let lastIndex = 0;
    EXISTING_MATH_REGEX.lastIndex = 0; // reset global regex state

    let match: RegExpExecArray | null;
    while ((match = EXISTING_MATH_REGEX.exec(content)) !== null) {
        // Xử lý phần text trước khối math
        if (match.index > lastIndex) {
            parts.push(convertBareSubSup(content.slice(lastIndex, match.index)));
        }
        // Giữ nguyên khối math
        parts.push(match[0]);
        lastIndex = match.index + match[0].length;
    }
    // Xử lý phần text còn lại sau khối math cuối
    if (lastIndex < content.length) {
        parts.push(convertBareSubSup(content.slice(lastIndex)));
    }

    return parts.join('');
}

// ─── BƯỚC 2: TOKENIZER ────────────────────────────────────────────────────────
// Phân tích chuỗi đã tiền xử lý thành các token: text, inline-math, block-math, chem.
// Xử lý đúng: $$, \[, \begin, \(, \ce{}, $
// Cải tiến so với bản cũ:
//   - $...$ không khớp nếu ký tự ngay sau $ là khoảng trắng (tránh nhận lầm giá tiền "$50")
//   - $...$ không vượt qua ký tự newline (inline math không trải dài nhiều dòng)
//   - Xử lý đúng ký tự escape '\' bên trong $...$

function tokenize(content: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    let textBuffer = '';

    const flush = () => {
        if (textBuffer) {
            tokens.push({ type: 'text', value: textBuffer });
            textBuffer = '';
        }
    };

    /** Tiêu thụ nội dung đến chuỗi kết thúc `end`, theo dõi cặp ngoặc nhọn. */
    const consumeUntil = (end: string): string | null => {
        let result = '';
        let depth = 0;
        while (i < content.length) {
            if (content.startsWith(end, i) && depth === 0) {
                i += end.length;
                return result;
            }
            const ch = content[i];
            if (ch === '{') depth++;
            else if (ch === '}') depth = Math.max(0, depth - 1);
            result += ch;
            i++;
        }
        return null; // không tìm thấy closing
    };

    while (i < content.length) {
        // ──── Table Detection ────
        let isStartOfLine = i === 0 || content[i - 1] === '\n';
        if (isStartOfLine) {
            let cursor = i;
            while (cursor < content.length && (content[cursor] === ' ' || content[cursor] === '\t')) {
                cursor++;
            }
            if (content[cursor] === '|') {
                let j = cursor;
                let currentLine = '';
                const tableLines: string[] = [];
                while (j < content.length) {
                    const char = content[j];
                    if (char === '\n') {
                        if (currentLine.trim().startsWith('|') && currentLine.trim().endsWith('|')) {
                            tableLines.push(currentLine.trim());
                            currentLine = '';
                            j++;
                            let nextRowStart = j;
                            while (nextRowStart < content.length && (content[nextRowStart] === ' ' || content[nextRowStart] === '\t')) nextRowStart++;
                            if (content[nextRowStart] !== '|') break;
                            j = nextRowStart;
                        } else break;
                    } else {
                        currentLine += char;
                        j++;
                    }
                }
                if (currentLine.trim().startsWith('|') && currentLine.trim().endsWith('|')) {
                    tableLines.push(currentLine.trim());
                }

                const dividerLine = tableLines[1];
                if (tableLines.length >= 2 && dividerLine && dividerLine.includes('-')) {
                    flush();
                    const rows = tableLines
                        .filter(line => !line.match(/^\|[ :|-]+\|$/))
                        .map(line => line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(s => s.trim()));
                    tokens.push({ type: 'table', rows });
                    i = j;
                    continue;
                }
            }
        }

        // ──── $$...$$ — block math ────
        if (content.startsWith('$$', i)) {
            flush();
            i += 2;
            const math = consumeUntil('$$');
            if (math !== null) {
                tokens.push({ type: 'block-math', value: math.trim() });
            } else {
                textBuffer += '$$';
            }
            continue;
        }

        // ──── \[...\] — block math (LaTeX chuẩn) ────
        if (content.startsWith('\\[', i)) {
            flush();
            i += 2;
            const math = consumeUntil('\\]');
            if (math !== null) {
                tokens.push({ type: 'block-math', value: math.trim() });
            } else {
                textBuffer += '\\[';
            }
            continue;
        }

        // ──── \begin{...}...\end{...} — môi trường LaTeX ────
        if (content.startsWith('\\begin{', i)) {
            const envMatch = content.slice(i).match(/^\\begin\{([^}]+)\}/);
            if (envMatch) {
                const envName = envMatch[1];
                flush();
                const startTag = `\\begin{${envName}}`;
                const endTag = `\\end{${envName}}`;
                i += startTag.length;
                const math = consumeUntil(endTag);
                if (math !== null) {
                    tokens.push({ type: 'block-math', value: `${startTag}${math}${endTag}` });
                } else {
                    textBuffer += startTag;
                }
                continue;
            }
        }

        // ──── \(...\) — inline math (LaTeX chuẩn) ────
        if (content.startsWith('\\(', i)) {
            flush();
            i += 2;
            const math = consumeUntil('\\)');
            if (math !== null) {
                tokens.push({ type: 'inline-math', value: math.trim() });
            } else {
                textBuffer += '\\(';
            }
            continue;
        }

        // ──── \ce{...} — công thức hóa học (mhchem) ────
        if (content.startsWith('\\ce{', i)) {
            flush();
            i += 4;
            let chem = '';
            let depth = 1;
            while (i < content.length && depth > 0) {
                if (content[i] === '{') depth++;
                else if (content[i] === '}') {
                    depth--;
                    if (depth === 0) { i++; break; }
                }
                chem += content[i];
                i++;
            }
            tokens.push({ type: 'chem', value: `\\ce{${chem}}` });
            continue;
        }

        // ──── $...$ — inline math ────
        if (content[i] === '$') {
            // Heuristic: nếu ký tự ngay sau $ là khoảng trắng hoặc số mà không có closing $
            // trên cùng dòng → đây là ký hiệu tiền tệ, không phải math
            const nextCh = content[i + 1];
            if (nextCh === ' ' || nextCh === '\t' || nextCh === '\n' || nextCh === undefined) {
                textBuffer += '$';
                i++;
                continue;
            }

            let j = i + 1;
            let mathContent = '';
            let depth = 0;
            let found = false;

            while (j < content.length) {
                if (content[j] === '$' && depth === 0) {
                    found = true;
                    break;
                }
                // Inline math KHÔNG vượt qua newline
                if (content[j] === '\n') break;

                if (content[j] === '{') depth++;
                else if (content[j] === '}') depth = Math.max(0, depth - 1);
                else if (content[j] === '\\') {
                    // Ký tự escape: thêm cả '\' lẫn ký tự tiếp theo rồi tiếp tục
                    mathContent += content[j]; // '\'
                    j++;
                    if (j < content.length) {
                        mathContent += content[j]; // ký tự được escape
                        j++;
                    }
                    continue;
                }
                mathContent += content[j];
                j++;
            }

            if (found && mathContent.trim()) {
                flush();
                tokens.push({ type: 'inline-math', value: mathContent.trim() });
                i = j + 1;
                continue;
            }
        }

        // Ký tự văn bản thông thường
        textBuffer += content[i];
        i++;
    }

    flush();
    return tokens;
}

// ─── BƯỚC 3: COMPONENT ────────────────────────────────────────────────────────

export const LatexContent: React.FC<LatexContentProps> = ({ content, className, block }) => {
    if (!content) return null;

    const renderedParts = useMemo(() => {
        // Bước 1: Tiền xử lý (auto-detect bare sub/superscript)
        const processed = preprocessMathPatterns(content);
        // Bước 2: Tokenize
        const tokens = tokenize(processed);

        return tokens.map((token, index) => {
            try {
                switch (token.type) {
                    case 'table':
                        return (
                            <div key={index} className="latex-table-container">
                                <table className="latex-table">
                                    <thead>
                                        <tr>
                                            {token.rows[0]?.map((cell, i) => (
                                                <th key={i}>
                                                    <LatexContent content={cell} />
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {token.rows.slice(1).map((row, i) => (
                                            <tr key={i}>
                                                {row.map((cell, j) => (
                                                    <td key={j}>
                                                        <LatexContent content={cell} />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    case 'block-math':
                        return (
                            <span key={index} className="block my-2 overflow-x-auto">
                                <BlockMath math={token.value} errorColor="#cc0000" />
                            </span>
                        );
                    case 'inline-math':
                    case 'chem':
                        return <InlineMath key={index} math={token.value} errorColor="#cc0000" />;
                    case 'text':
                    default: {
                        const html = token.value
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="my-3 max-h-64 max-w-full rounded-xl object-contain shadow-sm border border-border" />')
                            .replace(/\*\*([\s\S]+?)\*\*/g, '<strong class="text-blue-600 font-bold">$1</strong>')
                            .replace(/__([\s\S]+?)__/g, '<strong class="text-blue-600 font-bold">$1</strong>')
                            .replace(/\*([\s\S]+?)\*/g, '<em class="italic">$1</em>')
                            .replace(/_([\s\S]+?)_/g, '<em class="italic">$1</em>');

                        return (
                            <span
                                key={index}
                                style={{ whiteSpace: 'pre-wrap' }}
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        );
                    }
                }
            } catch (err) {
                console.warn('[LatexContent] Render error:', err, token);
                const displayValue = 'value' in token ? token.value : '[Table]';
                return (
                    <span key={index} className="text-rose-500 font-mono text-xs bg-rose-50 px-1 rounded">
                        {displayValue}
                    </span>
                );
            }
        });
    }, [content]);

    if (block) {
        return <div className={className}>{renderedParts}</div>;
    }
    return <span className={className}>{renderedParts}</span>;
};
