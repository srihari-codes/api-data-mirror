import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getInbox, downloadFile, InboxFile } from '@/lib/api';
import { getKeys } from '@/lib/keyStorage';
import {
  verifySignature,
  decryptAESKey,
  decryptFile,
  hashData,
  concatenateBuffers,
  base64ToArrayBuffer,
  importSigningPublicKey,
  importPrivateKey,
} from '@/lib/crypto';

interface ReceiveFilesProps {
  onBack: () => void;
}

type ReceiveState = 'list' | 'downloading' | 'success' | 'error';

export function ReceiveFiles({ onBack }: ReceiveFilesProps) {
  const [state, setState] = useState<ReceiveState>('list');
  const [files, setFiles] = useState<InboxFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [selectedFile, setSelectedFile] = useState<InboxFile | null>(null);

  useEffect(() => {
    fetchInbox();
  }, []);

  const fetchInbox = async () => {
    setLoading(true);
    setError('');
    try {
      const inboxFiles = await getInbox();
      setFiles(inboxFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inbox');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: InboxFile) => {
    setSelectedFile(file);
    setState('downloading');
    setError('');

    try {
      // Get local keys
      const keys = await getKeys();
      if (!keys) {
        throw new Error('Local keys not found');
      }

      setProgress('Downloading encrypted file...');
      const downloadedFile = await downloadFile(file.fileId);

      setProgress('Verifying sender signature...');
      // Parse sender's signing public key
      let senderSigningKey: string;
      try {
        const parsed = JSON.parse(downloadedFile.senderPublicKey);
        senderSigningKey = parsed.signing;
      } catch {
        senderSigningKey = downloadedFile.senderPublicKey;
      }

      // Import sender's signing public key
      const signingPublicKey = await importSigningPublicKey(senderSigningKey);

      // Get encrypted file as ArrayBuffer
      const encryptedFileBuffer = await downloadedFile.encryptedFile.arrayBuffer();
      const nonce = base64ToArrayBuffer(downloadedFile.nonce);
      const authTag = base64ToArrayBuffer(downloadedFile.authTag);

      // Recreate the data that was signed
      const dataToVerify = concatenateBuffers(
        encryptedFileBuffer,
        nonce,
        authTag
      );
      const hash = await hashData(dataToVerify);

      // Verify signature
      const signature = base64ToArrayBuffer(downloadedFile.signature);
      const isValid = await verifySignature(signature, hash, signingPublicKey);

      if (!isValid) {
        throw new Error('Signature verification failed - file may be tampered or not from claimed sender');
      }

      setProgress('Decrypting file...');
      // Decrypt AES key with receiver's private key
      const encryptedAESKey = base64ToArrayBuffer(downloadedFile.encryptedAESKey);
      const privateKey = await importPrivateKey(keys.encryptionPrivateKey);
      const aesKey = await decryptAESKey(encryptedAESKey, privateKey);

      // Combine ciphertext and auth tag for AES-GCM decryption
      const ciphertextWithTag = new Uint8Array(encryptedFileBuffer.byteLength + authTag.byteLength);
      ciphertextWithTag.set(new Uint8Array(encryptedFileBuffer), 0);
      ciphertextWithTag.set(new Uint8Array(authTag), encryptedFileBuffer.byteLength);

      // Decrypt file
      const decryptedBuffer = await decryptFile(
        ciphertextWithTag.buffer,
        aesKey,
        new Uint8Array(nonce)
      );

      setProgress('Saving file...');
      // Create blob and download
      const blob = new Blob([decryptedBuffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadedFile.fileName || file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setState('success');
      setProgress('');
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to download file');
      setState('error');
      setProgress('');
    }
  };

  const handleReset = () => {
    setState('list');
    setSelectedFile(null);
    setError('');
    setProgress('');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Receive Files</h1>
          <Button onClick={onBack} variant="ghost" size="sm">
            Back
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-8">
        {state === 'list' && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">Inbox</h2>
              <Button onClick={fetchInbox} variant="outline" size="sm" disabled={loading}>
                Refresh
              </Button>
            </div>

            {loading && (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading...</p>
              </div>
            )}

            {!loading && error && (
              <div className="text-center py-8">
                <p className="text-destructive">{error}</p>
                <Button onClick={fetchInbox} variant="outline" className="mt-4">
                  Retry
                </Button>
              </div>
            )}

            {!loading && !error && files.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No files in your inbox</p>
              </div>
            )}

            {!loading && !error && files.length > 0 && (
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.fileId}
                    className="p-4 border rounded-lg flex justify-between items-center hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium">{file.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        From: {file.senderEmail || file.senderId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                    <Button onClick={() => handleDownload(file)} size="sm">
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {state === 'downloading' && (
          <div className="text-center space-y-4 py-8">
            <div className="animate-pulse">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
            <p className="text-muted-foreground">{progress}</p>
            {selectedFile && (
              <p className="text-sm">
                Downloading: {selectedFile.fileName}
              </p>
            )}
          </div>
        )}

        {state === 'success' && (
          <div className="text-center space-y-4 py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">File Downloaded Successfully</h3>
            <p className="text-muted-foreground text-sm">
              Signature verified. File is authentic and untampered.
            </p>
            <Button onClick={handleReset} className="w-full max-w-xs">
              Back to Inbox
            </Button>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center space-y-4 py-8">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Download Failed</h3>
            <p className="text-destructive text-sm">{error}</p>
            <Button onClick={handleReset} className="w-full max-w-xs">
              Back to Inbox
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
