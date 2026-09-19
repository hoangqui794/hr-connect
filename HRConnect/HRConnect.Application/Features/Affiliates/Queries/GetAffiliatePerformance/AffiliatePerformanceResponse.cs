namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliatePerformance;

public class AffiliatePerformanceResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Lấy thống kê hiệu suất đối tác tuyển dụng thành công.";
    public AffiliatePerformanceData? Data { get; set; }
}

public class AffiliatePerformanceData
{
    public Guid AffiliateId { get; set; }
    public string? DisplayName { get; set; }
    public string AffiliateType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateOnly? PeriodStart { get; set; }
    public DateOnly? PeriodEnd { get; set; }
    public int TotalSubmissions { get; set; }
    public int TotalShortlisted { get; set; }
    public int TotalInterviews { get; set; }
    public int TotalPlacements { get; set; }
    public decimal? SubmissionToHireRate { get; set; }
    public decimal? QualityRating { get; set; }
    public string? RatingLabel { get; set; }
    public string? CalculationVersion { get; set; }
    public DateTime? CalculatedAt { get; set; }
}
