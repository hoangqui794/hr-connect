using FluentValidation;

namespace HRConnect.Application.Features.Admin.Approvals.RejectAffiliate;

public class RejectAffiliateCommandValidator : AbstractValidator<RejectAffiliateCommand>
{
    public RejectAffiliateCommandValidator()
    {
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Lý do từ chối không được để trống.")
            .MaximumLength(500).WithMessage("Lý do từ chối không được vượt quá 500 ký tự.");
    }
}
