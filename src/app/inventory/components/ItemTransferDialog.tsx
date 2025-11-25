"use client"

import React from 'react';
import { useEffect, useState } from 'react';
import Web3Modal from 'web3modal';
import { BrowserProvider, Contract } from 'ethers';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import NFT from '../../../contracts/nft.json';
import { btnft } from '@/contracts/configuration';
import { useGetUsers } from '@/api/user/get';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ItemTransferDialogProps {
  tokenId: number;
  nftImage?: string | null;
  nftName?: string | null;
  inventoryId?: string | null;
  onTransferComplete?: () => void;
}
import { useTransferInventory } from '@/api/inventory/transfer';

export function ItemTransferDialog(props: ItemTransferDialogProps) {
  const { tokenId, nftImage, nftName, onTransferComplete } = props;
  const { isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [page] = useState(0);
  const [limit] = useState(50);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const transferMutation = useTransferInventory();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Fetch users when dialog opens (no search for now)
  const { data: usersData, isLoading } = useGetUsers(page, limit, '', Boolean(open));
  const usersList = (usersData as any)?.data?.users as any[] | undefined;

  useEffect(() => {
    if (!open) {
      setSelectedAddress('');
      setSelectedUser(null);
      setStatus('');
      setError('');
    }
  }, [open]);


  const handleTransfer = async () => {
    setError('');
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }
    if (!selectedAddress || !selectedAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
      setError('Please select a user with a valid wallet address');
      return;
    }

    setIsTransferring(true);
    setStatus('Preparing transfer...');

    try {
      const web3Modal = new Web3Modal();
      const connection = await web3Modal.connect();
      const provider = new BrowserProvider(connection);
      const signer = await provider.getSigner();
      const from = await signer.getAddress();

      setStatus('Sending transaction (wallet prompt)...');
      const contract = new Contract(btnft, NFT, signer as any);
      const tx = await contract['safeTransferFrom(address,address,uint256)'](from, selectedAddress, Number(tokenId));
      setStatus('Waiting for confirmation...');
      const receipt = await tx.wait();

      setStatus('Transfer complete');

      // notify backend if we have an inventoryId
      try {
        const invId = (props as any).inventoryId ?? null;
        if (invId) {
          setStatus('Updating backend...');
          await transferMutation.mutateAsync({ inventoryId: String(invId), recipientWallet: selectedAddress, txHash: receipt.transactionHash });
          setStatus('Backend updated');
        }
      } catch (apiErr: any) {
        console.warn('Backend transfer notify failed', apiErr);
      }

      if (onTransferComplete) await onTransferComplete();

      setTimeout(() => setOpen(false), 900);

      setStatus('Transfer complete');
      if (onTransferComplete) await onTransferComplete();

      setTimeout(() => setOpen(false), 900);
    } catch (err: any) {
      console.error('Transfer error', err);
      const isUserRejection = err?.code === 'ACTION_REJECTED' || err?.code === 4001 || err?.message?.toLowerCase?.().includes('user rejected') || err?.message?.toLowerCase?.().includes('user denied');
      if (isUserRejection) setError('Transaction cancelled');
      else setError(err?.message || 'Transfer failed');
    } finally {
      setIsTransferring(false);
      setStatus('');
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-slate-700 hover:bg-slate-600 text-white text-xs py-1.5 w-full" disabled={!isConnected}>
          Gift
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle>Gift NFT</DialogTitle>
          <DialogDescription className="text-sm text-zinc-400">Send token {tokenId} to another user.</DialogDescription>
        </DialogHeader>

        {/* NFT Preview */}
        <div className="space-y-4 my-4 ">
          <div className="bg-zinc-800 rounded-md overflow-hidden">
            <div className="w-full h-48 bg-zinc-700">
              {nftImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={String(nftImage).replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')}
                  alt={nftName || `Token ${tokenId}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">No Image</div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium">{nftName ?? 'Untitled'}</p>
              <p className="text-xs text-zinc-400">Token ID: {tokenId}</p>
            </div>
          </div>
        </div>

        {/* Recipient Select */}
        <div className="mt-4 ">
          <label className="block text-sm font-medium mb-1 text-zinc-300">Recipient</label>

          <Select
            value={selectedAddress ?? ''}
            onValueChange={(val) => {
              setSelectedAddress(val);
              const found = usersList?.find((u) => {
                const walletVal = String(u.wallet ?? u.address ?? u.walletAddress ?? '');
                return walletVal === String(val);
              });
              if (found) setSelectedUser(found);
              else setSelectedUser(null);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isLoading ? 'Loading users...' : (usersList && usersList.length > 0 ? 'Select a user' : 'No users available')} />
            </SelectTrigger>
            <SelectContent>
              {isLoading && <SelectItem value="loading">Loading...</SelectItem>}
              {!isLoading && usersList && usersList.length === 0 && <SelectItem value="none">No users</SelectItem>}
                  {!isLoading && usersList && usersList.map((u: any) => {
                    const walletVal = String(u.wallet ?? u.address ?? u.walletAddress ?? '');
                    return (
                      <SelectItem key={u._id} value={walletVal}>{u.name || u.username || u.email}</SelectItem>
                    );
                  })}
            </SelectContent>
          </Select>

          {status && <div className="text-sm text-blue-300 mt-2">{status}</div>}
          {error && <div className="text-sm text-red-400 mt-2">{error}</div>}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isTransferring}>Cancel</Button>
            <Button size="sm" onClick={handleTransfer} disabled={isTransferring || !selectedUser || !selectedAddress.match(/^0x[0-9a-fA-F]{40}$/)}>
              {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// also provide default export for convenience
export default ItemTransferDialog;
