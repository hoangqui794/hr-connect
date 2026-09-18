using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateCandidateProfile;

public class UpdateCandidateProfileCommandHandler : IRequestHandler<UpdateCandidateProfileCommand, UpdateCandidateProfileResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPhoneNormalizer _phoneNormalizer;
    private readonly ILogger<UpdateCandidateProfileCommandHandler> _logger;

    public UpdateCandidateProfileCommandHandler(
        ICandidateRepository candidateRepository,
        IUserRepository userRepository,
        IUnitOfWork unitOfWork,
        IPhoneNormalizer phoneNormalizer,
        ILogger<UpdateCandidateProfileCommandHandler> logger)
    {
        _candidateRepository = candidateRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _phoneNormalizer = phoneNormalizer;
        _logger = logger;
    }

    public async Task<UpdateCandidateProfileResponse> Handle(UpdateCandidateProfileCommand request, CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken);

        if (candidate == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng viên để cập nhật cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy hồ sơ ứng viên tương ứng với tài khoản này.");
        }

        var now = DateTime.UtcNow;
        var normalizedPhone = _phoneNormalizer.Normalize(request.Phone);

        // Cập nhật thông tin Candidate
        candidate.FullName = request.FullName.Trim();
        candidate.Phone = request.Phone?.Trim();
        candidate.NormalizedPhone = normalizedPhone;
        candidate.DateOfBirth = request.DateOfBirth;
        candidate.Gender = request.Gender?.Trim().ToUpperInvariant();
        candidate.CurrentAddress = request.CurrentAddress?.Trim();
        candidate.HighestEducation = request.HighestEducation?.Trim();
        candidate.YearsOfExperience = request.YearsOfExperience;
        candidate.Summary = request.Summary?.Trim();
        candidate.UpdatedAt = now;

        _candidateRepository.Update(candidate);

        // Đồng bộ DisplayName và Phone sang bảng AppUser
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
        if (user != null)
        {
            user.DisplayName = request.FullName.Trim();
            if (!string.IsNullOrWhiteSpace(request.Phone))
            {
                user.Phone = request.Phone.Trim();
                user.NormalizedPhone = normalizedPhone;
            }
            user.UpdatedAt = now;
            _userRepository.Update(user);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Ứng viên CandidateId {CandidateId} (UserId {UserId}) đã cập nhật hồ sơ thành công.", 
            candidate.CandidateId, request.UserId);

        return new UpdateCandidateProfileResponse
        {
            Success = true,
            Message = "Cập nhật hồ sơ ứng viên thành công.",
            Data = new UpdateCandidateProfileData
            {
                CandidateId = candidate.CandidateId,
                UserId = candidate.UserId,
                FullName = candidate.FullName,
                Phone = candidate.Phone,
                DateOfBirth = candidate.DateOfBirth,
                Gender = candidate.Gender,
                CurrentAddress = candidate.CurrentAddress,
                HighestEducation = candidate.HighestEducation,
                YearsOfExperience = candidate.YearsOfExperience,
                Summary = candidate.Summary,
                ProfileVisibility = candidate.ProfileVisibility,
                UpdatedAt = candidate.UpdatedAt
            }
        };
    }
}
