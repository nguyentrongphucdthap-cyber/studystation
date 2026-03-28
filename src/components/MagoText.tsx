/**
 * MagoText — Renders Mago AI responses with rich formatting.
 * Supports:
 *   - LaTeX: $...$ (inline), $$...$$ (block) — math, physics, chemistry (\ce{})
 *   - Markdown: **bold**, *italic*, `code`, ```code blocks```, ==highlight==
 *   - Lists: bullet (- item) and numbered (1. item)
 */
import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/mhchem.min.js';

interface MagoTextProps {
    text: string;
}

export default function MagoText({ text }: MagoTextProps) {
    const html = useMemo(() => formatMagoText(text), [text]);
    return <span className="mago-text" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── LaTeX rendering ──
function renderLatex(tex: string, displayMode: boolean): string {
    try {
        return katex.renderToString(tex, {
            displayMode,
            throwOnError: false,
            strict: false,
            trust: true,
        });
    } catch {
        return `<code>${escapeHtml(tex)}</code>`;
    }
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ── Main formatter ──
function formatMagoText(text: string): string {
    // Step 1: Split by code blocks (```...```) — these are never processed further
    const codeBlockParts = text.split(/(```[\s\S]*?```)/g);

    return codeBlockParts.map(part => {
        // Code block — render as-is
        if (part.startsWith('```') && part.endsWith('```')) {
            const code = part.slice(3, -3).replace(/^\w+\n/, '');
            return `<pre class="mago-code-block"><code>${escapeHtml(code.trim())}</code></pre>`;
        }

        // Step 2: Split by LaTeX ($$...$$ and $...$) — preserve LaTeX, format the rest
        const latexRegex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;
        const segments = part.split(latexRegex);

        let combined = '';
        for (const seg of segments) {
            if (seg.startsWith('$$') && seg.endsWith('$$')) {
                // Block LaTeX
                const tex = seg.slice(2, -2).trim();
                combined += `<div class="mago-math-block">${renderLatex(tex, true)}</div>`;
            } else if (seg.startsWith('$') && seg.endsWith('$') && seg.length > 2) {
                // Inline LaTeX
                const tex = seg.slice(1, -1).trim();
                combined += renderLatex(tex, false);
            } else {
                // Regular text — apply markdown formatting
                combined += formatMarkdown(seg);
            }
        }

        return combined;
    }).join('');
}

// ── Markdown formatting (applied only to non-LaTeX, non-code text) ──
function formatMarkdown(text: string): string {
    let html = escapeHtml(text);

    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* (not inside bold)
    html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');

    // Inline code: `text`
    html = html.replace(/`([^`]+?)`/g, '<code class="mago-inline-code">$1</code>');

    // Highlight: ==text==
    html = html.replace(/==(.+?)==/g, '<mark class="mago-highlight">$1</mark>');

    // Process line by line for lists
    const lines = html.split('\n');
    let result = '';
    let inList: 'ul' | 'ol' | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();

        // Bullet list: - item or • item
        const bulletMatch = trimmed.match(/^[-•]\s+(.+)/);
        // Numbered list: 1. item
        const numMatch = trimmed.match(/^\d+[\.)]\s+(.+)/);

        if (bulletMatch) {
            if (inList !== 'ul') {
                if (inList) result += `</${inList}>`;
                result += '<ul class="mago-list">';
                inList = 'ul';
            }
            result += `<li>${bulletMatch[1]}</li>`;
        } else if (numMatch) {
            if (inList !== 'ol') {
                if (inList) result += `</${inList}>`;
                result += '<ol class="mago-list">';
                inList = 'ol';
            }
            result += `<li>${numMatch[1]}</li>`;
        } else {
            if (inList) {
                result += `</${inList}>`;
                inList = null;
            }
            if (trimmed === '') {
                result += '<br/>';
            } else {
                result += (i > 0 ? '<br/>' : '') + line;
            }
        }
    }

    if (inList) result += `</${inList}>`;

    return result;
}
