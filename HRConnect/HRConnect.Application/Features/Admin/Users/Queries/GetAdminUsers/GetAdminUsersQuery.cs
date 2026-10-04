using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.Users.Queries.GetAdminUsers;

public sealed record GetAdminUsersQuery(
    string? Search = null,
    string? Status = null,
    string? Role = null,
    int Page = 1,
    int PageSize = 20) : IRequest<AdminUserListResponse>;

public sealed class GetAdminUsersQueryHandler : IRequestHandler<GetAdminUsersQuery, AdminUserListResponse>
{
    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "PENDING", "ACTIVE", "SUSPENDED", "LOCKED", "REJECTED"
    };

    private readonly IAdminUserRepository _repository;

    public GetAdminUsersQueryHandler(IAdminUserRepository repository)
    {
        _repository = repository;
    }

    public async Task<AdminUserListResponse> Handle(GetAdminUsersQuery request, CancellationToken cancellationToken)
    {
        if (request.Page < 1 || request.PageSize is < 1 or > 100)
        {
            throw new BadRequestException("Page phải từ 1 và pageSize phải trong khoảng 1 đến 100.");
        }

        var search = NormalizeOptional(request.Search, 180, "search");
        var status = NormalizeUpper(request.Status, 30, "status");
        var role = NormalizeUpper(request.Role, 80, "role");
        if (status != null && !AllowedStatuses.Contains(status))
        {
            throw new BadRequestException("Trạng thái người dùng không hợp lệ.");
        }

        var (items, total) = await _repository.GetUsersAsync(
            search, status, role, request.Page, request.PageSize, cancellationToken);
        var now = DateTime.UtcNow;

        return new AdminUserListResponse
        {
            Data = new AdminUserListData
            {
                Items = items.Select(user => AdminUserListItemDto.From(user, now)).ToList(),
                Page = request.Page,
                PageSize = request.PageSize,
                Total = total,
                TotalPages = (int)Math.Ceiling((double)total / request.PageSize)
            }
        };
    }

    private static string? NormalizeOptional(string? value, int maxLength, string name)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = value.Trim();
        if (normalized.Length > maxLength)
        {
            throw new BadRequestException($"Bộ lọc {name} không được vượt quá {maxLength} ký tự.");
        }

        return normalized;
    }

    private static string? NormalizeUpper(string? value, int maxLength, string name) =>
        NormalizeOptional(value, maxLength, name)?.ToUpperInvariant();
}
