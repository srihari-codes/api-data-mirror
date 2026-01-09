import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isAuthenticated, setToken, clearToken } from '@/lib/api';
import { hasKeys, clearKeys } from '@/lib/keyStorage';

interface AuthContextType {
  isLoggedIn: boolean;
  hasKeyPair: boolean;
  setLoggedIn: (value: boolean) => void;
  setHasKeyPair: (value: boolean) => void;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasKeyPair, setHasKeyPair] = useState(false);

  useEffect(() => {
    // Check authentication status on mount
    setIsLoggedIn(isAuthenticated());
    
    // Check if keys exist
    hasKeys().then(setHasKeyPair);
  }, []);

  const login = (token: string) => {
    setToken(token);
    setIsLoggedIn(true);
  };

  const logout = () => {
    clearToken();
    clearKeys();
    setIsLoggedIn(false);
    setHasKeyPair(false);
  };

  const setLoggedIn = (value: boolean) => {
    setIsLoggedIn(value);
  };

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, 
      hasKeyPair, 
      setLoggedIn, 
      setHasKeyPair, 
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
