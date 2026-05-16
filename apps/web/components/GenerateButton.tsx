'use client'

interface GenerateButtonProps {
  disabled: boolean
  isProcessing: boolean
}

export default function GenerateButton({ disabled, isProcessing }: GenerateButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`w-full py-3 px-6 rounded-lg font-medium text-sm transition-all ${
        disabled
          ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          : 'bg-accent text-black hover:bg-accent-glow active:scale-[0.98] shadow-lg shadow-accent-dim/20'
      }`}
    >
      {isProcessing ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Generating...
        </span>
      ) : (
        'Generate Pack'
      )}
    </button>
  )
}
