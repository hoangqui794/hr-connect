using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateProfile;

public class GetCandidateProfileQueryHandler : IRequestHandler<GetCandidateProfileQuery, CandidateProfileResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly ILogger<GetCandidateProfileQueryHandler> _logger;

    public GetCandidateProfileQueryHandler(
        ICandidateRepository candidateRepository,
        ILogger<GetCandidateProfileQueryHandler> logger)
    {
        _candidateRepository = candidateRepository;
        _logger = logger;
    }

    public async Task<CandidateProfileResponse> Handle(GetCandidateProfileQuery request, CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdWithDetailsAsync(request.UserId, cancellationToken);

        if (candidate == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng viên cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy hồ sơ ứng viên tương ứng với tài khoản này.");
        }

        var primaryCv = candidate.CandidateCvs.SingleOrDefault();
        var response = new CandidateProfileResponse
        {
            Success = true,
            Message = "Lấy thông tin hồ sơ ứng viên thành công.",
            Data = new CandidateProfileData
            {
                CandidateId = candidate.CandidateId,
                UserId = candidate.UserId,
                FullName = candidate.FullName,
                Email = candidate.Email ?? candidate.User?.Email,
                Phone = candidate.Phone ?? candidate.User?.Phone,
                DateOfBirth = candidate.DateOfBirth,
                Gender = candidate.Gender,
                CurrentAddress = candidate.CurrentAddress,
                HighestEducation = candidate.HighestEducation,
                YearsOfExperience = candidate.YearsOfExperience,
                Summary = candidate.Summary,
                ProfileVisibility = candidate.ProfileVisibility,
                Status = candidate.Status,
                AvatarUrl = candidate.User?.AvatarUrl,
                CreatedAt = candidate.CreatedAt,
                UpdatedAt = candidate.UpdatedAt,
                Skills = candidate.CandidateSkills?.Select(cs => new CandidateSkillItemDto
                {
                    SkillId = cs.SkillId,
                    SkillName = cs.Skill?.SkillName ?? string.Empty,
                    Category = cs.Skill?.Category,
                    ProficiencyLevel = cs.ProficiencyLevel,
                    YearsOfExperience = cs.YearsOfExperience
                }).ToList() ?? new List<CandidateSkillItemDto>(),
                PrimaryCv = primaryCv != null ? new CandidateCvItemDto
                {
                    CvId = primaryCv.CvId,
                    Title = primaryCv.Title,
                    CreationMethod = primaryCv.CreationMethod,
                    SourceFileUrl = primaryCv.SourceFileUrl,
                    RenderedFileUrl = primaryCv.RenderedFileUrl,
                    FileName = primaryCv.FileName,
                    FileSizeBytes = primaryCv.FileSizeBytes,
                    IsPrimary = primaryCv.IsPrimary,
                    UpdatedAt = primaryCv.UpdatedAt
                } : null
            }
        };

        return response;
    }
}
