import React from 'react';

interface CompanyLogoProps {
  id: string;
  name: string;
  className?: string;
  size?: number;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({ id, name, className = '', size = 38 }) => {
  switch (id) {
    case 'techcombank':
    case 'tcb':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#F8FAFC" />
          {/* Techcombank interlocking red diamond emblem */}
          <path d="M14 24 L24 14 L20 10 L10 20 Z" fill="#E11D48" />
          <path d="M34 24 L24 34 L28 38 L38 28 Z" fill="#E11D48" />
          <rect x="18" y="18" width="12" height="12" fill="#E11D48" rx="1.5" />
          <rect x="22" y="22" width="4" height="4" fill="#FFFFFF" />
        </svg>
      );

    case 'fpt':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#FFFFFF" />
          {/* FPT 3 colorful corporate curved stripes */}
          <path d="M10 32 C10 22 17 14 26 12 L22 18 C16 20 14 26 14 32 Z" fill="#F97316" />
          <path d="M18 34 C18 25 24 18 33 16 L29 22 C23 24 21 29 21 34 Z" fill="#2563EB" />
          <path d="M26 36 C26 28 31 22 39 20 L36 26 C31 27 29 31 29 36 Z" fill="#16A34A" />
        </svg>
      );

    case 'viettel':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#FFFFFF" />
          {/* Viettel red speech bubble with quotation marks */}
          <circle cx="24" cy="24" r="15" fill="#DC2626" />
          <path d="M19 22 Q19 18 22 18 Q23 21 21 25 Z" fill="#FFFFFF" />
          <path d="M26 22 Q26 18 29 18 Q30 21 28 25 Z" fill="#FFFFFF" />
        </svg>
      );

    case 'vpbank':
    case 'vpb':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#FFFFFF" />
          {/* VPBank green flower petals with red accent */}
          <path d="M14 26 C14 18 22 16 24 24 C20 28 16 28 14 26 Z" fill="#16A34A" />
          <path d="M34 26 C34 18 26 16 24 24 C28 28 32 28 34 26 Z" fill="#16A34A" />
          <path d="M24 14 L28 20 L24 24 L20 20 Z" fill="#DC2626" />
        </svg>
      );

    case 'vinamilk':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#1E3A8A" />
          <circle cx="24" cy="24" r="16" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
          <text x="24" y="27" fill="#FFFFFF" fontSize="9" fontWeight="900" textAnchor="middle" letterSpacing="0.5">VNM</text>
        </svg>
      );

    case 'shopee':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#EA580C" />
          {/* Shopee shopping bag & S */}
          <path d="M16 19 L16 34 L32 34 L32 19 Z" fill="#FFFFFF" />
          <path d="M20 19 C20 15 28 15 28 19" stroke="#EA580C" strokeWidth="2" fill="none" />
          <path d="M22 25 C22 23 26 23 26 25 C26 27 22 27 22 29 C22 31 26 31 26 29" stroke="#EA580C" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      );

    case 'vtech':
    case 'vt':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#0F172A" />
          {/* V-Tech cyan cube */}
          <path d="M24 12 L35 18 L35 30 L24 36 L13 30 L13 18 Z" fill="none" stroke="#38BDF8" strokeWidth="2.5" />
          <path d="M18 22 L24 29 L30 22" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'novatech':
    case 'nt':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#4338CA" />
          {/* NovaTech AI Spark */}
          <path d="M24 12 L27 21 L36 24 L27 27 L24 36 L21 27 L12 24 L21 21 Z" fill="#C7D2FE" />
          <circle cx="24" cy="24" r="3" fill="#FFFFFF" />
        </svg>
      );

    case 'seedlabs':
    case 'seed':
    case 'sr':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#065F46" />
          {/* SEED leaf polygon */}
          <path d="M24 12 C30 16 32 24 24 36 C16 24 18 16 24 12 Z" fill="#34D399" />
          <circle cx="24" cy="22" r="3" fill="#065F46" />
        </svg>
      );

    case 'ankhang':
    case 'ak':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#1E293B" />
          {/* An Khang Roof Crest */}
          <path d="M14 28 L24 14 L34 28 Z" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="24" cy="28" r="4" fill="#F59E0B" />
        </svg>
      );

    case 'digitalwave':
    case 'dw':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#0284C7" />
          {/* Waveform Fintech */}
          <path d="M12 24 Q18 14 24 24 T36 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <circle cx="24" cy="24" r="3.5" fill="#BAE6FD" />
        </svg>
      );

    case 'cloudnative':
    case 'cn':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#0EA5E9" />
          {/* Cloud Nodes */}
          <circle cx="19" cy="25" r="7" fill="#FFFFFF" />
          <circle cx="29" cy="25" r="7" fill="#FFFFFF" />
          <circle cx="24" cy="19" r="8" fill="#FFFFFF" />
          <circle cx="24" cy="22" r="3" fill="#0EA5E9" />
        </svg>
      );

    case 'mediamax':
    case 'mm':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label={name}>
          <rect width="48" height="48" rx="8" fill="#7C3AED" />
          {/* Media Play Diamond */}
          <polygon points="18,15 34,24 18,33" fill="#FFFFFF" />
        </svg>
      );

    default:
      return (
        <div
          className={`flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs ${className}`}
          style={{ width: size, height: size }}
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
      );
  }
};

export default CompanyLogo;
