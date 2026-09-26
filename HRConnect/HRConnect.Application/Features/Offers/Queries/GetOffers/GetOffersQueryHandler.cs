using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Offers.Queries.GetOffers;

public class GetOffersQueryHandler : IRequestHandler<GetOffersQuery, GetOffersResponse>
{
    private readonly IOfferRepository _offerRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ILogger<GetOffersQueryHandler> _logger;

    public GetOffersQueryHandler(
        IOfferRepository offerRepository,
        ICompanyUserRepository companyUserRepository,
        ILogger<GetOffersQueryHandler> logger)
    {
        _offerRepository = offerRepository;
        _companyUserRepository = companyUserRepository;
        _logger = logger;
    }

    public async Task<GetOffersResponse> Handle(GetOffersQuery request, CancellationToken cancellationToken)
    {
        Guid? companyId = null;
        Guid? candidateUserId = null;
        var hideDraftForCandidate = false;

        if (request.IsClientCompanyUser)
        {
            var member = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (member == null)
            {
                _logger.LogWarning("Tài khoản Client Company {UserId} không gắn với doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }
            companyId = member.CompanyId;
        }
        else if (request.IsCandidate)
        {
            candidateUserId = request.CurrentUserId;
            hideDraftForCandidate = true;
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("Người dùng {UserId} không có quyền xem danh sách lời mời nhận việc.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền xem danh sách lời mời nhận việc.");
        }

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var (items, totalCount) = await _offerRepository.GetOffersAsync(
            companyId,
            candidateUserId,
            request.JobId,
            request.ApplicationId,
            request.CandidateId,
            request.Status,
            hideDraftForCandidate,
            page,
            pageSize,
            cancellationToken);

        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling((double)totalCount / pageSize);

        var dtos = items.Select(o => new OfferItemDto
        {
            OfferId = o.OfferId,
            ApplicationId = o.ApplicationId,
            JobId = o.Application.JobId,
            JobTitle = o.Application.Job?.Title ?? string.Empty,
            CompanyId = o.Application.Job?.CompanyId ?? Guid.Empty,
            CompanyName = o.Application.Job?.Company?.CompanyName ?? string.Empty,
            CandidateId = o.Application.CandidateId,
            CandidateName = o.Application.Candidate?.FullName ?? string.Empty,
            CandidateEmail = o.Application.Candidate?.Email,
            CandidatePhone = o.Application.Candidate?.Phone,
            OfferVersion = o.OfferVersion,
            Salary = o.Salary,
            CurrencyCode = o.CurrencyCode ?? "VND",
            StartDate = o.StartDate,
            ExpiryDate = o.ExpiryDate,
            Status = o.Status,
            OfferDocumentUrl = o.OfferDocumentUrl,
            SentAt = o.SentAt,
            RespondedAt = o.RespondedAt,
            DeclineReason = o.DeclineReason,
            CreatedAt = o.CreatedAt,
            UpdatedAt = o.UpdatedAt,
            ConcurrencyToken = o.ConcurrencyToken
        }).ToList();

        return new GetOffersResponse
        {
            Success = true,
            Message = "Lấy danh sách lời mời nhận việc thành công.",
            Data = new GetOffersData
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
