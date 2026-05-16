'use client'

import { useCallback, useEffect, useState } from 'react'
import UploadDropzone from '@/components/UploadDropzone'
import PresetCard from '@/components/PresetCard'
import ChaosSlider from '@/components/ChaosSlider'
import OutputFormatSelector from '@/components/OutputFormatSelector'
import LocalFirstBadge from '@/components/LocalFirstBadge'
import GenerateButton from '@/components/GenerateButton'
import PackStatusCard from '@/components/PackStatusCard'
import Footer from '@/components/Footer'
import { api } from '@/lib/api'
import { PRESETS } from '@/lib/presets'
import { Capabilities, PackStatusResponse } from '@/lib/types'

export default function Home() {
  const [files, setFiles] = useState<File[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESETS[0].id)
  const [chaos, setChaos] = useState(0.33)
  const [outputFormat, setOutputFormat] = useState('wav')
  const [packId, setPackId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)

  useEffect(() => {
    api
      .getCapabilities()
      .then(setCapabilities)
      .catch(() => {
        setCapabilities({
          presets: PRESETS,
          chaos_levels: { min: 0, max: 1, step: 0.01 },
          output_formats: ['wav', 'aiff', 'flac'],
          accepted_extensions: ['wav', 'aiff', 'flac', 'mp3', 'm4a', 'ogg'],
          max_upload_mb: 50,
          max_duration_seconds: 600,
          tools: {},
        })
      })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (files.length === 0 || !selectedPreset || isProcessing) return

    setIsProcessing(true)
    setError(null)
    setPackId(null)

    try {
      const packName =
        files.length === 1
          ? files[0].name.replace(/\.[^.]+$/, '')
          : `pack-${Date.now()}`

      const response = await api.createPack(
        files,
        selectedPreset,
        chaos,
        outputFormat,
        packName,
      )
      setPackId(response.pack_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create pack')
      setIsProcessing(false)
    }
  }, [files, selectedPreset, chaos, outputFormat, isProcessing])

  const handlePackComplete = useCallback(
    (_status: PackStatusResponse) => {
      setIsProcessing(false)
    },
    [],
  )

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start sm:items-center gap-4 flex-wrap">
            <img
              src="/wyt-logo.png"
              alt=""
              className="h-20 w-20 sm:h-40 sm:w-40 object-contain opacity-85 shrink-0"
            />
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight mt-2 sm:mt-0">
              <span className="text-foreground">Resample</span>
              <span className="text-accent">-Lab</span>
            </h1>
            <LocalFirstBadge />
          </div>
          <p className="text-sm text-zinc-500">
            Turn any sound into a sample pack. Non-AI DSP, fully local.
          </p>
        </div>

        {/* Upload */}
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Source Audio
          </h2>
          <UploadDropzone
            onFilesSelected={setFiles}
            acceptedExtensions={
              capabilities?.accepted_extensions || [
                'wav', 'aiff', 'flac', 'mp3', 'm4a', 'ogg',
              ]
            }
            maxUploadMb={capabilities?.max_upload_mb || 50}
          />
        </section>

        {/* Preset Selection */}
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-accent">
            Preset
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(capabilities?.presets || PRESETS).map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isSelected={selectedPreset === preset.id}
                onSelect={setSelectedPreset}
              />
            ))}
          </div>
        </section>

        {/* Chaos + Format */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <ChaosSlider value={chaos} onChange={setChaos} />
          </div>
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-accent mb-3">
              Format
            </h2>
            <OutputFormatSelector
              value={outputFormat}
              onChange={setOutputFormat}
              formats={capabilities?.output_formats || ['wav', 'aiff', 'flac']}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-accent-dim/50 bg-accent-dim/10 p-3">
            <p className="text-sm text-accent">{error}</p>
          </div>
        )}

        {/* Generate */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
        >
          <GenerateButton
            disabled={files.length === 0 || isProcessing}
            isProcessing={isProcessing}
          />
        </form>

        {/* Pack Status */}
        {packId && (
          <PackStatusCard
            key={packId}
            packId={packId}
            onComplete={handlePackComplete}
          />
        )}
      </main>

      <Footer />
    </div>
  )
}
