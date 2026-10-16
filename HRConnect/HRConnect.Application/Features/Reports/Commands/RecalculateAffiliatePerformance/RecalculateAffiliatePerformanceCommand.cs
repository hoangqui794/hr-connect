using System;
using MediatR;

namespace HRConnect.Application.Features.Reports.Commands.RecalculateAffiliatePerformance;

public record RecalculateAffiliatePerformanceCommand(
    DateOnly From,
    DateOnly To,
    Guid? AffiliateId = null) : IRequest<RecalculateAffiliatePerformanceResponse>;
