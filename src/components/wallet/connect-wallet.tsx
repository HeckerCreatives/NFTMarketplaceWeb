'use client'
import React from 'react'
import { Connector, useConnect } from 'wagmi'
import { Button } from '../ui/button'

export function WalletOptions() {
  const { connectors, connect } = useConnect()

  return connectors.map((connector) => (
    <Button key={connector.uid} onClick={() => connect({ connector })} className=' text-white'>
     Log in with {connector.name}
    </Button>
  ))
}