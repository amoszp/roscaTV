'use client'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { getT, type Lang } from '@/lib/i18n'
import { WordMark } from '../App'

/** Sign in, or create an account (it works straight away). */
export default function Login({ lang, onSignedIn }: { lang: Lang; onSignedIn: () => void }) {
  const t = getT(lang).account
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [form, setForm] = useState({ name: '', username: '', password: '', password2: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const signup = mode === 'signup'

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
  })

  const errorFor = (err: unknown) => {
    const status = err instanceof ApiError ? err.status : 0
    if (status === 0) return t.errOffline
    if (status === 409) return t.errTaken
    if (status === 429) return t.errTooMany
    if (signup && status === 400 && err instanceof Error) return err.message
    return t.errWrong
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (signup && form.password !== form.password2) { setError(t.passwordsDiffer); return }
    setBusy(true); setError('')
    try {
      if (signup) await api.post('/api/auth/signup', { displayName: form.name.trim(), username: form.username.trim(), password: form.password })
      else await api.post('/api/auth/login', { username: form.username.trim(), password: form.password })
      onSignedIn()
    } catch (err) {
      setError(errorFor(err)); setBusy(false)
    }
  }

  const input = 'w-full rounded-2xl px-4 text-[15px] text-white outline-none'
  const inputStyle = { background: 'var(--surface-3)', border: '1px solid var(--border-dim)', minHeight: 48 }

  return (
    <div className="flex items-center justify-center overflow-y-auto px-5"
      style={{ height: '100%', background: 'var(--bg)', paddingTop: 'max(24px, env(safe-area-inset-top))', paddingBottom: 24 }}>
      <form onSubmit={submit} className="w-full rounded-3xl glass p-6" style={{ maxWidth: 380 }}>
        <div className="flex justify-center"><WordMark size={30} /></div>
        <p className="text-center font-bold text-white" style={{ marginTop: 14, fontSize: 18 }}>{signup ? t.createTitle : t.signIn}</p>
        <p className="text-center" style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>{signup ? t.createSub : t.signInTitle}</p>

        <div className="flex flex-col gap-3" style={{ marginTop: 22 }}>
          {signup && <input {...field('name')} name="name" className={input} style={inputStyle} placeholder={t.name} aria-label={t.name} autoComplete="name" maxLength={40} required />}
          <input {...field('username')} name="username" className={input} style={inputStyle} placeholder={t.username} aria-label={t.username}
            autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={32} required />
          <input {...field('password')} name="password" type="password" className={input} style={inputStyle} placeholder={t.password} aria-label={t.password}
            autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 4 : undefined} required />
          {signup && <input {...field('password2')} name="password2" type="password" className={input} style={inputStyle} placeholder={t.repeatPassword}
            aria-label={t.repeatPassword} autoComplete="new-password" minLength={4} required />}
        </div>
        {signup && <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)' }}>{t.usernameHint}</p>}

        {error && (
          <p role="alert" className="rounded-2xl" style={{ marginTop: 14, padding: '10px 14px', fontSize: 13, color: '#FDA4AF', background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.35)' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="w-full rounded-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ marginTop: 18, minHeight: 48, fontSize: 15, background: 'var(--accent-grad)', color: '#1A1030', boxShadow: 'var(--glow-accent)' }}>
          {busy ? t.oneMoment : signup ? t.create : t.signIn}
        </button>
        <button type="button" onClick={() => { setMode(signup ? 'login' : 'signup'); setError('') }}
          className="w-full transition-opacity active:opacity-60" style={{ marginTop: 10, padding: '8px 0', fontSize: 13, color: 'var(--text-muted)' }}>
          {signup ? t.toLogin : t.toSignup}
        </button>
      </form>
    </div>
  )
}
