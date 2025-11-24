'use client'

import { useEffect, useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import Web3Modal from 'web3modal';
import axios from 'axios';
import { useAccount } from 'wagmi';
import { WalletLogin } from '@/components/auth/WalletLogin';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import NFT from '../../../contracts/nft.json';
import Collection from '../../../contracts/collection.json';
import { btnft, btnftcol, sepmarket, sepnft } from '@/contracts/configuration';
import { useGetMyInventory } from '@/api/inventory/get';
import { InventoryItem } from '@/types/inventory';
import ItemMintDialog from './ItemMintDialog';
import ItemListDialog from './ItemListDialog';

interface NFTMetadata {
  name: string;
  img: string;
  tokenId: number;
  wallet: string;
  desc: string;
  price?: string;
  inventoryId?: string;
}

export default function InventoryContracts() {
  const { address, isConnected } = useAccount();
  const { walletLoggedIn } = useWalletAuth();
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  // const [nftSale, setNftsSale] = useState<NFTMetadata[]>([]);
  const [inventoryTokenMap, setInventoryTokenMap] = useState<Record<string, number>>({});

  // Only enable API queries when wallet is connected and backend wallet-login completed
  const { data: apiData, isLoading: apiLoading, isError: apiError } = useGetMyInventory(
    Boolean(isConnected && walletLoggedIn)
  );
  const [mintingMap, setMintingMap] = useState<Record<string, boolean>>({});

  async function getCreatedNFTs() {
    try {
      let provider: any;
      if ((window as any).ethereum) {
        provider = new BrowserProvider((window as any).ethereum);
      } else {
        const web3Modal = new Web3Modal();
        const connection = await web3Modal.connect();
        provider = new BrowserProvider(connection);
      }

      if (!address) return;

      const signer = await provider.getSigner();
      const contract = new Contract(btnft, NFT, signer);

      const itemArray: NFTMetadata[] = [];
      // Build a quick lookup from API inventory images to inventory IDs (best-effort)
      const apiInventory = apiData?.data?.inventory ?? [];
      const imageToInventoryId: Record<string, string> = {};
      if (Array.isArray(apiInventory)) {
        for (const inv of apiInventory) {
          const rawImg = inv?.ipfsImage ?? null;
          if (!rawImg) continue;
          const normalized = String(rawImg).replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
          imageToInventoryId[normalized] = String(inv._id ?? '');
        }
      }
      const totalSupply = await contract._tokenIds();
      for (let i = 1; i <= totalSupply; i++) {
        try {
          const owner = await contract.ownerOf(i);
          if (owner.toLowerCase() === address.toLowerCase()) {
            const rawUri = await contract.tokenURI(i);
            const cleanUri = rawUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
            const response = await axios.get(cleanUri);
            const metadata = response.data;
            const rawImg = metadata.image || '';
            const image = rawImg.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');

            // If this token's image matches an API inventory item, prefer API name/image and record mapping
            const matchedInventoryId = imageToInventoryId[image] ?? null;
            const meta = {
              name: matchedInventoryId ? (apiInventory.find((a: any) => String(a._id ?? a.id) === matchedInventoryId)?.itemid ?? metadata.name) : metadata.name,
              img: image,
              tokenId: i,
              wallet: owner,
              desc: matchedInventoryId ? (apiInventory.find((a: any) => String(a._id ?? a.id) === matchedInventoryId)?.itemname ?? metadata.description) : metadata.description,
              inventoryId: matchedInventoryId || undefined,
            };

            itemArray.push(meta);

            if (matchedInventoryId) {
              setInventoryTokenMap((prev) => ({ ...prev, [matchedInventoryId!]: i }));
            }
          }
        } catch (error) {
          // ignore individual token errors
          console.log(`Error fetching token ${i}:`, error);
        }
      }

      setNfts(itemArray);
      console.log('Created NFTs:', itemArray);
    } catch (err) {
      console.error('getCreatedNFTs error', err);
    }
  }   

  // async function getWalletNFTs() {
  //   try {
  //     let provider: any;
  //     if ((window as any).ethereum) {
  //       provider = new BrowserProvider((window as any).ethereum);
  //     } else {
  //       const web3Modal = new Web3Modal();
  //       const connection = await web3Modal.connect();
  //       provider = new BrowserProvider(connection);
  //     }

  //     if (!address) return;

  //     const signer = await provider.getSigner();
  //     const contract = new Contract(btnftcol, Collection, signer);

  //     const itemArray: NFTMetadata[] = [];
  //     const totalSupply = await contract.totalSupply();

  //     for (let i = 1; i <= totalSupply; i++) {
  //       try {
  //         const owner = await contract.ownerOf(i);
  //         if (owner.toLowerCase() === address.toLowerCase()) {
  //           const rawUri = await contract.tokenURI(i);
  //           const cleanUri = rawUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
  //           const response = await axios.get(cleanUri);
  //           const metadata = response.data;
  //           const rawImg = metadata.image || '';
  //           const image = rawImg.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');

  //           const meta = {
  //             name: metadata.name,
  //             img: image,
  //             tokenId: i,
  //             wallet: owner,
  //             desc: metadata.description,
  //           };

  //           itemArray.push(meta);
  //         }
  //       } catch (error) {
  //         console.log(`Error fetching token ${i}:`, error);
  //       }
  //     }

  //     setNftsSale(itemArray);
  //     console.log('Wallet NFTs:', itemArray);
  //   } catch (err) {
  //     console.error('getWalletNFTs error', err);
  //   }
  // }

  useEffect(() => {
    // Only fetch contract data after the wallet is connected AND the backend
    // wallet login/authentication flow completed (prevents premature RPC calls)
    if (isConnected && walletLoggedIn) {
      // Add a small delay to ensure localStorage flag is fully synced before fetching
      const timer = setTimeout(() => {
        getCreatedNFTs();
        // getWalletNFTs();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, walletLoggedIn, address]);


  // When API data arrives, log it and optionally merge with contract-fetched items
  useEffect(() => {
    if (apiData && apiData.data) {
      console.log('API inventory data:', apiData.data);
    }
  }, [apiData]);

  // Minting is now handled by ItemMintDialog (backend + on-chain fallback)

  return (
    <>
      {!isConnected ? (
        <section className="w-full max-w-[1440px] mt-8">
          <div className="w-full flex flex-col items-center gap-6">
            <h3 className="text-2xl font-bold text-white">Please connect your wallet</h3>
            <p className="text-sm text-zinc-400">You must be logged in with your wallet to view and mint items.</p>
            <div className="mt-4">
              <WalletLogin />
            </div>
          </div>
        </section>
      ) : (
        <section className="w-full max-w-[1440px] mt-8">
          <div className="w-full flex flex-col items-center gap-6">
            <h3 className="text-2xl font-bold text-white">Your NFTs (from contracts)</h3>
            {/* <p className="text-sm text-zinc-400">Fetched {nfts.length} created NFTs, {nftSale.length} collection NFTs. Check console for full arrays.</p> */}

            {/* Minimal display for created NFTs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full px-4">
              {nfts.map((nft, index) => (
                <div key={`created-${index}`} className="group bg-zinc-900 border-[1px] border-zinc-800 rounded-md overflow-hidden">
                  <div className="w-full h-[280px] bg-zinc-800 overflow-hidden">
                    {nft.img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={nft.img} alt={nft.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-zinc-700" />
                    )}
                  </div>
                  <div className="px-3 py-2 text-white border-t border-zinc-800 space-y-2">
                    <div>
                      <p className="text-sm font-medium mb-1">{nft.name || 'Untitled'}</p>
                      <p className="text-xs text-zinc-400 truncate">Token: {nft.tokenId}</p>
                    </div>
                    <ItemListDialog
                      tokenId={nft.tokenId}
                      nftName={nft.name || 'Untitled'}
                      nftImage={nft.img}
                      inventoryId={nft.inventoryId}
                      onListingComplete={() => {
                        getCreatedNFTs();
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* API in-game inventory (mintable items) */}
            <div className="w-full max-w-[1440px] mt-8 px-4">
              <h4 className="text-lg font-semibold text-white mb-3">In-game Assets</h4>
              {apiLoading && <p className="text-zinc-400">Loading inventory...</p>}
              {apiError && <p className="text-red-400">Failed to load in-game inventory</p>}

              {!apiLoading && apiData?.data?.inventory && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {apiData.data.inventory.map((item: InventoryItem) => {
                    const id = item._id;
                    const isMintable = item.isMintable;
                    const isMinted = item.isMinted;
                    const mappedTokenId = inventoryTokenMap?.[String(id)];
                    return (
                      <div key={id} className="group bg-zinc-900 border-[1px] border-zinc-800 rounded-md overflow-hidden">
                        <div className="w-full h-[260px] bg-zinc-800 overflow-hidden">
                          {item.ipfsImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.ipfsImage} alt={item.itemname} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-zinc-700" />
                          )}
                        </div>
                        <div className="px-3 py-2 text-white flex flex-col gap-2 border-t border-zinc-800">
                          <div>
                            <p className="text-sm font-medium">{item.itemname}</p>
                            <p className="text-xs text-zinc-400">Qty: {item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {isMintable && !isMinted ? (
                              <ItemMintDialog
                                item={item}
                              />
                            ) : isMinted ? (
                              mappedTokenId ? (
                                <span className="text-emerald-400 text-xs font-medium">Minted — Token: {mappedTokenId}</span>
                              ) : (
                                <span className="text-emerald-400 text-xs font-medium">Minted</span>
                              )
                            ) : (
                              <span className="text-zinc-400 text-xs">Not mintable</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </section>
      )}
    </>
  );
}
