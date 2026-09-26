using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Queries.GetInterviews;

public class GetInterviewsQueryHandler : IRequestHandler<GetInterviewsQuery, GetInterviewsResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ILogger<GetInterviewsQueryHandler> _logger;

    public GetInterviewsQueryHandler(
        IInterviewRepository interviewRepository,
        ICompanyUserRepository companyUserRepository,
        ILogger<GetInterviewsQueryHandler> logger)
    {
        _interviewRepository = interviewRepository;
        _companyUserRepository = companyUserRepository;
        _logger = logger;
    }

    public async Task<GetInterviewsResponse> Handle(GetInterviewsQuery request, CancellationToken cancellationToken)
    {
        Guid? companyId = null;
        Guid? candidateUserId = null;

        if (request.IsClientCompanyUser)
        {
            var member = await _companyUserRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            if (member == null)
            {
                _logger.LogWarning("Tài khoản Client Company {UserId} không gắn với doanh nghiệp nào.", request.UserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }
            companyId = member.CompanyId;
        }
        else if (request.IsCandidate)
        {
            candidateUserId = request.UserId;
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("Người dùng {UserId} không có quyền xem danh sách lịch phỏng vấn.", request.UserId);
            throw new ForbiddenException("Bạn không có quyền xem danh sách lịch phỏng vấn.");
        }

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var (items, totalCount) = await _interviewRepository.GetInterviewsAsync(
            companyId,
            candidateUserId,
            request.JobId,
            request.ApplicationId,
            request.InterviewerId,
            request.Status,
            request.Result,
            request.FromDate,
            request.ToDate,
            page,
            pageSize,
            cancellationToken);

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        var dtos = items.Select(i =>
        {
            var participants = (i.InterviewParticipants ?? new List<Domain.Entities.InterviewParticipant>())
                .Select(p => new InterviewParticipantDto
                {
                    UserId = p.UserId,
                    Name = p.User?.DisplayName ?? p.User?.Email,
                    Role = p.Role
                }).ToList();

            return new InterviewItemDto
            {
                InterviewId = i.InterviewId,
                ApplicationId = i.ApplicationId,
                JobId = i.Application?.JobId ?? Guid.Empty,
                JobTitle = i.Application?.Job?.Title ?? string.Empty,
                CompanyId = i.Application?.Job?.CompanyId ?? Guid.Empty,
                CompanyName = i.Application?.Job?.Company?.CompanyName ?? string.Empty,
                CandidateId = i.Application?.CandidateId ?? Guid.Empty,
                CandidateName = i.Application?.Candidate?.FullName ?? string.Empty,
                CandidateEmail = i.Application?.Candidate?.Email,
                CandidatePhone = i.Application?.Candidate?.Phone,
                InterviewRound = i.InterviewRound,
                InterviewType = i.InterviewType,
                ScheduledAt = i.ScheduledAt,
                DurationMinutes = i.DurationMinutes,
                Location = i.Location,
                MeetingLink = i.MeetingLink,
                Status = i.Status,
                Result = i.Result,
                Feedback = i.Feedback,
                Participants = participants,
                CreatedAt = i.CreatedAt,
                ConcurrencyToken = i.ConcurrencyToken
            };
        }).ToList();

        return new GetInterviewsResponse
        {
            Success = true,
            Message = "Lấy danh sách lịch phỏng vấn thành công.",
            Data = new GetInterviewsData
            {
                Items = dtos,
                Page = page,
                PageSize = pageSize,
                Total = totalCount,
                TotalPages = totalPages
            }
        };
    }
}
