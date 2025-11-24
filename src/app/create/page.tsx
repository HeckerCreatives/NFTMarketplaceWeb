'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { injected, useAccount, useConnect, useWriteContract } from 'wagmi';
import { pinata, updateFileMetadataOnPinata, uploadFileToPinata, uploadMetadataToPinata } from '../../contracts/configuration';
import { btnft, btmarket } from '../../contracts/configuration';
import { ChevronRight, ShoppingBag } from 'lucide-react';
import { Navbar } from '@/components/dashboard/navbar';
import { Account } from '@/components/wallet/account';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { BrowserProvider, Contract, Interface, parseUnits } from 'ethers';
import NFT from '../../contracts/nft.json';
import Market from '../../contracts/market.json';
import Collection from '../../contracts/collection.json';
import Resell from '../../contracts/resell.json';
import Web3Modal from "web3modal";
import { WalletLogin } from '@/components/auth/WalletLogin';

export default function CreateNFT() {
    const { connect } = useConnect()
    const { address, isConnected } = useAccount();
    const [fileUrl, setFileUrl] = useState<string | null>(null)
    const [formInput, updateFormInput] = useState({ price: '', name: '', description: '' })
    const router = useRouter()

    function extractFileIdFromUrl(url: string): string {
        const parts = url.split('/');
        return parts[parts.length - 1]; // Extract the last part of the URL (CID)
    }
    async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
      
        try {
          const upload = await uploadFileToPinata(file);

          const url = `https://gateway.pinata.cloud/ipfs/${upload.IpfsHash}`;
          console.log('File uploaded to Pinata:', url);
      
          // Set the file URL in state
          setFileUrl(url);
        } catch (error) {
          console.log('Error uploading file:', error);
        }
      }

      async function createMarket() {
        const { name, description, price } = formInput;
    
        if (!name || !description || !price || !fileUrl) return;
    
        try {
            // Extract file CID
            const fileId = extractFileIdFromUrl(fileUrl);
            const metadata = {
                name: name,
                description: description,
                image: `https://gateway.pinata.cloud/ipfs/${fileId}`, 
                attributes: [
                    { trait_type: "Marketplace", value: "KF NFT Marketplace" },
                    { trait_type: "Price", value: price }
                ]
            };
    
            // Upload metadata JSON to Pinata
            const metadataBlob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
            const metadataFile = new File([metadataBlob], `${name}.json`, { type: "application/json" });
            const metadataUpload = await uploadFileToPinata(metadataFile);
    
            const metadataUri = `https://gateway.pinata.cloud/ipfs/${metadataUpload.IpfsHash}`;
            console.log('Metadata uploaded to Pinata:', metadataUri);
    
            // Mint the NFT with metadata URI
            createNFT(metadataUri);
        } catch (error) {
            console.log('Error uploading metadata on Pinata:', error);
        }
    }
    
    async function createNFT(url: String) {
        const web3Modal = new Web3Modal();
        const connection = await web3Modal.connect();
        const provider = new BrowserProvider(connection);
        const signer = await provider.getSigner();
    
        let contract = new Contract(btnft, NFT, signer);
    
        try {
            let transaction = await contract.createNFT(url);
            console.log("Transaction sent:", transaction);
    
            let tx = await transaction.wait();
            console.log("Transaction confirmed:", tx);
            console.log("Transaction logs:", tx.logs);
    
            // Parse the logs manually to find the NFTCreated event
            const iface = new Interface(NFT);
            const event = tx.logs
                .map((log: any) => {
                    try {
                        return iface.parseLog(log);
                    } catch (err) {
                        return null; // Skip logs that cannot be parsed
                    }
                })
                .find((parsedLog: any) => parsedLog && parsedLog.name === "NFTCreated");
    
            if (event) {
                const owner = event.args[0]; // Owner address
                const tokenId = Number(event.args[1]); // Convert BigInt to number
                const tokenURI = event.args[2]; // Token URI
                console.log("NFT Created Event:", { owner, tokenId, tokenURI });
    
                const price = parseUnits(formInput.price, 'ether');
                contract = new Contract(btmarket, Market, signer);
                let listingFee = await contract.listingFee();
                listingFee = listingFee.toString();
    
                transaction = await contract.createVaultItem(btnft, tokenId, price, { value: listingFee });
                await transaction.wait();
    
                window.location.reload();
            } else {
                console.log("NFTCreated event not found in logs.");
            }
        } catch (error) {
            console.error("Error in createNFT:", error);
        }
    }

    async function buyNFT() {
        const { name, description } = formInput;
    
        if (!name || !description || !fileUrl) {
            console.log('Missing required fields: name, description, or fileUrl');
            return;
        }
    
    
        try {

            // Extract file CID
            const fileId = extractFileIdFromUrl(fileUrl);
            const metadata = {
                name: name,
                description: description,
                image: `https://gateway.pinata.cloud/ipfs/${fileId}`, 
                attributes: [
                    { trait_type: "Marketplace", value: "KF NFT Marketplace" },
                ]
            };
    

            const metadataCid = await uploadMetadataToPinata(metadata);
    
            const metadataUri = `https://gateway.pinata.cloud/ipfs/${metadataCid}`;
            console.log('Metadata uploaded to Pinata:', metadataUri);

            mintNFT(metadataUri);
        } catch (error) {
            console.log('Error uploading metadata to Pinata:', error);
        }
    }

    async function mintNFT(url: String) {
        const web3Modal = new Web3Modal()
        const connection = await web3Modal.connect()
        const provider = new BrowserProvider(connection)
        const signer = await provider.getSigner()
        let contract = new Contract(btnft, NFT, signer)
        let cost = await contract.cost()
        let transaction = await contract.mintNFT(url, { value: cost })
        await transaction.wait()
        window.location.reload();
    }

    const formatAddress = (address: string) => {
        return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''
    }


    async function listContractFunctions(abiOrJson: any) {
    // abiOrJson can be the imported JSON (NFT / Market) or an ABI array
    const abi = abiOrJson?.abi ?? abiOrJson;
    const iface = new Interface(abi);

    const funcs = iface.fragments
        .filter((f: any) => f.type === 'function')
        .map((f: any) => ({
            name: f.name,
            signature: f.format(), // full signature
            inputs: f.inputs?.map((i: any) => `${i.type} ${i.name}`).join(', '),
            stateMutability: f.stateMutability
        }));

    console.table(funcs);
    return funcs;
}


// console.log(listContractFunctions(NFT));
// console.log(listContractFunctions(Market));
console.log(listContractFunctions(Collection))

    return (
        <main className=" w-full bg-zinc-950 min-h-screen h-auto flex flex-col items-center">
        <nav className=" w-full max-w-[1440px] flex items-center justify-between h-[70px]">
            <div className=" flex items-center gap-2 text-zinc-300">
                <ShoppingBag size={20}/>
                <p className=" text-sm font-medium">Marketplace</p>
        
                <ChevronRight size={15}/>
        
                <p className=" text-sm text-white font-medium">Create NFT</p>
        
            </div>
        
            <div className=" flex items-center gap-2 text-xs">
        
                <Navbar/>
                {isConnected ? (
                <Account/>
        
                ) : (
                <div className="px-4">
                  <WalletLogin 
                    onSuccess={() => console.log('Connected')}
                    onError={(error) => console.error('Connection failed:', error)}
                  />
                </div>
                )}
            </div>
        </nav>
            <section className="w-full max-w-[1440px] flex flex-col items-center gap-4 mt-8">
            <div className="w-full flex flex-col items-center text-center gap-4">
                <h2 className="text-2xl font-bold text-white">NFT Creator Portal</h2>
                <p className="text-sm text-zinc-400">
                The NFT Marketplace with a Reward. Create and Sell your NFT in the Marketplace.
                </p>
            </div>

            <div className="w-full flex flex-col md:flex-row justify-center items-start gap-8">
                {/* Left Column */}


                {/* Right Column */}
                <div className="flex flex-col items-center gap-4">
                <div className="bg-zinc-800 p-4 rounded-md shadow-md w-full max-w-sm">
                    <input
                    type="text"
                    placeholder="Enter your NFT Name"
                    className="w-full p-2 mb-4 bg-zinc-900 text-white rounded-md"
                    onChange={(e) => updateFormInput({ ...formInput, name: e.target.value })}
                    />
                    <textarea
                    placeholder="NFT Description"
                    className="w-full p-2 mb-4 bg-zinc-900 text-white rounded-md"
                    onChange={(e) => updateFormInput({ ...formInput, description: e.target.value })}
                    />
                    <input
                    type="file"
                    name="Asset"
                    className="w-full p-2 mb-4 bg-zinc-900 text-white rounded-md"
                    onChange={onChange}
                    />
                    {fileUrl && <img className="rounded-md w-full" src={fileUrl} alt="Uploaded NFT" />}
                    <input
                    type="text"
                    placeholder="Set your price"
                    className="w-full p-2 mb-4 bg-zinc-900 text-white rounded-md"
                    onChange={(e) => updateFormInput({ ...formInput, price: e.target.value })}
                    />
                                <div className="w-full flex flex-col md:flex-row justify-center items-start gap-8">
                {isConnected ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="bg-zinc-800 p-4 rounded-md shadow-md w-full max-w-sm">
                            <input
                                type="text"
                                placeholder="Enter your NFT Name"
                                className="w-full p-2 mb-4 bg-zinc-900 text-white rounded-md"
                                onChange={(e) => updateFormInput({ ...formInput, name: e.target.value })}
                            />
                            {/* ...existing form inputs... */}
                            <button
                                onClick={() => createMarket()}
                                className="w-full bg-green-600 text-white py-2 rounded-md mb-2"
                            >
                                List your NFT!
                            </button>
                            <button
                                onClick={() => buyNFT()}
                                className="w-full bg-blue-600 text-white py-2 rounded-md"
                            >
                                Mint your NFT!
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 p-8">
                        <div className="text-center">
                            <h3 className="text-xl font-semibold text-white mb-4">Connect Your Wallet</h3>
                            <p className="text-zinc-400 mb-6">Please connect your wallet to create and mint NFTs</p>
                            <div className="max-w-sm mx-auto">
                              <WalletLogin 
                                onSuccess={() => console.log('Connected')}
                                onError={(error) => console.error('Connection failed:', error)}
                              />
                            </div>
                        </div>
                    </div>
                )}
            </div>
                </div>
                </div>
            </div>
            </section>

       </main>
    )
}