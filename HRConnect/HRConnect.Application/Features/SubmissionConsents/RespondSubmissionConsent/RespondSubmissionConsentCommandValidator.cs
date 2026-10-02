using FluentValidation;

namespace HRConnect.Application.Features.SubmissionConsents.RespondSubmissionConsent;

public sealed class RespondSubmissionConsentCommandValidator : AbstractValidator<RespondSubmissionConsentCommand>
{
    public RespondSubmissionConsentCommandValidator()
    {
        RuleFor(x => x.Token).MaximumLength(200);
        RuleFor(x => x)
            .Must(x => (!string.IsNullOrWhiteSpace(x.Token)) ^ x.SubmissionId.HasValue)
            .WithMessage("Phải cung cấp đúng một nguồn xác định yêu cầu: token email hoặc submissionId.");
        RuleFor(x => x.Decision)
            .Must(value => value is not null &&
                           (value.Equals("CONFIRM", StringComparison.OrdinalIgnoreCase) ||
                            value.Equals("DECLINE", StringComparison.OrdinalIgnoreCase)))
            .WithMessage("Decision chỉ nhận CONFIRM hoặc DECLINE.");
    }
}
