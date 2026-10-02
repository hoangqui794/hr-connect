using MediatR;

namespace HRConnect.Application.Features.Affiliates.Commands.ResendSubmissionConsent;

public sealed record ResendSubmissionConsentCommand(Guid SubmissionId, Guid UserId) : IRequest<ResendSubmissionConsentResponse>;

public sealed class ResendSubmissionConsentResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = null!;
    public Guid SubmissionId { get; set; }
    public string Status { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public int EmailSendCount { get; set; }
    public string EmailDeliveryStatus { get; set; } = null!;
}
