using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateLibrary;

public sealed record GetAffiliateCandidateLibraryQuery(
    Guid UserId,
    string? Search = null,
    int Page = 1,
    int PageSize = 20,
    string SortBy = "lastSubmittedAt",
    string SortDirection = "desc") : IRequest<GetAffiliateCandidateLibraryResponse>;
