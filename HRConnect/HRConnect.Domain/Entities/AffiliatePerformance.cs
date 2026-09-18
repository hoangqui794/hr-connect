using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// D17-ready performance snapshot. submission_to_hire_rate is supported; quality_rating stays nullable until the rating formula is approved.
/// </summary>
public partial class AffiliatePerformance
{
    public Guid AffiliatePerformanceId { get; set; }

    public Guid AffiliateId { get; set; }

    public DateOnly PeriodStart { get; set; }

    public DateOnly PeriodEnd { get; set; }

    public int TotalSubmissions { get; set; }

    public int TotalShortlisted { get; set; }

    public int TotalInterviews { get; set; }

    public int TotalPlacements { get; set; }

    public decimal? SubmissionToHireRate { get; set; }

    public decimal? QualityRating { get; set; }

    public string? RatingLabel { get; set; }

    public string? CalculationVersion { get; set; }

    public DateTime CalculatedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual AffiliateProfile Affiliate { get; set; } = null!;
}

