import '../styles/globals.css'
// Note: ArcGIS CSS moved to MapApp component to avoid webpack issues
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from "@/components/ui/toaster"
import { ChatProvider } from '@/contexts/ChatContext'
import ThemeProvider from '@/components/theme/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MPIQ - PA',
  description: '',
  icons: {
    icon: '/mpiq_pin2.png',
  },
}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload critical data files for faster initial load */}
        <link rel="preload" href="/data/blob-urls.json" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/data/political/pensylvania/precincts/pa_2020_presidential.geojson" as="fetch" crossOrigin="anonymous" />

        {/* Preconnect to Vercel Blob Storage - set NEXT_PUBLIC_BLOB_STORE_URL in .env.local */}
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <ChatProvider>
            {children}
          </ChatProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}