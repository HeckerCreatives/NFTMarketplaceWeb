'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface WalletAuthContextType {
  walletLoggedIn: boolean;
  loginInProgress: boolean;
  setWalletLoggedIn: (value: boolean) => void;
  setLoginInProgress: (value: boolean) => void;
}

const WalletAuthContext = createContext<WalletAuthContextType | undefined>(undefined);

export function WalletAuthProvider({ children }: { children: ReactNode }) {
  const [walletLoggedIn, setWalletLoggedInState] = useState<boolean>(false);
  const [loginInProgress, setLoginInProgressState] = useState<boolean>(false);

  useEffect(() => {
    // Read initial state from localStorage on mount
    try {
      const flag = localStorage.getItem('walletLoggedIn') === 'true';
      setWalletLoggedInState(flag);
    } catch (e) {
      setWalletLoggedInState(false);
    }
  }, []);

  const setWalletLoggedIn = (value: boolean) => {
    setWalletLoggedInState(value);
    try {
      if (value) {
        localStorage.setItem('walletLoggedIn', 'true');
      } else {
        localStorage.removeItem('walletLoggedIn');
      }
    } catch (e) {
      // ignore storage errors
    }
  };

  const setLoginInProgress = (value: boolean) => {
    setLoginInProgressState(value);
    try {
      if (value) {
        localStorage.setItem('walletLoginInProgress', 'true');
      } else {
        localStorage.removeItem('walletLoginInProgress');
      }
    } catch (e) {
      // ignore storage errors
    }
  };

  // Sync across tabs: update context if localStorage changes elsewhere
  useEffect(() => {
    const handler = (ev: StorageEvent) => {
      if (!ev.key) return;
      try {
        if (ev.key === 'walletLoggedIn') {
          setWalletLoggedInState(ev.newValue === 'true');
        }
        if (ev.key === 'walletLoginInProgress') {
          setLoginInProgressState(ev.newValue === 'true');
        }
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <WalletAuthContext.Provider value={{ walletLoggedIn, setWalletLoggedIn, loginInProgress, setLoginInProgress }}>
      {children}
    </WalletAuthContext.Provider>
  );
}

export function useWalletAuth() {
  const context = useContext(WalletAuthContext);
  if (context === undefined) {
    throw new Error('useWalletAuth must be used within a WalletAuthProvider');
  }
  return context;
}
