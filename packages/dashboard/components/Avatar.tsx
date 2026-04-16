export function Avatar({
  src,
  name,
  size = 'md',
  rank
}: {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg'
  rank?: number
}) {
  const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
  }

  const rankRingMap = {
    1: 'ring-2 ring-yellow-500',
    2: 'ring-2 ring-gray-400',
    3: 'ring-2 ring-orange-600',
  }

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className={`relative ${sizeMap[size]} flex items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 font-semibold text-white overflow-hidden ${rank ? rankRingMap[rank as 1 | 2 | 3] : ''}`}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  )
}
