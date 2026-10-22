using System;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Constants;
using MediatR;

namespace HRConnect.Application.Features.Jobs.ServiceAgreements;

public sealed class VoidServiceAgreementCommand : IRequest<ServiceAgreementDto>
{
    [JsonIgnore] public Guid JobId { get; set; }
    [JsonIgnore] public Guid AgreementId { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
    public string VoidReason { get; set; } = null!;
}

public sealed class VoidServiceAgreementCommandHandler : IRequestHandler<VoidServiceAgreementCommand, ServiceAgreementDto>
{
    private readonly IServiceAgreementRepository _agreements;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _uow;

    public VoidServiceAgreementCommandHandler(
        IServiceAgreementRepository agreements,
        IAuditLogService audit,
        IUnitOfWork uow)
    {
        _agreements = agreements;
        _audit = audit;
        _uow = uow;
    }

    public async Task<ServiceAgreementDto> Handle(VoidServiceAgreementCommand request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.VoidReason))
        {
            throw new BadRequestException("Bắt buộc phải cung cấp lý do hủy bỏ thỏa thuận dịch vụ.");
        }

        var agreement = await _agreements.GetByIdForUpdateAsync(request.AgreementId, ct);
        if (agreement == null || agreement.JobId != request.JobId)
        {
            throw new NotFoundException("Không tìm thấy thỏa thuận dịch vụ yêu cầu.");
        }

        if (agreement.Status == ServiceAgreementStatuses.Signed)
        {
            throw new ConflictException("Không thể hủy bỏ thỏa thuận dịch vụ đã được ký kết chính thức. Để thay đổi điều khoản, vui lòng tạo phiên bản thỏa thuận bổ sung mới.");
        }

        var now = DateTime.UtcNow;
        agreement.Status = ServiceAgreementStatuses.Void;
        agreement.IsCurrent = false;
        agreement.VoidedAt = now;
        agreement.VoidedByUserId = request.UserId;
        agreement.VoidReason = request.VoidReason.Trim();
        agreement.ConcurrencyToken = Guid.NewGuid();

        await _audit.AddAsync(new AuditEntry
        {
            Action = "SERVICE_AGREEMENT_VOIDED",
            EntityType = "ServiceAgreement",
            EntityId = agreement.ServiceAgreementId,
            ActorUserId = request.UserId,
            NewValues = new { Status = agreement.Status, Reason = agreement.VoidReason }
        }, ct);

        await _uow.SaveChangesAsync(ct);
        return ServiceAgreementDto.FromEntity(agreement);
    }
}
