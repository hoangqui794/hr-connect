using FluentValidation;

namespace HRConnect.Application.Features.Candidates.Commands.ApplyJob;

public sealed class ApplyJobCommandValidator : AbstractValidator<ApplyJobCommand>
{
    public ApplyJobCommandValidator()
    {
        RuleFor(command => command.JobId)
            .NotEmpty().WithMessage("Mã công việc không được để trống.");

        RuleFor(command => command)
            .Must(command => HasUploadedFile(command) ^ HasCvId(command))
            .WithMessage("Phải cung cấp đúng một nguồn CV: tệp PDF mới hoặc cvId trong kho CV của Candidate.");
    }

    private static bool HasUploadedFile(ApplyJobCommand command) =>
        command.FileStream != null &&
        command.FileStream != Stream.Null &&
        !string.IsNullOrWhiteSpace(command.FileName) &&
        command.FileSizeBytes > 0;

    private static bool HasCvId(ApplyJobCommand command) =>
        command.CvId.HasValue && command.CvId.Value != Guid.Empty;
}
