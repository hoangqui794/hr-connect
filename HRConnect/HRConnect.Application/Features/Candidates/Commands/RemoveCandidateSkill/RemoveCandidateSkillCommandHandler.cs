using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.RemoveCandidateSkill;

public sealed class RemoveCandidateSkillCommandHandler : IRequestHandler<RemoveCandidateSkillCommand, RemoveCandidateSkillResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly IUnitOfWork _unitOfWork;

    public RemoveCandidateSkillCommandHandler(
        ICandidateRepository candidateRepository,
        IUnitOfWork unitOfWork)
    {
        _candidateRepository = candidateRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<RemoveCandidateSkillResponse> Handle(
        RemoveCandidateSkillCommand request,
        CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdWithSkillsForUpdateAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ ứng viên tương ứng với tài khoản này.");

        var candidateSkill = candidate.CandidateSkills.SingleOrDefault(item => item.SkillId == request.SkillId)
            ?? throw new NotFoundException("Kỹ năng này không thuộc hồ sơ ứng viên.");

        candidate.CandidateSkills.Remove(candidateSkill);
        candidate.UpdatedAt = DateTime.UtcNow;
        _candidateRepository.Update(candidate);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new RemoveCandidateSkillResponse(true, "Đã xóa kỹ năng khỏi hồ sơ ứng viên.", request.SkillId);
    }
}
