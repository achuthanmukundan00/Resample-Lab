'use client'

import { useCallback, useRef, useState } from 'react'

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void
  acceptedExtensions: string[]
  maxUploadMb: number
}

export default function UploadDropzone({
  onFilesSelected,
  acceptedExtensions,
  maxUploadMb,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [fileNames, setFileNames] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true)
    } else if (e.type === 'dragleave') {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        setFileNames(files.map((f) => f.name))
        onFilesSelected(files)
      }
    },
    [onFilesSelected],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        setFileNames(files.map((f) => f.name))
        onFilesSelected(files)
      }
    },
    [onFilesSelected],
  )

  const extStr = acceptedExtensions.join(', ')

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
        isDragging
          ? 'border-accent bg-accent-dim/15'
          : 'border-zinc-700 hover:border-accent-dim bg-zinc-900/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedExtensions.map((e) => `.${e}`).join(',')}
        onChange={handleFileInput}
        className="hidden"
      />
      {fileNames.length > 0 ? (
        <div>
          <p className="text-sm text-zinc-300 mb-1">
            {fileNames.length} file(s) selected
          </p>
          <p className="text-xs text-zinc-500 truncate max-w-xs mx-auto">
            {fileNames.join(', ')}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-zinc-400 mb-2">
            Drop audio files here or click to browse
          </p>
          <p className="text-xs text-zinc-600">
            Accepted: {extStr} (max {maxUploadMb}MB)
          </p>
        </div>
      )}
    </div>
  )
}
