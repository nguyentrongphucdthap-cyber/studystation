/**
 * Utility functions for exporting data to various formats and triggering downloads.
 */

/**
 * Trigger a browser download of a file.
 */
export function triggerDownload(content: string, fileName: string, contentType: string) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Export data as a formatted JSON file.
 */
export function downloadJSON(data: any, fileName: string) {
    const json = JSON.stringify(data, null, 2);
    triggerDownload(json, fileName.endsWith('.json') ? fileName : `${fileName}.json`, 'application/json');
}

/**
 * Export an array of objects as a CSV file.
 * Handles escaping quotes and commas.
 */
export function downloadCSV(data: any[], fileName: string) {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header] ?? '';
                const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                // Escape double quotes and wrap in double quotes if it contains comma or newline
                const escaped = stringValue.replace(/"/g, '""');
                return /[,|"\n]/.test(escaped) ? `"${escaped}"` : escaped;
            }).join(',')
        )
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel UTF-8 support
    triggerDownload(csvContent, fileName.endsWith('.csv') ? fileName : `${fileName}.csv`, 'text/csv;charset=utf-8;');
}
