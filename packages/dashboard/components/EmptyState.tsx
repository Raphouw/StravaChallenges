export function EmptyState({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <div className="text-center py-12 bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg">
      <div className="text-5xl mb-4">🏔️</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  )
}
