import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'StravaChallenge — Compete on Every Climb',
  description: 'Create segment challenges, invite friends, and compete on Strava. Track leaderboards in real-time with auto-tracking.',
  keywords: ['strava', 'challenges', 'cycling', 'climbing', 'leaderboard'],
  openGraph: {
    title: 'StravaChallenge',
    description: 'Compete with friends on Strava segments',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StravaChallenge',
    description: 'Compete on Strava segments with friends',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-black text-white">{children}</body>
    </html>
  )
}
