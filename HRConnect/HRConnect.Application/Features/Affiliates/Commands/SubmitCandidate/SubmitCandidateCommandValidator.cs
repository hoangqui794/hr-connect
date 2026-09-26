using FluentValidation;

namespace HRConnect.Application.Features.Affiliates.Commands.SubmitCandidate;

public class SubmitCandidateCommandValidator : AbstractValidator<SubmitCandidateCommand>
{

    public SubmitCandidateCommandValidator()
    {
        RuleFor(x => x.JobId)
            .NotEmpty().WithMessage("Mã công việc không được để trống.");

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Họ và tên ứng viên không được để trống.")
            .MaximumLength(255).WithMessage("Họ và tên không được vượt quá 255 ký tự.");

        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.Email) || !string.IsNullOrWhiteSpace(x.Phone))
            .WithMessage("Phải cung cấp ít nhất Email hoặc Số điện thoại của ứng viên.");

        RuleFor(x => x)
            .Must(x => HasUploadedFile(x) ^ (x.CvId.HasValue && x.CvId.Value != Guid.Empty))
            .WithMessage("Phải cung cấp đúng một nguồn CV: tệp PDF mới hoặc cvId do chính Affiliate đã tải trước đó.");

        When(x => !string.IsNullOrWhiteSpace(x.Email), () =>
        {
            RuleFor(x => x.Email!)
                .EmailAddress().WithMessage("Email không đúng định dạng.")
                .MaximumLength(255).WithMessage("Email không được vượt quá 255 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Phone), () =>
        {
            RuleFor(x => x.Phone!)
                .Matches(@"^[0-9+() \-\.]{8,20}$").WithMessage("Số điện thoại không đúng định dạng.");
        });
    }

    private static bool HasUploadedFile(SubmitCandidateCommand command) =>
        command.FileStream != null &&
        command.FileStream != Stream.Null &&
        !string.IsNullOrWhiteSpace(command.FileName) &&
        command.FileSizeBytes > 0;
}
