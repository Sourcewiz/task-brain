'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Magic links normally open supabase.co/auth/v1/verify, which blocked networks
// can't reach. With the email template pointing here instead, the token is
// verified through the /sb proxy.
export default function Confirm() {
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type') || 'email'

    if (!token_hash) {
      setError('This sign-in link is missing its token. Request a new one.')
      return
    }

    supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) setError(error.message)
      else window.location.replace('/')
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {error ? (
        <div className="text-center">
          <p className="text-sm text-red-500">{error}</p>
          <a href="/" className="text-xs text-blue-600 mt-3 inline-block hover:underline">
            Back to sign in
          </a>
        </div>
      ) : (
        <div className="text-gray-400 text-lg">Signing you in...</div>
      )}
    </div>
  )
}
