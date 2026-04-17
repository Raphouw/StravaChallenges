import React from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ src, alt, size = 'md' }: AvatarProps) {
  const sizeStyles = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
  };

  const initials = alt
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`${sizeStyles[size]} rounded-full bg-gradient-to-br from-purple-600 to-blue-600 overflow-hidden flex items-center justify-center flex-shrink-0`}>
      {src ? (
        <img src={src} alt={alt || 'User'} className="w-full h-full object-cover" />
      ) : (
        <span className="text-white font-semibold">
          {initials}
        </span>
      )}
    </div>
  );
}
