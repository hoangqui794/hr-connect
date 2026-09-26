using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.AuditLogs;

public sealed record GetAuditLogsQuery(
    Guid? ActorUserId = null,
    string? Action = null,
    string? EntityType = null,
    Guid? EntityId = null,
    Guid? CorrelationId = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    int Page = 1,
    int PageSize = 20) : IRequest<GetAuditLogsResponse>;

public sealed class GetAuditLogsResponse
{
    public bool Success { get; init; } = true;

    public required GetAuditLogsData Data { get; init; }
}

public sealed class GetAuditLogsData
{
    public required IReadOnlyList<AuditLogItemDto> Items { get; init; }

    public int Page { get; init; }

    public int PageSize { get; init; }

    public int Total { get; init; }

    public int TotalPages { get; init; }
}

public sealed class GetAuditLogsQueryHandler : IRequestHandler<GetAuditLogsQuery, GetAuditLogsResponse>
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;
    private readonly IAuditLogRepository _repository;

    public GetAuditLogsQueryHandler(IAuditLogRepository repository)
    {
        _repository = repository;
    }

    public async Task<GetAuditLogsResponse> Handle(GetAuditLogsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = request.PageSize < 1
            ? DefaultPageSize
            : Math.Min(request.PageSize, MaxPageSize);
        if ((long)(page - 1) * pageSize > int.MaxValue)
        {
            throw new BadRequestException("Số trang vượt quá giới hạn cho phép.");
        }
        var fromUtc = NormalizeUtc(request.FromUtc);
        var toUtc = NormalizeUtc(request.ToUtc);

        if (fromUtc.HasValue && toUtc.HasValue && fromUtc > toUtc)
        {
            throw new BadRequestException("Thời gian bắt đầu không được lớn hơn thời gian kết thúc.");
        }

        var action = NormalizeFilter(request.Action, 120, "action");
        var entityType = NormalizeFilter(request.EntityType, 80, "entityType");

        var (items, total) = await _repository.GetListAsync(
            request.ActorUserId,
            action,
            entityType,
            request.EntityId,
            request.CorrelationId,
            fromUtc,
            toUtc,
            page,
            pageSize,
            cancellationToken);

        return new GetAuditLogsResponse
        {
            Data = new GetAuditLogsData
            {
                Items = items.Select(AuditLogItemDto.From).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = (int)Math.Ceiling((double)total / pageSize)
            }
        };
    }

    private static DateTime? NormalizeUtc(DateTime? value)
    {
        if (!value.HasValue) return null;
        return value.Value.Kind switch
        {
            DateTimeKind.Utc => value.Value,
            DateTimeKind.Local => value.Value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
        };
    }

    private static string? NormalizeFilter(string? value, int maxLength, string name)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = value.Trim().ToUpperInvariant();
        if (normalized.Length > maxLength)
        {
            throw new BadRequestException($"Bộ lọc {name} không được vượt quá {maxLength} ký tự.");
        }

        return normalized;
    }
}
