using FluentValidation;
using HRConnect.Application.Common.Models;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Companies.Commands.UploadCompanyLogo;

public sealed class UploadCompanyLogoCommandValidator : AbstractValidator<UploadCompanyLogoCommand>
{
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    private static readonly string[] AllowedContentTypes = ["image/jpeg", "image/png", "image/webp"];

    public UploadCompanyLogoCommandValidator(IOptions<R2Settings> options)
    {
        var settings = options.Value;
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.FileName)
            .NotEmpty().WithMessage("Tên tập tin logo không được để trống.")
            .Must(name => AllowedExtensions.Any(ext => name.EndsWith(ext, StringComparison.OrdinalIgnoreCase)))
            .WithMessage("Logo phải là ảnh JPG, PNG hoặc WebP.");
        RuleFor(x => x.ContentType)
            .Must(type => AllowedContentTypes.Contains(type?.ToLowerInvariant()))
            .WithMessage("Logo phải là ảnh JPG, PNG hoặc WebP.");
        RuleFor(x => x.FileSizeBytes)
            .GreaterThan(0).WithMessage("Tập tin logo không được rỗng.")
            .LessThanOrEqualTo(settings.MaxAvatarFileSizeBytes)
            .WithMessage($"Kích thước logo không được vượt quá {settings.MaxAvatarFileSizeMb}MB.");
        RuleFor(x => x.FileStream).NotNull().Must(stream => stream != Stream.Null)
            .WithMessage("Dữ liệu logo không được rỗng.");
    }
}
