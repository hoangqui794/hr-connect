using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Offers.Queries.GetOfferDetail;

public class GetOfferDetailQueryHandler : IRequestHandler<GetOfferDetailQuery, GetOfferDetailResponse>
{
    private readonly IOfferRepository _offerRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ILogger<GetOfferDetailQueryHandler> _logger;

    public GetOfferDetailQueryHandler(
        IOfferRepository offerRepository,
        ICompanyUserRepository companyUserRepository,
        ILogger<GetOfferDetailQueryHandler> logger)
    {
        _offerRepository = offerRepository;
        _companyUserRepository = companyUserRepository;
        _logger = logger;
    }

    public async Task<GetOfferDetailResponse> Handle(GetOfferDetailQuery request, CancellationToken cancellationToken)
    {
        var offer = await _offerRepository.GetByIdWithDetailsAsync(request.OfferId, cancellationToken);
        if (offer == null)
        {
            _logger.LogWarning("Không tìm thấy Offer {OfferId}.", request.OfferId);
            throw new NotFoundException("Không tìm thấy lời mời nhận việc.");
        }

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (companyUser == null)
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc công ty nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            if (offer.Application.Job.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {UserCompanyId} cố truy cập Offer của công ty {OfferCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, offer.Application.Job.CompanyId);
                throw new ForbiddenException("Bạn không có quyền truy cập lời mời nhận việc của doanh nghiệp khác.");
            }
        }
        else if (request.IsCandidate)
        {
            if (offer.Application.Candidate?.UserId != request.CurrentUserId)
            {
                _logger.LogWarning("Ứng viên {UserId} cố truy cập Offer của ứng viên {CandidateUserId}.",
                    request.CurrentUserId, offer.Application.Candidate?.UserId);
                throw new ForbiddenException("Bạn không có quyền xem lời mời nhận việc của ứng viên khác.");
            }

            if (offer.Status is "DRAFT" or "PENDING_APPROVAL" or "REJECTED")
            {
                _logger.LogWarning("Ứng viên {UserId} cố xem Offer {OfferId} ở trạng thái chưa gửi {Status}.",
                    request.CurrentUserId, offer.OfferId, offer.Status);
                throw new ForbiddenException("Lời mời nhận việc chưa được gửi tới bạn.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền xem Offer {OfferId}.", request.CurrentUserId, request.OfferId);
            throw new ForbiddenException("Bạn không có quyền truy cập lời mời nhận việc.");
        }

        var detail = new OfferDetailDto
        {
            OfferId = offer.OfferId,
            ApplicationId = offer.ApplicationId,
            Job = new JobDetailDto
            {
                JobId = offer.Application.JobId,
                Title = offer.Application.Job?.Title ?? string.Empty,
                CompanyId = offer.Application.Job?.CompanyId ?? Guid.Empty,
                CompanyName = offer.Application.Job?.Company?.CompanyName ?? string.Empty
            },
            Candidate = new CandidateDetailDto
            {
                CandidateId = offer.Application.CandidateId,
                FullName = offer.Application.Candidate?.FullName ?? string.Empty,
                Email = offer.Application.Candidate?.Email,
                Phone = offer.Application.Candidate?.Phone
            },
            OfferVersion = offer.OfferVersion,
            Salary = offer.Salary,
            CurrencyCode = offer.CurrencyCode ?? "VND",
            StartDate = offer.StartDate,
            ExpiryDate = offer.ExpiryDate,
            Status = offer.Status,
            OfferDocumentUrl = offer.OfferDocumentUrl,
            SentAt = offer.SentAt,
            RespondedAt = offer.RespondedAt,
            DeclineReason = offer.DeclineReason,
            ConcurrencyToken = offer.ConcurrencyToken,
            CreatedBy = offer.CreatedByNavigation != null
                ? new CreatedByDto
                {
                    UserId = offer.CreatedByNavigation.UserId,
                    DisplayName = offer.CreatedByNavigation.DisplayName,
                    Email = offer.CreatedByNavigation.Email
                }
                : null,
            CreatedAt = offer.CreatedAt,
            UpdatedAt = offer.UpdatedAt,
            Approvals = offer.OfferApprovals.Select(oa => new OfferApprovalSummaryDto
            {
                ApprovalId = oa.ApprovalId,
                UserId = oa.UserId,
                ApproverName = oa.User?.DisplayName,
                ApprovalType = oa.ApprovalType,
                Status = oa.Status,
                Comment = oa.Comment,
                CreatedAt = oa.CreatedAt
            }).ToList(),
            Placements = offer.Placements.Select(p => new PlacementSummaryDto
            {
                PlacementId = p.PlacementId,
                ActualStartDate = p.ActualStartDate,
                Position = p.Position,
                Department = p.Department,
                Status = p.Status,
                ConfirmedAt = p.ConfirmedAt,
                CreatedAt = p.CreatedAt
            }).ToList()
        };

        return new GetOfferDetailResponse
        {
            Success = true,
            Message = "Lấy thông tin chi tiết lời mời nhận việc thành công.",
            Data = detail
        };
    }
}
