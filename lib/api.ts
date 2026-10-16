/* Talking to RoscaTV's own server (only in builds with NEXT_PUBLIC_SERVER_SYNC=1). */

export const SERVER_SYNC = process.env.NEXT_PUBLIC_SERVER_SYNC === '1'

/** Error from the server, with its HTTP status (0 = no connection). */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    throw new ApiError(0, 'No connection')
  }
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { /* not JSON */ }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`)
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}

/** Fired when the server says the session is gone; the sign-in screen listens. */
export const SIGNED_OUT_EVENT = 'roscatv:signed-out'
export function signalSignedOut(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
}
