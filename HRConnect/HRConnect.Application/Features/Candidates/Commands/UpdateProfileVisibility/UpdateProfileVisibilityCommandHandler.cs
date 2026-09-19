using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateProfileVisibility;

public class UpdateProfileVisibilityCommandHandler : IRequestHandler<UpdateProfileVisibilityCommand, UpdateProfileVisibilityResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<UpdateProfileVisibilityCommandHandler> _logger;

    public UpdateProfileVisibilityCommandHandler(
        ICandidateRepository candidateRepository,
        IUnitOfWork unitOfWork,
        ILogger<UpdateProfileVisibilityCommandHandler> logger)
    {
        _candidateRepository = candidateRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<UpdateProfileVisibilityResponse> Handle(UpdateProfileVisibilityCommand request, CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken);

        if (candidate == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng viên để cập nhật chế độ hiển thị cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy hồ sơ ứng viên tương ứng với tài khoản này.");
        }

        var normalizedVisibility = request.Visibility.Trim().ToUpperInvariant();
        candidate.ProfileVisibility = normalizedVisibility;
        candidate.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã cập nhật chế độ hiển thị hồ sơ ứng viên {CandidateId} sang {Visibility}", candidate.CandidateId, normalizedVisibility);

        return new UpdateProfileVisibilityResponse
        {
            Success = true,
            Message = "Cập nhật chế độ hiển thị hồ sơ thành công.",
            Data = new UpdateProfileVisibilityData
            {
                CandidateId = candidate.CandidateId,
                UserId = candidate.UserId,
                ProfileVisibility = candidate.ProfileVisibility,
                UpdatedAt = candidate.UpdatedAt
            }
        };
    }
}
