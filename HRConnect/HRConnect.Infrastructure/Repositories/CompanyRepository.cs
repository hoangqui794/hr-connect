using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class CompanyRepository : ICompanyRepository
{
    private readonly ApplicationDbContext _context;

    public CompanyRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(Company company, CancellationToken cancellationToken = default)
    {
        await _context.Companies.AddAsync(company, cancellationToken);
    }

    public async Task<Company?> GetByIdAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        return await _context.Companies
            .FirstOrDefaultAsync(c => c.CompanyId == companyId, cancellationToken);
    }

    public async Task<bool> ExistsByTaxCodeAsync(string taxCode, CancellationToken cancellationToken = default)
    {
        return await _context.Companies
            .AnyAsync(c => c.TaxCode != null && c.TaxCode.ToLower() == taxCode.ToLower(), cancellationToken);
    }

    public void Update(Company company)
    {
        _context.Companies.Update(company);
    }
}
