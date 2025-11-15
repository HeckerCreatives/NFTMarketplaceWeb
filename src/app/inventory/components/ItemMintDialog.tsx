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
import { btnft, uploadMetadataToPinata } from '../../../contracts/configuration';
import { useMintInventory } from '@/api/inventory/mint';
import { useAccount, useConnect, injected } from 'wagmi';
import toast from 'react-hot-toast';

interface Props {
  item: InventoryItem;
  triggerClass?: string;
  triggerLabel?: string;
  disabled?: boolean;
  onConfirm?: (quantity: number) => Promise<void> | void;
}

export default function ItemMintDialog({ item, triggerClass, triggerLabel = 'Mint as NFT', disabled, onConfirm }: Props) {
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

      // Convert ipfs://... to a properly encoded gateway HTTPS URL for compatibility (MetaMask reliably fetches HTTPS)
      function ipfsToGatewayUrl(ipfsUri: string) {
        try {
          const stripped = ipfsUri.replace(/^ipfs:\/\//, '');
          const parts = stripped.split('/');
          const cid = parts.shift();
          // Decode any existing percent-encoding first (handles %2520) then encode once
          const decodedSegments = parts.map((p) => {
            try {
              return decodeURIComponent(p);
            } catch (e) {
              return p;
            }
          });
          const path = decodedSegments.map((p) => encodeURIComponent(p)).join('/');
          return path && path.length > 0
            ? `https://gateway.pinata.cloud/ipfs/${cid}/${path}`
            : `https://gateway.pinata.cloud/ipfs/${cid}`;
        } catch (e) {
          return ipfsUri;
        }
      }

      // Prefer to build image from CID + filename when possible so the path exists under the CID
      let imageForMetadata: string;
      if (imageForJson && imageForJson.startsWith('ipfs://')) {
        const noProto = imageForJson.replace(/^ipfs:\/\//, '');
        const parts = noProto.split('/');
        const cid = parts.shift();
        const filenameRaw = parts.length > 0 ? parts[parts.length - 1] : undefined;
        if (cid) {
          if (filenameRaw) {
            // decode any double-encoding then encode exactly once per segment
            let decoded = filenameRaw;
            try { decoded = decodeURIComponent(filenameRaw); } catch (e) { decoded = filenameRaw; }
            const encoded = encodeURIComponent(decoded);
            imageForMetadata = `https://gateway.pinata.cloud/ipfs/${cid}/${encoded}`;
          } else {
            imageForMetadata = `https://gateway.pinata.cloud/ipfs/${cid}`;
          }
        } else {
          imageForMetadata = ipfsToGatewayUrl(imageForJson);
        }
      } else if (imageForJson && imageForJson.startsWith('http')) {
        imageForMetadata = imageForJson;
      } else {
        imageForMetadata = ipfsToGatewayUrl(imageForJson);
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

      try {
        const resp = await mintMutation.mutateAsync(payload);
        console.log('Backend mint response', resp);

        // If backend created inventory documents but left tokenId null, perform on-chain mint for those
        const mintedItems = resp?.data?.mintedItems ?? resp?.mintedItems ?? resp?.data ?? null;
        let needsOnChain = 0;
        let inventoryIdsNeedingOnChain: string[] = [];
        if (Array.isArray(mintedItems)) {
          for (const it of mintedItems) {
            // common shapes: { _id, tokenId } or { id, tokenId }
            const tokenId = it?.tokenId ?? it?.token_id ?? null;
            const id = it?._id ?? it?.id ?? null;
            if ((tokenId === null || tokenId === undefined) && id) {
              needsOnChain++;
              inventoryIdsNeedingOnChain.push(String(id));
            }
          }
        }

        if (needsOnChain > 0) {
          toast('Backend reserved items — now performing on-chain mint (wallet will prompt)...');
          // perform on-chain mint for number of missing items
          const receipts = await performOnChainMint(needsOnChain, metadataUri);
          console.log('On-chain receipts for backend-created items:', receipts);

          // Try to notify backend to attach tokenIds and tx hashes to inventory records
          try {
            // Match receipts to inventory IDs in order (best-effort)
            const tokenIds = receipts.map((r: any) => r.tokenId ?? null);
            const txHashes = receipts.map((r: any) => r.txHash ?? (r.receipt && r.receipt.transactionHash) ?? null);

            // Notify backend about on-chain token assignments by calling the mint endpoint
            // Payload shape: { inventoryIds, tokenIds, txHashes, metadataUri }
            try {
              const notifyPayload = {
                inventoryIds: inventoryIdsNeedingOnChain,
                tokenIds,
                txHashes,
                metadataUri: metadataUri,
              } as any;

              const notifyResp = await mintMutation.mutateAsync(notifyPayload as any);
              console.log('Backend post-mint response', notifyResp);
            } catch (notifyErr) {
              console.warn('Backend post-mint (mint-item) failed', notifyErr);
            }
          } catch (confirmErr) {
            console.warn('Failed to call backend confirm endpoint', confirmErr);
          }

          toast.success(`On-chain mint complete (${needsOnChain}). Check console for receipts.`);
        } else {
          toast.success('Mint successful (backend)');
        }

        setOpen(false);
        return;
      } catch (apiErr) {
        console.error('Backend mint failed, falling back to on-chain mint', apiErr);
        // fall through to on-chain fallback
      }

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

      // Ensure there's an injected provider (MetaMask). If not present, try to trigger wagmi connect.
      let provider: any;
      const injectedAvailable = (typeof window !== 'undefined' && (window as any).ethereum);
      if (!injectedAvailable) {
        try {
          await connect?.({ connector: injected as any });
        } catch (connErr) {
          console.warn('wagmi connect request error', connErr);
        }
      }

      const injectedNow = (typeof window !== 'undefined' && (window as any).ethereum) ? (window as any).ethereum : null;
      if (!injectedNow) {
        toast.error('No injected wallet found. Please install MetaMask or connect a wallet.');
        throw new Error('No injected provider available');
      }

      // Create an ethers provider from the injected provider and get signer
      provider = new BrowserProvider(injectedNow as any);
      try {
        await injectedNow.request?.({ method: 'eth_requestAccounts' });
      } catch (reqErr) {
        console.warn('eth_requestAccounts request error', reqErr);
      }

      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress().catch((e: any) => null);
      console.log('Using signer address:', signerAddress);
      try {
        const network = await provider.getNetwork();
        console.log('Provider network:', network);
      } catch (netErr) {
        console.warn('Could not read provider network', netErr);
      }

      const contract = new Contract(btnft, NFT, signer as any);

      // Sequentially mint the requested quantity (contract may not support batch mint)
      const receipts: Array<{ txHash: string; receipt: any }> = [];
      for (let i = 0; i < qty; i++) {
        console.log('Minting token', i + 1, 'of', qty, 'tokenUri=', tokenUri);
        const cost = await contract.cost();
        console.log('Unit cost (wei):', cost?.toString ? cost.toString() : cost);

        try {
          // This call should trigger the wallet signature prompt for a transaction
          const tx = await contract.mintNFT(tokenUri, { value: cost });
          console.log('Transaction sent', tx.hash);
          const receipt = await tx.wait();
          console.log('Transaction confirmed', receipt.transactionHash);
          receipts.push({ txHash: receipt.transactionHash, receipt });
        } catch (txErr: any) {
          console.error('Transaction error while minting', txErr);
          // rethrow so caller can handle fallback
          throw txErr;
        }
      }

      // Optionally refresh or notify — parent onConfirm (if present) would handle updates
      console.log('Minting complete');
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
