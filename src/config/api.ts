// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  // Auth
  AUTH_GOOGLE: '/auth/google',
  
  // Users
  USERS_PUBLIC_KEY: '/users/public-key',
  
  // Files
  FILES_SEND: '/files/send',
  FILES_INBOX: '/files/inbox',
  FILES_DOWNLOAD: (fileId: string) => `/files/download/${fileId}`,
};
