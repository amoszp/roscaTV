'use client'
import { createContext, useContext } from 'react'

export interface AccountUser { id: number; username: string; displayName: string }

/** The signed-in account, in builds that sync with the server; null otherwise. */
export const AccountContext = createContext<{ user: AccountUser; signOut: () => void } | null>(null)
export const useAccount = () => useContext(AccountContext)
