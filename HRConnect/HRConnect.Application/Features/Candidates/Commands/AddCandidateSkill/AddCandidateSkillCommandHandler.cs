using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Common;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.AddCandidateSkill;

public sealed class AddCandidateSkillCommandHandler : IRequestHandler<AddCandidateSkillCommand, CandidateSkillMutationResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly ISkillRepository _skillRepository;
    private readonly IUnitOfWork _unitOfWork;

    public AddCandidateSkillCommandHandler(
        ICandidateRepository candidateRepository,
        ISkillRepository skillRepository,
        IUnitOfWork unitOfWork)
    {
        _candidateRepository = candidateRepository;
        _skillRepository = skillRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<CandidateSkillMutationResponse> Handle(
        AddCandidateSkillCommand request,
        CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdWithSkillsForUpdateAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ ứng viên tương ứng với tài khoản này.");

        if (request.SkillId.HasValue && request.SkillId.Value != Guid.Empty &&
            candidate.CandidateSkills.Any(item => item.SkillId == request.SkillId.Value))
        {
            throw new ConflictException("Kỹ năng này đã có trong hồ sơ ứng viên.");
        }

        if (candidate.CandidateSkills.Count >= 50)
        {
            throw new BadRequestException("Một hồ sơ chỉ được có tối đa 50 kỹ năng.");
        }

        Skill skill;
        if (request.SkillId.HasValue && request.SkillId.Value != Guid.Empty)
        {
            var skills = await _skillRepository.GetActiveByIdsAsync([request.SkillId.Value], cancellationToken);
            if (!skills.TryGetValue(request.SkillId.Value, out var foundSkill))
            {
                throw new BadRequestException("Kỹ năng không tồn tại hoặc đã ngừng hoạt động.");
            }
            skill = foundSkill;
        }
        else if (!string.IsNullOrWhiteSpace(request.SkillName))
        {
            skill = await _skillRepository.GetOrCreateByNameAsync(request.SkillName, null, cancellationToken);
        }
        else
        {
            throw new BadRequestException("Vui lòng chọn hoặc nhập tên kỹ năng.");
        }

        if (candidate.CandidateSkills.Any(item => item.SkillId == skill.SkillId))
        {
            throw new ConflictException("Kỹ năng này đã có trong hồ sơ ứng viên.");
        }

        var candidateSkill = new CandidateSkill
        {
            CandidateId = candidate.CandidateId,
            SkillId = skill.SkillId,
            ProficiencyLevel = CandidateSkillRules.NormalizeProficiencyLevel(request.ProficiencyLevel),
            YearsOfExperience = request.YearsOfExperience
        };

        candidate.CandidateSkills.Add(candidateSkill);
        candidate.UpdatedAt = DateTime.UtcNow;
        _candidateRepository.Update(candidate);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new CandidateSkillMutationResponse(
            true,
            "Đã thêm kỹ năng vào hồ sơ ứng viên.",
            CandidateSkillRules.ToDto(candidateSkill, skill));
    }
}
