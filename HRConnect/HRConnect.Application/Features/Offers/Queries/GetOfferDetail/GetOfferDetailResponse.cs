using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Offers.Queries.GetOfferDetail;

public class GetOfferDetailResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy thông tin chi tiết lời mời nhận việc thành công.";

    public OfferDetailDto Data { get; set; } = new();
}

public class OfferDetailDto
{
    public Guid OfferId { get; set; }

    public Guid ApplicationId { get; set; }

    public JobDetailDto Job { get; set; } = new();

    public CandidateDetailDto Candidate { get; set; } = new();

    public int OfferVersion { get; set; }

    public decimal? Salary { get; set; }

    public string CurrencyCode { get; set; } = "VND";

    public DateOnly? StartDate { get; set; }

    public DateOnly? ExpiryDate { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? OfferDocumentUrl { get; set; }

    public DateTime? SentAt { get; set; }

    public DateTime? RespondedAt { get; set; }

    public string? DeclineReason { get; set; }

    public Guid ConcurrencyToken { get; set; }

    public CreatedByDto? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public List<OfferApprovalSummaryDto> Approvals { get; set; } = new();

    public List<PlacementSummaryDto> Placements { get; set; } = new();
}

public class JobDetailDto
{
    public Guid JobId { get; set; }

    public string Title { get; set; } = string.Empty;

    public Guid CompanyId { get; set; }

    public string CompanyName { get; set; } = string.Empty;
}

public class CandidateDetailDto
{
    public Guid CandidateId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string? Email { get; set; }

    public string? Phone { get; set; }
}

public class CreatedByDto
{
    public Guid UserId { get; set; }

    public string? DisplayName { get; set; }

    public string? Email { get; set; }
}

public class OfferApprovalSummaryDto
{
    public Guid ApprovalId { get; set; }

    public Guid UserId { get; set; }

    public string? ApproverName { get; set; }

    public string? ApprovalType { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? Comment { get; set; }

    public DateTime CreatedAt { get; set; }
}

public class PlacementSummaryDto
{
    public Guid PlacementId { get; set; }

    public DateOnly ActualStartDate { get; set; }

    public string? Position { get; set; }

    public string? Department { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTime ConfirmedAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
