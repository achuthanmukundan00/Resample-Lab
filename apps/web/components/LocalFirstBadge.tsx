export default function LocalFirstBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-400">
      <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-sm shadow-accent-dim/50" />
      Local-First — No Cloud Upload
    </div>
  )
}
