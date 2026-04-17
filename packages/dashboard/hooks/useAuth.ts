'use client'

import { useEffect, useState } from 'react'

export interface AuthUser {
  id: string
  name: string
  strava_id: string
  profile_pic_url: string
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem('strava_jwt')
    if (savedToken) {
      setToken(savedToken)
      fetchUser(savedToken)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUser = async (jwt: string) => {
    try {
      const response = await fetch('https://strava-challenges-extension.vercel.app/api/user/me', {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data)
      } else {
        localStorage.removeItem('strava_jwt')
        setToken(null)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      localStorage.removeItem('strava_jwt')
      setToken(null)
    } finally {
      setLoading(false)
    }
  }

  const login = (jwt: string, userData: AuthUser) => {
    localStorage.setItem('strava_jwt', jwt)
    setToken(jwt)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('strava_jwt')
    setToken(null)
    setUser(null)
  }

  return { user, token, loading, login, logout }
}
