using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.SavedJobs.DTOs;
using MediatR;

namespace HRConnect.Application.Features.Candidates.SavedJobs.Commands.UnsaveJob;

public sealed record UnsaveJobCommand(Guid UserId, Guid JobId) : IRequest<SaveJobResponse>;

public sealed class UnsaveJobCommandHandler : IRequestHandler<UnsaveJobCommand, SaveJobResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly ICandidateSavedJobRepository _savedJobRepository;
    private readonly IUnitOfWork _unitOfWork;

    public UnsaveJobCommandHandler(
        ICandidateRepository candidateRepository,
        ICandidateSavedJobRepository savedJobRepository,
        IUnitOfWork unitOfWork)
    {
        _candidateRepository = candidateRepository;
        _savedJobRepository = savedJobRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<SaveJobResponse> Handle(UnsaveJobCommand request, CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (candidate == null)
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng viên tương ứng với tài khoản.");

        var removed = await _savedJobRepository.RemoveAsync(candidate.CandidateId, request.JobId, cancellationToken);
        if (removed)
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new SaveJobResponse(true, "Đã xóa việc làm khỏi danh sách đã lưu.");
    }
}
