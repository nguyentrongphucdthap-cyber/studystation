/**
 * MagoText — Renders Mago AI responses with rich formatting.
 * Supports: **bold**, *italic*, `code`, ```code blocks```, bullet/numbered lists, and newlines.
 */
import { useMemo } from 'react';

interface MagoTextProps {
    text: string;
}

export default function MagoText({ text }: MagoTextProps) {
    const html = useMemo(() => formatMagoText(text), [text]);
    return <span className="mago-text" dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatMagoText(text: string): string {
    // Split by code blocks first (```...```)
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map(part => {
        // Code block
        if (part.startsWith('```') && part.endsWith('```')) {
            const code = part.slice(3, -3).replace(/^\w+\n/, ''); // remove optional language tag
            return `<pre class="mago-code-block"><code>${escapeHtml(code.trim())}</code></pre>`;
        }

        // Process inline formatting
        let html = escapeHtml(part);

        // Bold: **text**
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic: *text* (but not inside bold)
        html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');

        // Inline code: `text`
        html = html.replace(/`([^`]+?)`/g, '<code class="mago-inline-code">$1</code>');

        // Highlight: ==text==
        html = html.replace(/==(.+?)==/g, '<mark class="mago-highlight">$1</mark>');

        // Process line by line for lists and paragraphs
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
                // Empty line = paragraph break
                if (trimmed === '') {
                    result += '<br/>';
                } else {
                    result += (i > 0 ? '<br/>' : '') + line;
                }
            }
        }

        if (inList) result += `</${inList}>`;

        return result;
    }).join('');
}
