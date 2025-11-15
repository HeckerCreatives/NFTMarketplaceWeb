'use client'
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, LogIn, SeparatorHorizontal, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useAccount, useBalance, useConnect, useContractRead, useEnsAvatar, useEnsName, useReadContract, useWriteContract } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { FaEthereum } from "react-icons/fa";
import { Account } from "@/components/wallet/account";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/dashboard/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSwitchChain } from 'wagmi'
import { mainnet, sepolia, optimism, arbitrum, bscTestnet } from 'wagmi/chains'
import { normalize } from 'viem/ens'

import { BrowserProvider, Contract, Interface, parseUnits, Wallet } from 'ethers';
import Market from '../../contracts/market.json';
import NFT from '../../contracts/nft.json';
import Collection from '../../contracts/collection.json';
import Web3Modal from "web3modal";
import axios from 'axios';
import { btnft, btnftcol } from "@/contracts/configuration";
import { WalletLogin } from '@/components/auth/WalletLogin';
import InventoryContracts from './components/InventoryContracts';

export default function inventory(){
  const { connect } = useConnect()
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address: address,
  });
    

  

    return (
       <main className=" w-full bg-zinc-950 min-h-screen h-auto flex flex-col items-center">
        <nav className=" w-full max-w-[1440px] flex items-center justify-between h-[70px]">
            <div className=" flex items-center gap-2 text-zinc-300">
                <ShoppingBag size={20}/>
                <p className=" text-sm font-medium">Marketplace</p>
        
                <ChevronRight size={15}/>
        
                <p className=" text-sm text-white font-medium">Inventory</p>
        
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
      <InventoryContracts />
       </main>
    )
}