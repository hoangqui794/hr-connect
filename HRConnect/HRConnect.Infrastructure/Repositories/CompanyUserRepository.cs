using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class CompanyUserRepository : ICompanyUserRepository
{
    private readonly ApplicationDbContext _context;

    public CompanyUserRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(CompanyUser companyUser, CancellationToken cancellationToken = default)
    {
        await _context.CompanyUsers.AddAsync(companyUser, cancellationToken);
    }

    public async Task<CompanyUser?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.CompanyUsers
            .Include(cu => cu.Company)
            .FirstOrDefaultAsync(cu => cu.UserId == userId, cancellationToken);
    }

    public void Update(CompanyUser companyUser)
    {
        _context.CompanyUsers.Update(companyUser);
    }
}
