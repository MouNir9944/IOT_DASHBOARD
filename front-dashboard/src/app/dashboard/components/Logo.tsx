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
    lg: 'w-40 h-10' // Increased from w-32 h-8 to w-40 h-10
  };

  const imageDimensions = {
    sm: { width: 24, height: 24 },
    md: { width: 32, height: 32 },
    lg: { width: 160, height: 40 } // Increased from 128x32 to 160x40
  };

  const currentSize = imageDimensions[size];

  return (
    <div className={`${sizeClasses[size]} ${className} flex-shrink-0`}>
      <Image
        src={src}
        alt={alt}
        width={currentSize.width}
        height={currentSize.height}
        className="w-full h-full object-contain"
        priority
        quality={95} // Ensure high quality rendering
      />
    </div>
  );
}
