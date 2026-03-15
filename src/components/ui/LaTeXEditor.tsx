import React, { useState, useCallback } from 'react';
import { LatexContent } from '@/components/ui/LatexContent';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

interface LaTeXEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    rows?: number;
    className?: string;
    showToolbar?: boolean;
}

interface ToolbarButton {
    label: string;
    insert: string;         // text to insert (use | as cursor position marker)
    title: string;
    group?: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
    // Math basics
    { label: '$…$', insert: '$|$', title: 'Inline math', group: 'math' },
    { label: '$$…$$', insert: '$$\n|\n$$', title: 'Block math (display)', group: 'math' },
    { label: '\\(…\\)', insert: '\\(|\\)', title: 'Inline math LaTeX style', group: 'math' },
    { label: '\\[…\\]', insert: '\\[\n|\n\\]', title: 'Block math LaTeX style', group: 'math' },
    // Fractions & powers
    { label: '\\frac', insert: '\\frac{|}{b}', title: 'Fraction', group: 'algebra' },
    { label: 'x²', insert: 'x^{|}', title: 'Superscript / Power', group: 'algebra' },
    { label: 'x₂', insert: 'x_{|}', title: 'Subscript', group: 'algebra' },
    { label: '√', insert: '\\sqrt{|}', title: 'Square root', group: 'algebra' },
    { label: 'ⁿ√', insert: '\\sqrt[n]{|}', title: 'N-th root', group: 'algebra' },
    // Calculus
    { label: '∫', insert: '\\int_{a}^{b} | \\, dx', title: 'Integral', group: 'calculus' },
    { label: '∑', insert: '\\sum_{i=1}^{n} |', title: 'Sum', group: 'calculus' },
    { label: '∏', insert: '\\prod_{i=1}^{n} |', title: 'Product', group: 'calculus' },
    { label: 'lim', insert: '\\lim_{x \\to |} f(x)', title: 'Limit', group: 'calculus' },
    { label: "f'", insert: "f'(|)", title: 'Derivative', group: 'calculus' },
    { label: '∂', insert: '\\frac{\\partial |}{\\partial x}', title: 'Partial derivative', group: 'calculus' },
    // Vectors
    { label: '\\vec', insert: '\\vec{|}', title: 'Vector arrow', group: 'vectors' },
    { label: '|x|', insert: '|{|}|', title: 'Absolute value', group: 'vectors' },
    { label: '‖x‖', insert: '\\|{|}\\|', title: 'Norm', group: 'vectors' },
    // Trigonometry
    { label: 'sin', insert: '\\sin(|)', title: 'Sine', group: 'trig' },
    { label: 'cos', insert: '\\cos(|)', title: 'Cosine', group: 'trig' },
    { label: 'tan', insert: '\\tan(|)', title: 'Tangent', group: 'trig' },
    { label: 'π', insert: '\\pi', title: 'Pi', group: 'trig' },
    { label: '∞', insert: '\\infty', title: 'Infinity', group: 'trig' },
    // Chemistry
    { label: '\\ce', insert: '\\ce{|}', title: 'Chemistry formula (mhchem)', group: 'chem' },
    { label: '→', insert: '\\ce{|->}', title: 'Chemistry arrow', group: 'chem' },
    { label: '⇌', insert: '\\ce{|<=>}', title: 'Equilibrium arrow', group: 'chem' },
    // Matrices
    { label: 'matrix', insert: '\\begin{pmatrix}\n  a & b \\\\\\\\\n  c & d\n\\end{pmatrix}', title: 'Matrix', group: 'matrix' },
    { label: 'cases', insert: '\\begin{cases}\n  | & \\text{if } x > 0 \\\\\\\\\n  0 & \\text{otherwise}\n\\end{cases}', title: 'Cases', group: 'matrix' },
];

const GROUPS = [
    { key: 'math', label: 'Toán cơ bản' },
    { key: 'algebra', label: 'Đại số' },
    { key: 'calculus', label: 'Tính toán' },
    { key: 'vectors', label: 'Vectơ' },
    { key: 'trig', label: 'Lượng giác' },
    { key: 'chem', label: '⚗️ Hóa học' },
    { key: 'matrix', label: 'Ma trận' },
];

export const LaTeXEditor: React.FC<LaTeXEditorProps> = ({
    value,
    onChange,
    placeholder = 'Nhập nội dung... Dùng $...$ cho inline math, $$...$$ cho block math',
    label,
    rows = 4,
    className,
    showToolbar = true,
}) => {
    const [showPreview, setShowPreview] = useState(true);
    const [activeGroup, setActiveGroup] = useState<string | null>(null);

    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const insertAtCursor = useCallback((template: string) => {
        const ta = textareaRef.current;
        if (!ta) return;

        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const selected = value.slice(start, end);

        // Replace | with the selected text (if any), otherwise place cursor there
        let toInsert = template.includes('|')
            ? template.replace('|', selected || '')
            : template;

        const cursorOffset = template.indexOf('|');

        const newValue = value.slice(0, start) + toInsert + value.slice(end);
        onChange(newValue);

        // Restore cursor position
        requestAnimationFrame(() => {
            ta.focus();
            const newCursor = cursorOffset >= 0
                ? start + cursorOffset + (selected.length > 0 && template.includes('|') ? selected.length : 0)
                : start + toInsert.length;
            ta.selectionStart = ta.selectionEnd = Math.min(newCursor, newValue.length);
        });
    }, [value, onChange]);

    const filteredButtons = activeGroup
        ? TOOLBAR_BUTTONS.filter(b => b.group === activeGroup)
        : TOOLBAR_BUTTONS.slice(0, 12); // Show first 12 by default

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            {label && (
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {label}
                </label>
            )}

            {/* Toolbar */}
            {showToolbar && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {/* Group selector */}
                    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setActiveGroup(null)}
                            className={cn(
                                'px-2 py-1 text-[10px] font-bold rounded-md transition-all',
                                !activeGroup
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                            )}
                        >
                            Thường dùng
                        </button>
                        {GROUPS.map(g => (
                            <button
                                key={g.key}
                                type="button"
                                onClick={() => setActiveGroup(activeGroup === g.key ? null : g.key)}
                                className={cn(
                                    'px-2 py-1 text-[10px] font-bold rounded-md transition-all',
                                    activeGroup === g.key
                                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                                )}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>

                    {/* Symbol buttons */}
                    <div className="flex flex-wrap gap-1 p-2">
                        {filteredButtons.map(btn => (
                            <button
                                key={btn.title}
                                type="button"
                                title={btn.title}
                                onClick={() => insertAtCursor(btn.insert)}
                                className="px-2 py-1 text-[11px] font-mono font-semibold rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300 transition-all text-slate-700 dark:text-slate-200 shadow-sm"
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Editor + Preview */}
            <div className={cn('flex gap-3', showPreview ? 'flex-row' : 'flex-col')}>
                {/* Textarea */}
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Soạn thảo</span>
                        <button
                            type="button"
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-indigo-500 transition-colors"
                        >
                            {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {showPreview ? 'Ẩn preview' : 'Hiện preview'}
                        </button>
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        placeholder={placeholder}
                        rows={rows}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-mono outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all resize-y leading-relaxed"
                        spellCheck={false}
                    />
                </div>

                {/* Preview */}
                {showPreview && (
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Preview</span>
                        <div className="flex-1 min-h-[80px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-3 text-sm overflow-auto">
                            {value ? (
                                <LatexContent content={value} className="text-slate-800 dark:text-slate-200 leading-relaxed" />
                            ) : (
                                <span className="text-slate-400 italic text-xs">Preview sẽ hiện ở đây...</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
