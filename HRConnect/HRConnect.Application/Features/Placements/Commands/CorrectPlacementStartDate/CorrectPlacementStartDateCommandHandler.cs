using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Placements.Commands.CorrectPlacementStartDate;

public sealed class CorrectPlacementStartDateCommandHandler
    : IRequestHandler<CorrectPlacementStartDateCommand, CorrectPlacementStartDateResponse>
{
    private const int CorrectionWindowDays = 7;
    private const int ReasonMaxLength = 1_000;

    private readonly IFinanceRepository _financeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<CorrectPlacementStartDateCommandHandler> _logger;

    public CorrectPlacementStartDateCommandHandler(
        IFinanceRepository financeRepository,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService,
        ILogger<CorrectPlacementStartDateCommandHandler> logger)
    {
        _financeRepository = financeRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public async Task<CorrectPlacementStartDateResponse> Handle(
        CorrectPlacementStartDateCommand request,
        CancellationToken cancellationToken)
    {
        if (!request.IsInternalHrOrAdmin)
        {
            throw new ForbiddenException("Chỉ Internal HR hoặc Platform Admin được sửa ngày đi làm thực tế.");
        }

        var reason = NormalizeReason(request.Reason);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (request.ActualStartDate > today)
        {
            throw new BadRequestException(
                "Ngày thực tế đi làm không được ở tương lai.",
                PlacementStartDateErrorCodes.InvalidStartDate);
        }

        var placement = await _financeRepository.GetPlacementForFinanceAsync(request.PlacementId, cancellationToken);
        if (placement == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin tiếp nhận việc.");
        }

        var offerRespondedAt = placement.Offer?.RespondedAt ??
            (placement.Offer?.UpdatedAt == default ? (DateTime?)null : placement.Offer?.UpdatedAt);
        if (offerRespondedAt.HasValue && request.ActualStartDate < DateOnly.FromDateTime(offerRespondedAt.Value))
        {
            throw new BadRequestException(
                "Ngày thực tế đi làm không được sớm hơn ngày ứng viên chấp nhận offer.",
                PlacementStartDateErrorCodes.InvalidStartDate);
        }

        var now = DateTime.UtcNow;
        if (now > placement.ConfirmedAt.AddDays(CorrectionWindowDays) ||
            string.Equals(placement.ServiceFee?.Status, ServiceFeeStates.Paid, StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException(
                "Ngày đi làm đã bị khóa: chỉ được sửa trong 7 ngày kể từ lúc xác nhận và trước khi phí dịch vụ được thanh toán.",
                PlacementStartDateErrorCodes.StartDateLocked);
        }

        var previousActualStartDate = placement.ActualStartDate;
        var previousWarrantyEndDate = placement.Warranty?.EndDate;
        var previousServiceFeeDueDate = placement.ServiceFee?.DueDate;

        placement.ActualStartDate = request.ActualStartDate;
        placement.UpdatedAt = now;

        if (placement.Warranty != null)
        {
            var priorWarrantyStart = placement.Warranty.StartDate;
            placement.Warranty.StartDate = request.ActualStartDate;
            if (previousWarrantyEndDate.HasValue)
            {
                var duration = previousWarrantyEndDate.Value.DayNumber - priorWarrantyStart.DayNumber;
                placement.Warranty.EndDate = request.ActualStartDate.AddDays(duration);
            }
            placement.Warranty.UpdatedAt = now;
            placement.Warranty.UpdatedBy = request.CurrentUserId;
        }

        if (placement.ServiceFee != null)
        {
            var dueOffset = placement.ServiceFee.DueDate.DayNumber - previousActualStartDate.DayNumber;
            placement.ServiceFee.DueDate = request.ActualStartDate.AddDays(dueOffset);
            placement.ServiceFee.UpdatedAt = now;
        }

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.PlacementStartDateCorrected,
            EntityType = "PLACEMENT",
            EntityId = placement.PlacementId,
            ActorUserId = request.CurrentUserId,
            OldValues = new
            {
                actualStartDate = previousActualStartDate,
                warrantyEndDate = previousWarrantyEndDate,
                serviceFeeDueDate = previousServiceFeeDueDate
            },
            NewValues = new
            {
                actualStartDate = placement.ActualStartDate,
                warrantyEndDate = placement.Warranty?.EndDate,
                serviceFeeDueDate = placement.ServiceFee?.DueDate,
                reason
            }
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Placement {PlacementId} start date corrected from {PreviousStartDate} to {ActualStartDate} by {ActorUserId}.",
            placement.PlacementId,
            previousActualStartDate,
            placement.ActualStartDate,
            request.CurrentUserId);

        return new CorrectPlacementStartDateResponse(
            placement.PlacementId,
            previousActualStartDate,
            placement.ActualStartDate,
            previousWarrantyEndDate,
            placement.Warranty?.EndDate,
            previousServiceFeeDueDate,
            placement.ServiceFee?.DueDate,
            placement.UpdatedAt);
    }

    private static string NormalizeReason(string? value)
    {
        var normalized = value?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            throw new BadRequestException("Lý do sửa ngày đi làm là bắt buộc.");
        }

        if (normalized.Length > ReasonMaxLength)
        {
            throw new BadRequestException($"Lý do sửa ngày đi làm không được vượt quá {ReasonMaxLength} ký tự.");
        }

        return normalized;
    }
}
