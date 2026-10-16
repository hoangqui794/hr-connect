using System;
using MediatR;

namespace HRConnect.Application.Features.Reports.Queries.GetReportOverview;

public sealed record GetReportOverviewQuery(DateOnly? From, DateOnly? To) : IRequest<ReportOverviewResponse>;
