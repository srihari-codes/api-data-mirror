// API Client for Zero-Trust File Sharing
import { API_BASE_URL, API_ENDPOINTS } from '@/config/api';

// Get JWT from localStorage
function getToken(): string | null {
  return localStorage.getItem('jwt');
}

// Set JWT in localStorage
export function setToken(token: string): void {
  localStorage.setItem('jwt', token);
}

// Clear JWT from localStorage
export function clearToken(): void {
  localStorage.removeItem('jwt');
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return !!getToken();
}

// Headers with JWT
function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Authorization': `Bearer ${token}`,
  };
}

// JSON headers with JWT
function jsonAuthHeaders(): HeadersInit {
  return {
    ...authHeaders(),
    'Content-Type': 'application/json',
  };
}

// POST /auth/google - Authenticate user with Google OAuth
export async function authGoogle(credential: string): Promise<{ token: string; isNewUser: boolean; userId: string }> {
  const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH_GOOGLE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ credential }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Authentication failed');
  }
  
  return response.json();
}

// POST /users/public-key - Store user's public key (registration only)
export async function uploadPublicKey(publicKey: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.USERS_PUBLIC_KEY}`, {
    method: 'POST',
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ publicKey }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload public key');
  }
  
  return response.json();
}

// GET /users/public-key?email= - Get receiver's public key
export async function getReceiverPublicKey(email: string): Promise<{ userId: string; publicKey: string }> {
  const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.USERS_PUBLIC_KEY}?email=${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'User not found');
  }
  
  return response.json();
}

// POST /files/send - Upload encrypted file
export interface SendFilePayload {
  receiverId: string;
  encryptedAESKey: string;
  nonce: string;
  authTag: string;
  signature: string;
  senderPublicKey: string;
  file: Blob;
  fileName: string;
}

export async function sendFile(payload: SendFilePayload): Promise<{ fileId: string; message: string }> {
  const formData = new FormData();
  formData.append('receiverId', payload.receiverId);
  formData.append('encryptedAESKey', payload.encryptedAESKey);
  formData.append('nonce', payload.nonce);
  formData.append('authTag', payload.authTag);
  formData.append('signature', payload.signature);
  formData.append('senderPublicKey', payload.senderPublicKey);
  formData.append('file', payload.file, payload.fileName);
  
  const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.FILES_SEND}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send file');
  }
  
  return response.json();
}

// GET /files/inbox - List incoming files
export interface InboxFile {
  fileId: string;
  fileName: string;
  senderId: string;
  senderEmail?: string;
  uploadedAt: string;
}

export async function getInbox(): Promise<InboxFile[]> {
  const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.FILES_INBOX}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch inbox');
  }
  
  return response.json();
}

// GET /files/download/:fileId - Download encrypted file
export interface DownloadedFile {
  encryptedFile: Blob;
  encryptedAESKey: string;
  nonce: string;
  authTag: string;
  signature: string;
  senderPublicKey: string;
  fileName: string;
}

export async function downloadFile(fileId: string): Promise<DownloadedFile> {
  const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.FILES_DOWNLOAD(fileId)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to download file');
  }
  
  // Parse multipart response or JSON with blob
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    // JSON response with base64 encoded file
    const data = await response.json();
    const fileBlob = new Blob([Uint8Array.from(atob(data.encryptedFile), c => c.charCodeAt(0))]);
    return {
      encryptedFile: fileBlob,
      encryptedAESKey: data.encryptedAESKey,
      nonce: data.nonce,
      authTag: data.authTag,
      signature: data.signature,
      senderPublicKey: data.senderPublicKey,
      fileName: data.fileName,
    };
  } else {
    // Assume blob response with metadata in headers
    const blob = await response.blob();
    return {
      encryptedFile: blob,
      encryptedAESKey: response.headers.get('X-Encrypted-AES-Key') || '',
      nonce: response.headers.get('X-Nonce') || '',
      authTag: response.headers.get('X-Auth-Tag') || '',
      signature: response.headers.get('X-Signature') || '',
      senderPublicKey: response.headers.get('X-Sender-Public-Key') || '',
      fileName: response.headers.get('X-File-Name') || 'downloaded-file',
    };
  }
}
