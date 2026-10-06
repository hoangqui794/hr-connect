using FluentValidation;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;

namespace HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;

public sealed class UpdateApplicationScreeningStatusCommandValidator
    : AbstractValidator<UpdateApplicationScreeningStatusCommand>
{
    public UpdateApplicationScreeningStatusCommandValidator()
    {
        RuleFor(x => x.TargetStatus).NotEmpty().WithMessage("Trạng thái sàng lọc không được để trống.");

        RuleFor(x => x.ConcurrencyToken).NotNull()
            .WithMessage("Thiếu concurrencyToken của hồ sơ. Vui lòng tải lại trang.");

        RuleFor(x => x.Reason).MaximumLength(ApplicationReasonCodes.MaxNoteLength)
            .WithMessage($"Ghi chú tối đa {ApplicationReasonCodes.MaxNoteLength} ký tự.");

        When(x => IsRejected(x.TargetStatus), () =>
        {
            RuleFor(x => x.ReasonCode)
                .Must(code => ApplicationReasonCodes.ScreeningRejectionCodes.Contains(ApplicationReasonCodes.Normalize(code)))
                .WithMessage("Phải chọn mã lý do hợp lệ khi loại hồ sơ: "
                    + string.Join(", ", ApplicationReasonCodes.ScreeningRejectionCodes) + ".");

            RuleFor(x => x.Reason)
                .NotEmpty()
                .When(x => ApplicationReasonCodes.Normalize(x.ReasonCode) == ApplicationReasonCodes.Other)
                .WithMessage("Chọn lý do OTHER thì phải ghi chú.");
        });
    }

    private static bool IsRejected(string? status) =>
        string.Equals(status?.Trim(), ApplicationStates.Rejected, StringComparison.OrdinalIgnoreCase);
}
