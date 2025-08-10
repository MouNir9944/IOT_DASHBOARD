import React from 'react';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  src?: string;
  alt?: string;
}

export default function Logo({ 
  className = '', 
  size = 'md', 
  src = '/logo.png', // Default logo path - place your logo.png in the public folder
  alt = 'DigiSmart Logo'
}: LogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-32 h-30'
  };

  return (
    <div className={`${sizeClasses[size]} ${className} flex-shrink-0`}>
      <Image
        src={src}
        alt={alt}
        width={size === 'sm' ? 24 : size === 'md' ? 32 : 40}
        height={size === 'sm' ? 24 : size === 'md' ? 32 : 40}
        className="w-full h-full object-contain"
        priority
      />
    </div>
  );
}
