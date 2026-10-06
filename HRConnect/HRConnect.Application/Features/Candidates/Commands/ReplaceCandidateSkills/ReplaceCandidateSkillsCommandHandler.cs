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

        var skillIds = request.Skills.Select(skill => skill.SkillId).ToArray();
        var skillsById = await _skillRepository.GetActiveByIdsAsync(skillIds, cancellationToken);
        if (skillsById.Count != skillIds.Length)
        {
            throw new BadRequestException("Một hoặc nhiều kỹ năng không tồn tại hoặc đã ngừng hoạt động.");
        }

        foreach (var existingSkill in candidate.CandidateSkills.ToList())
        {
            candidate.CandidateSkills.Remove(existingSkill);
        }

        var candidateSkills = request.Skills.Select(input => new CandidateSkill
        {
            CandidateId = candidate.CandidateId,
            SkillId = input.SkillId,
            ProficiencyLevel = CandidateSkillRules.NormalizeProficiencyLevel(input.ProficiencyLevel),
            YearsOfExperience = input.YearsOfExperience
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
            candidateSkills
                .Select(candidateSkill => CandidateSkillRules.ToDto(candidateSkill, skillsById[candidateSkill.SkillId]))
                .ToList());
    }
}
