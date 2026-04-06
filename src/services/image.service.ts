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

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error('[Image Service] Server returned non-JSON response:', text);
        throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Vui lòng kiểm tra console.');
    }

    if (!response.ok) {
        throw new Error(data.error || `Lỗi tải ảnh (${response.status})`);
    }

    return data;
}
