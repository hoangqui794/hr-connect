using System;
using MediatR;

namespace HRConnect.Application.Features.Reports.Queries.GetReportTopCompanies;

public sealed record GetReportTopCompaniesQuery(
    DateOnly? From,
    DateOnly? To,
    string? SortBy = "PLACEMENTS",
    int Limit = 10) : IRequest<ReportTopCompaniesResponse>;
