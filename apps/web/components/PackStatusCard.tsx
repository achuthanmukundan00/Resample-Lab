'use client'

import { useEffect, useRef, useState } from 'react'
import { PackStatusResponse } from '@/lib/types'
import { PackManifest } from '@/lib/dsp/types'
import { api } from '@/lib/api'
import { MICRO_MESSAGES } from '@/lib/microcopy'

const POLL_TIMEOUT_MS = 60_000

interface PackStatusCardProps {
  /** API polling mode (legacy backend path) */
  packId?: string
  onComplete?: (status: PackStatusResponse) => void

  /** Local processing mode */
  localStatus?: 'idle' | 'processing' | 'complete' | 'error'
  localProgress?: number
  localMessage?: string
  manifest?: PackManifest | null
  onLocalDownload?: () => void
  onReset?: () => void
}

export default function PackStatusCard({
  packId,
  onComplete,
  localStatus,
  localProgress = 0,
  localMessage,
  manifest,
  onLocalDownload,
  onReset,
}: PackStatusCardProps) {
  const [status, setStatus] = useState<PackStatusResponse | null>(null)
  const [microIndex, setMicroIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const startTime = useRef(Date.now())

  // ---- API polling mode ----
  useEffect(() => {
    if (!packId) return

    let cancelled = false
    startTime.current = Date.now()

    const poll = async () => {
      if (cancelled) return
      if (Date.now() - startTime.current > POLL_TIMEOUT_MS) {
        setError(
          `Pack generation timed out after ${POLL_TIMEOUT_MS / 1000}s. The backend may be busy or unavailable.`,
        )
        return
      }

      try {
        const s = await api.getPackStatus(packId)
        if (cancelled) return
        setStatus(s)

        if (s.status === 'completed' || s.status === 'failed') {
          onComplete?.(s)
          return
        }
        setTimeout(poll, 1500)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to fetch status')
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [packId, onComplete])

  // Micro-message rotation (for both modes)
  const isActive = packId
    ? status?.status === 'processing'
    : localStatus === 'processing'

  useEffect(() => {
    if (!isActive) return
    const t = setInterval(() => {
      setMicroIndex((i) => (i + 1) % MICRO_MESSAGES.length)
    }, 3000)
    return () => clearInterval(t)
  }, [isActive])

  // ---- Error display ----
  const displayError = error || (localStatus === 'error' ? localMessage : null)

  if (displayError) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
        <p className="text-sm text-red-400">{displayError}</p>
        {localMessage && localMessage !== displayError && (
          <p className="text-xs text-zinc-500 mt-1">{localMessage}</p>
        )}
        {onReset && (
          <button
            onClick={onReset}
            className="mt-3 text-xs text-zinc-500 hover:text-zinc-400 underline"
          >
            Dismiss
          </button>
        )}
      </div>
    )
  }

  // ---- Local mode ----
  if (localStatus) {
    if (localStatus === 'idle') return null

    const progress = Math.min(1, Math.max(0, localProgress))

    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {localStatus === 'complete' ? 'completed' : 'processing'}
          </span>
          <span className="text-xs font-mono text-accent">
            {Math.round(progress * 100)}%
          </span>
        </div>

        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500 shadow-sm shadow-accent-dim/30"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {localStatus === 'processing' && (
          <p className="text-xs text-zinc-500 italic">
            {localMessage || MICRO_MESSAGES[microIndex]}
          </p>
        )}

        {localStatus === 'complete' && (
          <div className="space-y-2">
            <button
              onClick={onLocalDownload}
              className="w-full py-2 px-4 rounded-lg bg-accent text-black hover:bg-accent-glow text-sm font-medium transition-colors shadow-lg shadow-accent-dim/20"
            >
              Download Pack
            </button>
            {manifest && (
              <details className="text-xs">
                <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400">
                  View manifest
                </summary>
                <pre className="mt-2 p-2 rounded bg-zinc-950 text-zinc-500 overflow-x-auto max-h-48 overflow-y-auto">
                  {JSON.stringify(manifest, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    )
  }

  // ---- API polling mode (legacy) ----
  if (!status) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 animate-pulse">
        <div className="h-4 w-24 bg-zinc-800 rounded mb-3" />
        <div className="h-2 bg-zinc-800 rounded-full" />
      </div>
    )
  }

  const handleDownload = async () => {
    if (!packId) return
    try {
      await api.downloadPack(packId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {status.status}
        </span>
        <span className="text-xs font-mono text-accent">
          {Math.round(status.progress * 100)}%
        </span>
      </div>

      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 shadow-sm shadow-accent-dim/30"
          style={{ width: `${status.progress * 100}%` }}
        />
      </div>

      {status.status === 'processing' && (
        <p className="text-xs text-zinc-500 italic">
          {MICRO_MESSAGES[microIndex]}
        </p>
      )}

      {status.status === 'completed' && (
        <div className="space-y-2">
          <button
            onClick={handleDownload}
            className="w-full py-2 px-4 rounded-lg bg-accent text-black hover:bg-accent-glow text-sm font-medium transition-colors shadow-lg shadow-accent-dim/20"
          >
            Download Pack
          </button>
          {status.manifest && (
            <details className="text-xs">
              <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400">
                View manifest
              </summary>
              <pre className="mt-2 p-2 rounded bg-zinc-950 text-zinc-500 overflow-x-auto max-h-48 overflow-y-auto">
                {JSON.stringify(status.manifest, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {status.status === 'failed' && (
        <p className="text-xs text-red-400">
          {status.error || 'Generation failed'}
        </p>
      )}
    </div>
  )
}
