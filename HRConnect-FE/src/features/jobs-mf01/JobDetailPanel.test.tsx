import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PublicJobCompany } from '@/types/api/jobs';
import { JobCompanyCard } from './JobDetailPanel';

const company: PublicJobCompany = {
  companyId: '30000000-0000-0000-0000-000000000001',
  companyName: 'HR Connect Demo Company',
  logoUrl: null,
  industry: 'Công nghệ thông tin',
  companySize: '51-200 nhân sự',
  website: 'https://hrconnect.example.com/',
  address: 'Thành phố Hồ Chí Minh',
  description: 'Môi trường làm việc minh bạch, thân thiện và chú trọng phát triển con người.',
  isVerified: true,
};

describe('JobCompanyCard', () => {
  it('shows the sanitized public company profile with a safe website link', () => {
    render(<JobCompanyCard company={company} />);

    expect(screen.getByRole('region', { name: 'Thông tin doanh nghiệp' })).toBeInTheDocument();
    expect(screen.getByText(company.companyName)).toBeInTheDocument();
    expect(screen.getByText('Đã xác minh')).toBeInTheDocument();
    expect(screen.getByText(company.industry!)).toBeInTheDocument();
    expect(screen.getByText(company.companySize!)).toBeInTheDocument();
    expect(screen.getByText(company.address!)).toBeInTheDocument();
    expect(screen.getByText(company.description!)).toBeInTheDocument();

    const website = screen.getByRole('link', { name: /website công ty/i });
    expect(website).toHaveAttribute('href', company.website);
    expect(website).toHaveAttribute('target', '_blank');
    expect(website).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('uses a friendly fallback and hides unsafe website values', () => {
    render(
      <JobCompanyCard
        company={{
          ...company,
          industry: null,
          companySize: null,
          address: null,
          description: null,
          website: 'javascript:alert(1)',
          isVerified: false,
        }}
      />
    );

    expect(screen.getByText('Doanh nghiệp chưa cập nhật phần giới thiệu.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /website công ty/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Đã xác minh')).not.toBeInTheDocument();
  });
});
