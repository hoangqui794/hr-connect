import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@/services/apiClient';
import { CompanyLogo } from './CompanyLogo';

describe('CompanyLogo', () => {
  it('resolves a backend-owned logo path against the API host and fills its frame', () => {
    render(
      <CompanyLogo
        companyName="HR Connect Demo Company"
        logoUrl="/api/v1/companies/company-1/logo?v=9"
        size="xl"
      />
    );

    const expectedOrigin = new URL(API_BASE_URL, window.location.origin).origin;
    const image = screen.getByRole('img', { name: 'Logo HR Connect Demo Company' });

    expect(image).toHaveAttribute(
      'src',
      `${expectedOrigin}/api/v1/companies/company-1/logo?v=9`
    );
    expect(image).toHaveClass('h-full', 'w-full', 'object-cover');
  });

  it('keeps an absolute CDN URL unchanged', () => {
    render(
      <CompanyLogo
        companyName="HR Connect"
        logoUrl="https://cdn.example.com/company-logo.webp"
      />
    );

    expect(screen.getByRole('img', { name: 'Logo HR Connect' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/company-logo.webp'
    );
  });

  it('falls back to company initials when the logo cannot load', () => {
    render(
      <CompanyLogo
        companyName="HR Connect"
        logoUrl="https://cdn.example.com/broken.webp"
      />
    );

    fireEvent.error(screen.getByRole('img', { name: 'Logo HR Connect' }));

    expect(screen.queryByRole('img', { name: 'Logo HR Connect' })).not.toBeInTheDocument();
    expect(screen.getByText('HC')).toBeInTheDocument();
  });
});
