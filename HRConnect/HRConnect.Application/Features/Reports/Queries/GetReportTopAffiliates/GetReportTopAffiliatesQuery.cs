using System;
using MediatR;

namespace HRConnect.Application.Features.Reports.Queries.GetReportTopAffiliates;

public sealed record GetReportTopAffiliatesQuery(
    DateOnly? From,
    DateOnly? To,
    string? SortBy = "PLACEMENTS",
    int Limit = 10) : IRequest<ReportTopAffiliatesResponse>;
