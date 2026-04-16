'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ChallengeDetail() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params?.slug as string
  const adminToken = searchParams?.get('admin')
  const isAdmin = adminToken === '465786453sd4fsdfsdfsdf456'

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    fetch(
      `https://strava-challenges-extension.vercel.app/api/challenges/public?slug=${slug}`
    )
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  if (loading) return <p style={{padding:'2rem'}}>Loading...</p>
  if (!data?.name) return <p style={{padding:'2rem'}}>Challenge not found</p>

  const challenge = data
  const leaderboard = data.leaderboard || []

  return (
    <div style={{maxWidth:'800px',margin:'0 auto',padding:'2rem',fontFamily:'sans-serif'}}>
      <a href={`/?admin=${adminToken || ''}`} style={{color:'#FC4C02',textDecoration:'none'}}>← Back</a>
      <h1>{challenge.name}</h1>
      <p>{challenge.type} challenge · Ends {new Date(challenge.ends_at).toLocaleDateString()}</p>

      {isAdmin && (
        <button
          onClick={async () => {
            if (!confirm('Delete this challenge?')) return
            await fetch(
              'https://strava-challenges-extension.vercel.app/api/challenges/delete',
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${adminToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ challengeId: challenge.id })
              }
            )
            window.location.href = `/?admin=${adminToken}`
          }}
          style={{background:'red',color:'white',padding:'0.5rem 1rem',border:'none',borderRadius:'4px',cursor:'pointer',marginBottom:'1rem'}}
        >
          🗑️ Delete Challenge
        </button>
      )}

      <h2>Leaderboard</h2>
      {!leaderboard?.length ? (
        <p>No efforts yet</p>
      ) : (
        leaderboard.map((entry: any, i: number) => (
          <div key={entry.user_id} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.75rem',marginBottom:'0.5rem',background:'#f9f9f9',borderRadius:'8px'}}>
            <strong>#{i+1}</strong>
            <img src={entry.user_profile_pic} width={40} height={40} style={{borderRadius:'50%'}} alt={entry.user_name} />
            <span>{entry.user_name}</span>
            <span style={{marginLeft:'auto'}}>{entry.score} {challenge.type === 'count' ? 'efforts' : ''}</span>
          </div>
        ))
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <ChallengeDetail />
    </Suspense>
  )
}
