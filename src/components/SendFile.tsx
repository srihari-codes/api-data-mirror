import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getReceiverPublicKey, sendFile } from '@/lib/api';
import { getKeys } from '@/lib/keyStorage';
import {
  generateAESKey,
  generateNonce,
  encryptFile,
  encryptAESKey,
  signData,
  hashData,
  concatenateBuffers,
  arrayBufferToBase64,
  importPublicKey,
  importSigningPrivateKey,
} from '@/lib/crypto';

interface SendFileProps {
  onBack: () => void;
}

type SendState = 'lookup' | 'select' | 'sending' | 'success' | 'error';

export function SendFile({ onBack }: SendFileProps) {
  const [state, setState] = useState<SendState>('lookup');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [receiverData, setReceiverData] = useState<{ userId: string; publicKey: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLookupReceiver = async () => {
    if (!receiverEmail.trim()) {
      setError('Please enter receiver email');
      return;
    }

    setError('');
    setProgress('Looking up receiver...');

    try {
      const data = await getReceiverPublicKey(receiverEmail.trim());
      setReceiverData(data);
      setState('select');
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'User not found');
      setProgress('');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSend = async () => {
    if (!selectedFile || !receiverData) return;

    setState('sending');
    setError('');

    try {
      // Get local keys
      const keys = await getKeys();
      if (!keys) {
        throw new Error('Local keys not found');
      }

      setProgress('Reading file...');
      const fileBuffer = await selectedFile.arrayBuffer();

      setProgress('Generating encryption key...');
      // Generate AES key and nonce
      const aesKey = await generateAESKey();
      const nonce = generateNonce();

      setProgress('Encrypting file...');
      // Encrypt file with AES-256-GCM
      const encryptedFileBuffer = await encryptFile(fileBuffer, aesKey, nonce);

      // AES-GCM produces ciphertext + auth tag appended
      // Auth tag is last 16 bytes
      const encryptedFile = new Uint8Array(encryptedFileBuffer);
      const authTagLength = 16;
      const ciphertext = encryptedFile.slice(0, encryptedFile.length - authTagLength);
      const authTag = encryptedFile.slice(encryptedFile.length - authTagLength);

      setProgress('Encrypting key for receiver...');
      // Parse receiver's public key (it's stored as JSON with encryption and signing keys)
      let receiverEncryptionKey: string;
      try {
        const parsed = JSON.parse(receiverData.publicKey);
        receiverEncryptionKey = parsed.encryption;
      } catch {
        // Fallback: use the key directly if not JSON
        receiverEncryptionKey = receiverData.publicKey;
      }

      // Import receiver's public key and encrypt AES key
      const receiverPublicKey = await importPublicKey(receiverEncryptionKey);
      const encryptedAESKey = await encryptAESKey(aesKey, receiverPublicKey);

      setProgress('Creating digital signature...');
      // Create hash of encrypted data + metadata for signing
      const dataToSign = concatenateBuffers(
        ciphertext.buffer as ArrayBuffer,
        nonce.buffer as ArrayBuffer,
        authTag.buffer as ArrayBuffer
      );
      const hash = await hashData(dataToSign);

      // Sign the hash with sender's private signing key
      const signingPrivateKey = await importSigningPrivateKey(keys.signingPrivateKey);
      const signature = await signData(hash, signingPrivateKey);

      setProgress('Uploading encrypted file...');
      // Send to server
      const result = await sendFile({
        receiverId: receiverData.userId,
        encryptedAESKey: arrayBufferToBase64(encryptedAESKey),
        nonce: arrayBufferToBase64(nonce.buffer as ArrayBuffer),
        authTag: arrayBufferToBase64(authTag.buffer as ArrayBuffer),
        signature: arrayBufferToBase64(signature),
        senderPublicKey: keys.signingPublicKey,
        file: new Blob([ciphertext]),
        fileName: selectedFile.name,
      });

      console.log('File sent:', result);
      setState('success');
      setProgress('');
    } catch (err) {
      console.error('Send failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to send file');
      setState('error');
      setProgress('');
    }
  };

  const handleReset = () => {
    setState('lookup');
    setReceiverEmail('');
    setReceiverData(null);
    setSelectedFile(null);
    setError('');
    setProgress('');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Send File</h1>
          <Button onClick={onBack} variant="ghost" size="sm">
            Back
          </Button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-8">
        {state === 'lookup' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Receiver Email
              </label>
              <Input
                type="email"
                value={receiverEmail}
                onChange={(e) => setReceiverEmail(e.target.value)}
                placeholder="receiver@email.com"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button 
              onClick={handleLookupReceiver} 
              className="w-full"
              disabled={!!progress}
            >
              {progress || 'Look Up Receiver'}
            </Button>
          </div>
        )}

        {state === 'select' && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="text-muted-foreground">Sending to: </span>
                <strong>{receiverEmail}</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Select File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded file:border-0
                  file:text-sm file:font-medium
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90"
              />
            </div>

            {selectedFile && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="text-muted-foreground">Selected: </span>
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2">
              <Button onClick={handleReset} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleSend} 
                className="flex-1"
                disabled={!selectedFile}
              >
                Send
              </Button>
            </div>
          </div>
        )}

        {state === 'sending' && (
          <div className="text-center space-y-4">
            <div className="animate-pulse">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
            <p className="text-muted-foreground">{progress}</p>
          </div>
        )}

        {state === 'success' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">File Sent Successfully</h3>
            <p className="text-muted-foreground text-sm">
              Your file has been encrypted and sent securely.
            </p>
            <Button onClick={handleReset} className="w-full">
              Send Another File
            </Button>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Failed to Send</h3>
            <p className="text-destructive text-sm">{error}</p>
            <Button onClick={handleReset} className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
