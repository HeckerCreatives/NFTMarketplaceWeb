'use client'
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, LogIn, SeparatorHorizontal, ShoppingBag } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useAccount, useBalance, useConnect, useEnsAvatar, useEnsName, useSwitchAccount } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { FaEthereum } from "react-icons/fa";
import { Account } from "@/components/wallet/account";
import { useEffect } from "react";
import { Navbar } from "@/components/dashboard/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSwitchChain } from 'wagmi'
import { normalize } from 'viem/ens'
import { config } from "@/wagmi/config";
import { WalletLogin } from '@/components/auth/WalletLogin';

export default function profile(){
  const { connect } = useConnect()
  const { address, isConnected } = useAccount();
  const { chains, switchChain } = useSwitchChain()
  const { data: balance } = useBalance({
    address: address,
  });

  const { data: ensName } = useEnsName({
    address: address,
  })

  const ensAvatar = useEnsAvatar({
    name: normalize('wevm.eth'),    
    config: config
  })
  


  console.log(ensAvatar)

  useEffect(() => {
    if (isConnected) {
      console.log('Connected with address:', address);
    }

    if (balance) {
      console.log('Balance:', balance);
    }
  }, [isConnected, address]);

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
        
                <p className=" text-sm text-white font-medium">Profile</p>
        
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
        <Card className="w-[600px] bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4 p-4">
              {/* Profile Header */}
            <div className="flex items-center gap-4 p-4">
            <div className="w-[100px] h-[100px] rounded-full overflow-hidden bg-zinc-800">
                <Image
                src={ensAvatar.data || "/metamask.png"}
                width={100}
                height={100}
                alt="avatar"
                className="object-cover"
                unoptimized={!!ensAvatar}
                />
            </div>
            <div className="flex flex-col gap-2">
                <h2 className="text-white text-xl font-medium">
                {ensName || (isConnected ? formatAddress(address || '') : 'Not Connected')}
                </h2>
                {isConnected && (
                <p className="text-zinc-400 text-sm flex gap-2">
                    <FaEthereum className="text-primary"/>
                    {address}
                </p>
                )}
            </div>
            </div>
                <div>
            </div>
            </div>

                  {/* display chains and add swich network */}
                  <div className="flex items-center gap-4">
                    <p className="text-zinc-400 text-sm font-bold ">Networks: </p>
                    <div className="flex grid grid-cols-4 items-center gap-2">
                      {chains.map((chain) => (
                        <button
                          key={chain.id}
                          onClick={() => switchChain({ chainId: chain?.id})}
                          className=" h-[40px] w-full  flex justify-center items-center gap-2 text-white text-sm font-medium bg-zinc-800 px-2 py-1 rounded-md"
                        >
                          {chain.name}
                        </button>
                      ))}
                    </div>
                </div>

            {/* Wallet Details */}
            {isConnected ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-zinc-400 text-sm">Account Balance</p>
                  <p className="text-white text-lg font-medium flex items-center gap-1">
                    <FaEthereum />
                    {balance?.formatted || '0'} {balance?.symbol}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-zinc-400 text-sm">USD Value</p>
                  <p className="text-white text-lg font-medium">
                    ${balance?.formatted ? (Number(balance.formatted) * 3000).toFixed(2) : '0.00'}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-zinc-400 text-sm">Network</p>
                  <p className="text-white text-lg font-medium">Ethereum Mainnet</p>
                </div>
                <div className="space-y-2">
                  <p className="text-zinc-400 text-sm">Status</p>
                  <p className="text-emerald-400 text-lg font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"/>
                    Connected
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-zinc-400">Connect your wallet to view details</p>
                <div className="mt-4 max-w-sm mx-auto">
                  <WalletLogin 
                    onSuccess={() => console.log('Connected')}
                    onError={(error) => console.error('Connection failed:', error)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

       </main>
    )
}