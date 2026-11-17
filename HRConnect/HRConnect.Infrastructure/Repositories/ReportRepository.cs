using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Admin.Dashboard;
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
        const string primaryCurrency = "VND";
        static string NormalizeCurrency(string? code) =>
            string.IsNullOrWhiteSpace(code) ? primaryCurrency : code.Trim().ToUpperInvariant();

        // 1. service_fee: PLACEMENT là HEADHUNT_COD; DEPOSIT + SETTLEMENT − CREDIT (hoàn cọc) là CV_SOURCING.
        var billedFees = await _context.ServiceFees
            .AsNoTracking()
            .Where(sf => sf.CreatedAt >= range.FromUtc && sf.CreatedAt < range.ToUtcPlusOne && sf.Status != ServiceFeeStates.Cancelled)
            .Select(sf => new { sf.Kind, sf.Amount, sf.CurrencyCode })
            .ToListAsync(cancellationToken);

        var collectedFees = await _context.ServiceFees
            .AsNoTracking()
            .Where(sf => sf.Status == ServiceFeeStates.Paid && sf.PaidAt != null && sf.PaidAt >= range.FromUtc && sf.PaidAt < range.ToUtcPlusOne)
            .Select(sf => new { sf.Kind, sf.Amount, sf.CurrencyCode, PaidAt = sf.PaidAt!.Value })
            .ToListAsync(cancellationToken);

        // 2. CV_APPLICATION từ job_posting_fee
        var cvAppBilledItems = await _context.JobPostingFees
            .AsNoTracking()
            .Where(jpf => jpf.CreatedAt >= range.FromUtc && jpf.CreatedAt < range.ToUtcPlusOne && jpf.Status != "CANCELLED")
            .Select(jpf => new { jpf.Amount, jpf.CurrencyCode })
            .ToListAsync(cancellationToken);

        var cvAppPaidItems = await _context.JobPostingFees
            .AsNoTracking()
            .Where(jpf => jpf.Status == "PAID" && jpf.PaidAt != null && jpf.PaidAt >= range.FromUtc && jpf.PaidAt < range.ToUtcPlusOne)
            .Select(jpf => new { jpf.Amount, jpf.CurrencyCode, PaidAt = jpf.PaidAt!.Value })
            .ToListAsync(cancellationToken);

        // 3. Commission: HEADHUNT_COD đạt khi hết bảo hành; CV_SOURCING đạt khi CV được chấp nhận.
        var earnedCommissions = await EarnedCommissionsInPeriod(range)
            .Select(c => new
            {
                c.Amount,
                CurrencyCode = c.Placement != null && c.Placement.ServiceFee != null
                    ? c.Placement.ServiceFee.CurrencyCode
                    : (c.Placement != null && c.Placement.Application != null && c.Placement.Application.Job != null
                        ? c.Placement.Application.Job.CurrencyCode
                        : (c.SourcingDelivery != null && c.SourcingDelivery.Job != null
                            ? c.SourcingDelivery.Job.CurrencyCode
                            : null))
            })
            .ToListAsync(cancellationToken);

        var completedPayouts = await _context.Payouts
            .AsNoTracking()
            .Where(p => p.Status == PayoutStates.Completed && p.PayoutDate != null && p.PayoutDate >= range.FromUtc && p.PayoutDate < range.ToUtcPlusOne)
            .Select(p => new
            {
                p.Amount,
                CurrencyCode = p.Commission != null && p.Commission.Placement != null && p.Commission.Placement.ServiceFee != null
                    ? p.Commission.Placement.ServiceFee.CurrencyCode
                    : (p.Commission != null && p.Commission.Placement != null && p.Commission.Placement.Application != null && p.Commission.Placement.Application.Job != null
                        ? p.Commission.Placement.Application.Job.CurrencyCode
                        : (p.Commission != null && p.Commission.SourcingDelivery != null && p.Commission.SourcingDelivery.Job != null
                            ? p.Commission.SourcingDelivery.Job.CurrencyCode
                            : null))
            })
            .ToListAsync(cancellationToken);

        RevenueCurrencySummaryDto SummarizeCurrency(string currency)
        {
            var hhBilled = billedFees
                .Where(f => NormalizeCurrency(f.CurrencyCode) == currency && IsHeadhuntKind(f.Kind))
                .Sum(f => SignedAmount(f.Kind, f.Amount));
            var hhCollected = collectedFees
                .Where(f => NormalizeCurrency(f.CurrencyCode) == currency && IsHeadhuntKind(f.Kind))
                .Sum(f => SignedAmount(f.Kind, f.Amount));
            var srcBilled = billedFees
                .Where(f => NormalizeCurrency(f.CurrencyCode) == currency && !IsHeadhuntKind(f.Kind))
                .Sum(f => SignedAmount(f.Kind, f.Amount));
            var srcCollected = collectedFees
                .Where(f => NormalizeCurrency(f.CurrencyCode) == currency && !IsHeadhuntKind(f.Kind))
                .Sum(f => SignedAmount(f.Kind, f.Amount));
            var appBilled = cvAppBilledItems
                .Where(f => NormalizeCurrency(f.CurrencyCode) == currency)
                .Sum(f => f.Amount);
            var appCollected = cvAppPaidItems
                .Where(f => NormalizeCurrency(f.CurrencyCode) == currency)
                .Sum(f => f.Amount);

            return new RevenueCurrencySummaryDto
            {
                Totals = new Dictionary<string, RevenueServiceTotalDto>
                {
                    ["HEADHUNT_COD"] = new() { Billed = hhBilled, Collected = hhCollected },
                    ["CV_SOURCING"] = new() { Billed = srcBilled, Collected = srcCollected },
                    ["CV_APPLICATION"] = new() { Billed = appBilled, Collected = appCollected }
                },
                Commission = new RevenueCommissionDto
                {
                    Earned = earnedCommissions.Where(c => NormalizeCurrency(c.CurrencyCode) == currency).Sum(c => c.Amount),
                    Paid = completedPayouts.Where(p => NormalizeCurrency(p.CurrencyCode) == currency).Sum(p => p.Amount)
                }
            };
        }

        // Tổng hợp riêng cho từng loại tiền tệ (không cộng gộp 1:1 giữa USD/VND).
        var currencies = billedFees.Select(f => NormalizeCurrency(f.CurrencyCode))
            .Concat(collectedFees.Select(f => NormalizeCurrency(f.CurrencyCode)))
            .Concat(cvAppBilledItems.Select(f => NormalizeCurrency(f.CurrencyCode)))
            .Concat(cvAppPaidItems.Select(f => NormalizeCurrency(f.CurrencyCode)))
            .Concat(earnedCommissions.Select(c => NormalizeCurrency(c.CurrencyCode)))
            .Concat(completedPayouts.Select(p => NormalizeCurrency(p.CurrencyCode)))
            .Append(primaryCurrency)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var byCurrency = currencies.ToDictionary(c => c, SummarizeCurrency, StringComparer.OrdinalIgnoreCase);
        var primarySummary = byCurrency[primaryCurrency];

        // 4. Series cho báo cáo chính (thu theo collected VND, gom theo groupBy và timezone UTC+7)
        var periodMap = new SortedDictionary<string, RevenueSeriesItemDto>();

        foreach (var item in collectedFees.Where(f => NormalizeCurrency(f.CurrencyCode) == primaryCurrency))
        {
            var period = FormatPeriod(item.PaidAt.Add(VietnamOffset), groupBy);
            if (!periodMap.TryGetValue(period, out var seriesItem))
            {
                seriesItem = new RevenueSeriesItemDto { Period = period };
                periodMap[period] = seriesItem;
            }
            periodMap[period] = IsHeadhuntKind(item.Kind)
                ? seriesItem with { HEADHUNT_COD = seriesItem.HEADHUNT_COD + SignedAmount(item.Kind, item.Amount) }
                : seriesItem with { CV_SOURCING = seriesItem.CV_SOURCING + SignedAmount(item.Kind, item.Amount) };
        }

        foreach (var item in cvAppPaidItems.Where(f => NormalizeCurrency(f.CurrencyCode) == primaryCurrency))
        {
            var period = FormatPeriod(item.PaidAt.Add(VietnamOffset), groupBy);
            if (!periodMap.TryGetValue(period, out var seriesItem))
            {
                seriesItem = new RevenueSeriesItemDto { Period = period };
                periodMap[period] = seriesItem;
            }
            periodMap[period] = seriesItem with { CV_APPLICATION = seriesItem.CV_APPLICATION + item.Amount };
        }

        return new ReportRevenueResponse
        {
            Currency = primaryCurrency,
            Totals = primarySummary.Totals,
            Series = periodMap.Values.ToList(),
            Commission = primarySummary.Commission,
            ByCurrency = byCurrency
        };
    }

    /// <summary>CV_SOURCING fees in revenue: a CREDIT is deposit refunded to the Client.</summary>
    private static bool IsHeadhuntKind(string kind) =>
        kind is ServiceFeeKinds.Placement or ServiceFeeKinds.ReplacementRefund;

    /// <summary>Money returned to the Client lowers revenue.</summary>
    private static decimal SignedAmount(string kind, decimal amount) =>
        ServiceFeeKinds.OwedToClient.Contains(kind) ? -amount : amount;

    /// <summary>
    /// Commissions earned in the period: HEADHUNT_COD when the warranty ends inside it,
    /// CV_SOURCING when the CV was accepted (commission created) inside it.
    /// </summary>
    private IQueryable<HRConnect.Domain.Entities.Commission> EarnedCommissionsInPeriod(ReportTimeRange range) =>
        _context.Commissions
            .AsNoTracking()
            .Where(c => (c.Status == CommissionStates.Earned || c.Status == CommissionStates.Payable || c.Status == CommissionStates.Paid)
                && ((c.Placement != null
                        && c.Placement.Warranty != null
                        && c.Placement.Warranty.EndDate != null
                        && c.Placement.Warranty.EndDate >= range.FromDate
                        && c.Placement.Warranty.EndDate <= range.ToDate)
                    || (c.SourcingDeliveryId != null
                        && c.CreatedAt >= range.FromUtc
                        && c.CreatedAt < range.ToUtcPlusOne)));

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
        var commissionsInPeriod = await EarnedCommissionsInPeriod(range)
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
                && sf.PaidAt < range.ToUtcPlusOne)
            .Select(sf => new
            {
                // A CREDIT or REPLACEMENT_REFUND goes back to the Client, so it lowers the company revenue.
                Amount = ServiceFeeKinds.OwedToClient.Contains(sf.Kind) ? -sf.Amount : sf.Amount,
                sf.CompanyId
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

    // =========================================================================
    // Admin dashboard (GET /api/v1/admin/dashboard/metrics)
    // Money conditions mirror GetRevenueReportAsync (collectedFees, cvAppPaidItems, completedPayouts);
    // ReportFeaturesTests / AdminDashboardMetricsTests reconcile both against the same data.
    // Days are Vietnam-time days (timestamp UTC + 7h), like the revenue report series.
    // =========================================================================

    private const string DashboardCurrency = "VND";
    private const double VietnamOffsetHours = 7;
    /// <summary>job_posting_fee.status of a collected posting fee (same literal as the revenue block).</summary>
    private const string PostingFeePaidStatus = "PAID";
    /// <summary>Status that ApprovalRepository.GetApprovalsAsync filters on for the Approvals page.</summary>
    private const string ApprovalUnderReviewStatus = "UNDER_REVIEW";

    /// <summary>A money movement, flattened so it can be filtered by currency and grouped by day in SQL.</summary>
    private sealed class DashboardMoneyRow
    {
        public string Kind { get; init; } = string.Empty;
        public decimal Amount { get; init; }
        public string? CurrencyCode { get; init; }
        public DateTime At { get; init; }
    }

    /// <summary>Same as GetRevenueReportAsync.collectedFees: PAID service fees by PaidAt.</summary>
    private IQueryable<DashboardMoneyRow> PaidServiceFeesInPeriod(ReportTimeRange range) =>
        _context.ServiceFees
            .AsNoTracking()
            .Where(sf => sf.Status == ServiceFeeStates.Paid && sf.PaidAt != null && sf.PaidAt >= range.FromUtc && sf.PaidAt < range.ToUtcPlusOne)
            .Select(sf => new DashboardMoneyRow { Kind = sf.Kind, Amount = sf.Amount, CurrencyCode = sf.CurrencyCode, At = sf.PaidAt!.Value });

    /// <summary>Same as GetRevenueReportAsync.cvAppPaidItems: PAID posting fees by PaidAt.</summary>
    private IQueryable<DashboardMoneyRow> PaidPostingFeesInPeriod(ReportTimeRange range) =>
        _context.JobPostingFees
            .AsNoTracking()
            .Where(jpf => jpf.Status == PostingFeePaidStatus && jpf.PaidAt != null && jpf.PaidAt >= range.FromUtc && jpf.PaidAt < range.ToUtcPlusOne)
            .Select(jpf => new DashboardMoneyRow { Amount = jpf.Amount, CurrencyCode = jpf.CurrencyCode, At = jpf.PaidAt!.Value });

    /// <summary>Same as GetRevenueReportAsync.completedPayouts: COMPLETED payouts by PayoutDate, currency from the commission's source.</summary>
    private IQueryable<DashboardMoneyRow> CompletedPayoutsInPeriod(ReportTimeRange range) =>
        _context.Payouts
            .AsNoTracking()
            .Where(p => p.Status == PayoutStates.Completed && p.PayoutDate != null && p.PayoutDate >= range.FromUtc && p.PayoutDate < range.ToUtcPlusOne)
            .Select(p => new DashboardMoneyRow
            {
                Amount = p.Amount,
                CurrencyCode = p.Commission != null && p.Commission.Placement != null && p.Commission.Placement.ServiceFee != null
                    ? p.Commission.Placement.ServiceFee.CurrencyCode
                    : (p.Commission != null && p.Commission.Placement != null && p.Commission.Placement.Application != null && p.Commission.Placement.Application.Job != null
                        ? p.Commission.Placement.Application.Job.CurrencyCode
                        : (p.Commission != null && p.Commission.SourcingDelivery != null && p.Commission.SourcingDelivery.Job != null
                            ? p.Commission.SourcingDelivery.Job.CurrencyCode
                            : null)),
                At = p.PayoutDate!.Value
            });

    /// <summary>NormalizeCurrency(code) == VND, written so PostgreSQL can evaluate it.</summary>
    private static IQueryable<DashboardMoneyRow> OnlyDashboardCurrency(IQueryable<DashboardMoneyRow> rows) =>
        rows.Where(r => (r.CurrencyCode == null || r.CurrencyCode.Trim() == string.Empty ? DashboardCurrency : r.CurrencyCode.Trim().ToUpper()) == DashboardCurrency);

    private static async Task<Dictionary<DateOnly, decimal>> SumByVietnamDayAsync(IQueryable<DashboardMoneyRow> rows, CancellationToken cancellationToken)
    {
        var grouped = await OnlyDashboardCurrency(rows)
            .GroupBy(r => r.At.AddHours(VietnamOffsetHours).Date)
            .Select(g => new { Day = g.Key, Amount = g.Sum(r => r.Amount) })
            .ToListAsync(cancellationToken);

        return grouped.ToDictionary(g => DateOnly.FromDateTime(g.Day), g => g.Amount);
    }

    private static async Task<Dictionary<DateOnly, int>> CountByVietnamDayAsync(IQueryable<DateTime> timestamps, CancellationToken cancellationToken)
    {
        var grouped = await timestamps
            .GroupBy(t => t.AddHours(VietnamOffsetHours).Date)
            .Select(g => new { Day = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        return grouped.ToDictionary(g => DateOnly.FromDateTime(g.Day), g => g.Count);
    }

    public async Task<IReadOnlyList<DashboardCashflowDay>> GetDashboardCashflowByDayAsync(ReportTimeRange range, CancellationToken cancellationToken = default)
    {
        // CREDIT / REPLACEMENT_REFUND are paid back to the Client: never counted as fees collected.
        var serviceFees = await SumByVietnamDayAsync(
            PaidServiceFeesInPeriod(range).Where(r => !ServiceFeeKinds.OwedToClient.Contains(r.Kind)), cancellationToken);
        var refunds = await SumByVietnamDayAsync(
            PaidServiceFeesInPeriod(range).Where(r => ServiceFeeKinds.OwedToClient.Contains(r.Kind)), cancellationToken);
        // FREE_TIER packages record a 0 VND posting fee.
        var postingFees = await SumByVietnamDayAsync(
            PaidPostingFeesInPeriod(range).Where(r => r.Amount > 0), cancellationToken);
        var payouts = await SumByVietnamDayAsync(CompletedPayoutsInPeriod(range), cancellationToken);

        return serviceFees.Keys
            .Concat(refunds.Keys)
            .Concat(postingFees.Keys)
            .Concat(payouts.Keys)
            .Distinct()
            .OrderBy(d => d)
            .Select(d => new DashboardCashflowDay(
                d,
                serviceFees.GetValueOrDefault(d),
                refunds.GetValueOrDefault(d),
                postingFees.GetValueOrDefault(d),
                payouts.GetValueOrDefault(d)))
            .ToList();
    }

    public async Task<IReadOnlyList<DashboardActivityDay>> GetDashboardActivityByDayAsync(ReportTimeRange range, CancellationToken cancellationToken = default)
    {
        var newUsers = await CountByVietnamDayAsync(
            _context.AppUsers.AsNoTracking()
                .Where(u => u.CreatedAt >= range.FromUtc && u.CreatedAt < range.ToUtcPlusOne)
                .Select(u => u.CreatedAt),
            cancellationToken);

        var auditEvents = await CountByVietnamDayAsync(
            _context.AuditLogs.AsNoTracking()
                .Where(a => a.CreatedAt >= range.FromUtc && a.CreatedAt < range.ToUtcPlusOne)
                .Select(a => a.CreatedAt),
            cancellationToken);

        // The Approvals page lists these two sources (ApprovalRepository.GetApprovalsAsync).
        var affiliateReviews = await CountByVietnamDayAsync(
            _context.AffiliateApplications.AsNoTracking()
                .Where(a => a.ReviewedAt != null && a.ReviewedAt >= range.FromUtc && a.ReviewedAt < range.ToUtcPlusOne)
                .Select(a => a.ReviewedAt!.Value),
            cancellationToken);

        var companyReviews = await CountByVietnamDayAsync(
            _context.CompanyVerificationRequests.AsNoTracking()
                .Where(c => c.ReviewedAt != null && c.ReviewedAt >= range.FromUtc && c.ReviewedAt < range.ToUtcPlusOne)
                .Select(c => c.ReviewedAt!.Value),
            cancellationToken);

        return newUsers.Keys
            .Concat(auditEvents.Keys)
            .Concat(affiliateReviews.Keys)
            .Concat(companyReviews.Keys)
            .Distinct()
            .OrderBy(d => d)
            .Select(d => new DashboardActivityDay(
                d,
                newUsers.GetValueOrDefault(d),
                auditEvents.GetValueOrDefault(d),
                affiliateReviews.GetValueOrDefault(d) + companyReviews.GetValueOrDefault(d)))
            .ToList();
    }

    public async Task<DashboardKpiSnapshot> GetDashboardKpisAsync(DateTime todayStartUtc, CancellationToken cancellationToken = default)
    {
        var pendingAffiliateApprovals = await _context.AffiliateApplications.AsNoTracking()
            .CountAsync(a => a.Status == ApprovalUnderReviewStatus, cancellationToken);
        var pendingCompanyApprovals = await _context.CompanyVerificationRequests.AsNoTracking()
            .CountAsync(c => c.Status == ApprovalUnderReviewStatus, cancellationToken);

        var activeUsers = await _context.AppUsers.AsNoTracking()
            .CountAsync(u => u.Status == UserAccountStates.Active, cancellationToken);
        var suspendedUsers = await _context.AppUsers.AsNoTracking()
            .CountAsync(u => u.Status == UserAccountStates.Suspended, cancellationToken);

        var auditEventsToday = await _context.AuditLogs.AsNoTracking()
            .CountAsync(a => a.CreatedAt >= todayStartUtc, cancellationToken);

        // Overdue fees the Client owes HR Connect; money owed to the Client is never overdue.
        var overdueFees = _context.ServiceFees.AsNoTracking()
            .Where(sf => sf.Status == ServiceFeeStates.Overdue && !ServiceFeeKinds.OwedToClient.Contains(sf.Kind));
        var overdueCount = await overdueFees.CountAsync(cancellationToken);
        var overdueAmount = await OnlyDashboardCurrency(overdueFees.Select(sf => new DashboardMoneyRow
            {
                Kind = sf.Kind,
                Amount = sf.Amount,
                CurrencyCode = sf.CurrencyCode,
                At = sf.CreatedAt
            }))
            .SumAsync(r => r.Amount, cancellationToken);

        var payableCommissions = _context.Commissions.AsNoTracking()
            .Where(c => c.Status == CommissionStates.Payable);
        var payableCount = await payableCommissions.CountAsync(cancellationToken);
        var payableAmount = await OnlyDashboardCurrency(payableCommissions.Select(c => new DashboardMoneyRow
            {
                Amount = c.Amount,
                CurrencyCode = c.Placement != null && c.Placement.ServiceFee != null
                    ? c.Placement.ServiceFee.CurrencyCode
                    : (c.Placement != null && c.Placement.Application != null && c.Placement.Application.Job != null
                        ? c.Placement.Application.Job.CurrencyCode
                        : (c.SourcingDelivery != null && c.SourcingDelivery.Job != null
                            ? c.SourcingDelivery.Job.CurrencyCode
                            : null)),
                At = c.CreatedAt
            }))
            .SumAsync(r => r.Amount, cancellationToken);

        var openDisputes = await _context.Disputes.AsNoTracking()
            .CountAsync(d => d.Status == DisputeStates.Open || d.Status == DisputeStates.UnderReview, cancellationToken);

        return new DashboardKpiSnapshot(
            pendingAffiliateApprovals + pendingCompanyApprovals,
            activeUsers,
            suspendedUsers,
            auditEventsToday,
            overdueCount,
            overdueAmount,
            payableCount,
            payableAmount,
            openDisputes);
    }

    public async Task<IReadOnlyList<DashboardRoleCount>> GetDashboardUserRoleCountsAsync(CancellationToken cancellationToken = default)
    {
        // Same assignment filter as UserRepository.GetAuthorizationSnapshotAsync, plus not revoked.
        var counts = await _context.UserRoles.AsNoTracking()
            .Where(ur => ur.Status == UserRoleAssignmentStates.Active && ur.RevokedAt == null && ur.Role.IsActive)
            .GroupBy(ur => ur.Role.Code)
            .Select(g => new { Role = g.Key, Count = g.Select(ur => ur.UserId).Distinct().Count() })
            .ToListAsync(cancellationToken);

        var byRole = counts.ToDictionary(c => c.Role, c => c.Count, StringComparer.Ordinal);
        return RoleCodes.All
            .Select(role => new DashboardRoleCount(role, byRole.GetValueOrDefault(role)))
            .ToList();
    }

    private static string FormatPeriod(DateTime dt, string groupBy) => groupBy switch
    {
        "QUARTER" => $"{dt.Year}-Q{(dt.Month - 1) / 3 + 1}",
        "YEAR" => dt.Year.ToString(),
        _ => $"{dt.Year:D4}-{dt.Month:D2}"
    };
}
