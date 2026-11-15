using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Placements.Queries.GetPlacements;

public class GetPlacementsQueryHandler : IRequestHandler<GetPlacementsQuery, GetPlacementsResponse>
{
    private static readonly Regex ResignationNoteRegex = new(
        @"ngày làm việc cuối\s+(\d{4}-\d{2}-\d{2})(?::\s*(.+))?$",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private readonly IPlacementRepository _placementRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ILogger<GetPlacementsQueryHandler> _logger;

    public GetPlacementsQueryHandler(
        IPlacementRepository placementRepository,
        ICompanyUserRepository companyUserRepository,
        ILogger<GetPlacementsQueryHandler> logger)
    {
        _placementRepository = placementRepository;
        _companyUserRepository = companyUserRepository;
        _logger = logger;
    }

    public async Task<GetPlacementsResponse> Handle(GetPlacementsQuery request, CancellationToken cancellationToken)
    {
        Guid? companyId = null;

        if (request.IsClientCompanyUser)
        {
            var member = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (!HRConnect.Application.Features.Recruitment.Common.CompanyMembershipPolicy.IsActive(member))
            {
                _logger.LogWarning("Tài khoản Client Company {UserId} không gắn với doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }
            companyId = member.CompanyId;
        }
        else if (request.IsInternalHrOrAdmin)
        {
            companyId = request.CompanyId;
        }
        else
        {
            _logger.LogWarning("Người dùng {UserId} không có quyền xem danh sách tiếp nhận việc.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền xem danh sách tiếp nhận việc.");
        }

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var (items, totalCount) = await _placementRepository.GetPlacementsAsync(
            companyId,
            request.JobId,
            request.CandidateId,
            request.Status,
            request.FromDate,
            request.ToDate,
            page,
            pageSize,
            cancellationToken);

        var dtos = items.Select(p =>
        {
            var candidate = p.Application?.Candidate;
            var candidateName = !string.IsNullOrWhiteSpace(candidate?.FullName)
                ? candidate.FullName
                : (candidate?.Email ?? "Ứng viên");

            var candidateEmail = candidate?.Email ?? candidate?.User?.Email ?? string.Empty;
            var candidatePhone = candidate?.Phone ?? candidate?.User?.Phone;

            var confirmedByName = !string.IsNullOrWhiteSpace(p.ConfirmedByNavigation?.DisplayName)
                ? p.ConfirmedByNavigation.DisplayName
                : p.ConfirmedByNavigation?.Email;

            var (endDate, resignationReason, resignedBy) = ExtractResignationInfo(p);

            return new PlacementListItemDto(
                p.PlacementId,
                p.ApplicationId,
                p.OfferId,
                p.ActualStartDate,
                p.Position,
                p.Department,
                p.Status,
                p.ConfirmedAt,
                p.ConfirmedBy,
                confirmedByName,
                p.ConfirmationNote,
                new PlacementCandidateDto(
                    candidate?.CandidateId ?? Guid.Empty,
                    candidateName,
                    candidateEmail,
                    candidatePhone
                ),
                new PlacementJobDto(
                    p.Application?.JobId ?? Guid.Empty,
                    p.Application?.Job?.Title ?? string.Empty,
                    p.Application?.Job?.CompanyId ?? Guid.Empty,
                    p.Application?.Job?.Company?.CompanyName ?? string.Empty
                ),
                p.CreatedAt,
                p.UpdatedAt,
                p.Warranty?.EndDate,
                p.Warranty?.Status,
                p.ServiceFee?.Status,
                p.ReplacementSlotId.HasValue,
                p.Application?.Job?.ServiceType?.Code,
                endDate,
                resignationReason,
                resignedBy
            );
        }).ToList();

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return new GetPlacementsResponse(
            dtos,
            page,
            pageSize,
            totalCount,
            totalPages
        );
    }

    private static (DateOnly? EndDate, string? Reason, string? ResignedBy) ExtractResignationInfo(Placement p)
    {
        var isLeft = string.Equals(p.Status, PlacementStates.LeftDuringWarranty, StringComparison.OrdinalIgnoreCase)
                     || string.Equals(p.Status, "RESIGNED", StringComparison.OrdinalIgnoreCase);
        var warrantyStatus = p.Warranty?.Status;
        var hasClaimOrVoided = string.Equals(warrantyStatus, WarrantyStates.Claimed, StringComparison.OrdinalIgnoreCase)
                               || string.Equals(warrantyStatus, WarrantyStates.Voided, StringComparison.OrdinalIgnoreCase);

        if (!isLeft && !hasClaimOrVoided)
        {
            return (null, null, null);
        }

        var noteBeforeHr = p.Warranty?.ResultNote?.Split(" | Internal HR ", 2, StringSplitOptions.None)[0].Trim();
        DateOnly? endDate = null;
        string? reason = null;

        if (!string.IsNullOrWhiteSpace(noteBeforeHr))
        {
            var match = ResignationNoteRegex.Match(noteBeforeHr);
            if (match.Success)
            {
                if (DateOnly.TryParseExact(
                        match.Groups[1].Value,
                        "yyyy-MM-dd",
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.None,
                        out var parsedDate))
                {
                    endDate = parsedDate;
                }

                var parsedReason = match.Groups[2].Value.Trim();
                reason = string.IsNullOrWhiteSpace(parsedReason) ? null : parsedReason;
            }
            else
            {
                reason = noteBeforeHr;
            }
        }

        if (endDate == null && isLeft)
        {
            endDate = DateOnly.FromDateTime(p.UpdatedAt);
        }

        string? resignedBy = hasClaimOrVoided
                             || string.Equals(p.Status, PlacementStates.LeftDuringWarranty, StringComparison.OrdinalIgnoreCase)
                             || (noteBeforeHr?.StartsWith("Client báo nghỉ", StringComparison.OrdinalIgnoreCase) ?? false)
            ? "CLIENT"
            : null;

        return (endDate, reason, resignedBy);
    }
}
