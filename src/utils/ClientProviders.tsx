'use client';

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from 'wagmi';
import { config } from '@/wagmi/config';
import { Toaster } from "react-hot-toast";
import { Check, X } from "lucide-react";

export default function ClientProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-right"
          reverseOrder={false}
          toastOptions={{
            className: ' bg-red-500',
            success:{
              icon: <Check size={15} className=" text-green-500"/>,
              style: {
                padding: '10px',
                color: 'black',
                backgroundColor: 'white',
                fontSize: '12px',
                borderRadius: '0px',
              }
            },
            error:{
              icon: <X size={15} className=" text-red-500"/>,
              style: {
                padding: '10px',
                color: 'black',
                backgroundColor: 'white',
                fontSize: '12px',
                borderRadius: '0px',
              }
            },
            style: {
              padding: '8px',
              color: 'black',
              fontSize: '12px',
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
