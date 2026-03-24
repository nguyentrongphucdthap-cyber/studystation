import { Exam, QuestionGroup } from '@/types';

/**
 * Normalizes an English exam if it's in the legacy format (no questionGroups).
 */
export function normalizeEnglishExam(exam: Exam): Exam {
    if (exam.subjectId !== 'anh') return exam;
    if (exam.questionGroups && exam.questionGroups.length > 0) return exam;

    const part1 = exam.part1 || [];
    if (part1.length === 0) return exam;

    const newGroups: QuestionGroup[] = [];
    const usedIds = new Set<number>();

    // Step 1: Detect common patterns like "Read the following passage and mark..."
    // We look for consecutive questions that share a common "instruction" prefix.
    
    let i = 0;
    while (i < part1.length) {
        const currentQ = part1[i]!;
        if (usedIds.has(currentQ.id)) {
            i++;
            continue;
        }

        // Try to find if this question has a "Group-like" header
        // Patterns: 
        // 1. "Read the following passage..."
        // 2. "Mark the letter A, B, C, or D on your answer sheet..."
        
        const text = currentQ.text;
        const instructionMatch = text.match(/^(?:Read the following passage|Mark the letter A, B, C, or D|Choose the word|Choose the best answer)([\s\S]*?)(?:\r?\n\r?\n|\.\r?\n|:)/i);

        if (instructionMatch) {
            const instruction = instructionMatch[0].trim();
            const groupQuestions: number[] = [currentQ.id];
            usedIds.add(currentQ.id);

            // Look ahead for questions with the SAME instruction prefix
            let j = i + 1;
            while (j < part1.length) {
                const nextQ = part1[j]!;
                if (nextQ.text.startsWith(instruction)) {
                    groupQuestions.push(nextQ.id);
                    usedIds.add(nextQ.id);
                    j++;
                } else {
                    break;
                }
            }

            if (groupQuestions.length > 1 || instruction.length > 50) {
                // Create a group
                const groupId = `auto-grp-${newGroups.length + 1}`;
                
                // Clean up question text by removing the instruction prefix
                // If it's a passage, the instruction might be "Read... passage" followed by the passage
                // We'll try to separate Requirement from Passage if possible
                let title = instruction;
                let passage = '';

                if (instruction.toLowerCase().includes('passage')) {
                   // Split instruction from passage if there's a clear break
                   const passageSplit = instruction.split(/(?:on your answer sheet to indicate|following questions:)/i);
                   if (passageSplit.length > 1) {
                       title = passageSplit[0]!.trim() + '...';
                       passage = instruction.substring(instruction.indexOf(passageSplit[1]!) || 0).trim();
                   }
                }

                newGroups.push({
                    id: groupId,
                    title: title,
                    passage: passage,
                    questionIds: groupQuestions
                });

                // Update the original questions to remove the instruction prefix (optional but cleaner)
                // However, doing this might be risky if the split is not perfect.
                // For now, let's just keep the text as is but move to groups.
            }
        }
        i++;
    }

    if (newGroups.length > 0) {
        return {
            ...exam,
            questionGroups: newGroups
        };
    }

    return exam;
}
