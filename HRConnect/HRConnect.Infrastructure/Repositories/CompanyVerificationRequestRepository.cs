using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class CompanyVerificationRequestRepository : ICompanyVerificationRequestRepository
{
    private readonly ApplicationDbContext _context;

    public CompanyVerificationRequestRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(CompanyVerificationRequest request, CancellationToken cancellationToken = default)
    {
        await _context.CompanyVerificationRequests.AddAsync(request, cancellationToken);
    }

    public async Task<CompanyVerificationRequest?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.CompanyVerificationRequests
            .Include(cvr => cvr.Company)
            .FirstOrDefaultAsync(cvr => cvr.SubmittedBy == userId, cancellationToken);
    }

    public async Task<CompanyVerificationRequest?> GetByCompanyIdAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        return await _context.CompanyVerificationRequests
            .Include(cvr => cvr.Company)
            .FirstOrDefaultAsync(cvr => cvr.CompanyId == companyId, cancellationToken);
    }

    public async Task<CompanyVerificationRequest?> GetByIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        return await _context.CompanyVerificationRequests
            .Include(cvr => cvr.Company)
            .FirstOrDefaultAsync(cvr => cvr.CompanyVerificationRequestId == requestId, cancellationToken);
    }

    public void Update(CompanyVerificationRequest request)
    {
        _context.CompanyVerificationRequests.Update(request);
    }
}
