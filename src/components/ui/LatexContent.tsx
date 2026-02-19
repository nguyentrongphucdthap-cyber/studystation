import React, { useMemo } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// Import mhchem for bundled katex if possible
try {
    // @ts-ignore
    import('katex/dist/contrib/mhchem');
} catch {
    // Fail silently
}

interface LatexContentProps {
    content: string;
    className?: string;
}

export const LatexContent: React.FC<LatexContentProps> = ({ content, className }) => {
    if (!content) return null;

    const renderedParts = useMemo(() => {
        // Regex to split: 
        // 1. $$...$$ (Block math)
        // 2. $...$ (Inline math)
        // 3. \ce{...} (Naked chemistry)
        const parts = content.split(/(\$\$.*?\$\$|\$.*?\$|\\ce\{.*?\})/gs);

        return parts.map((part, index) => {
            if (!part) return null;

            try {
                // Block math: $$ ... $$
                if (part.startsWith('$$') && part.endsWith('$$')) {
                    const math = part.slice(2, -2).trim();
                    return <BlockMath key={index} math={math} errorColor="#cc0000" />;
                }

                // Inline math: $ ... $
                if (part.startsWith('$') && part.endsWith('$')) {
                    const math = part.slice(1, -1).trim();
                    return <InlineMath key={index} math={math} errorColor="#cc0000" />;
                }

                // Chemistry: \ce{ ... }
                if (part.startsWith('\\ce{') && part.endsWith('}')) {
                    return <InlineMath key={index} math={part} errorColor="#cc0000" />;
                }

                // AI sometimes forgets the braces: \ce C17H35...
                // We attempt to catch common chemistry patterns if they start with \ce
                if (part.trim().startsWith('\\ce')) {
                    return <InlineMath key={index} math={part.trim()} errorColor="#cc0000" />;
                }

                // Regular text
                return (
                    <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
                        {part}
                    </span>
                );
            } catch (err) {
                console.error('KaTeX render error:', err, part);
                return <span key={index} className="text-red-500 font-mono text-xs">{part}</span>;
            }
        });
    }, [content]);

    return (
        <span className={className}>
            {renderedParts}
        </span>
    );
};
