using FluentValidation;

namespace HRConnect.Application.Features.Admin.Approvals.GetApprovalList;

public sealed class GetApprovalListQueryValidator : AbstractValidator<GetApprovalListQuery>
{
    private static readonly string[] AllowedTypes = ["AFFILIATE", "CLIENT"];
    private static readonly string[] AllowedStatuses = ["UNDER_REVIEW", "APPROVED", "REJECTED"];
    private static readonly string[] AllowedSortFields = ["submittedAt", "status", "type"];
    private static readonly string[] AllowedSortDirections = ["asc", "desc"];

    public GetApprovalListQueryValidator()
    {
        RuleFor(query => query.Type)
            .Must(value => IsEmptyOrAllowed(value, AllowedTypes))
            .WithMessage("type chỉ nhận AFFILIATE hoặc CLIENT.");

        RuleFor(query => query.Status)
            .Must(value => IsEmptyOrAllowed(value, AllowedStatuses))
            .WithMessage("status chỉ nhận UNDER_REVIEW, APPROVED hoặc REJECTED.");

        RuleFor(query => query.Search)
            .MaximumLength(100)
            .WithMessage("search không được vượt quá 100 ký tự.");

        RuleFor(query => query.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("page phải lớn hơn hoặc bằng 1.");

        RuleFor(query => query.PageSize)
            .InclusiveBetween(1, 100)
            .WithMessage("pageSize phải từ 1 đến 100.");

        RuleFor(query => query.SortBy)
            .Must(value => IsEmptyOrAllowed(value, AllowedSortFields))
            .WithMessage("sortBy chỉ nhận submittedAt, status hoặc type.");

        RuleFor(query => query.SortDirection)
            .Must(value => IsEmptyOrAllowed(value, AllowedSortDirections))
            .WithMessage("sortDirection chỉ nhận asc hoặc desc.");
    }

    private static bool IsEmptyOrAllowed(string? value, IReadOnlyCollection<string> allowed) =>
        string.IsNullOrWhiteSpace(value) ||
        allowed.Contains(value.Trim(), StringComparer.OrdinalIgnoreCase);
}
