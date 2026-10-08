using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Entities;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Interviews.Commands.CancelInterview;

public class CancelInterviewCommandHandler : IRequestHandler<CancelInterviewCommand, CancelInterviewResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<CancelInterviewCommandHandler> _logger;
    private readonly IAuditLogService _auditLogService;

    public CancelInterviewCommandHandler(
        IInterviewRepository interviewRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<CancelInterviewCommandHandler> logger,
        IAuditLogService auditLogService)
    {
        _interviewRepository = interviewRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
    }

    public async Task<CancelInterviewResponse> Handle(CancelInterviewCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new BadRequestException("Lý do hủy lịch phỏng vấn là bắt buộc.");
        }

        var interview = await _interviewRepository.GetByIdForUpdateAsync(request.InterviewId, cancellationToken);
        if (interview == null)
        {
            _logger.LogWarning("Không tìm thấy lịch phỏng vấn {InterviewId}.", request.InterviewId);
            throw new NotFoundException("Không tìm thấy lịch phỏng vấn.");
        }

        if (interview.Status == InterviewStates.Cancelled)
        {
            throw new BadRequestException("Buổi phỏng vấn này đã bị hủy trước đó.");
        }

        if (interview.Status is InterviewStates.Completed or InterviewStates.NoShow)
        {
            throw new BadRequestException("Không thể hủy buổi phỏng vấn đã hoàn thành.");
        }

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, interview.ConcurrencyToken, "phỏng vấn");

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (!HRConnect.Application.Features.Recruitment.Common.CompanyMembershipPolicy.IsActive(companyUser))
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            if (interview.Application?.Job?.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố hủy lịch Interview của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, interview.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền hủy lịch phỏng vấn của doanh nghiệp khác.");
            }
        }
        else
        {
            _logger.LogWarning("User {UserId} không có quyền hủy lịch phỏng vấn.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền hủy lịch phỏng vấn.");
        }

        var now = DateTime.UtcNow;
        var oldStatus = interview.Status;

        interview.Status = InterviewStates.Cancelled;

        var newConcurrencyToken = Guid.NewGuid();
        interview.ConcurrencyToken = newConcurrencyToken;
        interview.UpdatedAt = now;

        interview.InterviewStatusHistories.Add(new InterviewStatusHistory
        {
            InterviewStatusHistoryId = Guid.NewGuid(),
            InterviewId = interview.InterviewId,
            OldStatus = oldStatus,
            NewStatus = InterviewStates.Cancelled,
            OldScheduledAt = interview.ScheduledAt,
            NewScheduledAt = null,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = request.Reason.Trim()
        });

        _interviewRepository.Update(interview);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.InterviewCancelled,
            EntityType = "INTERVIEW",
            EntityId = interview.InterviewId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldStatus, scheduledAt = interview.ScheduledAt },
            NewValues = new
            {
                applicationId = interview.ApplicationId,
                status = interview.Status,
                hasReason = true
            }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new CancelInterviewResponse
        {
            Success = true,
            Message = "Hủy lịch phỏng vấn thành công.",
            Data = new CancelInterviewData
            {
                InterviewId = interview.InterviewId,
                ApplicationId = interview.ApplicationId,
                InterviewRound = interview.InterviewRound,
                Status = InterviewStates.Cancelled,
                Reason = request.Reason.Trim(),
                ConcurrencyToken = newConcurrencyToken,
                CancelledAt = now
            }
        };
    }
}
