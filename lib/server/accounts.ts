import { NextResponse } from 'next/server'

/*
 * Client for the shared accounts service (users, sessions, API keys), reached
 * over a private network. RoscaTV stores no passwords itself.
 */

const ACCOUNTS_URL = () => process.env.ACCOUNTS_URL ?? 'http://accounts:4600'
const SERVICE_TOKEN = () => process.env.ACCOUNTS_SERVICE_TOKEN ?? ''
const APP_NAME = 'roscatv'

export const SESSION_COOKIE = 'roscatv_session'
const SESSION_MAX_AGE_SECONDS = 180 * 86_400
const COOKIE_SECURE = () => (process.env.COOKIE_SECURE ?? 'true') !== 'false'

export interface User {
  id: number
  username: string
  displayName: string
  isAdmin: boolean
}

export class AccountsUnavailable extends Error {}

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  let res: Response
  try {
    res = await fetch(`${ACCOUNTS_URL()}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-service-token': SERVICE_TOKEN() },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
  } catch (err) {
    throw new AccountsUnavailable(String(err))
  }
  if (res.status >= 500) throw new AccountsUnavailable(`accounts service answered ${res.status}`)
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

export interface Client {
  ip?: string
  device?: string
}

// Behind Cloudflare the visitor's address arrives in CF-Connecting-IP.
export function clientInfo(req: Request): Client {
  const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim().slice(0, 64) || undefined
  const device = (req.headers.get('user-agent') ?? '').slice(0, 300) || undefined
  return { ip, device }
}

export const login = (username: string, password: string, client: Client) =>
  call('POST', '/v1/login', { username, password, app: APP_NAME, ...client })

export const signup = (username: string, password: string, displayName: string, client: Client) =>
  call('POST', '/v1/signup', { username, password, displayName, app: APP_NAME, ...client })

export async function logout(token: string): Promise<void> {
  await call('POST', '/v1/logout', { token })
}

// Verified tokens are cached briefly so a burst of requests costs one lookup.
const verifyCache = new Map<string, { user: User; until: number }>()
const VERIFY_CACHE_MS = 30_000

export async function verify(token: string): Promise<User | null> {
  const cached = verifyCache.get(token)
  if (cached && cached.until > Date.now()) return cached.user
  const { status, data } = await call('POST', '/v1/verify', { token })
  if (status !== 200) {
    verifyCache.delete(token)
    return null
  }
  verifyCache.set(token, { user: data.user, until: Date.now() + VERIFY_CACHE_MS })
  return data.user
}

export function forgetToken(token: string): void {
  verifyCache.delete(token)
}

export function readToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join('=')) || null
  }
  return null
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    path: '/', httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE_SECONDS, secure: COOKIE_SECURE(),
  })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 0, secure: COOKIE_SECURE() })
}

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * Wraps a route that needs a signed-in user: 401 without a valid session or
 * API key, 503 when the accounts service can't be reached.
 */
export function withUser<C>(handler: (req: Request, user: User, ctx: C) => Promise<Response> | Response) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const token = readToken(req)
    if (!token) return json({ error: 'login required' }, 401)
    let user: User | null
    try {
      user = await verify(token)
    } catch (err) {
      if (err instanceof AccountsUnavailable) return json({ error: 'accounts service unavailable' }, 503)
      throw err
    }
    if (!user) return json({ error: 'login required' }, 401)
    return handler(req, user, ctx)
  }
}

/** Reads a JSON body; null if it isn't JSON. */
export async function readJson(req: Request): Promise<any> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
