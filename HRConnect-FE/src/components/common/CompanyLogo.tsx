import React, { useEffect, useState } from 'react';

/** Only use an explicit backend URL; never guess a company's brand from its name. */
export function getCompanyLogoUrl(_companyName: string = '', explicitUrl?: string): string {
  return explicitUrl?.trim() || '';
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

  useEffect(() => {
    setCurrentSrc(initialUrl);
    setHasError(false);
  }, [initialUrl]);

  const initials = companyName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HR';

  const handleError = () => {
    setHasError(true);
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
      {currentSrc && !hasError ? (
        <img
          src={currentSrc}
          alt={`Logo ${companyName}`}
          onError={handleError}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-[inherit] bg-gradient-to-br from-blue-50 to-cyan-100 font-bold tracking-tight text-blue-700" aria-label={`Ký hiệu doanh nghiệp ${companyName}`}>
          {initials}
        </span>
      )}
    </div>
  );
};

export default CompanyLogo;
