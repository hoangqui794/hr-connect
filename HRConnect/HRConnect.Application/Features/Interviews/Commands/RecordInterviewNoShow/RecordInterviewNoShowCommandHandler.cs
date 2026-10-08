using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Interviews.Commands.RecordInterviewNoShow;

public class RecordInterviewNoShowCommandHandler : IRequestHandler<RecordInterviewNoShowCommand, RecordInterviewNoShowResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;

    public RecordInterviewNoShowCommandHandler(
        IInterviewRepository interviewRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService)
    {
        _interviewRepository = interviewRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
    }

    public async Task<RecordInterviewNoShowResponse> Handle(RecordInterviewNoShowCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new BadRequestException("Lý do vắng mặt là bắt buộc.");
        }

        var interview = await _interviewRepository.GetByIdForUpdateAsync(request.InterviewId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy lịch phỏng vấn.");

        if (interview.Status != InterviewStates.Scheduled)
        {
            throw new BadRequestException($"Chỉ có thể ghi nhận vắng mặt cho lịch ở trạng thái {InterviewStates.Scheduled}.");
        }

        if (interview.ScheduledAt.HasValue && interview.ScheduledAt.Value > DateTime.UtcNow)
        {
            throw new BadRequestException("Chỉ có thể ghi nhận vắng mặt sau thời gian phỏng vấn.");
        }

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, interview.ConcurrencyToken, "phỏng vấn");

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (!CompanyMembershipPolicy.IsActive(companyUser))
            {
                throw new ForbiddenException("Tài khoản doanh nghiệp không tồn tại hoặc không hoạt động.");
            }

            if (interview.Application?.Job?.CompanyId != companyUser!.CompanyId)
            {
                throw new ForbiddenException("Bạn không có quyền ghi nhận vắng mặt cho lịch phỏng vấn của doanh nghiệp khác.");
            }
        }
        else
        {
            throw new ForbiddenException("Bạn không có quyền ghi nhận ứng viên vắng mặt.");
        }

        var now = DateTime.UtcNow;
        var oldStatus = interview.Status;
        interview.Status = InterviewStates.NoShow;
        interview.Result = null;
        interview.UpdatedAt = now;
        interview.ConcurrencyToken = Guid.NewGuid();
        interview.InterviewStatusHistories.Add(new InterviewStatusHistory
        {
            InterviewStatusHistoryId = Guid.NewGuid(),
            InterviewId = interview.InterviewId,
            OldStatus = oldStatus,
            NewStatus = InterviewStates.NoShow,
            OldScheduledAt = interview.ScheduledAt,
            NewScheduledAt = interview.ScheduledAt,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = request.Reason.Trim()
        });

        _interviewRepository.Update(interview);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.InterviewNoShowRecorded,
            EntityType = "INTERVIEW",
            EntityId = interview.InterviewId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldStatus },
            NewValues = new
            {
                applicationId = interview.ApplicationId,
                status = interview.Status,
                scheduledAt = interview.ScheduledAt,
                hasReason = true
            }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new RecordInterviewNoShowResponse(
            interview.InterviewId,
            interview.ApplicationId,
            interview.Status,
            request.Reason.Trim(),
            interview.ConcurrencyToken,
            now);
    }
}
