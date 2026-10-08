using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Placements.Queries.GetPlacementDetail;

public class GetPlacementDetailQueryHandler : IRequestHandler<GetPlacementDetailQuery, GetPlacementDetailResponse>
{
    private readonly IPlacementRepository _placementRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ILogger<GetPlacementDetailQueryHandler> _logger;

    public GetPlacementDetailQueryHandler(
        IPlacementRepository placementRepository,
        ICompanyUserRepository companyUserRepository,
        ILogger<GetPlacementDetailQueryHandler> logger)
    {
        _placementRepository = placementRepository;
        _companyUserRepository = companyUserRepository;
        _logger = logger;
    }

    public async Task<GetPlacementDetailResponse> Handle(GetPlacementDetailQuery request, CancellationToken cancellationToken)
    {
        var placement = await _placementRepository.GetByIdWithDetailsAsync(request.PlacementId, cancellationToken);
        if (placement == null)
        {
            _logger.LogWarning("Không tìm thấy Placement {PlacementId}.", request.PlacementId);
            throw new NotFoundException("Không tìm thấy thông tin tiếp nhận việc.");
        }

        if (request.IsClientCompanyUser)
        {
            var member = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (!HRConnect.Application.Features.Recruitment.Common.CompanyMembershipPolicy.IsActive(member))
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            if (placement.Application?.Job?.CompanyId != member.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố truy cập Placement của công ty {JobCompanyId}.",
                    request.CurrentUserId, member.CompanyId, placement.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền xem thông tin tiếp nhận việc của doanh nghiệp khác.");
            }
        }
        else if (request.IsCandidate)
        {
            if (placement.Application?.Candidate?.UserId != request.CurrentUserId)
            {
                _logger.LogWarning("Ứng viên {UserId} cố truy cập Placement của ứng viên khác.", request.CurrentUserId);
                throw new ForbiddenException("Bạn không có quyền xem thông tin tiếp nhận việc này.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền xem chi tiết tiếp nhận việc.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền xem thông tin tiếp nhận việc.");
        }

        var candidate = placement.Application?.Candidate;
        var candidateName = !string.IsNullOrWhiteSpace(candidate?.FullName)
            ? candidate.FullName
            : (candidate?.Email ?? "Ứng viên");

        var candidateEmail = candidate?.Email ?? candidate?.User?.Email ?? string.Empty;
        var candidatePhone = candidate?.Phone ?? candidate?.User?.Phone;

        var confirmedByName = !string.IsNullOrWhiteSpace(placement.ConfirmedByNavigation?.DisplayName)
            ? placement.ConfirmedByNavigation.DisplayName
            : placement.ConfirmedByNavigation?.Email;

        var allowedActions = new List<string> { "VIEW_PLACEMENT" };
        if (placement.Probation != null)
        {
            allowedActions.Add("VIEW_PROBATION");
        }

        if (placement.Warranty != null)
        {
            allowedActions.Add("VIEW_WARRANTY");
        }

        PlacementDetailProbationDto? probationDto = null;
        if (placement.Probation != null)
        {
            probationDto = new PlacementDetailProbationDto(
                placement.Probation.ProbationId,
                placement.Probation.StartDate,
                placement.Probation.EndDate,
                placement.Probation.Result,
                placement.Probation.Notes
            );
        }

        PlacementDetailWarrantyDto? warrantyDto = null;
        if (placement.Warranty != null)
        {
            warrantyDto = new PlacementDetailWarrantyDto(
                placement.Warranty.WarrantyId,
                placement.Warranty.StartDate,
                placement.Warranty.EndDate,
                placement.Warranty.Status,
                placement.Warranty.ResultNote
            );
        }

        return new GetPlacementDetailResponse(
            placement.PlacementId,
            placement.ApplicationId,
            placement.OfferId,
            placement.ActualStartDate,
            placement.Position,
            placement.Department,
            placement.Status,
            placement.ConfirmedAt,
            placement.ConfirmedBy,
            confirmedByName,
            placement.ConfirmationNote,
            new PlacementDetailCandidateDto(
                candidate?.CandidateId ?? Guid.Empty,
                candidateName,
                candidateEmail,
                candidatePhone,
                candidate?.Summary
            ),
            new PlacementDetailJobDto(
                placement.Application?.JobId ?? Guid.Empty,
                placement.Application?.Job?.Title ?? string.Empty,
                placement.Application?.Job?.CompanyId ?? Guid.Empty,
                placement.Application?.Job?.Company?.CompanyName ?? string.Empty
            ),
            new PlacementDetailOfferDto(
                placement.Offer?.OfferId ?? placement.OfferId,
                placement.Offer?.Salary,
                placement.Offer?.CurrencyCode,
                placement.Offer?.StartDate,
                placement.Offer?.Status ?? "ACCEPTED",
                placement.Offer?.OfferDocumentUrl
            ),
            probationDto,
            warrantyDto,
            allowedActions,
            placement.CreatedAt,
            placement.UpdatedAt
        );
    }
}
