using System;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplications;

public record GetRecruitmentApplicationsQuery(
    Guid UserId,
    bool IsClientCompanyUser,
    bool IsInternalHrOrAdmin,
    Guid? JobId = null,
    string? Status = null,
    string? CandidateName = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    int Page = 1,
    int PageSize = 10
) : IRequest<RecruitmentApplicationsResponse>;
