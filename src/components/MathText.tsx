/**
 * MathText — renders text with inline $...$ and block $$...$$ LaTeX formulas via KaTeX.
 * Falls back to plain text if KaTeX fails on a formula.
 */
import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Match $$...$$ (block) and $...$ (inline), non-greedy
const MATH_REGEX = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;

function renderLatex(tex: string, displayMode: boolean): string {
    try {
        return katex.renderToString(tex, {
            displayMode,
            throwOnError: false,
            strict: false,
        });
    } catch {
        return tex;
    }
}

export default function MathText({ text }: { text: string }) {
    const parts = useMemo(() => {
        const result: { type: 'text' | 'math'; content: string; display: boolean }[] = [];
        let lastIndex = 0;

        text.replace(MATH_REGEX, (match, _group, offset) => {
            // Push text before this match
            if (offset > lastIndex) {
                result.push({ type: 'text', content: text.slice(lastIndex, offset), display: false });
            }

            const isBlock = match.startsWith('$$');
            const tex = isBlock ? match.slice(2, -2).trim() : match.slice(1, -1).trim();
            result.push({ type: 'math', content: tex, display: isBlock });

            lastIndex = offset + match.length;
            return match;
        });

        // Push remaining text
        if (lastIndex < text.length) {
            result.push({ type: 'text', content: text.slice(lastIndex), display: false });
        }

        return result;
    }, [text]);

    // If no math found, render as plain text (fast path)
    if (parts.length === 1 && parts[0]?.type === 'text') {
        return <>{text}</>;
    }

    return (
        <>
            {parts.map((part, i) =>
                part.type === 'text' ? (
                    <span key={i}>{part.content}</span>
                ) : (
                    <span
                        key={i}
                        dangerouslySetInnerHTML={{ __html: renderLatex(part.content, part.display) }}
                        style={part.display ? { display: 'block', textAlign: 'center', margin: '6px 0' } : undefined}
                    />
                )
            )}
        </>
    );
}
