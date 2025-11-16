"use client"

import { useEffect, useRef } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import axios from 'axios';
import { useLogout } from '@/api/auth/auth';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

export default function AuthSync() {
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const logoutMutation = useLogout();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { walletLoggedIn, loginInProgress } = useWalletAuth();
  const walletLoggedInRef = useRef<boolean>(walletLoggedIn);
  const loginInProgressRef = useRef<boolean>(loginInProgress);

  useEffect(() => {
    // If the wallet is connected but we don't have a record of completing the
    // WalletLogin flow (server-side auth), wait 1 minute before forcing disconnect.
    // This gives the user time to complete the login flow. If a login is already
    // in progress, don't start the timeout.
    // Keep refs up-to-date for the async timeout closure
    walletLoggedInRef.current = walletLoggedIn;
    loginInProgressRef.current = loginInProgress;

    // Use localStorage for cross-tab reliability
    try {
      const isPending = loginInProgress || localStorage.getItem('walletLoginInProgress') === 'true';

      if (isConnected && !walletLoggedIn && !isPending) {
        // Wait 120 seconds before disconnecting (longer grace window)
        timeoutRef.current = setTimeout(() => {
          (async () => {
            // Re-check latest flags (ref + storage) before taking action
            const pendingNow = loginInProgressRef.current || localStorage.getItem('walletLoginInProgress') === 'true';
            const loggedInNow = walletLoggedInRef.current || localStorage.getItem('walletLoggedIn') === 'true';

            if (pendingNow || loggedInNow) {
              // Someone completed login in this tab or another; cancel
              return;
            }

            // Before forcing a disconnect, ask the server if a session exists.
            // If /auth/session returns 200, assume session present and avoid disconnect.
            try {
              const resp = await axios.get('/auth/session');
              if (resp && resp.status === 200) {
                // Server says a session exists — sync to localStorage so other tabs know
                try { localStorage.setItem('walletLoggedIn', 'true'); } catch (_) {}
                return;
              }
            } catch (err) {
              // If request fails (network or 401), we'll proceed to disconnect below.
            }

            // Try to clear server session if any, then disconnect the wallet.
            try {
              logoutMutation.mutate();
            } catch (e) {
              // ignore logout errors
            }
            try {
              disconnect();
            } catch (e) {
              // ignore disconnect errors
            }
          })();
        }, 5000); // 5 seconds
      } else {
        // If logged in, login in progress, or disconnected, clear any pending timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    } catch (e) {
      // ignore storage errors
    }

    // Listen for cross-tab changes so other tabs finishing login can cancel the timeout
    const storageHandler = (ev: StorageEvent) => {
      if (!ev.key) return;
      if (ev.key === 'walletLoggedIn' || ev.key === 'walletLoginInProgress') {
        // Clear pending timeout if another tab updated login flags
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    window.addEventListener('storage', storageHandler);

    // Cleanup timeout and listener on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.removeEventListener('storage', storageHandler);
    };
  }, [isConnected, disconnect, logoutMutation, walletLoggedIn, loginInProgress]);

  return null;
}
