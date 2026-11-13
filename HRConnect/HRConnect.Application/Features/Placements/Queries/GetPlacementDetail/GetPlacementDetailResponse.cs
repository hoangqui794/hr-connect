using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Placements.Queries.GetPlacementDetail;

public record GetPlacementDetailResponse(
    Guid PlacementId,
    Guid ApplicationId,
    Guid OfferId,
    DateOnly ActualStartDate,
    string? Position,
    string? Department,
    string Status,
    DateTime ConfirmedAt,
    Guid? ConfirmedBy,
    string? ConfirmedByName,
    string? ConfirmationNote,
    bool IsReplacement,
    Guid? ReplacementSlotId,
    Guid? ReplacesPlacementId,
    PlacementDetailCandidateDto Candidate,
    PlacementDetailJobDto Job,
    PlacementDetailOfferDto Offer,
    PlacementDetailProbationDto? Probation,
    PlacementDetailWarrantyDto? Warranty,
    IReadOnlyList<string> AllowedActions,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    PlacementDetailFinancialDto? Financial = null
);

/// <summary>
/// Phí dịch vụ của placement (HEADHUNT_COD) và hoa hồng Affiliate. Client chỉ thấy phí dịch vụ;
/// hoa hồng chỉ trả cho Internal HR/Admin. Ứng viên không nhận khối này.
/// </summary>
public record PlacementDetailFinancialDto(
    decimal? ServiceFeeAmount,
    string? ServiceFeeStatus,
    decimal? CommissionAmount,
    string? CommissionStatus
);

public record PlacementDetailCandidateDto(
    Guid CandidateId,
    string FullName,
    string Email,
    string? Phone,
    string? Summary
);

public record PlacementDetailJobDto(
    Guid JobId,
    string Title,
    Guid CompanyId,
    string CompanyName
);

public record PlacementDetailOfferDto(
    Guid OfferId,
    decimal? Salary,
    string? CurrencyCode,
    DateOnly? StartDate,
    string Status,
    string? OfferDocumentUrl
);

public record PlacementDetailProbationDto(
    Guid ProbationId,
    DateOnly StartDate,
    DateOnly? EndDate,
    string? Result,
    string? Notes
);

public record PlacementDetailWarrantyDto(
    Guid WarrantyId,
    DateOnly StartDate,
    DateOnly? EndDate,
    string Status,
    string? ResultNote
);
