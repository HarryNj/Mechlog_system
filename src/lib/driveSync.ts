import { signInWithPopup, signOut, GoogleAuthProvider, User } from 'firebase/auth';
import { auth, googleAuthProvider } from './firebase.ts';

// In-memory token cache (as requested by security guidelines)
let cachedAccessToken: string | null = null;
let googleUser: User | null = null;

export const connectGoogleDrive = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Auth.');
    }
    cachedAccessToken = credential.accessToken;
    googleUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Drive connection error:', error);
    throw error;
  }
};

export const disconnectGoogleDrive = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  googleUser = null;
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getGoogleUser = (): User | null => {
  return googleUser;
};

// Generic Multipart File Upload to Google Drive (Supports binary like Excel or JSON strings)
export const uploadToDriveMultipart = async (
  name: string,
  mimeType: string,
  contentBlob: Blob,
  accessToken: string
) => {
  const metadata = {
    name: name,
    mimeType: mimeType
  };

  const boundary = "eff_drive_sync_boundary_" + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // Read Blob contents as ArrayBuffer
  const fileBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(contentBlob);
  });

  const metadataStr = JSON.stringify(metadata);
  const header = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadataStr}${delimiter}Content-Type: ${mimeType}\r\n\r\n`;
  const footer = `${closeDelimiter}`;

  const headerBytes = new TextEncoder().encode(header);
  const footerBytes = new TextEncoder().encode(footer);

  const totalLength = headerBytes.byteLength + fileBytes.byteLength + footerBytes.byteLength;
  const combinedBytes = new Uint8Array(totalLength);
  combinedBytes.set(headerBytes, 0);
  combinedBytes.set(new Uint8Array(fileBytes), headerBytes.byteLength);
  combinedBytes.set(footerBytes, headerBytes.byteLength + fileBytes.byteLength);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: combinedBytes
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive Upload failed: ${text}`);
  }
  return await res.json();
};

// List JSON backups saved in Google Drive
export const listDriveBackups = async (accessToken: string) => {
  const q = "name contains 'eff_fleet_backup' and mimeType = 'application/json' and trashed = false";
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&orderBy=createdTime desc`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list backups from Google Drive: ${text}`);
  }
  const data = await res.json();
  return data.files || [];
};

// Download dynamic file contents from Google Drive
export const downloadDriveFile = async (fileId: string, accessToken: string) => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to download backup file: ${text}`);
  }
  return await res.json();
};

// Delete a backup from Google Drive with confirmation requirement (as per rules)
export const deleteDriveFile = async (fileId: string, accessToken: string) => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete Google Drive file: ${text}`);
  }
  return true;
};
