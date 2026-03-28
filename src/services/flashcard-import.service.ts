import Papa from 'papaparse';
import type { VocabWord } from '@/types';

export interface ImportResult {
    data: VocabWord[];
    errors: string[];
}

export async function parseFlashcardsCSV(file: File): Promise<ImportResult> {
    return new Promise((resolve) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data: VocabWord[] = [];
                const errors: string[] = [];

                results.data.forEach((row: any, index: number) => {
                    // Normalize headers (try different variations)
                    const front = row['Front'] || row['Mặt trước'] || row['Word'] || row['Từ vựng'] || row['Question'] || row['Câu hỏi'];
                    const back = row['Back'] || row['Mặt sau'] || row['Meaning'] || row['Nghĩa'] || row['Answer'] || row['Trả lời'];
                    const notes = row['Notes'] || row['Ghi chú'] || row['Chú thích'] || row['Example'] || row['Ví dụ'];

                    if (front && back) {
                        data.push({
                            word: front.toString().trim(),
                            meaning: back.toString().trim(),
                            notes: notes ? notes.toString().trim() : undefined,
                            example: notes ? notes.toString().trim() : undefined,
                        });
                    } else {
                        errors.push(`Dòng ${index + 1}: Thiếu nội dung mặt trước hoặc mặt sau.`);
                    }
                });

                resolve({ data, errors });
            },
            error: (error) => {
                resolve({ data: [], errors: [`Lỗi khi đọc file: ${error.message}`] });
            }
        });
    });
}

export function generateCSVSample(): string {
    const headers = ['Front', 'Back', 'Notes'];
    const rows = [
        ['$E = mc^2$', 'Năng lượng nghỉ', 'Công thức nổi tiếng của Einstein'],
        ['$\\sqrt{a^2 + b^2} = c$', 'Định lí Pitago', 'Áp dụng cho tam giác vuông'],
        ['Tại sao bầu trời màu xanh?', 'Do hiện tượng tán xạ Rayleigh', 'Ánh sáng xanh bị tán xạ nhiều hơn'],
    ];
    
    return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');
}

export function downloadCSVSample() {
    const csv = generateCSVSample();
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_flashcard.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
