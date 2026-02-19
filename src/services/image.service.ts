export interface UploadResult {
    url: string;
    thumb: string;
    delete_url: string;
}

export async function uploadToImgBB(file: File | Blob): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
    }

    return await response.json();
}
