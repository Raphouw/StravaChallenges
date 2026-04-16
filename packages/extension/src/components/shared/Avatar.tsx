import React from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ src, alt, size = 'md' }: AvatarProps) {
  const sizeStyles = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <div className={`${sizeStyles[size]} rounded-full bg-gray-300 overflow-hidden flex items-center justify-center`}>
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span className="text-gray-600 text-sm font-semibold">
          {alt.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
