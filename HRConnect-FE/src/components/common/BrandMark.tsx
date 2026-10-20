import React from 'react';

interface BrandMarkProps {
  /** Rendered size in px (square). */
  size?: number;
  /** `dark`: navy tile, white H (default). `light`: white tile, blue H, for dark backgrounds. */
  tone?: 'dark' | 'light';
  className?: string;
}

/**
 * HR Connect logo (chosen 20/10, concept "H mạng kết nối"): two H stems joined by a wave link,
 * with two nodes under the stems. Same drawing as public/favicon.svg.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 36, tone = 'dark', className }) => {
  const tile = tone === 'dark' ? '#0C4A6E' : '#FFFFFF';
  const stem = tone === 'dark' ? '#FFFFFF' : '#0369A1';
  const link = tone === 'dark' ? '#38BDF8' : '#0EA5E9';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="HR Connect">
      <rect width="64" height="64" rx="15" fill={tile} />
      <rect x="16" y="13" width="9" height="30" rx="4.5" fill={stem} />
      <rect x="39" y="13" width="9" height="30" rx="4.5" fill={stem} />
      <path d="M20.5 28.5 C27 22.5, 37 34.5, 43.5 28.5" stroke={link} strokeWidth="5.5" fill="none" strokeLinecap="round" />
      <circle cx="20.5" cy="51" r="3.6" fill={link} />
      <circle cx="43.5" cy="51" r="3.6" fill={link} />
    </svg>
  );
};

export default BrandMark;
