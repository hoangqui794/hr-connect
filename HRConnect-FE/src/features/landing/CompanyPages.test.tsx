import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { CompaniesPage } from './CompanyPages';

vi.mock('./components/Navbar', () => ({ Navbar: () => <nav /> }));

const INDUSTRY_L1 = '11111111-1111-1111-1111-111111111111';
const INDUSTRY_L2 = '22222222-2222-2222-2222-222222222222';
const SIZE_51_200 = '33333333-3333-3333-3333-333333333333';

let searchRequests: URLSearchParams[] = [];

const lastRequest = (): URLSearchParams | undefined => searchRequests[searchRequests.length - 1];

const page = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 };

beforeEach(() => {
  searchRequests = [];
  server.use(
    http.get('*/public/companies/featured', () => HttpResponse.json({ success: true, data: [] })),
    http.get('*/public/companies', ({ request }) => {
      searchRequests.push(new URL(request.url).searchParams);
      return HttpResponse.json({ success: true, data: page });
    }),
    http.get('*/industries', () =>
      HttpResponse.json({
        success: true,
        data: [
          {
            industryId: INDUSTRY_L1, code: 'tech', nameEn: 'Technology', nameVi: 'Công nghệ', level: 1,
            children: [{ industryId: INDUSTRY_L2, code: 'software', nameEn: 'Software Development', nameVi: null, level: 2, children: null }],
          },
        ],
      })),
    http.get('*/company-sizes', () =>
      HttpResponse.json({ success: true, data: [{ companySizeId: SIZE_51_200, code: 'S51', label: '51-200 nhân viên', minEmployees: 51, maxEmployees: 200 }] })),
  );
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AntApp>
        <MemoryRouter>
          <CompaniesPage />
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );

const openSelect = (label: string) => {
  const combobox = screen.getByRole('combobox', { name: label });
  fireEvent.mouseDown(combobox);
  return combobox;
};

describe('CompaniesPage filters (UC-03)', () => {
  it('describes the search box as a company-name search', async () => {
    renderPage();
    expect(screen.getByPlaceholderText('Tên công ty')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/lĩnh vực/i)).not.toBeInTheDocument();
    await waitFor(() => expect(searchRequests.length).toBeGreaterThan(0));
  });

  it('sends industryId when an industry (including a child industry) is chosen', async () => {
    renderPage();
    await waitFor(() => expect(searchRequests.length).toBeGreaterThan(0));

    openSelect('Ngành nghề');
    // Expand the level-1 node, then pick its level-2 child.
    const tree = await screen.findByRole('tree');
    fireEvent.click(within(tree).getByText('Công nghệ'));
    await waitFor(() => expect(lastRequest()?.get('industryId')).toBe(INDUSTRY_L1));

    openSelect('Ngành nghề');
    const switcher = document.querySelector('.ant-select-tree-switcher');
    if (switcher) fireEvent.click(switcher);
    fireEvent.click(await screen.findByText('Software Development'));
    await waitFor(() => expect(lastRequest()?.get('industryId')).toBe(INDUSTRY_L2));
  });

  it('sends companySizeId when a company size is chosen and clears every filter', async () => {
    renderPage();
    await waitFor(() => expect(searchRequests.length).toBeGreaterThan(0));

    openSelect('Quy mô công ty');
    fireEvent.click(await screen.findByTitle('51-200 nhân viên'));
    await waitFor(() => expect(lastRequest()?.get('companySizeId')).toBe(SIZE_51_200));

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    await waitFor(() => {
      const last = lastRequest()!;
      expect(last.get('companySizeId')).toBeNull();
      expect(last.get('industryId')).toBeNull();
    });
    expect(screen.queryByRole('button', { name: 'Xóa bộ lọc' })).not.toBeInTheDocument();
  });
});
