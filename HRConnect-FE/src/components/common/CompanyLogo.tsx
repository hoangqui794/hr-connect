import React, { useState } from 'react';

// Curated high-resolution official/CDN logos for well-known Vietnamese & international tech brands
const KNOWN_COMPANY_LOGOS: Record<string, string> = {
  fpt: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/FPT_logo_2010.svg/320px-FPT_logo_2010.svg.png',
  'fpt software': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/FPT_logo_2010.svg/320px-FPT_logo_2010.svg.png',
  techcorp: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
  'techcorp enterprise solutions': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
  'techcorp solutions': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
  vnpay: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-VNPAY-QR-1.png',
  'vnpay fintech': 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-VNPAY-QR-1.png',
  viettel: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Viettel_logo_2021.svg/320px-Viettel_logo_2021.svg.png',
  'viettel digital': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Viettel_logo_2021.svg/320px-Viettel_logo_2021.svg.png',
  momo: 'https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png',
  'momo superapp': 'https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png',
  shopee: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Shopee.svg/320px-Shopee.svg.png',
  'shopee vietnam': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Shopee.svg/320px-Shopee.svg.png',
  'mb bank': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Logo_MB_new.png/320px-Logo_MB_new.png',
  'mb bank digital': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Logo_MB_new.png/320px-Logo_MB_new.png',
  vinai: 'https://www.vinai.io/wp-content/uploads/2021/04/VinAI-logo.png',
  'vinai research': 'https://www.vinai.io/wp-content/uploads/2021/04/VinAI-logo.png',
  agal: 'https://api.dicebear.com/7.x/identicon/svg?seed=AGAL',
  'agal solutions': 'https://api.dicebear.com/7.x/identicon/svg?seed=AGAL',
  digitalwave: 'https://api.dicebear.com/7.x/identicon/svg?seed=DigitalWave',
  'digitalwave fintech agency': 'https://api.dicebear.com/7.x/identicon/svg?seed=DigitalWave',
  cloudnative: 'https://api.dicebear.com/7.x/identicon/svg?seed=CloudNative',
  'cloudnative systems ltd.': 'https://api.dicebear.com/7.x/identicon/svg?seed=CloudNative',
  retailgiant: 'https://api.dicebear.com/7.x/identicon/svg?seed=RetailGiant',
  'retailgiant global labs': 'https://api.dicebear.com/7.x/identicon/svg?seed=RetailGiant',
  healthtech: 'https://api.dicebear.com/7.x/identicon/svg?seed=HealthTech',
  'healthtech innovations hub': 'https://api.dicebear.com/7.x/identicon/svg?seed=HealthTech',
  nextgen: 'https://api.dicebear.com/7.x/identicon/svg?seed=NextGen',
  'nextgen saas platform': 'https://api.dicebear.com/7.x/identicon/svg?seed=NextGen',
};

// Find matching logo by company name
export function getCompanyLogoUrl(companyName: string = '', explicitUrl?: string): string {
  if (explicitUrl && explicitUrl.trim()) {
    return explicitUrl.trim();
  }

  const normalized = companyName.toLowerCase().trim();

  // Direct lookup
  if (KNOWN_COMPANY_LOGOS[normalized]) {
    return KNOWN_COMPANY_LOGOS[normalized];
  }

  // Partial match
  for (const [key, url] of Object.entries(KNOWN_COMPANY_LOGOS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return url;
    }
  }

  // Fallback to high-quality SVG identicon
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(companyName || 'Company')}&backgroundColor=f1f5f9`;
}

interface CompanyLogoProps {
  companyName: string;
  logoUrl?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  companyName,
  logoUrl,
  className = '',
  size = 'md',
}) => {
  const initialUrl = getCompanyLogoUrl(companyName, logoUrl);
  const [currentSrc, setCurrentSrc] = useState(initialUrl);
  const [hasError, setHasError] = useState(false);

  const fallbackUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
    companyName || 'HRConnect'
  )}&backgroundColor=f8fafc`;

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setCurrentSrc(fallbackUrl);
    }
  };

  const sizeClasses = {
    sm: 'w-9 h-9 rounded-lg p-1',
    md: 'w-12 h-12 rounded-xl p-1.5',
    lg: 'w-16 h-16 rounded-2xl p-2',
    xl: 'w-20 h-20 rounded-2xl p-2.5',
  };

  return (
    <div
      className={`border border-slate-100 bg-white shadow-xs shrink-0 flex items-center justify-center overflow-hidden transition-transform duration-200 group-hover:scale-105 ${
        sizeClasses[size]
      } ${className}`}
    >
      <img
        src={currentSrc}
        alt={`${companyName} Logo`}
        onError={handleError}
        loading="lazy"
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export default CompanyLogo;
