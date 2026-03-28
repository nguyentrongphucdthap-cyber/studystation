import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { cn } from '@/lib/utils';

interface FormattedTextProps {
    text: string;
    className?: string;
}

export function FormattedText({ text, className }: FormattedTextProps) {
    if (!text) return null;

    // Split text by $$ (block math) and $ (inline math)
    // We prioritize $$ over $
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$.*?\$)/g);

    return (
        <div className={cn("inline-block", className)}>
            {parts.map((part, index) => {
                if (part.startsWith('$$') && part.endsWith('$$')) {
                    const math = part.slice(2, -2);
                    return <BlockMath key={index} math={math} />;
                } else if (part.startsWith('$') && part.endsWith('$')) {
                    const math = part.slice(1, -1);
                    return <InlineMath key={index} math={math} />;
                }
                
                // For regular text, handle newlines
                return (
                    <span key={index} className="whitespace-pre-wrap">
                        {part}
                    </span>
                );
            })}
        </div>
    );
}
