using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class AffiliatePerformanceRepository : IAffiliatePerformanceRepository
{
    private readonly ApplicationDbContext _context;

    public AffiliatePerformanceRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AffiliatePerformance?> GetLatestPerformanceAsync(Guid affiliateId, CancellationToken cancellationToken = default)
    {
        return await _context.AffiliatePerformances
            .Where(p => p.AffiliateId == affiliateId)
            .OrderByDescending(p => p.PeriodEnd)
            .ThenByDescending(p => p.CalculatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<AffiliatePerformance?> GetByPeriodAsync(
        Guid affiliateId,
        DateOnly periodStart,
        DateOnly periodEnd,
        CancellationToken cancellationToken = default)
    {
        return await _context.AffiliatePerformances
            .FirstOrDefaultAsync(p => p.AffiliateId == affiliateId && p.PeriodStart == periodStart && p.PeriodEnd == periodEnd, cancellationToken);
    }

    public async Task<IReadOnlyList<AffiliatePerformance>> GetHistoryAsync(
        Guid affiliateId,
        int limit = 12,
        CancellationToken cancellationToken = default)
    {
        return await _context.AffiliatePerformances
            .Where(p => p.AffiliateId == affiliateId)
            .OrderByDescending(p => p.PeriodEnd)
            .ThenByDescending(p => p.CalculatedAt)
            .Take(Math.Max(1, limit))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AffiliateProfile>> GetActiveAffiliatesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.AffiliateProfiles
            .Where(p => p.Status == "ACTIVE")
            .ToListAsync(cancellationToken);
    }

    public async Task<(int Submissions, int Shortlisted, int Interviews, int Placements)> ComputeMetricsAsync(
        Guid affiliateId,
        DateOnly periodStart,
        DateOnly periodEnd,
        CancellationToken cancellationToken = default)
    {
        var profile = await _context.AffiliateProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.AffiliateId == affiliateId, cancellationToken);

        if (profile == null)
        {
            return (0, 0, 0, 0);
        }

        var startUtc = periodStart.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endUtcExclusive = periodEnd.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // 1. TotalSubmissions: Lượt nộp của Affiliate được ứng viên đồng ý (submission ACCEPTED/consent CONFIRMED) trong kỳ.
        // Không đếm lượt bị chặn trùng, bị từ chối consent hay hết hạn
        var validSubmissions = await _context.Submissions
            .AsNoTracking()
            .Include(s => s.Consent)
            .Where(s => s.SubmittedBy == profile.UserId
                        && s.SubmittedAt >= startUtc
                        && s.SubmittedAt < endUtcExclusive
                        && (s.Status == "ACCEPTED" || (s.Consent != null && s.Consent.Status == "CONFIRMED")))
            .ToListAsync(cancellationToken);

        int totalSubmissions = validSubmissions.Count;
        if (totalSubmissions == 0)
        {
            return (0, 0, 0, 0);
        }

        var validSubmissionIds = validSubmissions.Select(s => s.SubmissionId).ToHashSet();

        // 2. Lấy applications liên kết với các submission trên
        var linkedApplications = await _context.Applications
            .AsNoTracking()
            .Include(a => a.ApplicationStatusHistories)
            .Include(a => a.Interviews)
            .Include(a => a.Placement)
                .ThenInclude(p => p!.Warranty)
            .Where(a => (a.AcceptedSubmissionId.HasValue && validSubmissionIds.Contains(a.AcceptedSubmissionId.Value))
                        || _context.Attributions.Any(attr => attr.AffiliateId == affiliateId
                                                             && validSubmissionIds.Contains(attr.WinningSubmissionId)
                                                             && attr.ApplicationId == a.ApplicationId))
            .ToListAsync(cancellationToken);

        // 3. TotalShortlisted: Application từ các lượt trên đã từng SHORTLISTED
        int totalShortlisted = linkedApplications.Count(a =>
            a.Status == ApplicationStates.Shortlisted
            || a.Status == ApplicationStates.Interview
            || a.Status == ApplicationStates.OfferPending
            || a.Status == ApplicationStates.OfferAccepted
            || a.Status == ApplicationStates.Placed
            || a.ApplicationStatusHistories.Any(h => h.NewStatus == ApplicationStates.Shortlisted));

        // 4. TotalInterviews: Application đã từng INTERVIEW
        int totalInterviews = linkedApplications.Count(a =>
            a.Status == ApplicationStates.Interview
            || a.Status == ApplicationStates.OfferPending
            || a.Status == ApplicationStates.OfferAccepted
            || a.Status == ApplicationStates.Placed
            || a.Interviews.Any()
            || a.ApplicationStatusHistories.Any(h => h.NewStatus == ApplicationStates.Interview));

        // 5. TotalPlacements: Application PLACED và bảo hành không bị VOIDED
        int totalPlacements = linkedApplications.Count(a =>
            (a.Status == ApplicationStates.Placed || a.Placement != null)
            && (a.Placement == null || a.Placement.Warranty == null || a.Placement.Warranty.Status != WarrantyStates.Voided));

        return (totalSubmissions, totalShortlisted, totalInterviews, totalPlacements);
    }

    public async Task<AffiliatePerformance> UpsertPerformanceAsync(
        AffiliatePerformance performance,
        CancellationToken cancellationToken = default)
    {
        var existing = await _context.AffiliatePerformances
            .FirstOrDefaultAsync(p => p.AffiliateId == performance.AffiliateId
                                      && p.PeriodStart == performance.PeriodStart
                                      && p.PeriodEnd == performance.PeriodEnd, cancellationToken);

        if (existing != null)
        {
            existing.TotalSubmissions = performance.TotalSubmissions;
            existing.TotalShortlisted = performance.TotalShortlisted;
            existing.TotalInterviews = performance.TotalInterviews;
            existing.TotalPlacements = performance.TotalPlacements;
            existing.SubmissionToHireRate = performance.SubmissionToHireRate;
            existing.QualityRating = performance.QualityRating;
            existing.RatingLabel = performance.RatingLabel;
            existing.CalculationVersion = performance.CalculationVersion;
            existing.CalculatedAt = performance.CalculatedAt;

            await _context.SaveChangesAsync(cancellationToken);
            return existing;
        }

        if (performance.AffiliatePerformanceId == Guid.Empty)
        {
            performance.AffiliatePerformanceId = Guid.NewGuid();
        }
        if (performance.CreatedAt == default)
        {
            performance.CreatedAt = DateTime.UtcNow;
        }
        if (performance.CalculatedAt == default)
        {
            performance.CalculatedAt = DateTime.UtcNow;
        }

        await _context.AffiliatePerformances.AddAsync(performance, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        return performance;
    }
}
