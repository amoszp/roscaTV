'use client'
import { useCallback, useEffect, useState } from 'react'
import App from '../App'
import Login from './Login'
import { AccountContext, type AccountUser } from './account'
import { api, ApiError, SIGNED_OUT_EVENT } from '@/lib/api'
import { adoptCacheFor, cacheOwner, flushOutbox, forgetLocalCopy } from '@/lib/db'
import { useStore } from '@/lib/store'
import { getT, type Lang } from '@/lib/i18n'

const LS_USER = 'rosca_user'

function cachedLang(): Lang {
  try { return JSON.parse(localStorage.getItem('rosca_settings') || '{}').language === 'en' ? 'en' : 'es' } catch { return 'es' }
}
function cachedUser(): AccountUser | null {
  try {
    const u = JSON.parse(localStorage.getItem(LS_USER) || 'null')
    return u && u.id === cacheOwner() ? u : null
  } catch { return null }
}

type Phase = { phase: 'loading' } | { phase: 'login' } | { phase: 'offline' } | { phase: 'ready'; user: AccountUser }

/**
 * Decides between the sign-in screen and the app. With no connection, the
 * last signed-in account's copy of the library opens as it is, and changes
 * are sent once the server is back.
 */
export default function Root() {
  const [state, setState] = useState<Phase>({ phase: 'loading' })

  const start = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      const { user } = await api.get<{ user: AccountUser }>('/api/auth/me')
      await adoptCacheFor(user.id)
      localStorage.setItem(LS_USER, JSON.stringify(user))
      setState({ phase: 'ready', user })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { setState({ phase: 'login' }); return }
      const user = cachedUser()
      setState(user ? { phase: 'ready', user } : { phase: 'offline' })
    }
  }, [])

  useEffect(() => { void start() }, [start])

  useEffect(() => {
    const signedOut = () => setState({ phase: 'login' })
    // Reopening the app shows changes made on other devices.
    const visible = () => { if (document.visibilityState === 'visible') void useStore.getState().loadLibrary() }
    const online = () => { void flushOutbox() }
    window.addEventListener(SIGNED_OUT_EVENT, signedOut)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('online', online)
    return () => {
      window.removeEventListener(SIGNED_OUT_EVENT, signedOut)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('online', online)
    }
  }, [])

  const signOut = useCallback(async () => {
    await forgetLocalCopy()
    try { await api.post('/api/auth/logout') } catch { /* offline: this screen still signs out */ }
    try { localStorage.removeItem(LS_USER) } catch { /* ignore */ }
    useStore.setState({ library: {} })
    setState({ phase: 'login' })
  }, [])

  if (state.phase === 'login') return <Login lang={cachedLang()} onSignedIn={start} />
  if (state.phase === 'ready') {
    return (
      <AccountContext.Provider value={{ user: state.user, signOut }}>
        <App key={state.user.id} />
      </AccountContext.Provider>
    )
  }

  const t = getT(cachedLang()).account
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ height: '100%', background: 'var(--bg)' }}>
      {state.phase === 'offline' ? (
        <div className="rounded-3xl glass px-6 py-6">
          <p className="font-bold text-white">{t.cantReach}</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{t.checkConnection}</p>
          <button type="button" onClick={start} className="rounded-2xl font-bold transition-all active:scale-95"
            style={{ marginTop: 16, padding: '10px 24px', fontSize: 14, background: 'var(--accent-grad)', color: '#1A1030', boxShadow: 'var(--glow-accent)' }}>
            {t.tryAgain}
          </button>
        </div>
      ) : (
        <span className="animate-spin rounded-full" aria-label="Loading"
          style={{ width: 32, height: 32, border: '2px solid var(--border-dim)', borderTopColor: 'var(--accent)' }} />
      )}
    </div>
  )
}
