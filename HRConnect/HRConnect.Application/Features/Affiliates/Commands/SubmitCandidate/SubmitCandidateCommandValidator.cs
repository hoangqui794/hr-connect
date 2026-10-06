using FluentValidation;

namespace HRConnect.Application.Features.Affiliates.Commands.SubmitCandidate;

public class SubmitCandidateCommandValidator : AbstractValidator<SubmitCandidateCommand>
{

    public SubmitCandidateCommandValidator()
    {
        RuleFor(x => x.JobId)
            .NotEmpty().WithMessage("Mã công việc không được để trống.");

        When(x => !x.CandidateId.HasValue, () =>
        {
            RuleFor(x => x.FullName)
                .NotEmpty().WithMessage("Họ và tên ứng viên không được để trống.")
                .MaximumLength(255).WithMessage("Họ và tên không được vượt quá 255 ký tự.");

            RuleFor(x => x.Email)
                .NotEmpty().WithMessage("Email ứng viên là bắt buộc để gửi yêu cầu xác nhận.")
                .EmailAddress().WithMessage("Email không đúng định dạng.")
                .MaximumLength(255).WithMessage("Email không được vượt quá 255 ký tự.");
        });

        When(x => x.CandidateId.HasValue, () =>
        {
            RuleFor(x => x.CandidateId!.Value)
                .NotEmpty().WithMessage("candidateId không hợp lệ.");
            RuleFor(x => x.CvId)
                .NotNull().WithMessage("Phải chọn cvId khi sử dụng Candidate từ kho.")
                .Must(value => value.HasValue && value.Value != Guid.Empty)
                .WithMessage("cvId không hợp lệ.");
            RuleFor(x => x)
                .Must(x => !HasUploadedFile(x))
                .WithMessage("Không được tải tệp CV mới khi sử dụng Candidate từ kho.");
        });

        RuleFor(x => x)
            .Must(x => HasUploadedFile(x) ^ (x.CvId.HasValue && x.CvId.Value != Guid.Empty))
            .WithMessage("Phải cung cấp đúng một nguồn CV: tệp PDF mới hoặc cvId do chính Affiliate đã tải trước đó.");

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
