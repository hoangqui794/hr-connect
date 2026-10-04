using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.Admin.AuditLogs;

public sealed record GetAuditLogsQuery(
    Guid? ActorUserId = null,
    string? ActorType = null,
    string? Action = null,
    string? Source = null,
    string? ServiceName = null,
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
        var actorType = NormalizeFilter(request.ActorType, 30, "actorType");
        var source = NormalizeFilter(request.Source, 30, "source");
        var serviceName = NormalizeFilter(request.ServiceName, 80, "serviceName");
        var entityType = NormalizeFilter(request.EntityType, 80, "entityType");

        if (actorType != null && !AuditActorTypes.All.Contains(actorType))
            throw new BadRequestException("Bộ lọc actorType không hợp lệ.");
        if (source != null && !AuditSources.All.Contains(source))
            throw new BadRequestException("Bộ lọc source không hợp lệ.");

        var (items, total) = await _repository.GetListAsync(
            request.ActorUserId,
            actorType,
            action,
            source,
            serviceName,
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
