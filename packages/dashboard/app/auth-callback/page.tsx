'use client'
import { useEffect } from 'react'
import { Suspense } from 'react'

function AuthCallbackInner() {
  useEffect(() => {
    // Lire le token directement depuis window.location
    // car useSearchParams peut ne pas être disponible immédiatement
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const userId = params.get('userId')
    const name = params.get('name')
    const profileUrl = params.get('profileUrl')

    if (token) {
      localStorage.setItem('strava_jwt', token)
      localStorage.setItem('strava_user', JSON.stringify({
        id: userId,
        name: name,
        profile_pic_url: profileUrl
      }))
      window.location.href = '/'
    } else {
      window.location.href = '/?error=auth_failed'
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0A0A0A',
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      Connexion en cours...
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div style={{background:'#0A0A0A',height:'100vh'}}/>}>
      <AuthCallbackInner />
    </Suspense>
  )
}
