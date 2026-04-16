export function Badge({
  type
}: {
  type: 'count' | 'time' | 'elevation' | 'active' | 'ended'
}) {
  const styles = {
    count: 'bg-blue-900/30 text-blue-300 border-blue-700/50',
    time: 'bg-purple-900/30 text-purple-300 border-purple-700/50',
    elevation: 'bg-orange-900/30 text-orange-300 border-orange-700/50',
    active: 'bg-green-900/30 text-green-300 border-green-700/50',
    ended: 'bg-gray-700/30 text-gray-300 border-gray-600/50',
  }

  const labels = {
    count: 'COUNT',
    time: 'TIME',
    elevation: 'ELEVATION',
    active: 'ACTIVE',
    ended: 'ENDED',
  }

  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-semibold border rounded-md ${styles[type]}`}>
      {labels[type]}
    </span>
  )
}
