'use client'

import { useState } from 'react'

export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
      <code className="text-sm font-mono text-orange-400 flex-1">{code}</code>
      <button
        onClick={handleCopy}
        className="text-xs font-medium text-gray-400 hover:text-white transition-colors"
      >
        {copied ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  )
}
