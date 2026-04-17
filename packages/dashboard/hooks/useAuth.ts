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
    const savedUser = localStorage.getItem('strava_user')

    if (savedToken && savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        setToken(savedToken)
        setUser(userData)
      } catch (e) {
        console.error('Failed to parse saved user:', e)
        localStorage.removeItem('strava_jwt')
        localStorage.removeItem('strava_user')
      }
    }
    setLoading(false)
  }, [])

  const login = (jwt: string, userData: AuthUser) => {
    localStorage.setItem('strava_jwt', jwt)
    localStorage.setItem('strava_user', JSON.stringify(userData))
    setToken(jwt)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('strava_jwt')
    localStorage.removeItem('strava_user')
    setToken(null)
    setUser(null)
  }

  return { user, token, loading, login, logout }
}
