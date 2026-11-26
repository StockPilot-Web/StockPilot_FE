import React from 'react';

/**
 * Pilot AI Glowing "S" Logo Component.
 * Supports various preset sizes and custom styling.
 */
export function StockPilotAILogo({
  size = 'md',
  variant = 'transparent',
  className = '',
  style = {},
  alt = 'Pilot AI Logo',
}) {
  const sizeMap = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
    '2xl': 'w-16 h-16',
  };

  const sizeClass = sizeMap[size] || size;
  const imageSrc = '/stockpilot-ai-logo-transparent.png';

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={`object-contain shrink-0 select-none ${sizeClass} ${className}`}
      style={{
        ...style,
      }}
      loading="eager"
      onError={(e) => {
        // Fallback to square if transparent not found
        if (variant === 'transparent') {
          e.target.src = '/stockpilot-ai-logo.png';
        }
      }}
    />
  );
}

