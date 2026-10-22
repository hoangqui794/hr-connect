using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Interviews.Commands.ConfirmInterviewAttendance;

public sealed class ConfirmInterviewAttendanceCommandHandler
    : IRequestHandler<ConfirmInterviewAttendanceCommand, ConfirmInterviewAttendanceResponse>
{
    private readonly IInterviewRepository _interviews;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogs;
    private readonly INotificationRepository? _notifications;

    public ConfirmInterviewAttendanceCommandHandler(
        IInterviewRepository interviews,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogs,
        INotificationRepository? notifications = null)
    {
        _interviews = interviews;
        _unitOfWork = unitOfWork;
        _auditLogs = auditLogs;
        _notifications = notifications;
    }

    public async Task<ConfirmInterviewAttendanceResponse> Handle(
        ConfirmInterviewAttendanceCommand request,
        CancellationToken cancellationToken)
    {
        var interview = await _interviews.GetByIdForUpdateAsync(request.InterviewId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy lịch phỏng vấn.");

        if (interview.Application?.Candidate?.UserId != request.CurrentUserId)
        {
            throw new ForbiddenException("Bạn không có quyền xác nhận lịch phỏng vấn này.");
        }

        if (interview.Status != InterviewStates.Scheduled)
        {
            throw new BadRequestException("Chỉ có thể xác nhận lịch phỏng vấn đang chờ diễn ra.");
        }

        if (string.Equals(
                interview.CandidateAttendanceStatus,
                CandidateAttendanceStates.Confirmed,
                StringComparison.OrdinalIgnoreCase) &&
            interview.CandidateRespondedAt.HasValue)
        {
            return new ConfirmInterviewAttendanceResponse(
                interview.InterviewId,
                interview.ApplicationId,
                CandidateAttendanceStates.Confirmed,
                interview.CandidateRespondedAt.Value,
                AlreadyConfirmed: true);
        }

        var now = DateTime.UtcNow;
        if (!interview.ScheduledAt.HasValue || interview.ScheduledAt.Value <= now)
        {
            throw new BadRequestException("Không thể xác nhận sau khi thời gian phỏng vấn đã bắt đầu.");
        }

        interview.CandidateAttendanceStatus = CandidateAttendanceStates.Confirmed;
        interview.CandidateRespondedAt = now;
        interview.UpdatedAt = now;
        interview.ConcurrencyToken = Guid.NewGuid();
        _interviews.Update(interview);

        await _auditLogs.AddAsync(new AuditEntry
        {
            Action = AuditActions.InterviewAttendanceConfirmed,
            EntityType = "INTERVIEW",
            EntityId = interview.InterviewId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { candidateAttendanceStatus = (string?)null },
            NewValues = new
            {
                applicationId = interview.ApplicationId,
                candidateAttendanceStatus = interview.CandidateAttendanceStatus,
                candidateRespondedAt = interview.CandidateRespondedAt
            }
        }, cancellationToken);

        if (_notifications != null && interview.CreatedBy is { } recipientId && recipientId != Guid.Empty)
        {
            var candidateName = interview.Application.Candidate?.FullName ?? "Ứng viên";
            var jobTitle = interview.Application.Job?.Title ?? "vị trí đang tuyển";
            await _notifications.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = recipientId,
                NotificationType = "INTERVIEW",
                Title = "Ứng viên xác nhận tham gia phỏng vấn",
                Message = $"{candidateName} đã xác nhận tham gia phỏng vấn vòng {interview.InterviewRound} cho {jobTitle}.",
                RelatedEntityType = "INTERVIEW",
                RelatedEntityId = interview.InterviewId,
                Metadata = JsonSerializer.Serialize(new
                {
                    applicationId = interview.ApplicationId,
                    interviewId = interview.InterviewId,
                    candidateAttendanceStatus = CandidateAttendanceStates.Confirmed,
                    routeHint = $"/client/candidates?open={interview.ApplicationId}"
                }),
                IsRead = false,
                CreatedAt = now
            }, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new ConfirmInterviewAttendanceResponse(
            interview.InterviewId,
            interview.ApplicationId,
            CandidateAttendanceStates.Confirmed,
            now,
            AlreadyConfirmed: false);
    }
}
