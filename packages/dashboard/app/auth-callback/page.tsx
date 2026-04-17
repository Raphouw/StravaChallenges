'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  useEffect(() => {
    const token = searchParams.get('token')
    const userId = searchParams.get('userId')
    const name = searchParams.get('name')
    const profileUrl = searchParams.get('profileUrl')
    const stravaId = searchParams.get('stravaId')

    if (token && userId && name && stravaId) {
      const userData = {
        id: userId,
        name: decodeURIComponent(name),
        strava_id: stravaId,
        profile_pic_url: decodeURIComponent(profileUrl || ''),
      }
      login(token, userData)
    }
    router.push('/')
  }, [searchParams, login, router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Authenticating...</p>
      </div>
    </div>
  )
}
