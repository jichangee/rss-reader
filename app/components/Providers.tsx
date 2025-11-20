"use client"

import { SessionProvider } from "next-auth/react"
import { GlobalPlayerProvider } from "./GlobalPlayerContext"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <GlobalPlayerProvider>
        {children}
      </GlobalPlayerProvider>
    </SessionProvider>
  )
}

