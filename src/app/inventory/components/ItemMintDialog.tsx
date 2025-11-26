'use client'

import { useState } from 'react';
import { InventoryItem } from '@/types/inventory';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BrowserProvider, Contract } from 'ethers';
import NFT from '../../../contracts/nft.json';
import { btnft, uploadMetadataToPinata, uploadFileToPinata } from '../../../contracts/configuration';
import { useMintInventory } from '@/api/inventory/mint';
import { useAccount, useConnect, injected } from 'wagmi';
import toast from 'react-hot-toast';

interface Props {
  item: InventoryItem;
  triggerClass?: string;
  triggerLabel?: string;
  total: number;
  disabled?: boolean;
  onConfirm?: (quantity: number) => Promise<void> | void;
}

export default function ItemMintDialog({ item, triggerClass, triggerLabel = 'Mint as NFT', total, disabled, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  // Determine per-unit price if present on item or nested item object
  const pricePerUnitRaw = (item as any).mintPrice ?? (item as any).price ?? (item.item && (item.item.mintPrice ?? item.item.price)) ?? 0;
  const pricePerUnit = Number(pricePerUnitRaw) || 0;

  const max = item.quantity ?? 1;
  const mintMutation = useMintInventory();
  const { address } = useAccount();
  const { connect } = useConnect();

  console.log(total)
  // Helper: create a metadata JSON and pin to Pinata, returning gateway URI
  async function buildAndUploadMetadata(rawInput?: string): Promise<string | undefined> {
    const rawVal = rawInput ?? (item as any).ipfsImage ?? (item as any).image ?? (item.item && (item.item.ipfsImage ?? item.item.image)) ?? null;
    if (!rawVal) return undefined;
    try {
      let imageForJson = String(rawVal).trim();

      // Strip protocol for easier matching
      let stripped = imageForJson.replace(/^https?:\/\//i, '');

      // Handle subdomain gateway forms like <CID>.ipfs.gateway.pinata.cloud/<path>
      const subdomainMatch = stripped.match(/^([a-z0-9]+)\.ipfs\.gateway\.pinata\.cloud\/(.+)$/i);
      if (subdomainMatch) {
        imageForJson = `ipfs://${subdomainMatch[1]}/${subdomainMatch[2]}`;
      } else if (stripped.includes('/ipfs/')) {
        // gateway path form (gateway.pinata.cloud/ipfs/<CID>/...)
        const parts = stripped.split('/ipfs/');
        if (parts[1]) imageForJson = `ipfs://${parts[1]}`;
      } else if (imageForJson.startsWith('ipfs://')) {
        // already ipfs://, keep as-is
      } else {
        // If it looks like just a CID or CID/path, convert to ipfs://<CID> or ipfs://<CID>/file
        const cidOnlyMatch = stripped.match(/^([a-z0-9]+)(\/.*)?$/i);
        if (cidOnlyMatch) {
          imageForJson = `ipfs://${stripped}`;
        }
      }

      // IMPORTANT: Re-upload the image file to get a NEW CID for this specific NFT
      // This ensures each minted NFT has its own unique image reference
      let newImageCid: string | null = null;
      try {
        // Convert to gateway URL for fetching
        const imageGatewayUrl = imageForJson.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        console.log('Fetching image from gateway for re-upload:', imageGatewayUrl);
        
        // Fetch the image file
        const imageResponse = await fetch(imageGatewayUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }
        
        const imageBlob = await imageResponse.blob();
        
        // Use filename based on total supply prop
        if (total === 0 || total === undefined) {
          console.warn('Total supply not available, skipping re-upload');
          throw new Error('Total supply required for filename');
        }
        
        // Determine file extension from blob type
        let ext = 'png';
        if (imageBlob.type) {
          const typeMap: { [key: string]: string } = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
          };
          ext = typeMap[imageBlob.type] || 'png';
        }
        
        const filename = `${total + 1}.${ext}`;
        
        // Create a File object from the blob
        const imageFile = new File([imageBlob], filename, { type: imageBlob.type });
        
        console.log('Re-uploading image to Pinata...', filename);
        const uploadResult = await uploadFileToPinata(imageFile);
        newImageCid = uploadResult.IpfsHash;
        console.log('Image re-uploaded with new CID:', newImageCid);
      } catch (imgErr) {
        console.warn('Failed to re-upload image, will use original reference:', imgErr);
        // Fall back to using the original image reference if re-upload fails
      }

      // Build the metadata image field using the new CID (or original if re-upload failed)
      let imageForMetadata: string;
      if (newImageCid) {
        // Use the new CID with the filename (e.g., ipfs://QmABC.../44.png)
        const filename = `${total + 1}.${ext}`;
        imageForMetadata = `ipfs://${newImageCid}/${filename}`;
      } else if (imageForJson && imageForJson.startsWith('ipfs://')) {
        // Fall back to normalizing the original ipfs:// URI - use only CID
        const noProto = imageForJson.replace(/^ipfs:\/\//, '');
        const parts = noProto.split('/');
        const cid = parts.shift();
        if (cid) {
          imageForMetadata = `ipfs://${cid}`;
        } else {
          imageForMetadata = imageForJson;
        }
      } else if (imageForJson && imageForJson.startsWith('http')) {
        // Try to convert HTTP gateway URL back to ipfs:// - use only CID
        try {
          const ipfsMatch = imageForJson.match(/\/ipfs\/([^\/]+)/);
          if (ipfsMatch && ipfsMatch[1]) {
            const cid = ipfsMatch[1];
            imageForMetadata = `ipfs://${cid}`;
          } else {
            imageForMetadata = imageForJson;
          }
        } catch (e) {
          imageForMetadata = imageForJson;
        }
      } else {
        // Last resort
        imageForMetadata = imageForJson;
      }

      const metadata: any = {
        name: (item as any).itemid ?? String((item as any)._id ?? (item as any).id ?? 'Untitled'),
        description: (item as any).itemname ?? '',
        image: imageForMetadata,
        attributes: [
          { trait_type: 'InventoryId', value: String((item as any)._id ?? (item as any).id ?? '') },
        ],
      };

      const hash = await uploadMetadataToPinata(metadata);
      // Return gateway URL for ease-of-use in UIs, but metadata.image remains an ipfs:// URI
      return `https://gateway.pinata.cloud/ipfs/${hash}`;
    } catch (err) {
      console.warn('Failed to pin metadata to Pinata', err);
      return String(rawVal).replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
    }
  }

  async function handleConfirm() {
    if (disabled) return;
    const qty = Math.max(1, Math.min(max, Math.floor(quantity)));
    setBusy(true);
    try {
      // Determine token URI to use as metadataUri for the API (if available).
      // We prefer to upload a metadata JSON to Pinata (tokenURI) that points to the image.
      const raw = (item as any).ipfsImage ?? (item as any).image ?? (item.item && (item.item.ipfsImage ?? item.item.image)) ?? null;
      const imageGateway = raw ? String(raw).replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/') : undefined;

      // (metadata upload done via buildAndUploadMetadata)

      // If a parent supplied an onConfirm handler, call it (e.g., custom backend flow)
      if (onConfirm) {
        await onConfirm(qty);
        setOpen(false);
        return;
      }

      // Otherwise try using the backend mint API
      const inventoryId = (item as any).id ?? (item as any)._id ?? (item.item && (item.item.id ?? item.item._id));
      const payload: any = { inventoryId: String(inventoryId), quantity: qty };
      // Upload metadata JSON and attach metadataUri to payload when possible
      let metadataUri: string | undefined = undefined;
      if (raw) {
        metadataUri = await buildAndUploadMetadata(raw as string);
      }
      if (metadataUri) payload.metadataUri = metadataUri;
      if (address) payload.targetWallet = address;

      // Fallback: perform on-chain mint if API did not succeed
      await performOnChainMint(qty, metadataUri);
      setOpen(false);
    } catch (err) {
      console.error('Mint confirm error', err);
      // keep open so user can retry
    } finally {
      setBusy(false);
    }
  }

  async function performOnChainMint(qty: number, metadataUri?: string) {
    try {
      // Determine token URI to mint - prefer explicit ipfs image or image fields
      const raw = (item as any).ipfsImage ?? (item as any).image ?? (item.item && (item.item.ipfsImage ?? item.item.image)) ?? null;
      // Prefer to use provided metadataUri (JSON). If not provided, try to upload metadata, otherwise fall back to image gateway URL.
      let tokenUri: string | null = metadataUri ?? null;
      if (!tokenUri && raw) {
        // attempt to upload metadata JSON for minting
        try {
          const maybe = await buildAndUploadMetadata(raw as string);
          tokenUri = maybe ?? String(raw).replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        } catch (e) {
          tokenUri = String(raw).replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        }
      }

      if (!tokenUri) {
        throw new Error('No token URI available to mint from this item');
      }

      // Ensure there's an injected provider (MetaMask)
      const injectedNow = (typeof window !== 'undefined' && (window as any).ethereum) ? (window as any).ethereum : null;
      if (!injectedNow) {
        toast.error('No injected wallet found. Please install MetaMask or connect a wallet.');
        throw new Error('No injected provider available');
      }

      // CRITICAL: Request accounts FIRST before any contract calls
      // This ensures MetaMask opens and user can connect/approve
      console.log('Requesting accounts from MetaMask...');
      try {
        await injectedNow.request({ method: 'eth_requestAccounts' });
        console.log('Accounts approved by user');
      } catch (reqErr: any) {
        console.warn('User denied account access or request failed', reqErr);
        if (reqErr?.code === 4001 || reqErr?.message?.includes('User rejected')) {
          toast.error('Transaction cancelled');
        } else {
          toast.error('Failed to connect wallet');
        }
        throw reqErr;
      }

      // Create an ethers provider from the injected provider and get signer
      const provider = new BrowserProvider(injectedNow as any);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress().catch((e: any) => null);
      console.log('Using signer address:', signerAddress);

      const contract = new Contract(btnft, NFT, signer as any);

      // Safely read cost() - guard against missing function in ABI
      let unitCost: any = 0;
      try {
        if (typeof (contract as any).cost === 'function') {
          unitCost = await (contract as any).cost();
          console.log('Unit cost (wei):', unitCost?.toString ? unitCost.toString() : unitCost);
        } else {
          console.warn('contract.cost is not available in ABI - defaulting to 0');
        }
      } catch (costErr) {
        console.warn('Failed to read contract.cost, continuing with cost=0', costErr);
      }

      // Sequentially mint the requested quantity (contract may not support batch mint)
      const receipts: Array<{ txHash: string; receipt: any }> = [];
      for (let i = 0; i < qty; i++) {
        console.log('Minting token', i + 1, 'of', qty, 'tokenUri=', tokenUri);

        try {
          // This call should trigger the wallet signature prompt for a transaction
          const tx = await (contract as any).mintNFT(tokenUri, { value: unitCost });
          console.log('Transaction sent', tx.hash);
          toast.success(`Transaction sent: ${tx.hash.slice(0, 10)}...`);
          
          const receipt = await tx.wait();
          console.log('Transaction confirmed', receipt.transactionHash);
          toast.success(`Minted ${i + 1}/${qty}`);
          receipts.push({ txHash: receipt.transactionHash, receipt });
        } catch (txErr: any) {
          console.error('Transaction error while minting', txErr);
          if (txErr?.code === 4001 || txErr?.message?.includes('User rejected')) {
            toast.error('Transaction cancelled');
          } else {
            toast.error('Mint transaction failed');
          }
          throw txErr;
        }
      }

      console.log('Minting complete');
      toast.success('All NFTs minted successfully!');
      return receipts;
    } catch (err) {
      console.error('On-chain mint failed', err);
      throw err;
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" disabled={disabled}>
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[720px]">
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <div className="w-full flex justify-center">
            {(() => {
              const raw = (item as any).ipfsImage ?? (item as any).image ?? (item.item && (item.item.ipfsImage ?? item.item.image)) ?? null;
              const src = raw ? String(raw).replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/') : null;
              return src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={item.itemname} className="w-full max-w-[320px] h-[320px] object-cover rounded-md border border-zinc-800" />
              ) : (
                <div className="w-full max-w-[320px] h-[320px] bg-zinc-800 rounded-md flex items-center justify-center border border-zinc-800 text-zinc-400">No Image</div>
              );
            })()}
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">{item.itemname}</h3>
              <p className="text-sm text-zinc-400">Select quantity to mint (max {max})</p>
              <p className="text-xs text-zinc-400 mt-2">Available: {item.quantity}</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={max}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-24 bg-zinc-800 px-2 py-1 rounded border border-zinc-700 text-white"
              />
              <div className="text-sm text-zinc-300">
                <div>Unit: <span className="font-medium">{pricePerUnit === 0 ? 'Free / TBD' : pricePerUnit}</span></div>
                <div>Total: <span className="font-medium">{pricePerUnit === 0 ? '—' : (pricePerUnit * quantity).toString()}</span></div>
              </div>
            </div>

            <div className="mt-auto flex justify-end items-center gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm" disabled={busy}>Cancel</Button>
              </DialogClose>
              <Button variant="default" size="sm" onClick={handleConfirm} disabled={busy}>{busy ? 'Minting...' : 'Confirm Mint'}</Button>
            </div>
          </div>
        </div>
      
      </DialogContent>
    </Dialog>
  );
}
