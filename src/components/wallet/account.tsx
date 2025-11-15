'use client'
import { useAccount, useDisconnect, useEnsAvatar, useEnsName } from 'wagmi'

export function Account() {
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: ensName } = useEnsName({ address })
  const { data: ensAvatar } = useEnsAvatar({ name: ensName! })

  return (
    <div className=' text-white flex items-center gap-4 bg-zinc-800 px-3 py-1 rounded-full'>
      {ensAvatar && <img alt="ENS Avatar" src={ensAvatar} />}
      {address && <div>{ensName ? `${ensName} (${address})` : `${address.slice(0,3)}...${address.slice(3,6)}...`}</div>}
      <button className=' text-xs bg-zinc-950 px-3 py-2 rounded-full' onClick={() => disconnect()}>Disconnect</button>
    </div>
  )
}