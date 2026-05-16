export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 py-6 mt-auto">
      <div className="max-w-2xl mx-auto px-4 flex flex-col items-center gap-2 text-xs text-zinc-600">
        <p>
          <span className="text-accent">Resample</span>-Lab — Local-first audio mutation lab
        </p>
        <p>Powered by non-AI DSP (ffmpeg + numpy + scipy)</p>
      </div>
    </footer>
  )
}
