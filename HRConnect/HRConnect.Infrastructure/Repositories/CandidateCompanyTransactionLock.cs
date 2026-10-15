using HRConnect.Application.Common.Interfaces;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class CandidateCompanyTransactionLock : ICandidateCompanyTransactionLock
{
    private readonly ApplicationDbContext _context;

    public CandidateCompanyTransactionLock(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AcquireAsync(
        Guid candidateId,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        if (_context.Database.CurrentTransaction == null)
        {
            throw new InvalidOperationException(
                "Candidate/Company transaction lock must be acquired inside an active database transaction.");
        }

        var lockKey = $"mf02:candidate-company:{candidateId:N}:{companyId:N}";
        await _context.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))",
            cancellationToken);
    }
}
