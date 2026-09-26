using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Interviews.Commands.UpdateInterview;

public class UpdateInterviewCommandHandler : IRequestHandler<UpdateInterviewCommand, UpdateInterviewResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<UpdateInterviewCommandHandler> _logger;

    public UpdateInterviewCommandHandler(
        IInterviewRepository interviewRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<UpdateInterviewCommandHandler> logger)
    {
        _interviewRepository = interviewRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<UpdateInterviewResponse> Handle(UpdateInterviewCommand request, CancellationToken cancellationToken)
    {
        var interview = await _interviewRepository.GetByIdForUpdateAsync(request.InterviewId, cancellationToken);
        if (interview == null)
        {
            _logger.LogWarning("Không tìm thấy buổi phỏng vấn {InterviewId}.", request.InterviewId);
            throw new NotFoundException("Không tìm thấy lịch phỏng vấn.");
        }

        if (interview.Status is not ("SCHEDULED" or "RESCHEDULED"))
        {
            _logger.LogWarning("Buổi phỏng vấn {InterviewId} đang ở trạng thái {Status}, không thể cập nhật.",
                interview.InterviewId, interview.Status);
            throw new BadRequestException($"Không thể cập nhật buổi phỏng vấn đã ở trạng thái {interview.Status}.");
        }

        if (request.ConcurrencyToken.HasValue && request.ConcurrencyToken.Value != interview.ConcurrencyToken)
        {
            _logger.LogWarning("Xung đột concurrency trên Interview {InterviewId}. Token yêu cầu {ReqToken} khác với token hiện tại {CurToken}.",
                interview.InterviewId, request.ConcurrencyToken.Value, interview.ConcurrencyToken);
            throw new ConflictException("Dữ liệu phỏng vấn đã bị thay đổi bởi người khác. Vui lòng tải lại trang.");
        }

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (companyUser == null)
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            if (interview.Application?.Job?.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố cập nhật Interview của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, interview.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền cập nhật lịch phỏng vấn của doanh nghiệp khác.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền cập nhật lịch phỏng vấn.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền cập nhật lịch phỏng vấn.");
        }

        if (request.DurationMinutes.HasValue)
        {
            if (request.DurationMinutes.Value <= 0 || request.DurationMinutes.Value > 480)
            {
                throw new BadRequestException("Thời lượng phỏng vấn phải từ 1 đến 480 phút.");
            }
            interview.DurationMinutes = request.DurationMinutes.Value;
        }

        if (!string.IsNullOrWhiteSpace(request.InterviewType))
        {
            interview.InterviewType = request.InterviewType.Trim().ToUpperInvariant();
        }

        if (request.Location != null)
        {
            interview.Location = request.Location;
        }

        if (request.MeetingLink != null)
        {
            interview.MeetingLink = request.MeetingLink;
        }

        var participantsDto = new List<ScheduleInterviewParticipantDto>();
        if (request.Participants != null)
        {
            interview.InterviewParticipants.Clear();
            foreach (var p in request.Participants)
            {
                var role = string.IsNullOrWhiteSpace(p.Role) ? "INTERVIEWER" : p.Role.Trim().ToUpperInvariant();
                interview.InterviewParticipants.Add(new InterviewParticipant
                {
                    InterviewId = interview.InterviewId,
                    UserId = p.UserId,
                    Role = role
                });
                participantsDto.Add(new ScheduleInterviewParticipantDto(p.UserId, role));
            }
        }
        else
        {
            participantsDto = interview.InterviewParticipants
                .Select(p => new ScheduleInterviewParticipantDto(p.UserId, p.Role))
                .ToList();
        }

        var now = DateTime.UtcNow;
        var newConcurrencyToken = Guid.NewGuid();
        interview.ConcurrencyToken = newConcurrencyToken;
        interview.UpdatedAt = now;

        _interviewRepository.Update(interview);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new UpdateInterviewResponse
        {
            Success = true,
            Message = "Cập nhật lịch phỏng vấn thành công.",
            Data = new UpdateInterviewData
            {
                InterviewId = interview.InterviewId,
                ApplicationId = interview.ApplicationId,
                InterviewRound = interview.InterviewRound,
                InterviewType = interview.InterviewType,
                ScheduledAt = interview.ScheduledAt,
                DurationMinutes = interview.DurationMinutes,
                Location = interview.Location,
                MeetingLink = interview.MeetingLink,
                Status = interview.Status,
                ConcurrencyToken = newConcurrencyToken,
                UpdatedAt = now,
                Participants = participantsDto
            }
        };
    }
}
