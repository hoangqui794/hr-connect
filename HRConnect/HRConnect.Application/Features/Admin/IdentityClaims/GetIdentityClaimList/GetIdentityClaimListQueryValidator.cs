using FluentValidation;

namespace HRConnect.Application.Features.Admin.IdentityClaims.GetIdentityClaimList;

public sealed class GetIdentityClaimListQueryValidator : AbstractValidator<GetIdentityClaimListQuery>
{
    private static readonly string[] AllowedStatuses =
    [
        "PENDING_ADMIN_REVIEW",
        "COMPLETED",
        "REJECTED"
    ];

    public GetIdentityClaimListQueryValidator()
    {
        RuleFor(query => query.Status)
            .NotEmpty().WithMessage("Trạng thái là bắt buộc.")
            .Must(status => AllowedStatuses.Contains(status.Trim().ToUpperInvariant()))
            .WithMessage("status chỉ nhận PENDING_ADMIN_REVIEW, COMPLETED hoặc REJECTED.");
        RuleFor(query => query.Search)
            .MaximumLength(200).WithMessage("Từ khóa tìm kiếm không được vượt quá 200 ký tự.");
        RuleFor(query => query.Page)
            .GreaterThanOrEqualTo(1).WithMessage("page phải lớn hơn hoặc bằng 1.");
        RuleFor(query => query.PageSize)
            .InclusiveBetween(1, 100).WithMessage("pageSize phải từ 1 đến 100.");
        RuleFor(query => query.SortBy)
            .Must(value => new[] { "createdat", "verifiedat", "reviewedat" }
                .Contains(value.Trim().ToLowerInvariant()))
            .WithMessage("sortBy chỉ nhận createdAt, verifiedAt hoặc reviewedAt.");
        RuleFor(query => query.SortDirection)
            .Must(value => new[] { "asc", "desc" }.Contains(value.Trim().ToLowerInvariant()))
            .WithMessage("sortDirection chỉ nhận asc hoặc desc.");
    }
}
