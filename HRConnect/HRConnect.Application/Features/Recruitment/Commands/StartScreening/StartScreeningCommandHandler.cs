using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Commands.StartScreening;

public sealed class StartScreeningCommandHandler : IRequestHandler<StartScreeningCommand, StartScreeningResponse>
{
    private const string NotFoundMessage = "Không tìm thấy hồ sơ ứng tuyển thuộc công việc này.";

    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IServiceTypeRepository _serviceTypeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;

    public StartScreeningCommandHandler(
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IServiceTypeRepository serviceTypeRepository,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService)
    {
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _serviceTypeRepository = serviceTypeRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
    }

    public async Task<StartScreeningResponse> Handle(StartScreeningCommand request, CancellationToken cancellationToken)
    {
        var application = await _applicationRepository.GetByIdAsync(request.ApplicationId, cancellationToken);
        if (application == null || application.JobId != request.JobId)
        {
            throw new NotFoundException(NotFoundMessage);
        }

        var serviceTypeCode = application.Job?.ServiceType?.Code;
        if (serviceTypeCode == null && application.Job != null)
        {
            serviceTypeCode = (await _serviceTypeRepository.GetByIdAsync(application.Job.ServiceTypeId, cancellationToken))?.Code;
        }

        if (request.Actor == ScreeningActor.ClientCompany)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (companyUser == null
                || !string.Equals(companyUser.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase)
                || application.Job?.CompanyId != companyUser.CompanyId
                || !ClientVisibilityPolicy.IsVisibleToClient(
                    serviceTypeCode,
                    application.Status,
                    application.ApplicationStatusHistories.Select(h => h.NewStatus)))
            {
                throw new NotFoundException(NotFoundMessage);
            }
        }

        var currentStatus = application.Status.Trim().ToUpperInvariant();
        if (currentStatus != ApplicationStates.Submitted || !ScreeningPolicy.CanScreen(request.Actor, serviceTypeCode))
        {
            return Result(application, currentStatus, changed: false, "Hồ sơ giữ nguyên trạng thái.");
        }

        var now = DateTime.UtcNow;
        application.Status = ApplicationStates.Screening;
        application.UpdatedAt = now;
        application.ConcurrencyToken = Guid.NewGuid();
        application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
        {
            ApplicationStatusHistoryId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            OldStatus = currentStatus,
            NewStatus = ApplicationStates.Screening,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now
        });

        _applicationRepository.Update(application);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationStatusChanged,
            EntityType = "APPLICATION",
            EntityId = application.ApplicationId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = currentStatus },
            NewValues = new
            {
                status = ApplicationStates.Screening,
                sourceAction = "START_SCREENING",
                screenedBy = request.Actor.ToString(),
                serviceType = serviceTypeCode
            }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result(application, ApplicationStates.Screening, changed: true, "Đã chuyển hồ sơ sang SCREENING.");
    }

    private static StartScreeningResponse Result(
        HRConnect.Domain.Entities.Application application,
        string status,
        bool changed,
        string message) => new()
    {
        Message = message,
        Data = new StartScreeningData
        {
            ApplicationId = application.ApplicationId,
            CurrentStatus = status,
            Changed = changed,
            ConcurrencyToken = application.ConcurrencyToken
        }
    };
}
