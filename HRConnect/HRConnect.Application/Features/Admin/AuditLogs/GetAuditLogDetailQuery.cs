using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.AuditLogs;

public sealed record GetAuditLogDetailQuery(long AuditLogId) : IRequest<GetAuditLogDetailResponse>;

public sealed class GetAuditLogDetailResponse
{
    public bool Success { get; init; } = true;

    public required AuditLogDetailDto Data { get; init; }
}

public sealed class GetAuditLogDetailQueryHandler : IRequestHandler<GetAuditLogDetailQuery, GetAuditLogDetailResponse>
{
    private readonly IAuditLogRepository _repository;

    public GetAuditLogDetailQueryHandler(IAuditLogRepository repository)
    {
        _repository = repository;
    }

    public async Task<GetAuditLogDetailResponse> Handle(
        GetAuditLogDetailQuery request,
        CancellationToken cancellationToken)
    {
        if (request.AuditLogId <= 0)
        {
            throw new BadRequestException("Mã audit log không hợp lệ.");
        }

        var auditLog = await _repository.GetByIdAsync(request.AuditLogId, cancellationToken);
        if (auditLog == null)
        {
            throw new NotFoundException("Không tìm thấy audit log.");
        }

        return new GetAuditLogDetailResponse { Data = AuditLogDetailDto.From(auditLog) };
    }
}
