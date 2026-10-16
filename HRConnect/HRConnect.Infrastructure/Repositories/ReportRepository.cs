using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Reports.Common;
using HRConnect.Application.Features.Reports.Queries.GetReportOverview;
using HRConnect.Application.Features.Reports.Queries.GetReportRevenue;
using HRConnect.Application.Features.Reports.Queries.GetReportTopAffiliates;
using HRConnect.Application.Features.Reports.Queries.GetReportTopCompanies;
using HRConnect.Domain.Constants;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class ReportRepository : IReportRepository
{
    private readonly ApplicationDbContext _context;
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    public ReportRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ReportOverviewResponse> GetOverviewAsync(ReportTimeRange range, CancellationToken cancellationToken = default)
    {
        // 1. Jobs by Status (toàn bộ trạng thái hiện tại)
        var byStatus = new Dictionary<string, int>
        {
            ["ACTIVE"] = 0,
            ["PAUSED"] = 0,
            ["CLOSED"] = 0,
            ["PENDING_REVIEW"] = 0,
            ["DRAFT"] = 0,
            ["REJECTED"] = 0
        };

        var jobsByStatusList = await _context.Jobs
            .AsNoTracking()
            .GroupBy(j => j.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        foreach (var item in jobsByStatusList)
        {
            byStatus[item.Status] = item.Count;
        }

        // 2. Jobs by ServiceType (phát sinh trong kỳ [fromUtc, toUtcPlusOne])
        var byServiceType = new Dictionary<string, int>
        {
            ["HEADHUNT_COD"] = 0,
            ["CV_SOURCING"] = 0,
            ["CV_APPLICATION"] = 0
        };

        var jobsByServiceTypeList = await _context.Jobs
            .AsNoTracking()
            .Where(j => j.CreatedAt >= range.FromUtc && j.CreatedAt < range.ToUtcPlusOne)
            .GroupBy(j => j.ServiceType.Code)
            .Select(g => new { Code = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        foreach (var item in jobsByServiceTypeList)
        {
            byServiceType[item.Code] = item.Count;
        }

        // 3. Applications phát sinh trong kỳ
        var submitted = await _context.Applications
            .AsNoTracking()
            .CountAsync(a => a.AppliedAt >= range.FromUtc && a.AppliedAt < range.ToUtcPlusOne, cancellationToken);

        var shortlisted = await _context.Applications
            .AsNoTracking()
            .CountAsync(a => a.ApplicationStatusHistories.Any(h => h.NewStatus == ApplicationStates.Shortlisted && h.ChangedAt >= range.FromUtc && h.ChangedAt < range.ToUtcPlusOne)
                || (a.Status == ApplicationStates.Shortlisted && a.UpdatedAt >= range.FromUtc && a.UpdatedAt < range.ToUtcPlusOne), cancellationToken);

        var interview = await _context.Applications
            .AsNoTracking()
            .CountAsync(a => a.ApplicationStatusHistories.Any(h => h.NewStatus == ApplicationStates.Interview && h.ChangedAt >= range.FromUtc && h.ChangedAt < range.ToUtcPlusOne)
                || (a.Status == ApplicationStates.Interview && a.UpdatedAt >= range.FromUtc && a.UpdatedAt < range.ToUtcPlusOne)
                || a.Interviews.Any(i => i.CreatedAt >= range.FromUtc && i.CreatedAt < range.ToUtcPlusOne), cancellationToken);

        var placed = await _context.Applications
            .AsNoTracking()
            .CountAsync(a => a.ApplicationStatusHistories.Any(h => h.NewStatus == ApplicationStates.Placed && h.ChangedAt >= range.FromUtc && h.ChangedAt < range.ToUtcPlusOne)
                || (a.Status == ApplicationStates.Placed && a.UpdatedAt >= range.FromUtc && a.UpdatedAt < range.ToUtcPlusOne)
                || (a.Placement != null && a.Placement.CreatedAt >= range.FromUtc && a.Placement.CreatedAt < range.ToUtcPlusOne), cancellationToken);

        // 4. Placements phát sinh trong kỳ
        var started = await _context.Placements
            .AsNoTracking()
            .CountAsync(p => (p.ActualStartDate >= range.FromDate && p.ActualStartDate <= range.ToDate)
                || (p.CreatedAt >= range.FromUtc && p.CreatedAt < range.ToUtcPlusOne), cancellationToken);

        var warrantyPassed = await _context.Warranties
            .AsNoTracking()
            .CountAsync(w => w.Status == WarrantyStates.Passed
                && ((w.EndDate != null && w.EndDate >= range.FromDate && w.EndDate <= range.ToDate)
                    || (w.UpdatedAt >= range.FromUtc && w.UpdatedAt < range.ToUtcPlusOne)), cancellationToken);

        var warrantyVoided = await _context.Warranties
            .AsNoTracking()
            .CountAsync(w => w.Status == WarrantyStates.Voided
                && ((w.EndDate != null && w.EndDate >= range.FromDate && w.EndDate <= range.ToDate)
                    || (w.UpdatedAt >= range.FromUtc && w.UpdatedAt < range.ToUtcPlusOne)), cancellationToken);

        // 5. Companies
        var verifiedCompanies = await _context.Companies
            .AsNoTracking()
            .CountAsync(c => c.VerificationStatus == "VERIFIED"
                && ((c.VerifiedAt != null && c.VerifiedAt >= range.FromUtc && c.VerifiedAt < range.ToUtcPlusOne)
                    || (c.UpdatedAt >= range.FromUtc && c.UpdatedAt < range.ToUtcPlusOne)), cancellationToken);

        var pendingCompanies = await _context.Companies
            .AsNoTracking()
            .CountAsync(c => c.VerificationStatus == "PENDING"
                && c.CreatedAt >= range.FromUtc && c.CreatedAt < range.ToUtcPlusOne, cancellationToken);

        // 6. Affiliates
        var activeAffiliates = await _context.AffiliateProfiles
            .AsNoTracking()
            .CountAsync(ap => ap.Status == "ACTIVE"
                && ((ap.VerifiedAt != null && ap.VerifiedAt >= range.FromUtc && ap.VerifiedAt < range.ToUtcPlusOne)
                    || (ap.CreatedAt >= range.FromUtc && ap.CreatedAt < range.ToUtcPlusOne)), cancellationToken);

        var pendingAffiliates = await _context.AffiliateApplications
            .AsNoTracking()
            .CountAsync(aa => (aa.Status == "PENDING" || aa.Status == "UNDER_REVIEW")
                && aa.SubmittedAt >= range.FromUtc && aa.SubmittedAt < range.ToUtcPlusOne, cancellationToken);

        return new ReportOverviewResponse
        {
            Jobs = new ReportOverviewJobs
            {
                ByStatus = byStatus,
                ByServiceType = byServiceType
            },
            Applications = new ReportOverviewApplications
            {
                Submitted = submitted,
                Shortlisted = shortlisted,
                Interview = interview,
                Placed = placed
            },
            Placements = new ReportOverviewPlacements
            {
                Started = started,
                WarrantyPassed = warrantyPassed,
                WarrantyVoided = warrantyVoided
            },
            Companies = new ReportOverviewCompanies
            {
                Verified = verifiedCompanies,
                Pending = pendingCompanies
            },
            Affiliates = new ReportOverviewAffiliates
            {
                Active = activeAffiliates,
                Pending = pendingAffiliates
            }
        };
    }

    public async Task<ReportRevenueResponse> GetRevenueReportAsync(ReportTimeRange range, string groupBy, CancellationToken cancellationToken = default)
    {
        // 1. HEADHUNT_COD từ service_fee
        var headhuntBilled = await _context.ServiceFees
            .AsNoTracking()
            .Where(sf => sf.CreatedAt >= range.FromUtc && sf.CreatedAt < range.ToUtcPlusOne && sf.Status != ServiceFeeStates.Cancelled)
            .SumAsync(sf => sf.Amount, cancellationToken);

        var headhuntCollected = await _context.ServiceFees
            .AsNoTracking()
            .Where(sf => sf.Status == ServiceFeeStates.Paid && sf.PaidAt != null && sf.PaidAt >= range.FromUtc && sf.PaidAt < range.ToUtcPlusOne)
            .SumAsync(sf => sf.Amount, cancellationToken);

        // 2. CV_APPLICATION từ job_posting_fee
        var cvAppBilled = await _context.JobPostingFees
            .AsNoTracking()
            .Where(jpf => jpf.CreatedAt >= range.FromUtc && jpf.CreatedAt < range.ToUtcPlusOne && jpf.Status != "CANCELLED")
            .SumAsync(jpf => jpf.Amount, cancellationToken);

        var cvAppCollected = await _context.JobPostingFees
            .AsNoTracking()
            .Where(jpf => jpf.Status == "PAID" && jpf.PaidAt != null && jpf.PaidAt >= range.FromUtc && jpf.PaidAt < range.ToUtcPlusOne)
            .SumAsync(jpf => jpf.Amount, cancellationToken);

        // 3. Totals
        var totals = new Dictionary<string, RevenueServiceTotalDto>
        {
            ["HEADHUNT_COD"] = new() { Billed = headhuntBilled, Collected = headhuntCollected },
            ["CV_SOURCING"] = new() { Billed = 0m, Collected = 0m },
            ["CV_APPLICATION"] = new() { Billed = cvAppBilled, Collected = cvAppCollected }
        };

        // 4. Series (thu theo collected, gom theo groupBy và timezone UTC+7)
        var headhuntPaidItems = await _context.ServiceFees
            .AsNoTracking()
            .Where(sf => sf.Status == ServiceFeeStates.Paid && sf.PaidAt != null && sf.PaidAt >= range.FromUtc && sf.PaidAt < range.ToUtcPlusOne)
            .Select(sf => new { Amount = sf.Amount, PaidAt = sf.PaidAt!.Value })
            .ToListAsync(cancellationToken);

        var cvAppPaidItems = await _context.JobPostingFees
            .AsNoTracking()
            .Where(jpf => jpf.Status == "PAID" && jpf.PaidAt != null && jpf.PaidAt >= range.FromUtc && jpf.PaidAt < range.ToUtcPlusOne)
            .Select(jpf => new { Amount = jpf.Amount, PaidAt = jpf.PaidAt!.Value })
            .ToListAsync(cancellationToken);

        var periodMap = new SortedDictionary<string, RevenueSeriesItemDto>();

        foreach (var item in headhuntPaidItems)
        {
            var period = FormatPeriod(item.PaidAt.Add(VietnamOffset), groupBy);
            if (!periodMap.TryGetValue(period, out var seriesItem))
            {
                seriesItem = new RevenueSeriesItemDto { Period = period };
                periodMap[period] = seriesItem;
            }
            periodMap[period] = seriesItem with { HEADHUNT_COD = seriesItem.HEADHUNT_COD + item.Amount };
        }

        foreach (var item in cvAppPaidItems)
        {
            var period = FormatPeriod(item.PaidAt.Add(VietnamOffset), groupBy);
            if (!periodMap.TryGetValue(period, out var seriesItem))
            {
                seriesItem = new RevenueSeriesItemDto { Period = period };
                periodMap[period] = seriesItem;
            }
            periodMap[period] = seriesItem with { CV_APPLICATION = seriesItem.CV_APPLICATION + item.Amount };
        }

        // 5. Commission
        var commissionEarned = await _context.Commissions
            .AsNoTracking()
            .Where(c => (c.Status == CommissionStates.Earned || c.Status == CommissionStates.Payable || c.Status == CommissionStates.Paid)
                && c.Placement.Warranty != null
                && c.Placement.Warranty.EndDate != null
                && c.Placement.Warranty.EndDate >= range.FromDate
                && c.Placement.Warranty.EndDate <= range.ToDate)
            .SumAsync(c => c.Amount, cancellationToken);

        var commissionPaid = await _context.Payouts
            .AsNoTracking()
            .Where(p => p.Status == PayoutStates.Completed && p.PayoutDate != null && p.PayoutDate >= range.FromUtc && p.PayoutDate < range.ToUtcPlusOne)
            .SumAsync(p => p.Amount, cancellationToken);

        return new ReportRevenueResponse
        {
            Currency = "VND",
            Totals = totals,
            Series = periodMap.Values.ToList(),
            Commission = new RevenueCommissionDto
            {
                Earned = commissionEarned,
                Paid = commissionPaid
            }
        };
    }

    public async Task<ReportTopAffiliatesResponse> GetTopAffiliatesAsync(
        ReportTimeRange range,
        string sortBy,
        int limit,
        AffiliateRatingConfig ratingConfig,
        CancellationToken cancellationToken = default)
    {
        // Lấy danh sách AffiliateProfiles
        var profiles = await _context.AffiliateProfiles
            .AsNoTracking()
            .Include(ap => ap.User)
            .ToListAsync(cancellationToken);

        // Lấy toàn bộ submissions phát sinh trong kỳ được ứng viên đồng ý
        var validSubmissions = await _context.Submissions
            .AsNoTracking()
            .Where(s => s.SubmittedAt >= range.FromUtc && s.SubmittedAt < range.ToUtcPlusOne
                && (s.Status == "ACCEPTED" || (s.Consent != null && s.Consent.Status == "CONFIRMED")))
            .Select(s => new
            {
                s.SubmissionId,
                s.SubmittedBy,
                Applications = s.Applications.Select(a => new
                {
                    a.ApplicationId,
                    a.Status,
                    HasShortlistedHistory = a.ApplicationStatusHistories.Any(h => h.NewStatus == ApplicationStates.Shortlisted),
                    HasInterviewHistory = a.ApplicationStatusHistories.Any(h => h.NewStatus == ApplicationStates.Interview),
                    HasPlacement = a.Placement != null && (a.Placement.Warranty == null || a.Placement.Warranty.Status != WarrantyStates.Voided)
                }).ToList()
            })
            .ToListAsync(cancellationToken);

        // Lấy hoa hồng phát sinh trong kỳ theo attribution
        var commissionsInPeriod = await _context.Commissions
            .AsNoTracking()
            .Where(c => (c.Status == CommissionStates.Earned || c.Status == CommissionStates.Payable || c.Status == CommissionStates.Paid)
                && c.Placement.Warranty != null
                && c.Placement.Warranty.EndDate != null
                && c.Placement.Warranty.EndDate >= range.FromDate
                && c.Placement.Warranty.EndDate <= range.ToDate)
            .Select(c => new
            {
                c.Amount,
                c.Attribution.AffiliateId
            })
            .ToListAsync(cancellationToken);

        var commissionsByAffiliate = commissionsInPeriod
            .GroupBy(c => c.AffiliateId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var submissionsByUserId = validSubmissions
            .GroupBy(s => s.SubmittedBy)
            .ToDictionary(g => g.Key, g => g.ToList());

        var items = new List<TopAffiliateItemDto>();

        foreach (var profile in profiles)
        {
            var userSubmissions = submissionsByUserId.GetValueOrDefault(profile.UserId) ?? [];
            var totalSubmissions = userSubmissions.Count;

            var totalShortlisted = 0;
            var totalInterviews = 0;
            var totalPlacements = 0;

            foreach (var sub in userSubmissions)
            {
                foreach (var app in sub.Applications)
                {
                    if (app.HasShortlistedHistory || app.Status is ApplicationStates.Shortlisted or ApplicationStates.Interview or ApplicationStates.OfferPending or ApplicationStates.OfferAccepted or ApplicationStates.Placed)
                    {
                        totalShortlisted++;
                    }

                    if (app.HasInterviewHistory || app.Status is ApplicationStates.Interview or ApplicationStates.OfferPending or ApplicationStates.OfferAccepted or ApplicationStates.Placed)
                    {
                        totalInterviews++;
                    }

                    if (app.HasPlacement || app.Status == ApplicationStates.Placed)
                    {
                        totalPlacements++;
                    }
                }
            }

            var ratingResult = AffiliateRatingCalculator.Calculate(totalSubmissions, totalShortlisted, totalPlacements, ratingConfig);
            var commissionEarned = commissionsByAffiliate.GetValueOrDefault(profile.AffiliateId, 0m);

            var fullName = !string.IsNullOrWhiteSpace(profile.DisplayName)
                ? profile.DisplayName
                : (!string.IsNullOrWhiteSpace(profile.User?.DisplayName) ? profile.User.DisplayName : "Affiliate");

            items.Add(new TopAffiliateItemDto
            {
                AffiliateId = profile.AffiliateId,
                FullName = fullName,
                TotalSubmissions = totalSubmissions,
                TotalPlacements = totalPlacements,
                SubmissionToHireRate = ratingResult.SubmissionToHireRate,
                QualityRating = ratingResult.QualityRating,
                RatingLabel = ratingResult.RatingLabel,
                CommissionEarned = commissionEarned
            });
        }

        // Sắp xếp theo sortBy
        IEnumerable<TopAffiliateItemDto> query = items;
        if (sortBy == "SUBMISSION_TO_HIRE_RATE")
        {
            query = query
                .Where(x => x.TotalSubmissions >= ratingConfig.MinSubmissions)
                .OrderByDescending(x => x.SubmissionToHireRate ?? 0)
                .ThenByDescending(x => x.TotalPlacements);
        }
        else if (sortBy == "COMMISSION_EARNED")
        {
            query = query
                .OrderByDescending(x => x.CommissionEarned)
                .ThenByDescending(x => x.TotalPlacements);
        }
        else
        {
            // PLACEMENTS (mặc định)
            query = query
                .OrderByDescending(x => x.TotalPlacements)
                .ThenByDescending(x => x.CommissionEarned);
        }

        return new ReportTopAffiliatesResponse
        {
            Items = query.Take(limit).ToList()
        };
    }

    public async Task<ReportTopCompaniesResponse> GetTopCompaniesAsync(
        ReportTimeRange range,
        string sortBy,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var companies = await _context.Companies
            .AsNoTracking()
            .Select(c => new
            {
                c.CompanyId,
                c.CompanyName,
                c.Industry,
                ActiveJobs = c.Jobs.Count(j => j.Status == "ACTIVE")
            })
            .ToListAsync(cancellationToken);

        // Placements trong kỳ theo company
        var placementsInPeriod = await _context.Placements
            .AsNoTracking()
            .Where(p => (p.ActualStartDate >= range.FromDate && p.ActualStartDate <= range.ToDate)
                || (p.CreatedAt >= range.FromUtc && p.CreatedAt < range.ToUtcPlusOne))
            .Select(p => new
            {
                p.PlacementId,
                CompanyId = p.Application.Job.CompanyId
            })
            .ToListAsync(cancellationToken);

        var placementsByCompany = placementsInPeriod
            .GroupBy(p => p.CompanyId)
            .ToDictionary(g => g.Key, g => g.Count());

        // Doanh thu PAID trong kỳ theo company:
        // 1. ServiceFee
        var serviceFeesPaid = await _context.ServiceFees
            .AsNoTracking()
            .Where(sf => sf.Status == ServiceFeeStates.Paid
                && sf.PaidAt != null
                && sf.PaidAt >= range.FromUtc
                && sf.PaidAt < range.ToUtcPlusOne
                && sf.Placement != null)
            .Select(sf => new
            {
                sf.Amount,
                CompanyId = sf.Placement!.Application.Job.CompanyId
            })
            .ToListAsync(cancellationToken);

        // 2. JobPostingFee
        var jobPostingFeesPaid = await _context.JobPostingFees
            .AsNoTracking()
            .Where(jpf => jpf.Status == "PAID"
                && jpf.PaidAt != null
                && jpf.PaidAt >= range.FromUtc
                && jpf.PaidAt < range.ToUtcPlusOne)
            .Select(jpf => new
            {
                jpf.Amount,
                CompanyId = jpf.Job.CompanyId
            })
            .ToListAsync(cancellationToken);

        var revenueByCompany = new Dictionary<Guid, decimal>();
        foreach (var sf in serviceFeesPaid)
        {
            revenueByCompany[sf.CompanyId] = revenueByCompany.GetValueOrDefault(sf.CompanyId, 0m) + sf.Amount;
        }
        foreach (var jpf in jobPostingFeesPaid)
        {
            revenueByCompany[jpf.CompanyId] = revenueByCompany.GetValueOrDefault(jpf.CompanyId, 0m) + jpf.Amount;
        }

        var items = companies.Select(c => new TopCompanyItemDto
        {
            CompanyId = c.CompanyId,
            CompanyName = c.CompanyName,
            Industry = c.Industry,
            ActiveJobs = c.ActiveJobs,
            Placements = placementsByCompany.GetValueOrDefault(c.CompanyId, 0),
            RevenueCollected = revenueByCompany.GetValueOrDefault(c.CompanyId, 0m)
        });

        // Sắp xếp theo sortBy
        IEnumerable<TopCompanyItemDto> query = items;
        if (sortBy == "REVENUE")
        {
            query = query
                .OrderByDescending(x => x.RevenueCollected)
                .ThenByDescending(x => x.Placements);
        }
        else if (sortBy == "ACTIVE_JOBS")
        {
            query = query
                .OrderByDescending(x => x.ActiveJobs)
                .ThenByDescending(x => x.Placements);
        }
        else
        {
            // PLACEMENTS (mặc định)
            query = query
                .OrderByDescending(x => x.Placements)
                .ThenByDescending(x => x.RevenueCollected);
        }

        return new ReportTopCompaniesResponse
        {
            Items = query.Take(limit).ToList()
        };
    }

    private static string FormatPeriod(DateTime dt, string groupBy) => groupBy switch
    {
        "QUARTER" => $"{dt.Year}-Q{(dt.Month - 1) / 3 + 1}",
        "YEAR" => dt.Year.ToString(),
        _ => $"{dt.Year:D4}-{dt.Month:D2}"
    };
}
