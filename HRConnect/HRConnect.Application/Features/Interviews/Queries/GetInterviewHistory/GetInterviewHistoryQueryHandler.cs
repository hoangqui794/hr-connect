using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Interviews.Queries.GetInterviewHistory;

public class GetInterviewHistoryQueryHandler : IRequestHandler<GetInterviewHistoryQuery, GetInterviewHistoryResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ILogger<GetInterviewHistoryQueryHandler> _logger;

    public GetInterviewHistoryQueryHandler(
        IInterviewRepository interviewRepository,
        ICompanyUserRepository companyUserRepository,
        ILogger<GetInterviewHistoryQueryHandler> logger)
    {
        _interviewRepository = interviewRepository;
        _companyUserRepository = companyUserRepository;
        _logger = logger;
    }

    public async Task<GetInterviewHistoryResponse> Handle(GetInterviewHistoryQuery request, CancellationToken cancellationToken)
    {
        var interview = await _interviewRepository.GetByIdWithDetailsAsync(request.InterviewId, cancellationToken);
        if (interview == null)
        {
            _logger.LogWarning("Không tìm thấy buổi phỏng vấn {InterviewId}.", request.InterviewId);
            throw new NotFoundException("Không tìm thấy lịch phỏng vấn.");
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
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố xem lịch sử Interview của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, interview.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền xem lịch sử phỏng vấn của doanh nghiệp khác.");
            }
        }
        else if (request.IsCandidate)
        {
            if (interview.Application?.Candidate?.UserId != request.CurrentUserId)
            {
                _logger.LogWarning("Ứng viên {UserId} cố xem lịch sử Interview của ứng viên khác {CandidateUserId}.",
                    request.CurrentUserId, interview.Application?.Candidate?.UserId);
                throw new ForbiddenException("Bạn không có quyền xem lịch sử phỏng vấn của ứng viên khác.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền xem lịch sử phỏng vấn.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền xem lịch sử phỏng vấn.");
        }

        var historyDtos = interview.InterviewStatusHistories
            .OrderBy(h => h.ChangedAt)
            .Select(h => new InterviewStatusHistoryItemDto
            {
                HistoryId = h.InterviewStatusHistoryId,
                InterviewId = h.InterviewId,
                OldStatus = h.OldStatus,
                NewStatus = h.NewStatus,
                OldScheduledAt = h.OldScheduledAt,
                NewScheduledAt = h.NewScheduledAt,
                Reason = h.Reason,
                ChangedBy = h.ChangedBy,
                ChangedByName = h.ChangedByNavigation?.DisplayName,
                ChangedAt = h.ChangedAt
            }).ToList();

        return new GetInterviewHistoryResponse
        {
            Success = true,
            Message = "Lấy lịch sử trạng thái phỏng vấn thành công.",
            Data = historyDtos
        };
    }
}
