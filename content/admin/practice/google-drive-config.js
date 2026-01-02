/**
 * Google Drive Video Upload Configuration
 * 
 * HƯỚNG DẪN: 
 * 1. Làm theo các bước trong file GOOGLE_DRIVE_SETUP.md
 * 2. Thay thế các giá trị placeholder bên dưới bằng credentials của bạn
 */

const GOOGLE_DRIVE_CONFIG = {
    // OAuth 2.0 Client ID (từ Google Cloud Console → Credentials → OAuth 2.0 Client IDs)
    CLIENT_ID: '71472032732-aomouktu8au0caucvtmmcl7dsvoc9u8q.apps.googleusercontent.com',

    // API Key (từ Google Cloud Console → Credentials → API Keys)
    API_KEY: 'AIzaSyAQk7WiW2ez2yhBeJ-G6Z0fEdeiWAhh7BA',

    // Folder ID trên Google Drive để lưu video
    // Lấy từ URL: https://drive.google.com/drive/folders/FOLDER_ID
    FOLDER_ID: '1Rpfyn0EVphwudpvnZSAXMrVWPH9F6ayE',

    // Project Number (từ Google Cloud Console → Dashboard → Project number)
    // Dùng cho Google Picker
    APP_ID: '71472032732',

    // Scopes cần thiết
    SCOPES: 'https://www.googleapis.com/auth/drive.file',

    // Discovery docs
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],

    // Max file size (500MB)
    MAX_FILE_SIZE: 500 * 1024 * 1024,

    // Allowed video formats
    ALLOWED_TYPES: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
};

// ============================================================
// Google Drive Upload Class
// ============================================================

class GoogleDriveUploader {
    constructor() {
        this.isInitialized = false;
        this.isSignedIn = false;
        this.tokenClient = null;
        this.accessToken = null;
    }

    /**
     * Initialize Google API client
     */
    async init() {
        if (this.isInitialized) return;

        // Check if config is set
        if (GOOGLE_DRIVE_CONFIG.CLIENT_ID === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
            console.warn('[GoogleDrive] Config not set. Please update google-drive-config.js');
            return;
        }

        try {
            // Load Google APIs
            await this.loadGapiScript();
            await this.loadGisScript();

            // Initialize GAPI client
            await new Promise((resolve, reject) => {
                gapi.load('client:picker', { callback: resolve, onerror: reject });
            });

            await gapi.client.init({
                apiKey: GOOGLE_DRIVE_CONFIG.API_KEY,
                discoveryDocs: GOOGLE_DRIVE_CONFIG.DISCOVERY_DOCS,
            });

            // Initialize Google Identity Services
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
                scope: GOOGLE_DRIVE_CONFIG.SCOPES,
                callback: (response) => {
                    if (response.error) {
                        console.error('[GoogleDrive] Token error:', response);
                        return;
                    }
                    this.accessToken = response.access_token;
                    this.isSignedIn = true;
                },
            });

            this.isInitialized = true;
            console.log('[GoogleDrive] Initialized successfully');
        } catch (error) {
            console.error('[GoogleDrive] Init failed:', error);
            throw error;
        }
    }

    /**
     * Load GAPI script
     */
    loadGapiScript() {
        return new Promise((resolve, reject) => {
            if (window.gapi) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Load Google Identity Services script
     */
    loadGisScript() {
        return new Promise((resolve, reject) => {
            if (window.google?.accounts) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Request access token (triggers Google login popup)
     */
    async authorize() {
        if (!this.isInitialized) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            try {
                // Set callback
                this.tokenClient.callback = (response) => {
                    if (response.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    this.accessToken = response.access_token;
                    this.isSignedIn = true;
                    resolve(response.access_token);
                };

                // Request token - this opens Google login popup
                if (this.accessToken) {
                    // Already have token, request new one silently
                    this.tokenClient.requestAccessToken({ prompt: '' });
                } else {
                    // First time, show consent popup
                    this.tokenClient.requestAccessToken({ prompt: 'consent' });
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Upload video file to Google Drive
     * @param {File} file - Video file to upload
     * @param {Function} onProgress - Progress callback (0-100)
     * @returns {Promise<{id: string, link: string}>} - File ID and embed link
     */
    async uploadVideo(file, onProgress = () => { }) {
        // Validate file
        if (!file) {
            throw new Error('Không có file để upload');
        }

        if (!GOOGLE_DRIVE_CONFIG.ALLOWED_TYPES.includes(file.type)) {
            throw new Error('Định dạng file không được hỗ trợ. Vui lòng chọn MP4, WebM, MOV hoặc AVI');
        }

        if (file.size > GOOGLE_DRIVE_CONFIG.MAX_FILE_SIZE) {
            throw new Error(`File quá lớn. Tối đa ${Math.round(GOOGLE_DRIVE_CONFIG.MAX_FILE_SIZE / (1024 * 1024))}MB`);
        }

        // Ensure we're authorized
        if (!this.accessToken) {
            await this.authorize();
        }

        // Prepare metadata
        const metadata = {
            name: `${Date.now()}_${file.name}`,
            mimeType: file.type,
            parents: [GOOGLE_DRIVE_CONFIG.FOLDER_ID]
        };

        // Create form data
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        // Upload using XMLHttpRequest for progress tracking
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink');
            xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 201) {
                    const response = JSON.parse(xhr.responseText);

                    // Make file publicly viewable
                    this.makePublic(response.id).then(() => {
                        resolve({
                            id: response.id,
                            name: response.name,
                            link: `https://drive.google.com/file/d/${response.id}/view`,
                            embedLink: `https://drive.google.com/file/d/${response.id}/preview`
                        });
                    }).catch(error => {
                        console.warn('[GoogleDrive] Failed to make file public:', error);
                        // Still resolve with the file info
                        resolve({
                            id: response.id,
                            name: response.name,
                            link: `https://drive.google.com/file/d/${response.id}/view`,
                            embedLink: `https://drive.google.com/file/d/${response.id}/preview`
                        });
                    });
                } else if (xhr.status === 401) {
                    // Token expired, try to refresh
                    this.accessToken = null;
                    reject(new Error('Phiên đăng nhập hết hạn. Vui lòng thử lại.'));
                } else {
                    reject(new Error(`Upload thất bại: ${xhr.status} ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => {
                reject(new Error('Lỗi kết nối mạng'));
            };

            xhr.send(form);
        });
    }

    /**
     * Make file publicly viewable
     * @param {string} fileId - Google Drive file ID
     */
    async makePublic(fileId) {
        const permission = {
            type: 'anyone',
            role: 'reader'
        };

        await gapi.client.drive.permissions.create({
            fileId: fileId,
            resource: permission
        });
    }

    /**
     * Check if uploader is configured
     */
    isConfigured() {
        return GOOGLE_DRIVE_CONFIG.CLIENT_ID !== 'YOUR_CLIENT_ID.apps.googleusercontent.com' &&
            GOOGLE_DRIVE_CONFIG.API_KEY !== 'YOUR_API_KEY' &&
            GOOGLE_DRIVE_CONFIG.FOLDER_ID !== 'YOUR_FOLDER_ID';
    }
}

// Create global instance
window.googleDriveUploader = new GoogleDriveUploader();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GoogleDriveUploader, GOOGLE_DRIVE_CONFIG };
}
