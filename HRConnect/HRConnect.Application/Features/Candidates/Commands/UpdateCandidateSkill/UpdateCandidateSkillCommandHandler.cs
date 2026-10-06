using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Commands.AddCandidateSkill;
using HRConnect.Application.Features.Candidates.Common;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateCandidateSkill;

public sealed class UpdateCandidateSkillCommandHandler : IRequestHandler<UpdateCandidateSkillCommand, CandidateSkillMutationResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateCandidateSkillCommandHandler(
        ICandidateRepository candidateRepository,
        IUnitOfWork unitOfWork)
    {
        _candidateRepository = candidateRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<CandidateSkillMutationResponse> Handle(
        UpdateCandidateSkillCommand request,
        CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdWithSkillsForUpdateAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ ứng viên tương ứng với tài khoản này.");

        var candidateSkill = candidate.CandidateSkills.SingleOrDefault(item => item.SkillId == request.SkillId)
            ?? throw new NotFoundException("Kỹ năng này không thuộc hồ sơ ứng viên.");

        candidateSkill.ProficiencyLevel = CandidateSkillRules.NormalizeProficiencyLevel(request.ProficiencyLevel);
        candidateSkill.YearsOfExperience = request.YearsOfExperience;
        candidate.UpdatedAt = DateTime.UtcNow;
        _candidateRepository.Update(candidate);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new CandidateSkillMutationResponse(
            true,
            "Đã cập nhật kỹ năng của ứng viên.",
            CandidateSkillRules.ToDto(candidateSkill));
    }
}
