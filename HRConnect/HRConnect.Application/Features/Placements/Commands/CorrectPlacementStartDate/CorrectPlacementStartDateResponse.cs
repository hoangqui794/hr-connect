namespace HRConnect.Application.Features.Placements.Commands.CorrectPlacementStartDate;

public record CorrectPlacementStartDateResponse(
    Guid PlacementId,
    DateOnly PreviousActualStartDate,
    DateOnly ActualStartDate,
    DateOnly? PreviousWarrantyEndDate,
    DateOnly? WarrantyEndDate,
    DateOnly? PreviousServiceFeeDueDate,
    DateOnly? ServiceFeeDueDate,
    DateTime UpdatedAt
);
