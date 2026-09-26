using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Offers.Queries.GetOffers;

public class GetOffersResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy danh sách lời mời nhận việc thành công.";

    public GetOffersData Data { get; set; } = new();
}

public class GetOffersData
{
    public List<OfferItemDto> Items { get; set; } = new();

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int Total { get; set; }

    public int TotalPages { get; set; }
}

public class OfferItemDto
{
    public Guid OfferId { get; set; }

    public Guid ApplicationId { get; set; }

    public Guid JobId { get; set; }

    public string JobTitle { get; set; } = string.Empty;

    public Guid CompanyId { get; set; }

    public string CompanyName { get; set; } = string.Empty;

    public Guid CandidateId { get; set; }

    public string CandidateName { get; set; } = string.Empty;

    public string? CandidateEmail { get; set; }

    public string? CandidatePhone { get; set; }

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

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid ConcurrencyToken { get; set; }
}
