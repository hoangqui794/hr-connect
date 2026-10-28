import React, { useState } from 'react';

export interface CompanyLogoProps {
  id?: string;
  name?: string;
  companyName?: string;
  logoUrl?: string | null;
  className?: string;
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Deterministic color palette generator for companies based on name hash
 */
const BRAND_GRADIENTS = [
  { from: '#2563eb', to: '#06b6d4', text: '#ffffff', iconBg: 'rgba(255,255,255,0.2)' },
  { from: '#4f46e5', to: '#7c3aed', text: '#ffffff', iconBg: 'rgba(255,255,255,0.2)' },
  { from: '#059669', to: '#10b981', text: '#ffffff', iconBg: 'rgba(255,255,255,0.2)' },
  { from: '#d97706', to: '#f59e0b', text: '#ffffff', iconBg: 'rgba(255,255,255,0.2)' },
  { from: '#e11d48', to: '#f43f5e', text: '#ffffff', iconBg: 'rgba(255,255,255,0.2)' },
  { from: '#0284c7', to: '#38bdf8', text: '#ffffff', iconBg: 'rgba(255,255,255,0.2)' },
  { from: '#0d9488', to: '#14b8a6', text: '#ffffff', iconBg: 'rgba(255,255,255,0.2)' },
  { from: '#9333ea', to: '#c084fc', text: '#ffffff', iconBg: 'rgba(255,255,255,0.2)' },
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % BRAND_GRADIENTS.length;
  return BRAND_GRADIENTS[index];
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  id = '',
  name = '',
  companyName = '',
  logoUrl,
  className = '',
  size = 38,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  // Normalize effective size in pixels
  const pxSize =
    typeof size === 'number'
      ? size
      : size === 'sm'
        ? 32
        : size === 'md'
          ? 40
          : size === 'lg'
            ? 48
            : 64;

  const displayName = (companyName || name || 'Doanh nghiệp').trim();
  const searchKey = `${id} ${displayName}`.toLowerCase().trim();

  // 1. If explicit valid image URL is passed and hasn't failed, render it
  if (logoUrl && !imgFailed) {
    return (
      <img
        src={logoUrl}
        alt={`Logo ${displayName}`}
        onError={() => setImgFailed(true)}
        loading="lazy"
        width={pxSize}
        height={pxSize}
        className={`object-contain rounded-lg ${className}`}
      />
    );
  }

  // 2. HR Connect Platform / Demo Company
  if (
    searchKey.includes('hr connect') ||
    searchKey.includes('hrconnect') ||
    searchKey.includes('demo company')
  ) {
    return (
      <svg
        width={pxSize}
        height={pxSize}
        viewBox="0 0 64 64"
        className={className}
        role="img"
        aria-label={displayName}
      >
        <rect width="64" height="64" rx="14" fill="#0C4A6E" />
        <rect x="16" y="13" width="9" height="30" rx="4.5" fill="#FFFFFF" />
        <rect x="39" y="13" width="9" height="30" rx="4.5" fill="#FFFFFF" />
        <path
          d="M20.5 28.5 C27 22.5, 37 34.5, 43.5 28.5"
          stroke="#38BDF8"
          strokeWidth="5.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="20.5" cy="51" r="3.6" fill="#38BDF8" />
        <circle cx="43.5" cy="51" r="3.6" fill="#38BDF8" />
      </svg>
    );
  }

  // 3. NovaTech Solutions
  if (searchKey.includes('novatech') || searchKey.includes('nova tech')) {
    return (
      <svg
        width={pxSize}
        height={pxSize}
        viewBox="0 0 48 48"
        className={className}
        aria-label={displayName}
      >
        <rect width="48" height="48" rx="10" fill="#4338CA" />
        {/* NovaTech AI Spark & Star */}
        <path d="M24 10 L27 21 L38 24 L27 27 L24 38 L21 27 L10 24 L21 21 Z" fill="#C7D2FE" />
        <circle cx="24" cy="24" r="3.5" fill="#FFFFFF" />
        <circle cx="15" cy="15" r="2" fill="#818CF8" />
        <circle cx="33" cy="33" r="2" fill="#818CF8" />
      </svg>
    );
  }

  // 4. Mekong Fintech
  if (searchKey.includes('mekong')) {
    return (
      <svg
        width={pxSize}
        height={pxSize}
        viewBox="0 0 48 48"
        className={className}
        aria-label={displayName}
      >
        <defs>
          <linearGradient id="mekongGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="10" fill="url(#mekongGrad)" />
        {/* Fintech digital wave */}
        <path
          d="M11 26 C15 18, 21 18, 25 24 C29 30, 35 30, 37 22"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="16" cy="34" r="3" fill="#38BDF8" />
        <circle cx="32" cy="14" r="3.5" fill="#5EEAD4" />
      </svg>
    );
  }

  // 5. Lotus Commerce
  if (searchKey.includes('lotus')) {
    return (
      <svg
        width={pxSize}
        height={pxSize}
        viewBox="0 0 48 48"
        className={className}
        aria-label={displayName}
      >
        <defs>
          <linearGradient id="lotusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#FB7185" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="10" fill="url(#lotusGrad)" />
        {/* Lotus bloom flower */}
        <path d="M24 14 C27 21 31 27 34 32 C28 34 20 34 14 32 C17 27 21 21 24 14 Z" fill="#FFFFFF" />
        <path d="M24 19 C26 24 28 28 30 32 C26 33 22 33 18 32 C20 28 22 24 24 19 Z" fill="#FFE4E6" />
        <circle cx="24" cy="31" r="2.5" fill="#E11D48" />
      </svg>
    );
  }

  // 6. Thủ Đức Company
  if (searchKey.includes('thủ đức') || searchKey.includes('thu duc')) {
    return (
      <svg
        width={pxSize}
        height={pxSize}
        viewBox="0 0 48 48"
        className={className}
        aria-label={displayName}
      >
        <defs>
          <linearGradient id="tdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="10" fill="url(#tdGrad)" />
        {/* High-tech tower circuit */}
        <path d="M24 12 L34 20 L34 36 L14 36 L14 20 Z" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M24 12 L24 36" stroke="#5EEAD4" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3" fill="#FFFFFF" />
      </svg>
    );
  }

  // 7. Techcombank
  if (searchKey.includes('techcombank') || searchKey.includes('tcb')) {
    return (
      <svg width={pxSize} height={pxSize} viewBox="0 0 48 48" className={className} aria-label={displayName}>
        <rect width="48" height="48" rx="10" fill="#F8FAFC" />
        <path d="M14 24 L24 14 L20 10 L10 20 Z" fill="#E11D48" />
        <path d="M34 24 L24 34 L28 38 L38 28 Z" fill="#E11D48" />
        <rect x="18" y="18" width="12" height="12" fill="#E11D48" rx="1.5" />
        <rect x="22" y="22" width="4" height="4" fill="#FFFFFF" />
      </svg>
    );
  }

  // 8. FPT
  if (searchKey.includes('fpt')) {
    return (
      <svg width={pxSize} height={pxSize} viewBox="0 0 48 48" className={className} aria-label={displayName}>
        <rect width="48" height="48" rx="10" fill="#FFFFFF" />
        <path d="M10 32 C10 22 17 14 26 12 L22 18 C16 20 14 26 14 32 Z" fill="#F97316" />
        <path d="M18 34 C18 25 24 18 33 16 L29 22 C23 24 21 29 21 34 Z" fill="#2563EB" />
        <path d="M26 36 C26 28 31 22 39 20 L36 26 C31 27 29 31 29 36 Z" fill="#16A34A" />
      </svg>
    );
  }

  // 9. Viettel
  if (searchKey.includes('viettel')) {
    return (
      <svg width={pxSize} height={pxSize} viewBox="0 0 48 48" className={className} aria-label={displayName}>
        <rect width="48" height="48" rx="10" fill="#FFFFFF" />
        <circle cx="24" cy="24" r="15" fill="#DC2626" />
        <path d="M19 22 Q19 18 22 18 Q23 21 21 25 Z" fill="#FFFFFF" />
        <path d="M26 22 Q26 18 29 18 Q30 21 28 25 Z" fill="#FFFFFF" />
      </svg>
    );
  }

  // 10. VPBank
  if (searchKey.includes('vpbank') || searchKey.includes('vpb')) {
    return (
      <svg width={pxSize} height={pxSize} viewBox="0 0 48 48" className={className} aria-label={displayName}>
        <rect width="48" height="48" rx="10" fill="#FFFFFF" />
        <path d="M14 26 C14 18 22 16 24 24 C20 28 16 28 14 26 Z" fill="#16A34A" />
        <path d="M34 26 C34 18 26 16 24 24 C28 28 32 28 34 26 Z" fill="#16A34A" />
        <path d="M24 14 L28 20 L24 24 L20 20 Z" fill="#DC2626" />
      </svg>
    );
  }

  // 11. Vinamilk
  if (searchKey.includes('vinamilk') || searchKey.includes('vnm')) {
    return (
      <svg width={pxSize} height={pxSize} viewBox="0 0 48 48" className={className} aria-label={displayName}>
        <rect width="48" height="48" rx="10" fill="#1E3A8A" />
        <circle cx="24" cy="24" r="16" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
        <text x="24" y="27" fill="#FFFFFF" fontSize="9" fontWeight="900" textAnchor="middle" letterSpacing="0.5">VNM</text>
      </svg>
    );
  }

  // 12. Shopee
  if (searchKey.includes('shopee')) {
    return (
      <svg width={pxSize} height={pxSize} viewBox="0 0 48 48" className={className} aria-label={displayName}>
        <rect width="48" height="48" rx="10" fill="#EA580C" />
        <path d="M16 19 L16 34 L32 34 L32 19 Z" fill="#FFFFFF" />
        <path d="M20 19 C20 15 28 15 28 19" stroke="#EA580C" strokeWidth="2" fill="none" />
        <path d="M22 25 C22 23 26 23 26 25 C26 27 22 27 22 29 C22 31 26 31 26 29" stroke="#EA580C" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  // 13. VNG
  if (searchKey.includes('vng')) {
    return (
      <svg width={pxSize} height={pxSize} viewBox="0 0 48 48" className={className} aria-label={displayName}>
        <rect width="48" height="48" rx="10" fill="#F97316" />
        <path d="M12 16 L20 32 L28 16" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="34" cy="24" r="5" fill="#FFFFFF" />
      </svg>
    );
  }

  // 14. Fallback for all other companies:
  // Render an enterprise-grade gradient badge with distinct monogram
  const grad = getGradient(displayName);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('') || 'HR';

  return (
    <svg
      width={pxSize}
      height={pxSize}
      viewBox="0 0 48 48"
      className={`rounded-lg shrink-0 ${className}`}
      role="img"
      aria-label={displayName}
    >
      <defs>
        <linearGradient id={`bg-${initials}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={grad.from} />
          <stop offset="100%" stopColor={grad.to} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="10" fill={`url(#bg-${initials})`} />
      {/* Subtle modern geometric ring */}
      <circle cx="38" cy="10" r="14" fill={grad.iconBg} />
      <circle cx="10" cy="38" r="8" fill={grad.iconBg} />
      <text
        x="24"
        y="29"
        fill={grad.text}
        fontSize="15"
        fontWeight="800"
        textAnchor="middle"
        letterSpacing="0.05em"
        fontFamily="'Inter', -apple-system, sans-serif"
      >
        {initials}
      </text>
    </svg>
  );
};

export default CompanyLogo;
