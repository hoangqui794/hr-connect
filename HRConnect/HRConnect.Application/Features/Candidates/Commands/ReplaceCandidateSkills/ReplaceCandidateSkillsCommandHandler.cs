using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Common;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.ReplaceCandidateSkills;

public sealed class ReplaceCandidateSkillsCommandHandler : IRequestHandler<ReplaceCandidateSkillsCommand, ReplaceCandidateSkillsResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly ISkillRepository _skillRepository;
    private readonly IUnitOfWork _unitOfWork;

    public ReplaceCandidateSkillsCommandHandler(
        ICandidateRepository candidateRepository,
        ISkillRepository skillRepository,
        IUnitOfWork unitOfWork)
    {
        _candidateRepository = candidateRepository;
        _skillRepository = skillRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<ReplaceCandidateSkillsResponse> Handle(
        ReplaceCandidateSkillsCommand request,
        CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdWithSkillsForUpdateAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ ứng viên tương ứng với tài khoản này.");

        var explicitSkillIds = request.Skills
            .Where(s => s.SkillId.HasValue && s.SkillId.Value != Guid.Empty)
            .Select(s => s.SkillId!.Value)
            .Distinct()
            .ToArray();

        var skillsById = await _skillRepository.GetActiveByIdsAsync(explicitSkillIds, cancellationToken);
        if (skillsById.Count != explicitSkillIds.Length)
        {
            throw new BadRequestException("Một hoặc nhiều kỹ năng không tồn tại hoặc đã ngừng hoạt động.");
        }

        var resolvedSkills = new List<(Skill Skill, string? ProficiencyLevel, decimal? YearsOfExperience)>();
        foreach (var input in request.Skills)
        {
            Skill skill;
            if (input.SkillId.HasValue && input.SkillId.Value != Guid.Empty)
            {
                skill = skillsById[input.SkillId.Value];
            }
            else if (!string.IsNullOrWhiteSpace(input.SkillName))
            {
                skill = await _skillRepository.GetOrCreateByNameAsync(input.SkillName, null, cancellationToken);
            }
            else
            {
                throw new BadRequestException("Vui lòng chọn hoặc nhập tên kỹ năng.");
            }

            if (!resolvedSkills.Any(s => s.Skill.SkillId == skill.SkillId))
            {
                resolvedSkills.Add((skill, input.ProficiencyLevel, input.YearsOfExperience));
            }
        }

        foreach (var existingSkill in candidate.CandidateSkills.ToList())
        {
            candidate.CandidateSkills.Remove(existingSkill);
        }

        var candidateSkills = resolvedSkills.Select(item => new CandidateSkill
        {
            CandidateId = candidate.CandidateId,
            SkillId = item.Skill.SkillId,
            ProficiencyLevel = CandidateSkillRules.NormalizeProficiencyLevel(item.ProficiencyLevel),
            YearsOfExperience = item.YearsOfExperience
        }).ToList();

        foreach (var candidateSkill in candidateSkills)
        {
            candidate.CandidateSkills.Add(candidateSkill);
        }

        candidate.UpdatedAt = DateTime.UtcNow;
        _candidateRepository.Update(candidate);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new ReplaceCandidateSkillsResponse(
            true,
            "Đã cập nhật danh sách kỹ năng của ứng viên.",
            resolvedSkills.Select(item => CandidateSkillRules.ToDto(
                candidateSkills.First(cs => cs.SkillId == item.Skill.SkillId),
                item.Skill)).ToList());
    }
}
