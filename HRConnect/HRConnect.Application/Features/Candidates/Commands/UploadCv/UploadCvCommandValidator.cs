using FluentValidation;
using HRConnect.Application.Common.Models;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Candidates.Commands.UploadCv;

public class UploadCvCommandValidator : AbstractValidator<UploadCvCommand>
{
    public UploadCvCommandValidator(IOptions<R2Settings> r2Options)
    {
        var settings = r2Options.Value;
        var maxBytes = settings.MaxCvFileSizeBytes;

        RuleFor(x => x.FileName)
            .NotEmpty().WithMessage("Tên tập tin không được để trống.")
            .Must(fn => !string.IsNullOrWhiteSpace(fn) && fn.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Chỉ chấp nhận tập tin định dạng PDF (.pdf).");

        RuleFor(x => x.ContentType)
            .NotEmpty().WithMessage("Content-Type không được để trống.")
            .Must(ct => string.Equals(ct, "application/pdf", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Content-Type phải là application/pdf.");

        RuleFor(x => x.FileSizeBytes)
            .GreaterThan(0).WithMessage("Tập tin không được rỗng.")
            .LessThanOrEqualTo(maxBytes)
            .WithMessage($"Kích thước tập tin không được vượt quá {settings.MaxCvFileSizeMb}MB.");

        RuleFor(x => x.FileStream)
            .NotNull().WithMessage("Dữ liệu tập tin không được để trống.");
    }
}
