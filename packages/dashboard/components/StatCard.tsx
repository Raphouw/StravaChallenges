export function StatCard({
  icon,
  label,
  value
}: {
  icon: string
  label: string
  value: string | number
}) {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}
