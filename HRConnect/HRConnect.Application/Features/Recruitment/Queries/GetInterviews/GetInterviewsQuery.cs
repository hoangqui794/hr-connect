using System;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Queries.GetInterviews;

public record GetInterviewsQuery(
    Guid UserId,
    bool IsClientCompanyUser,
    bool IsInternalHrOrAdmin,
    bool IsCandidate = false,
    Guid? JobId = null,
    Guid? ApplicationId = null,
    Guid? InterviewerId = null,
    string? Status = null,
    string? Result = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    int Page = 1,
    int PageSize = 10
) : IRequest<GetInterviewsResponse>;
