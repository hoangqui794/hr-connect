/**
 * @file useFeaturedCompanies.ts
 * @description The verified, featured companies that are hiring right now, most open jobs first.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { companyDirectoryApi } from '@/services/api/companyDirectoryApi';

const COMPANY_PHOTOS: Array<[RegExp, string]> = [
  [/\bfpt\b/i, '/images/banners/banner-fpt.jpg'],
  [/\bvng\b/i, '/images/banners/banner-vng.jpg'],
  [/\bmomo\b/i, '/images/banners/banner-momo-hero.jpg'],
  [/vinamilk/i, '/images/banners/banner-vinamilk-side.jpg'],
];

/** A photo only for the company it shows; other companies get a plain background. */
export const companyPhoto = (companyName: string) => COMPANY_PHOTOS.find(([name]) => name.test(companyName))?.[1];

export const useFeaturedCompanies = () => {
  const query = useQuery({
    queryKey: ['public-companies', 'featured'],
    queryFn: () => companyDirectoryApi.featured(),
    staleTime: 5 * 60_000,
  });
  const companies = useMemo(
    () => (query.data ?? []).filter((company) => company.activeJobCount > 0).sort((a, b) => b.activeJobCount - a.activeJobCount),
    [query.data]
  );
  return { companies, isLoading: query.isLoading };
};
