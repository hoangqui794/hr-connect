import { useQuery } from '@tanstack/react-query';
import { companyDirectoryApi } from '@/services/api/companyDirectoryApi';

/** Level-1 industries (LinkedIn taxonomy) for the job search filter; a job matches through its company. */
export const useIndustryOptions = () => {
  const q = useQuery({
    queryKey: ['industries', 'level-1'],
    queryFn: () => companyDirectoryApi.industries(),
    staleTime: 60 * 60_000,
  });
  const options = (q.data ?? [])
    .map((i) => ({ value: i.industryId, label: i.nameVi || i.nameEn }))
    .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  return { options, isLoading: q.isLoading, labelOf: (id?: string) => options.find((o) => o.value === id)?.label };
};
