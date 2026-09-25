using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.InternalHr.Commands.RetryAiScoring;

public sealed record RetryAiScoringCommand(Guid ApplicationId, Guid RequestedByUserId)
    : IRequest<RetryAiScoringResponse>;

public sealed record RetryAiScoringResponse(
    bool Success,
    string Message,
    Guid ApplicationId,
    string AiStatus);

public sealed class RetryAiScoringCommandHandler
    : IRequestHandler<RetryAiScoringCommand, RetryAiScoringResponse>
{
    private readonly IApplicationRepository _applications;
    private readonly IMf03ScoringTrigger _scoringTrigger;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<RetryAiScoringCommandHandler> _logger;

    public RetryAiScoringCommandHandler(
        IApplicationRepository applications,
        IMf03ScoringTrigger scoringTrigger,
        IUnitOfWork unitOfWork,
        ILogger<RetryAiScoringCommandHandler> logger)
    {
        _applications = applications;
        _scoringTrigger = scoringTrigger;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<RetryAiScoringResponse> Handle(
        RetryAiScoringCommand request,
        CancellationToken cancellationToken)
    {
        var application = await _applications.GetByIdWithDetailsAsync(request.ApplicationId, cancellationToken);
        if (application == null)
            throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển.");

        var submission = application.Submission;
        if (submission == null)
            throw new ConflictException("Hồ sơ ứng tuyển không có CV được chấp nhận để chấm lại bằng AI.");

        var latestAttempt = application.AiMatchResults
            .OrderByDescending(result => result.AttemptNo)
            .FirstOrDefault();
        if (latestAttempt == null)
            throw new ConflictException("Hồ sơ này chưa có lượt chấm AI để thử lại.");
        if (!string.Equals(latestAttempt.Status, "FAILED", StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Chỉ có thể thử lại khi lượt chấm AI gần nhất đã thất bại.");

        await _scoringTrigger.TriggerScoringAsync(
            new Mf03TriggerPayload(
                application.ApplicationId,
                submission.CvId,
                application.JobId,
                request.RequestedByUserId),
            cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Internal user {UserId} queued MF-03 retry for ApplicationId={ApplicationId} after failed AttemptNo={AttemptNo}.",
            request.RequestedByUserId,
            application.ApplicationId,
            latestAttempt.AttemptNo);

        return new RetryAiScoringResponse(
            true,
            "Đã đưa yêu cầu chấm AI lại vào hàng đợi.",
            application.ApplicationId,
            "PENDING");
    }
}
