'use client'
import { useRef } from 'react'
import { useStore } from '@/lib/store'
import { exportLibrary, importLibrary } from '@/lib/db'
import { prewarmConfig, syncItemFull } from '@/lib/mediaSync'
import { resolveId } from '@/hooks/usePosterSync'
import { useT, type Lang, type Translations } from '@/lib/i18n'
import { useAccount } from '@/components/auth/account'
import type { ExportData, LibraryItem } from '@/lib/types'

const REGIONS = [
  {code:'AR',name:'Argentina'},{code:'AU',name:'Australia'},{code:'BR',name:'Brazil'},
  {code:'CA',name:'Canada'},{code:'DE',name:'Germany'},{code:'ES',name:'Spain'},
  {code:'FR',name:'France'},{code:'GB',name:'United Kingdom'},{code:'IT',name:'Italy'},
  {code:'JP',name:'Japan'},{code:'KR',name:'South Korea'},{code:'MX',name:'Mexico'},
  {code:'US',name:'United States'},
]

function normaliseItem(raw: Record<string,unknown>): LibraryItem | null {
  const rawId = raw['id'] ?? raw['tmdb_id']
  const id = typeof rawId==='number' ? rawId : typeof rawId==='string' ? parseInt(rawId,10) : NaN
  if (!id || isNaN(id) || id<=0) return null
  const rawMedia = String(raw['mediaType']||raw['media_type']||raw['type']||'')
  const mediaType: 'movie'|'tv' = rawMedia==='movie' ? 'movie' : 'tv'
  const rawType = String(raw['type']||raw['media_type']||'')
  let type: 'movies'|'series'|'anime' = 'series'
  if (rawType==='movies'||rawMedia==='movie') type='movies'
  else if (rawType==='anime') type='anime'
  const rawStatus = raw['status']
  const VALID_STATUSES = ['pending','watching','watched'] as const
  const status = typeof rawStatus === 'string' && (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as 'pending'|'watching'|'watched')
    : null
  const title = String(raw['title']||raw['name']||'')
  if (!title) return null
  return { id, mediaType, type, title, year:String(raw['year']||''), poster:String(raw['poster']||''),
    tmdbRating:String(raw['tmdbRating']||raw['tmdb_rating']||'—'), status,
    userRating: typeof raw['userRating']==='number' ? raw['userRating'] : typeof raw['global_rating']==='number' ? (raw['global_rating'] as number) : undefined,
    seasonData:(raw['seasonData'] as LibraryItem['seasonData'])??{}, notes:String(raw['notes']||''),
    addedAt: typeof raw['addedAt']==='number' ? raw['addedAt'] : Date.now(),
    updatedAt: typeof raw['updatedAt']==='number' ? raw['updatedAt'] : Date.now(),
    imdbId:typeof raw['imdbId']==='string'?raw['imdbId']:undefined,
    imdbRating:typeof raw['imdbRating']==='string'?raw['imdbRating']:undefined,
    rottenTomatoes:typeof raw['rottenTomatoes']==='string'?raw['rottenTomatoes']:undefined,
    metacritic:typeof raw['metacritic']==='string'?raw['metacritic']:undefined,
    rated:typeof raw['rated']==='string'?raw['rated']:undefined,
    runtime:typeof raw['runtime']==='string'?raw['runtime']:undefined,
    director:typeof raw['director']==='string'?raw['director']:undefined,
  }
}

async function hydrateBatch(items: LibraryItem[], upsertItem: (i:LibraryItem)=>Promise<void>, showToast:(m:string)=>void, t: Translations): Promise<void> {
  const needsWork = items.filter(it => !it.poster||it.poster===''||!it.imdbRating)
  if (!needsWork.length) return
  try { await prewarmConfig() } catch {}
  const BATCH=3; let synced=0
  for (let i=0; i<needsWork.length; i+=BATCH) {
    await Promise.all(needsWork.slice(i,i+BATCH).map(async item => {
      const ownId=resolveId(item); if (!ownId) return
      try { const u=await syncItemFull(item,ownId); await upsertItem(u); synced++ } catch {}
    }))
    if (i+BATCH<needsWork.length) await new Promise<void>(r=>setTimeout(r,300))
  }
  if (synced>0) showToast(t.settings.syncedToast(synced))
}

const LANGUAGES: { code: Lang; label: string }[] = [{ code: 'en', label: 'English' }, { code: 'es', label: 'Español' }]

export default function SettingsScreen() {
  const t = useT()
  const { settings, updateSettings, showToast, loadLibrary:reloadLib, upsertItem } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const account = useAccount()

  const handleExport = async () => {
    const data = await exportLibrary()
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob)
    a.download=`rosca-library-${new Date().toISOString().slice(0,10)}.json`; a.click()
    showToast(t.settings.exportedToast)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if (!file) return; e.target.value=''
    let data: ExportData
    try { data=JSON.parse(await file.text()) } catch { showToast(t.settings.cannotParseJson); return }
    if (!data.library||typeof data.library!=='object') { showToast(t.settings.missingLibraryKey); return }
    const normalised=(Object.values(data.library) as Array<Record<string,unknown>>).map(normaliseItem).filter((it): it is LibraryItem => it!==null)
    if (!normalised.length) { showToast(t.settings.noValidItems); return }
    await importLibrary({...data,library:Object.fromEntries(normalised.map(i=>[i.id,i]))})
    await reloadLib()
    showToast(t.settings.importedToast(normalised.length))
    hydrateBatch(normalised,upsertItem,showToast,t)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background:'transparent', paddingTop:'env(safe-area-inset-top,0px)' }}>
      <div className="flex flex-col gap-5 px-4 pt-5" style={{ paddingBottom: 'calc(var(--nav-h) + 32px)' }}>
        <p className="font-black uppercase tracking-widest gradient-text" style={{ fontSize:12 }}>{t.settings.preferences}</p>

        <Card title={t.settings.language}>
          <div className="flex gap-2">
            {LANGUAGES.map(l => {
              const active = settings.language === l.code
              return (
                <button key={l.code} onClick={() => updateSettings({ language: l.code })} aria-pressed={active}
                  className="flex-1 rounded-2xl font-bold transition-all active:scale-95"
                  style={{
                    padding: '10px 0', fontSize: 13,
                    background: active ? 'var(--accent-grad)' : 'var(--surface-3)',
                    color:      active ? '#1A1030' : 'var(--text-muted)',
                    border:     active ? 'none' : '1px solid var(--border-dim)',
                    boxShadow:  active ? 'var(--glow-accent)' : 'none',
                  }}>
                  {l.label}
                </button>
              )
            })}
          </div>
        </Card>

        <Card title={t.settings.streamingRegion}>
          <div className="relative">
            <select value={settings.region} onChange={e=>{updateSettings({region:e.target.value});showToast(t.settings.regionChangedToast(e.target.value))}}
              aria-label={t.settings.streamingRegionAria} className="w-full appearance-none rounded-2xl px-4 py-3 text-[14px] text-white pr-8"
              style={{ background:'var(--surface-3)', border:'1px solid var(--border-dim)', minHeight:44 }}>
              {REGIONS.map(r=><option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" style={{ fontSize:11, color:'var(--accent)' }}>▾</span>
          </div>
        </Card>

        <Card title={t.settings.exportLibrary}>
          <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>{t.settings.exportHint}</p>
          <Btn label={t.settings.downloadBtn} icon={<DownloadIcon />} onClick={handleExport} />
        </Card>

        <Card title={t.settings.importLibrary}>
          <div className="rounded-2xl p-3.5 mb-3.5" style={{ background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.25)' }}>
            <p className="font-bold mb-2 flex items-center gap-1.5" style={{ fontSize:11, color:'var(--accent)' }}>
              <WarningIcon /> {t.settings.readBeforeImporting}
            </p>
            <ol className="flex flex-col gap-1.5" role="list">
              {t.settings.importSteps.map((s,i)=>(
                <li key={i} className="flex gap-2" style={{ fontSize:11, color:'var(--text-muted)' }}>
                  <span style={{ color:'var(--text-faint)', flexShrink:0 }}>{i+1}.</span>{s}
                </li>
              ))}
            </ol>
          </div>
          <Btn label={t.settings.importBtn} icon={<UploadIcon />} onClick={()=>fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} aria-hidden="true" />
        </Card>

        {account && (
          <Card title={t.account.title}>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>{t.account.signedInAs(account.user.displayName || account.user.username)}</p>
            <Btn label={t.account.signOut} icon={<SignOutIcon />} onClick={account.signOut} />
          </Card>
        )}

        <p className="text-center" style={{ fontSize:10, color:'var(--text-faint)' }}>{account ? t.account.syncedNote : t.settings.localDataNote}</p>
      </div>
    </div>
  )
}

function Card({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div className="rounded-3xl overflow-hidden glass">
      <div className="px-4 py-3.5" style={{ borderBottom:'1px solid var(--border-dim)' }}>
        <p className="font-black text-white uppercase tracking-widest" style={{ fontSize:11 }}>{title}</p>
      </div>
      <div className="px-4 py-3.5">{children}</div>
    </div>
  )
}
function Btn({ label, icon, onClick }: { label:string; icon:React.ReactNode; onClick:()=>void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 rounded-2xl font-semibold text-white transition-opacity active:opacity-60"
      style={{ background:'var(--surface-3)', border:'1px solid var(--border-dim)', padding:'12px 16px', fontSize:14, minHeight:44 }}>
      <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width:26, height:26, background:'var(--accent-grad)', color:'#1A1030' }} aria-hidden="true">{icon}</span>{label}
    </button>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}
function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}
function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}
function WarningIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}
