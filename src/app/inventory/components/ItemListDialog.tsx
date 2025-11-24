'use client'

import { useState } from 'react';
import { BrowserProvider, Contract, parseUnits } from 'ethers';
import Web3Modal from 'web3modal';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import NFT from '../../../contracts/nft.json';
import Market from '../../../contracts/market.json';
import { btnft, btmarket } from '@/contracts/configuration';
import { useListInventory } from '@/api/inventory/list';

interface ItemListDialogProps {
  tokenId: number;
  nftName: string;
  nftImage: string;
  inventoryId?: string;
  onListingComplete?: () => void;
}

export default function ItemListDialog({ 
  tokenId, 
  nftName, 
  nftImage,
  inventoryId,
  onListingComplete 
}: ItemListDialogProps) {
  const { address, isConnected } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [isListing, setIsListing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const { mutate: listInventory, isPending } = useListInventory();

  const handleListNFT = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    if (!price || Number(price) <= 0) {
      setError('Please enter a valid price');
      return;
    }

    setIsListing(true);
    setError('');
    setStatus('Starting listing process...');

    try {
      const web3Modal = new Web3Modal();
      const connection = await web3Modal.connect();
      const provider = new BrowserProvider(connection);
      const signer = await provider.getSigner();

      // Step 1: Approve the marketplace to transfer this NFT
      setStatus('Approving marketplace... (1/2)');
      const nftContract = new Contract(btnft, NFT, signer);
      const approvalTx = await nftContract.approve(btmarket, tokenId);
      console.log('Approval transaction sent:', approvalTx.hash);
      
      setStatus('Waiting for approval confirmation...');
      await approvalTx.wait();
      console.log('Marketplace approved to transfer token', tokenId);

      // Step 2: List the NFT on the marketplace
      setStatus('Creating marketplace listing... (2/2)');
      const marketContract = new Contract(btmarket, Market, signer);
      const priceInWei = parseUnits(price, 'ether');
      let listingFee = await marketContract.listingFee();
      listingFee = listingFee.toString();

      const listingTx = await marketContract.createVaultItem(
        btnft, 
        Number(tokenId), 
        priceInWei, 
        { value: listingFee }
      );
      console.log('Listing transaction sent:', listingTx.hash);
      
      setStatus('Waiting for listing confirmation...');
      const receipt = await listingTx.wait();
      
      setStatus('NFT listed successfully!');
      console.log('NFT listed successfully! Token ID:', tokenId, 'Price:', price, 'ETH');
      
      // Call backend API to update inventory listing status
      if (inventoryId) {
        setStatus('Updating inventory status...');
        listInventory(
          {
            inventoryId: inventoryId,
            tokenId: tokenId,
            price: price,
            marketplaceAddress: btmarket,
            transactionHash: listingTx.hash,
          },
          {
            onSuccess: () => {
              console.log('Backend inventory updated successfully');
              setStatus('Listing complete!');
            },
            onError: (error) => {
              console.error('Failed to update backend inventory:', error);
              // Don't show error to user since blockchain listing succeeded
            },
          }
        );
      }
      
      // Close dialog after short delay
      setTimeout(() => {
        setIsOpen(false);
        setPrice('');
        setStatus('');
        if (onListingComplete) {
          onListingComplete();
        }
      }, 2000);

    } catch (err: any) {
      console.error('Error listing NFT:', err);
      
      // Check if user rejected the transaction
      const isUserRejection = 
        err?.code === 'ACTION_REJECTED' || 
        err?.code === 4001 || 
        err?.message?.includes('user rejected') ||
        err?.message?.includes('User denied') ||
        err?.message?.includes('user denied');
      
      if (isUserRejection) {
        setError('Transaction cancelled');
      } else {
        setError(err?.message || 'Failed to list NFT. Please try again.');
      }
      setStatus('');
    } finally {
      setIsListing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-1.5"
          disabled={!isConnected}
        >
          List for Sale
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">List NFT for Sale</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Set a price and list your NFT on the marketplace
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* NFT Preview */}
          <div className="bg-zinc-800 rounded-md overflow-hidden">
            <div className="w-full h-48 bg-zinc-700">
              {nftImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={nftImage} 
                  alt={nftName} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                  No Image
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium">{nftName}</p>
              <p className="text-xs text-zinc-400">Token ID: {tokenId}</p>
            </div>
          </div>

          {/* Price Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
              Listing Price (ETH)
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="0.5"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setError('');
              }}
              disabled={isListing}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-50"
            />
            <p className="text-xs text-zinc-500">
              Note: A small listing fee will be charged by the marketplace
            </p>
          </div>

          {/* Status Messages */}
          {status && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-md p-3">
              <p className="text-sm text-blue-300">{status}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-md p-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => {
                setIsOpen(false);
                setPrice('');
                setError('');
                setStatus('');
              }}
              disabled={isListing}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleListNFT}
              disabled={isListing || !price || Number(price) <= 0}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
            >
              {isListing ? 'Listing...' : 'List NFT'}
            </Button>
          </div>

          {/* Process Explanation */}
          <div className="bg-zinc-800/50 rounded-md p-3 text-xs text-zinc-400 space-y-1">
            <p className="font-medium text-zinc-300">Listing Process:</p>
            <p>1. Approve marketplace to transfer your NFT</p>
            <p>2. Create listing and pay listing fee</p>
            <p>3. NFT transfers to marketplace until sold</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
