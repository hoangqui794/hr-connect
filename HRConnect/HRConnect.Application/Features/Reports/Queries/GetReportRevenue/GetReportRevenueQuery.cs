using System;
using MediatR;

namespace HRConnect.Application.Features.Reports.Queries.GetReportRevenue;

public sealed record GetReportRevenueQuery(
    DateOnly? From,
    DateOnly? To,
    string? GroupBy = "MONTH") : IRequest<ReportRevenueResponse>;
