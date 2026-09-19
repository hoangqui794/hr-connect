using FluentValidation;

namespace HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateBankAccount;

public class UpdateAffiliateBankAccountCommandValidator : AbstractValidator<UpdateAffiliateBankAccountCommand>
{
    public UpdateAffiliateBankAccountCommandValidator()
    {
        RuleFor(x => x.BankName)
            .NotEmpty().WithMessage("Tên ngân hàng không được để trống.")
            .MinimumLength(2).WithMessage("Tên ngân hàng phải có ít nhất 2 ký tự.")
            .MaximumLength(100).WithMessage("Tên ngân hàng không được vượt quá 100 ký tự.");

        RuleFor(x => x.BankAccountNumber)
            .NotEmpty().WithMessage("Số tài khoản ngân hàng không được để trống.")
            .MinimumLength(5).WithMessage("Số tài khoản ngân hàng phải có ít nhất 5 ký tự.")
            .MaximumLength(50).WithMessage("Số tài khoản ngân hàng không được vượt quá 50 ký tự.")
            .Matches(@"^[a-zA-Z0-9]+$").WithMessage("Số tài khoản ngân hàng chỉ được chứa chữ cái và chữ số, không chứa ký tự đặc biệt hoặc khoảng trắng.");

        RuleFor(x => x.BankAccountHolder)
            .NotEmpty().WithMessage("Tên chủ tài khoản không được để trống.")
            .MinimumLength(2).WithMessage("Tên chủ tài khoản phải có ít nhất 2 ký tự.")
            .MaximumLength(180).WithMessage("Tên chủ tài khoản không được vượt quá 180 ký tự.");

        When(x => !string.IsNullOrWhiteSpace(x.BankBranch), () =>
        {
            RuleFor(x => x.BankBranch)
                .MaximumLength(180).WithMessage("Chi nhánh ngân hàng không được vượt quá 180 ký tự.");
        });
    }
}
