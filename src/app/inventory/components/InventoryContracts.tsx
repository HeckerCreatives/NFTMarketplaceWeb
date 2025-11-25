'use client'

import { useEffect, useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import Web3Modal from 'web3modal';
import axios from 'axios';
import { useAccount } from 'wagmi';
import { WalletLogin } from '@/components/auth/WalletLogin';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { ChevronDown } from 'lucide-react';
import NFT from '../../../contracts/nft.json';
import Collection from '../../../contracts/collection.json';
import { btnft, btnftcol, sepmarket, sepnft } from '@/contracts/configuration';
import { useGetMyInventory } from '@/api/inventory/get';
import { InventoryItem } from '@/types/inventory';
import ItemMintDialog from './ItemMintDialog';
import ItemListDialog from './ItemListDialog';
import { ItemTransferDialog } from './ItemTransferDialog';

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
  const [inventoryTokenMap, setInventoryTokenMap] = useState<Record<string, number>>({});
  const [selectedInGame, setSelectedInGame] = useState<Set<string>>(new Set());
  const [selectedWallet, setSelectedWallet] = useState<Set<number>>(new Set());

  // Only enable API queries when wallet is connected and backend wallet-login completed
  const { data: apiData, isLoading: apiLoading, isError: apiError } = useGetMyInventory(
    Boolean(isConnected && walletLoggedIn)
  );

  const inGameItems = apiData?.data?.inventory?.filter((item: InventoryItem) => item.isMintable && !item.isMinted) ?? [];

  const toggleItemSelect = (id: string | number, type: "ingame" | "wallet") => {
    if (type === "ingame") {
      setSelectedInGame((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(id as string)) {
          newSet.delete(id as string);
        } else {
          newSet.add(id as string);
        }
        return newSet;
      });
    } else {
      setSelectedWallet((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(id as number)) {
          newSet.delete(id as number);
        } else {
          newSet.add(id as number);
        }
        return newSet;
      });
    }
  };

  const toggleSelectAll = (type: "ingame" | "wallet", items: any[]) => {
    if (type === "ingame") {
      if (selectedInGame.size === items.length) {
        setSelectedInGame(new Set());
      } else {
        setSelectedInGame(new Set(items.map((item: InventoryItem) => item._id)));
      }
    } else {
      if (selectedWallet.size === items.length) {
        setSelectedWallet(new Set());
      } else {
        setSelectedWallet(new Set(items.map((nft: NFTMetadata) => nft.tokenId)));
      }
    }
  };

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
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-[1600px] mx-auto">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-20">
            <h3 className="text-2xl font-bold text-white mb-4">Please connect your wallet</h3>
            <p className="text-sm text-slate-400 mb-6">You must be logged in with your wallet to view and mint items.</p>
            <WalletLogin />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-[1240px]">
            {/* In-Game Assets Section */}
            <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">In-game Assets</h2>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {}}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium transition"
                  >
                    {selectedInGame.size === inGameItems.length && inGameItems.length > 0 ? 'Deselect all' : 'Select all'}
                  </button>
                  <button className="text-slate-400 hover:text-slate-300 transition">
                    <ChevronDown size={20} />
                  </button>
                </div>
              </div>

              {apiLoading ? (
                <div className="text-center py-12">
                  <p className="text-slate-400">Loading inventory...</p>
                </div>
              ) : apiError ? (
                <div className="text-center py-12">
                  <p className="text-red-400">Failed to load in-game inventory</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {inGameItems.length > 0 ? (
                    inGameItems.map((item: InventoryItem) => (
                      <div
                        key={item._id}
                        className={`relative group cursor-pointer transition-all ${
                          selectedInGame.has(item._id) ? "ring-2 ring-blue-400" : ""
                        }`}
                        onClick={() => toggleItemSelect(item._id, "ingame")}
                      >
                        {selectedInGame.has(item._id) && (
                          <>
                            <div className="absolute -top-2 -left-2 w-4 h-4 bg-white rounded-full z-10" />
                            <div className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full z-10" />
                            <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white rounded-full z-10" />
                            <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white rounded-full z-10" />
                            <div className="absolute top-1/2 -left-2 w-4 h-4 bg-white rounded-full z-10 -translate-y-1/2" />
                            <div className="absolute top-1/2 -right-2 w-4 h-4 bg-white rounded-full z-10 -translate-y-1/2" />
                          </>
                        )}

                        <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-lg hover:shadow-xl transition">
                          <div className="w-full aspect-square bg-slate-700 overflow-hidden flex items-center justify-center">
                            {item.ipfsImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.ipfsImage}
                                alt={item.itemname}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-600" />
                            )}
                          </div>
                          <div className="p-3 bg-slate-800">
                            <p className="text-sm font-semibold text-white">{item.itemname}</p>
                            <p className="text-xs text-slate-400 mt-1">Qty: {item.quantity}</p>
                            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                              <ItemMintDialog item={item} triggerClass="bg-green-600 hover:bg-green-700 text-white text-xs py-1.5 w-full" triggerLabel="Mint" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <p className="text-slate-400">No in-game assets available for minting</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* In-Wallet Assets Section */}
            <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">In-wallet Assets</h2>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {}}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium transition"
                  >
                    {selectedWallet.size === nfts.length && nfts.length > 0 ? 'Deselect all' : 'Select all'}
                  </button>
                  <button className="text-slate-400 hover:text-slate-300 transition">
                    <ChevronDown size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {nfts.length > 0 ? (
                  nfts.map((nft, index) => (
                    <div
                      key={`wallet-${index}`}
                      className={`relative group cursor-pointer transition-all ${
                        selectedWallet.has(nft.tokenId) ? "ring-2 ring-blue-400" : ""
                      }`}
                      onClick={() => toggleItemSelect(nft.tokenId, "wallet")}
                    >
                      {selectedWallet.has(nft.tokenId) && (
                        <>
                          <div className="absolute -top-2 -left-2 w-4 h-4 bg-white rounded-full z-10" />
                          <div className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full z-10" />
                          <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white rounded-full z-10" />
                          <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white rounded-full z-10" />
                          <div className="absolute top-1/2 -left-2 w-4 h-4 bg-white rounded-full z-10 -translate-y-1/2" />
                          <div className="absolute top-1/2 -right-2 w-4 h-4 bg-white rounded-full z-10 -translate-y-1/2" />
                        </>
                      )}

                      <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-lg hover:shadow-xl transition">
                        <div className="w-full aspect-square bg-slate-700 overflow-hidden flex items-center justify-center">
                          {nft.img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={nft.img}
                              alt={nft.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-600" />
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold text-white">{nft.name || "Untitled"}</p>
                          <p className="text-xs text-slate-400 mt-1">Token: {nft.tokenId}</p>
                            <div className="flex mt-2 gap-2 flex-row" onClick={(e) => e.stopPropagation()}>
                              <ItemListDialog
                                tokenId={nft.tokenId}
                                nftName={nft.name || 'Untitled'}
                                nftImage={nft.img}
                                inventoryId={nft.inventoryId}
                                onListingComplete={() => {
                                  getCreatedNFTs();
                                }}
                              />
                              <ItemTransferDialog
                                tokenId={nft.tokenId}
                                nftName={nft.name}
                                nftImage={nft.img}
                                inventoryId={nft.inventoryId}
                                onTransferComplete={() => getCreatedNFTs()}
                              />
                            </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12">
                    <p className="text-slate-400">No wallet assets</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
