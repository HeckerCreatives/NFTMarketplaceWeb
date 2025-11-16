'use client'

import { useState } from 'react';
import { ethers } from 'ethers';
import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { useRequestNonce, useWalletLogin } from '@/api/auth/auth';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

interface WalletLoginProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function WalletLogin({ onSuccess, onError }: WalletLoginProps) {
  const { connect } = useConnect();
  const { setWalletLoggedIn, setLoginInProgress } = useWalletAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState(false);

  // Wait/poll for accounts after requesting approval
  async function waitForAccounts(provider: any, timeout = 20000, interval = 500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const accounts = await provider.listAccounts();
        if (accounts && accounts.length > 0) return true;
      } catch (e) {
        // ignore and retry
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    return false;
  }

  const requestNonceMutation = useRequestNonce();
  const walletLoginMutation = useWalletLogin();

  const handleWalletLogin = async () => {
    // Handlers for provider events — attached during this login flow and removed in finally
    const accountsChangedHandler = (accounts: any) => {
      if (!accounts || accounts.length === 0) {
        setError('No wallet account available. Please connect your wallet.');
        setPendingRequest(false);
        setLoading(false);
      }
    };

    const disconnectHandler = () => {
      setError('Wallet disconnected.');
      setPendingRequest(false);
      setLoading(false);
    };

    try {
      // Prevent duplicate wallet requests (MetaMask RPC -32002)
      if (pendingRequest) {
        const msg = 'A wallet request is already pending. Please check your wallet.';
        setError(msg);
        onError?.(msg);
        return;
      }
      setPendingRequest(true);
      setLoading(true);
      // Inform global auth state that a login attempt is in progress so
      // AuthSync doesn't aggressively disconnect while we're waiting.
      try {
        setLoginInProgress(true);
        try { localStorage.setItem('walletLoginInProgress', 'true'); } catch (_) {}
      } catch (e) {
        // ignore
      }
      setError(null);

      if (!window.ethereum) {
        const errorMsg = 'MetaMask not detected. Please install it to continue.';
        setError(errorMsg);
        onError?.(errorMsg);
        window.open('https://metamask.io/download/', '_blank');
        return;
      }

      // Attach quick listeners to react to account/disconnect events while the
      // login flow is in progress (helps when the extension updates accounts).
      try {
        if ((window as any).ethereum && (window as any).ethereum.on) {
          (window as any).ethereum.on('accountsChanged', accountsChangedHandler);
          (window as any).ethereum.on('disconnect', disconnectHandler);
        }
      } catch (e) {
        // ignore
      }

      // Connect to provider and request accounts if needed
      const provider = new ethers.BrowserProvider(window.ethereum);
      try {
        const accounts = await provider.listAccounts();
        if (!accounts || accounts.length === 0) {
          setError('Waiting for wallet approval...');
          await provider.send('eth_requestAccounts', []);

          const ok = await waitForAccounts(provider, 20000, 500);
          setError(null);
          if (!ok) {
            const msg = 'No wallet account detected after approval. Please approve the connection in your wallet.';
            setError(msg);
            onError?.(msg);
            return;
          }
        }
      } catch (acctErr: any) {
        console.warn('Account request failed', acctErr);
        if (acctErr && (acctErr.code === -32002 || acctErr?.message?.includes('already pending'))) {
          const msg = 'A wallet approval is already pending in your wallet. Please approve it there.';
          setError(msg);
          onError?.(msg);
          return;
        }
        throw acctErr;
      }

      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();

      // Request nonce (use mutateAsync for linear flow)
      try {
        console.log('Requesting nonce for', walletAddress);
        const nonceResponse: any = await requestNonceMutation.mutateAsync({ walletAddress });
        if (nonceResponse?.message !== 'success') {
          throw new Error('Failed to get nonce from server');
        }

        // Sign message with wallet. Try provider `personal_sign` first for reliability,
        // then fall back to ethers `signer.signMessage`.
        const message = nonceResponse.data.message;
        console.log('Signing message:', message);

        let signature: string | null = null;
        setError('Waiting for signature approval...');

        // Use personal_sign through window.ethereum.request (most reliable for MetaMask)
        try {
          signature = await (window as any).ethereum.request({
            method: 'personal_sign',
            params: [message, walletAddress],
          });
          console.log('personal_sign succeeded');
        } catch (signErr: any) {
          console.error('personal_sign failed', signErr);
          
          // User explicitly rejected (code 4001) or not authorized yet (4100)
          if (signErr && (signErr.code === 4001 || signErr.code === 4100)) {
            const msg = signErr.code === 4001 
              ? 'Signature request was rejected. Please try again and approve the signature in your wallet.'
              : 'Signature not authorized. Please approve the signature request in your wallet and try again.';
            setError(msg);
            onError?.(msg);
            return;
          }
          
          // For other errors, show generic message and stop
          const msg = signErr?.message || 'Failed to sign message. Please try again.';
          setError(msg);
          onError?.(msg);
          return;
        }

        setError(null);

        if (!signature) {
          throw new Error('Failed to sign message with wallet');
        }

        // Login with signature (mutateAsync)
        try {
          const loginResponse: any = await walletLoginMutation.mutateAsync({ walletAddress, signature });
          if (loginResponse?.message === 'success') {
            connect({ connector: injected() });
            // Mark that the wallet login flow completed successfully so other parts
            // of the app can detect an authenticated wallet session.
            setWalletLoggedIn(true);
            try { localStorage.setItem('walletLoggedIn', 'true'); } catch (_) {}
            onSuccess?.();
          } else {
            const msg = loginResponse?.data || 'Login failed';
            onError?.(msg);
            setError(msg);
          }
        } catch (loginErr: any) {
          const msg = (loginErr && loginErr.message) || 'Wallet login failed';
          onError?.(msg);
          setError(msg);
        }
      } catch (err: any) {
        const msg = (err && err.message) || 'Failed to request nonce or sign';
        onError?.(msg);
        setError(msg);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to login with wallet';
      setError(errorMsg);
      onError?.(errorMsg);
      console.error('Wallet login error:', err);
    } finally {
      setLoading(false);
      setPendingRequest(false);
      try {
        setLoginInProgress(false);
      } catch (e) {
        // ignore
      }
      try { localStorage.removeItem('walletLoginInProgress'); } catch (_) {}
      // Clean up any event listeners we attached earlier
      try {
        if ((window as any).ethereum && (window as any).ethereum.removeListener) {
          (window as any).ethereum.removeListener('accountsChanged', accountsChangedHandler);
          (window as any).ethereum.removeListener('disconnect', disconnectHandler);
        }
      } catch (e) {
        // ignore
      }
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <Button 
        onClick={handleWalletLogin} 
        disabled={loading}
        className="text-white text-sm h-[40px] bg-gradient-to-r from-[#764BA2] to-[#667EEA]"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            Connecting...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <LogIn size={15} />
            Log in with MetaMask
          </span>
        )}
      </Button>
      
      {error && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-red-500 text-xs text-center">{error}</p>
          <div>
            <Button onClick={handleWalletLogin} disabled={loading} className="text-xs">Retry</Button>
          </div>
        </div>
      )}
    </div>
  );
}
