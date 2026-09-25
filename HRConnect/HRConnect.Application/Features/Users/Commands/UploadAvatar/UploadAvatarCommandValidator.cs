using FluentValidation;
using HRConnect.Application.Common.Models;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Users.Commands.UploadAvatar;

public class UploadAvatarCommandValidator : AbstractValidator<UploadAvatarCommand>
{
    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
    private static readonly string[] AllowedContentTypes = { "image/jpeg", "image/png", "image/webp" };

    public UploadAvatarCommandValidator(IOptions<R2Settings> r2Options)
    {
        var settings = r2Options.Value;
        var maxBytes = settings.MaxAvatarFileSizeBytes;

        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("UserId không được để trống.");

        RuleFor(x => x.FileName)
            .NotEmpty().WithMessage("Tên tập tin ảnh không được để trống.")
            .Must(fn => !string.IsNullOrWhiteSpace(fn) && AllowedExtensions.Any(ext => fn.EndsWith(ext, StringComparison.OrdinalIgnoreCase)))
            .WithMessage("Chỉ chấp nhận tập tin ảnh định dạng .jpg, .jpeg, .png hoặc .webp.");

        RuleFor(x => x.ContentType)
            .NotEmpty().WithMessage("Content-Type không được để trống.")
            .Must(ct => !string.IsNullOrWhiteSpace(ct) && AllowedContentTypes.Contains(ct.ToLowerInvariant()))
            .WithMessage("Content-Type phải là image/jpeg, image/png hoặc image/webp.");

        RuleFor(x => x.FileSizeBytes)
            .GreaterThan(0).WithMessage("Tập tin ảnh không được rỗng.")
            .LessThanOrEqualTo(maxBytes)
            .WithMessage($"Kích thước ảnh đại diện không được vượt quá {settings.MaxAvatarFileSizeMb}MB.");

        RuleFor(x => x.FileStream)
            .NotNull().WithMessage("Dữ liệu tập tin ảnh không được để trống.")
            .Must(s => s != Stream.Null).WithMessage("Dữ liệu tập tin ảnh không được rỗng.");
    }
}
