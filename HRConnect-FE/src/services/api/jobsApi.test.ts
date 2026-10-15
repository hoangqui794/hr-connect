import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../apiClient';
import { jobsApi } from './jobsApi';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('jobsApi public catalog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the anonymous Candidate-scoped endpoint and removes empty filters', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { items: [], page: 1, pageSize: 12, totalCount: 0, totalPages: 0 },
    });

    await jobsApi.searchPublic({
      search: '',
      location: undefined,
      employmentType: 'FULL_TIME',
      page: 1,
      pageSize: 12,
    });

    expect(apiClient.get).toHaveBeenCalledWith('/public/jobs', {
      params: { employmentType: 'FULL_TIME', page: 1, pageSize: 12 },
    });
  });
});

describe('jobsApi MF-01 commercial terms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the commercial-terms defaults from the data envelope', async () => {
    const data = { serviceTypeCode: 'HEADHUNT_COD', prefill: { feeMultiplier: 1.5 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data } });

    await expect(jobsApi.getCommercialTermsDefaults('job-1')).resolves.toEqual(data);
    expect(apiClient.get).toHaveBeenCalledWith('/internal/jobs/job-1/commercial-terms/defaults');
  });

  it('sends the agreed terms and agreement reference in the approve body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });

    await jobsApi.approve('job-1', 'token-1', {
      commercialTerms: { feeMultiplier: 1.2, warrantyDays: 60, paymentDueDays: 15 },
      agreementReference: 'HĐ-01',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/internal/jobs/job-1/approve',
      {
        concurrencyToken: 'token-1',
        commercialTerms: { feeMultiplier: 1.2, warrantyDays: 60, paymentDueDays: 15 },
        agreementReference: 'HĐ-01',
      },
      { params: { concurrencyToken: 'token-1' } }
    );
  });
});

describe('jobsApi MF-01 job templates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('searches active templates and unpacks data.data', async () => {
    const pageData = {
      items: [
        {
          templateId: 'tpl-1',
          code: 'IT_REACT',
          name: 'React Developer',
          industry: 'IT',
          level: 'MIDDLE',
          summary: 'React summary',
          requirementCount: 5,
          usageCount: 10,
          isActive: true,
          updatedAt: '2026-10-15T00:00:00Z',
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: pageData } });

    const result = await jobsApi.searchTemplates({ keyword: 'react', industry: 'IT', page: 1, pageSize: 20 });
    expect(result).toEqual(pageData);
    expect(apiClient.get).toHaveBeenCalledWith('/job-templates', {
      params: { keyword: 'react', industry: 'IT', page: 1, pageSize: 20 },
    });
  });

  it('fetches full template detail by id and unpacks data.data', async () => {
    const templateData = {
      templateId: 'tpl-1',
      code: 'IT_REACT',
      name: 'React Developer',
      industry: 'IT',
      level: 'MIDDLE',
      keywords: 'react, frontend',
      summary: 'React summary',
      title: 'Senior React Developer',
      description: 'Job description here',
      benefits: 'Benefits here',
      employmentType: 'FULL_TIME',
      minExperienceYears: 3,
      maxExperienceYears: 5,
      requirements: [
        { requirementType: 'MUST_HAVE', category: 'EXPERIENCE', content: '3+ years React' },
        { requirementType: 'SHOULD_HAVE', category: 'SKILL', content: 'TypeScript' },
      ],
      isActive: true,
      usageCount: 10,
      updatedAt: '2026-10-15T00:00:00Z',
      concurrencyToken: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: templateData } });

    const result = await jobsApi.getTemplate('tpl-1');
    expect(result).toEqual(templateData);
    expect(apiClient.get).toHaveBeenCalledWith('/job-templates/tpl-1');
  });

  it('calls getInternalTemplates with /internal/job-templates and unpacks data.data', async () => {
    const internalPageData = { items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: internalPageData } });

    const result = await jobsApi.getInternalTemplates({ keyword: 'net', isActive: true, page: 1, pageSize: 10 });
    expect(result).toEqual(internalPageData);
    expect(apiClient.get).toHaveBeenCalledWith('/internal/job-templates', {
      params: { keyword: 'net', isActive: true, page: 1, pageSize: 10 },
    });
  });

  it('calls getInternalTemplate by id with /internal/job-templates/{id}', async () => {
    const detail = { templateId: 'tpl-int-1', code: 'IT_NET', name: '.NET Dev', concurrencyToken: 'tok-1' };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: detail } });

    const result = await jobsApi.getInternalTemplate('tpl-int-1');
    expect(result).toEqual(detail);
    expect(apiClient.get).toHaveBeenCalledWith('/internal/job-templates/tpl-int-1');
  });

  it('calls createInternalTemplate with POST /internal/job-templates', async () => {
    const input = {
      code: 'IT_NET',
      name: '.NET Developer',
      industry: 'IT',
      title: '.NET Developer',
      description: 'Description',
      requirements: [{ requirementType: 'MUST_HAVE' as const, category: 'SKILL', content: 'C#' }],
    };
    const created = { ...input, templateId: 'new-id', usageCount: 0, isActive: true };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: created } });

    const result = await jobsApi.createInternalTemplate(input);
    expect(result).toEqual(created);
    expect(apiClient.post).toHaveBeenCalledWith('/internal/job-templates', input);
  });

  it('calls updateInternalTemplate with PUT /internal/job-templates/{id}', async () => {
    const input = {
      code: 'IT_NET',
      name: '.NET Developer Updated',
      industry: 'IT',
      title: '.NET Developer',
      description: 'Updated Description',
      requirements: [{ requirementType: 'MUST_HAVE' as const, category: 'SKILL', content: 'C#' }],
    };
    const updated = { ...input, templateId: 'tpl-1' };
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true, data: updated } });

    const result = await jobsApi.updateInternalTemplate('tpl-1', {
      concurrencyToken: 'tok-1',
      template: input,
    });
    expect(result).toEqual(updated);
    expect(apiClient.put).toHaveBeenCalledWith('/internal/job-templates/tpl-1', {
      concurrencyToken: 'tok-1',
      template: input,
    });
  });

  it('calls toggleTemplateActive with activate/deactivate endpoints', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });

    await jobsApi.toggleTemplateActive('tpl-1', true);
    expect(apiClient.post).toHaveBeenCalledWith('/internal/job-templates/tpl-1/activate');

    await jobsApi.toggleTemplateActive('tpl-1', false);
    expect(apiClient.post).toHaveBeenCalledWith('/internal/job-templates/tpl-1/deactivate');
  });
});

