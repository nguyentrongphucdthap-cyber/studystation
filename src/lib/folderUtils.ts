/**
 * Utilities for hierarchical folder path management (e.g. "Folder/Subfolder")
 */

export function getParentPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 1) return '';
    return parts.slice(0, -1).join('/');
}

export function getBaseName(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
}

export function joinPaths(...parts: (string | undefined | null)[]): string {
    return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

/**
 * Given a list of all existing folder paths and a current viewing path,
 * return the list of immediate subfolders at the current level.
 */
export function getSubFoldersAtLevel(allPaths: string[], currentPath: string): string[] {
    const prefix = currentPath ? currentPath + '/' : '';
    const subs = new Set<string>();
    
    allPaths.forEach(p => {
        if (p.startsWith(prefix) && p !== currentPath) {
            const relative = p.slice(prefix.length);
            const firstPart = relative.split('/')[0];
            if (firstPart) subs.add(firstPart);
        }
    });
    
    return Array.from(subs).sort((a, b) => a.localeCompare(b, 'vi'));
}

/**
 * Checks if path A is a descendant of path B (e.g. "A/B/C" is child of "A/B")
 */
export function isDescendant(path: string, parentPath: string): boolean {
    if (!parentPath) return true; // everything is descendant of root
    return path.startsWith(parentPath + '/');
}
