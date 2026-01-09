import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authGoogle, uploadPublicKey } from '@/lib/api';
import { 
  generateKeyPair, 
  generateSigningKeyPair, 
  exportPublicKey, 
  exportPrivateKey 
} from '@/lib/crypto';
import { storeKeys, hasKeys } from '@/lib/keyStorage';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, config: {
            theme: string;
            size: string;
            width: number;
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function Login() {
  const { login, setHasKeyPair } = useAuth();

  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    try {
      // Authenticate with backend
      const authResult = await authGoogle(response.credential);
      login(authResult.token);

      // Check if this is a new user (needs key generation)
      if (authResult.isNewUser) {
        // Generate key pairs
        const encryptionKeyPair = await generateKeyPair();
        const signingKeyPair = await generateSigningKeyPair();

        // Export keys
        const encryptionPublicKey = await exportPublicKey(encryptionKeyPair.publicKey);
        const encryptionPrivateKey = await exportPrivateKey(encryptionKeyPair.privateKey);
        const signingPublicKey = await exportPublicKey(signingKeyPair.publicKey);
        const signingPrivateKey = await exportPrivateKey(signingKeyPair.privateKey);

        // Store keys locally
        await storeKeys({
          encryptionPublicKey,
          encryptionPrivateKey,
          signingPublicKey,
          signingPrivateKey,
        });

        // Upload public keys to server (combined as single key for simplicity)
        // In production, you might want to store both separately
        const combinedPublicKey = JSON.stringify({
          encryption: encryptionPublicKey,
          signing: signingPublicKey,
        });
        await uploadPublicKey(combinedPublicKey);

        setHasKeyPair(true);
      } else {
        // Existing user - check if keys exist locally
        const keysExist = await hasKeys();
        setHasKeyPair(keysExist);
        
        if (!keysExist) {
          console.warn('Existing user but no local keys found. User may need to recover keys.');
        }
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
    }
  }, [login, setHasKeyPair]);

  useEffect(() => {
    // Load Google Sign-In script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google && GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });

        const buttonDiv = document.getElementById('google-signin-button');
        if (buttonDiv) {
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: 'outline',
            size: 'large',
            width: 280,
          });
        }
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [handleCredentialResponse]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="p-8 border rounded-lg shadow-sm max-w-md w-full">
        <h1 className="text-2xl font-bold mb-2 text-center">Vortex</h1>
        <p className="text-muted-foreground mb-6 text-center">
          Zero-Trust Encrypted File Sharing
        </p>
        
        <div className="flex flex-col items-center gap-4">
          {GOOGLE_CLIENT_ID ? (
            <div id="google-signin-button"></div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-destructive mb-2">
                Google Client ID not configured
              </p>
              <p className="text-xs text-muted-foreground">
                Set VITE_GOOGLE_CLIENT_ID environment variable
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-muted-foreground text-center">
          <p>Your files are encrypted end-to-end.</p>
          <p>Server never sees your plaintext data.</p>
        </div>
      </div>
    </div>
  );
}
