using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Reports.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Reports.Commands.RecalculateAffiliatePerformance;

public class RecalculateAffiliatePerformanceCommandHandler : IRequestHandler<RecalculateAffiliatePerformanceCommand, RecalculateAffiliatePerformanceResponse>
{
    private readonly IAffiliatePerformanceCalculationService _calcService;
    private readonly IAffiliateProfileRepository _profileRepository;
    private readonly ILogger<RecalculateAffiliatePerformanceCommandHandler> _logger;

    public RecalculateAffiliatePerformanceCommandHandler(
        IAffiliatePerformanceCalculationService calcService,
        IAffiliateProfileRepository profileRepository,
        ILogger<RecalculateAffiliatePerformanceCommandHandler> logger)
    {
        _calcService = calcService;
        _profileRepository = profileRepository;
        _logger = logger;
    }

    public async Task<RecalculateAffiliatePerformanceResponse> Handle(
        RecalculateAffiliatePerformanceCommand request,
        CancellationToken cancellationToken)
    {
        if (request.From > request.To)
        {
            throw new BadRequestException("Ngày bắt đầu (from) không được lớn hơn ngày kết thúc (to).");
        }

        int count = 0;
        if (request.AffiliateId.HasValue)
        {
            var profile = await _profileRepository.GetByIdAsync(request.AffiliateId.Value, cancellationToken);
            if (profile == null)
            {
                throw new NotFoundException($"Không tìm thấy đối tác tuyển dụng với mã {request.AffiliateId.Value}.");
            }

            await _calcService.CalculateAndUpsertAsync(
                request.AffiliateId.Value,
                request.From,
                request.To,
                cancellationToken);

            count = 1;
        }
        else
        {
            count = await _calcService.RecalculateAllActiveAffiliatesAsync(
                request.From,
                request.To,
                cancellationToken);
        }

        return new RecalculateAffiliatePerformanceResponse
        {
            Success = true,
            Message = $"Đã tính toán lại hiệu suất cho {count} đối tác tuyển dụng.",
            RecalculatedCount = count,
            PeriodStart = request.From,
            PeriodEnd = request.To
        };
    }
}
