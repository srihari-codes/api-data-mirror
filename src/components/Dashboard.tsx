import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SendFile } from './SendFile';
import { ReceiveFiles } from './ReceiveFiles';
import { Button } from '@/components/ui/button';

type View = 'dashboard' | 'send' | 'receive';

export function Dashboard() {
  const { logout, hasKeyPair } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');

  if (!hasKeyPair) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="p-8 border rounded-lg shadow-sm max-w-md w-full text-center">
          <h1 className="text-xl font-bold mb-4">Keys Not Found</h1>
          <p className="text-muted-foreground mb-4">
            Your encryption keys were not found on this device. 
            This can happen if you cleared browser data or are using a new device.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            You'll need to recover your keys or create a new account.
          </p>
          <Button onClick={logout} variant="outline">
            Logout
          </Button>
        </div>
      </div>
    );
  }

  if (currentView === 'send') {
    return <SendFile onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'receive') {
    return <ReceiveFiles onBack={() => setCurrentView('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Vortex</h1>
          <Button onClick={logout} variant="ghost" size="sm">
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Select an action to continue
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <button
            onClick={() => setCurrentView('send')}
            className="p-8 border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
          >
            <h3 className="text-xl font-semibold mb-2">Send</h3>
            <p className="text-muted-foreground text-sm">
              Encrypt and send a file to another user securely
            </p>
          </button>

          <button
            onClick={() => setCurrentView('receive')}
            className="p-8 border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
          >
            <h3 className="text-xl font-semibold mb-2">Receive</h3>
            <p className="text-muted-foreground text-sm">
              View and decrypt files sent to you
            </p>
          </button>
        </div>

        <div className="mt-12 text-center text-xs text-muted-foreground">
          <p>All files are encrypted end-to-end using AES-256-GCM</p>
          <p>Digital signatures ensure sender authenticity</p>
        </div>
      </main>
    </div>
  );
}
