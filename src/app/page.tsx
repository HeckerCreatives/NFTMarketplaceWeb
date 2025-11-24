'use client'
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, LogIn, ShoppingBag } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useAccount, useBalance, useConnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { FaEthereum } from "react-icons/fa";
import { Account } from "@/components/wallet/account";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/dashboard/navbar";


import { BrowserProvider, Contract, Interface, parseUnits, Wallet, formatUnits, JsonRpcProvider } from 'ethers';
import Web3Modal from "web3modal";
import { btmarket, btnft } from "@/contracts/configuration";
import Market from '../contracts/market.json';
import NFT from '../contracts/nft.json';
import axios from "axios";
import { WalletLogin } from "@/components/auth/WalletLogin";

export default function Home() {
  const { connect } = useConnect()
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address: address,
  });

  interface NFTItem {
    price: string;
    tokenId: number;
    seller: string;
    owner: string;
    image: string;
    name: string;
    description: string;
  }

  const [nfts, setNfts] = useState<NFTItem[]>([])

  useEffect(() => {
    if (isConnected) {
      console.log('Connected with address:', address);
    }

    if (balance) {
      console.log('Balance:', balance);
    }
  }, [isConnected, address]);

  
  interface MarketNFTItem {
    itemId: any;
    tokenId: bigint;
    price: bigint;
    seller: string;
    owner: string;
  }

  async function loadNewSaleNFTs() {
    try {
      // Use default provider for BSC Testnet instead of requiring wallet connection
      const provider = new JsonRpcProvider('https://bsc-prebsc-dataseed.bnbchain.org');
      
      // Create contract instances without signer for read-only operations
      const tokenContract = new Contract(btnft, NFT, provider);
      const marketContract = new Contract(btmarket, Market, provider);
  
      const data = await marketContract.getAvailableNft();

      const items = await Promise.all(data.map(async (i: MarketNFTItem) => {
        const tokenUri = await tokenContract.tokenURI(Number(i.tokenId));
        
        // Clean the URI and fetch metadata
        const cleanUri = tokenUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        const meta = await axios.get(cleanUri);
  
        const owner = await tokenContract.ownerOf(i.tokenId);
        let price = formatUnits(i.price.toString(), 'ether');
        
        let item = {
          price,
          tokenId: Number(i.tokenId),
          seller: i.seller,
          owner: owner,
          image: meta.data.image,
          name: meta.data.name,
          description: meta.data.description,
        };
        return item;
      }));
  
      console.log('Available NFTs:', items);
      setNfts(items);
    } catch (error) {
      console.error('Error loading NFTs:', error);
    }
  }

  async function buyNFT(nft: NFTItem) {
    try {
      const web3Modal = new Web3Modal();
      const connection = await web3Modal.connect();
      const provider = new BrowserProvider(connection);
      const signer = await provider.getSigner();
      const contract = new Contract(btmarket, Market, signer);
      
      // Get user's balance
      const balance = await provider.getBalance(await signer.getAddress());
      const price = parseUnits(nft.price.toString(), 'ether');
      const estimatedGas = await contract.kfMarketSale.estimateGas(
        btnft, 
        nft.tokenId, 
        { value: price }
      );
      
      // Calculate total cost (price + gas)
      const { gasPrice } = await provider.getFeeData();
      if(!gasPrice){
         console.log('Gas price not available')
         return
      }
      const totalCost = price + (estimatedGas * (gasPrice ?? BigInt(0)));
  
      // Check if user has enough balance
      if (balance < totalCost) {
        const required = formatUnits(totalCost, 'ether');
        const has = formatUnits(balance, 'ether');
        throw new Error(
          `Insufficient balance. You have ${Number(has).toFixed(4)} ETH but need ${Number(required).toFixed(4)} ETH (including gas)`
        );
      }
  
      const transaction = await contract.kfMarketSale(btnft, nft.tokenId, {
        value: price,
        gasLimit: estimatedGas
      });
  
      await transaction.wait();
      await loadNewSaleNFTs();
  
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes('insufficient funds')) {
        alert('You do not have enough funds to complete this purchase (including gas fees)');
      } else if (error.code === 'ACTION_REJECTED') {
        alert('Transaction was rejected by user');
      } else if (error.message?.includes('user rejected transaction')) {
        alert('You rejected the transaction');
      } else {
        console.error('Buy NFT Error:', error);
        alert('Not enough wallet balance to buy this NFT');
      }
    }
  }
  useEffect(() => {
    loadNewSaleNFTs()
  }, [isConnected])

  const formatAddress = (address: string) => {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''
  }

  return (
    <main className=" w-full bg-zinc-950 min-h-screen h-auto flex flex-col items-center">
      <nav className=" w-full max-w-[1440px] flex items-center justify-between h-[70px]">
        <div className=" flex items-center gap-2 text-zinc-300">
          <ShoppingBag size={20}/>
          <p className=" text-sm font-medium">Marketplace</p>

          <ChevronRight size={15}/>

          <p className=" text-sm text-white font-medium">Buy NFT</p>

        </div>

        <div className=" flex items-center gap-2 text-xs">

          <Navbar/>
          {isConnected ? (
          <Account/>

          ) : (
            <Dialog>
            <DialogTrigger className=" text-sm flex items-center gap-2 px-4 py-2 text-white bg-gradient-to-r from-[#764BA2] to-[#667EEA] rounded-full shadow hover:bg-primary/90">
            <LogIn size={15}/>Login
            </DialogTrigger>
            <DialogContent className=" ">
              <DialogHeader>
                <DialogTitle></DialogTitle>
                <DialogDescription>
                </DialogDescription>
              </DialogHeader>

              <div className=" w-full flex flex-col gap-4 text-white text-sm">
                <h2 className=" text-2xl font-bold">Welcome back</h2>
                <p className=" text-sm text-zinc-500">Select your login method.</p>

                <WalletLogin 
                  onSuccess={() => {
                    console.log('Wallet login successful');
                  }}
                  onError={(error) => {
                    console.error('Wallet login failed:', error);
                  }}
                />

              </div>
            </DialogContent>
            </Dialog>
          )}
          
        </div>


      
      </nav>

    <div className="max-w-[1440px] w-full h-auto mt-8">
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4">
        {nfts.map((nft, index) => (
          <div
            key={index}
            className="group flex flex-col w-full bg-zinc-900 h-[420px] border-[1px] border-zinc-800 rounded-md hover:border-zinc-700 transition-all duration-300"
          >
            <div className="w-full h-[55%] bg-zinc-800 rounded-t-md overflow-hidden">
              <img 
                src={nft.image.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')}
                alt={nft.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
            </div>

            <div className="w-full h-[45%] bg-zinc-950 flex flex-col gap-3 p-4 text-white rounded-b-md">
              <p className="text-sm px-3 py-1.5 bg-zinc-800 rounded-full text-blue-400 w-fit">
                Token ID: {nft.tokenId}
              </p>
              <p className="text-base font-semibold text-zinc-300">{nft.name}</p>
              <div className="flex justify-between items-center">
                <p className="text-sm text-zinc-400 truncate">{nft.description}</p>
                <p className="text-sm font-bold flex items-center gap-1">
                  {/* <FaEthereum/> */}
                   <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" viewBox="0 0 24 24">
    <path fill="#6b7280" d="M7.792 6.647L12 4.286l4.209 2.361l-1.543.874L12 6.03L9.34 7.52zm8.417 2.983l-1.543-.874L12 10.247L9.34 8.756l-1.547.874v1.744l2.657 1.492v2.978l1.551.874l1.547-.874v-2.978l2.662-1.492zm0 4.727V12.61l-1.543.874v1.744zm1.101.617l-2.661 1.487v1.749l4.208-2.366v-4.723l-1.547.87zM15.763 8.14l1.543.874v1.744l1.551-.87V8.14l-1.547-.875l-1.547.879zm-5.314 8.957v1.744l1.551.874l1.547-.874V17.1L12 17.97l-1.547-.874zm-2.657-2.743l1.543.874v-1.744l-1.543-.875v1.75zm2.657-6.214L12 9.013l1.547-.874L12 7.264l-1.547.879zm-3.759.874l1.547-.874l-1.543-.875l-1.55.879V9.89l1.546.87zm0 2.978l-1.547-.87v4.723l4.209 2.366v-1.753L6.694 14.97v-2.983z"></path>
</svg>

             {nft.price}
                </p>
              </div>

              <Button 
                onClick={() => buyNFT(nft)} 
                className="w-full text-white bg-blue-600 hover:bg-blue-700 transition-all duration-300"
              >
                Buy now
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>

    </main>
  );
}

