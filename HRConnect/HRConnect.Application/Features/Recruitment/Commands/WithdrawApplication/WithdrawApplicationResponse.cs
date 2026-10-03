namespace HRConnect.Application.Features.Recruitment.Commands.WithdrawApplication;

public record WithdrawApplicationResponse(
    Guid ApplicationId,
    string ApplicationStatus,
    int CancelledInterviewCount,
    int WithdrawnOfferCount,
    Guid ConcurrencyToken,
    DateTime WithdrawnAt);
