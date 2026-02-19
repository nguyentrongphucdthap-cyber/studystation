export interface ParsedQuestion {
    id?: string;
    text: string;
    options: string[];
    correct: number;
    explanation: string;
    image?: string;
}

export function parseExamText(text: string): ParsedQuestion[] {
    const questions: ParsedQuestion[] = [];
    const blocks = text.split(/--------------------------------------------------/);

    for (const block of blocks) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue;

        try {
            // Match content following [Question], stopping at the first option (A. or *A.)
            const questionMatch = trimmedBlock.match(/\[Question\]\s*([\s\S]*?)(?=[A-Z]\.|\n\*)/i);
            const questionContent = (questionMatch && questionMatch[1]) ? questionMatch[1].trim() : '';

            // Extract image from question content if present
            const imgMatch = questionContent.match(/!\[.*?\]\((.*?)\)/);
            const image = (imgMatch && imgMatch[1]) ? imgMatch[1] : undefined;
            const pureQuestion = questionContent.replace(/!\[.*?\]\(.*?\)/g, '').trim();

            const options: string[] = [];
            let correct = 0;

            // Regex looks for patterns like A. Option, *B. Correct, C. Option
            const optionRegex = /^[ \t]*(\*?)([A-D])\.\s*(.*)$/gm;
            let match;
            let optionIndex = 0;

            while ((match = optionRegex.exec(trimmedBlock)) !== null) {
                const isCorrect = match[1] === '*';
                const optText = match[3] || '';
                options.push(optText.trim());
                if (isCorrect) correct = optionIndex;
                optionIndex++;
            }

            const explanationMatch = trimmedBlock.match(/\[Explanation\]\s*([\s\S]*)$/i);
            const explanation = (explanationMatch && explanationMatch[1]) ? explanationMatch[1].trim() : '';

            if (pureQuestion && options.length > 0) {
                const question: ParsedQuestion = {
                    text: pureQuestion,
                    options: options.slice(0, 4),
                    correct,
                    explanation,
                };
                if (image) question.image = image;
                questions.push(question);
            }
        } catch (err) {
            console.error('[Parser] Failed to parse block:', trimmedBlock, err);
        }
    }

    return questions;
}
