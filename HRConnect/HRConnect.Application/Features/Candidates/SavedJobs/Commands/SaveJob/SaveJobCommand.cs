using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.SavedJobs.DTOs;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Candidates.SavedJobs.Commands.SaveJob;

public sealed record SaveJobCommand(Guid UserId, Guid JobId) : IRequest<SaveJobResponse>;

public sealed class SaveJobCommandHandler : IRequestHandler<SaveJobCommand, SaveJobResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly IJobRepository _jobRepository;
    private readonly ICandidateSavedJobRepository _savedJobRepository;
    private readonly IUnitOfWork _unitOfWork;

    public SaveJobCommandHandler(
        ICandidateRepository candidateRepository,
        IJobRepository jobRepository,
        ICandidateSavedJobRepository savedJobRepository,
        IUnitOfWork unitOfWork)
    {
        _candidateRepository = candidateRepository;
        _jobRepository = jobRepository;
        _savedJobRepository = savedJobRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<SaveJobResponse> Handle(SaveJobCommand request, CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (candidate == null)
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng viên tương ứng với tài khoản.");

        var job = await _jobRepository.GetByIdAsync(request.JobId, cancellationToken);
        if (job == null)
            throw new NotFoundException("Không tìm thấy công việc.");

        // Kiểm tra quyền xem của Candidate đối với Job
        var candidateRole = new[] { JobAccessPolicy.CandidateRole };
        var canView = JobAccessPolicy.CanViewDetail(job, isOwner: false, hasInternalAccess: false) &&
                      await _jobRepository.CanAnyRoleViewJobAsync(job.ServiceTypeId, candidateRole, cancellationToken);

        if (!canView)
            throw new ForbiddenException("Bạn không có quyền xem hoặc lưu công việc này.");

        // Idempotent: nếu đã lưu rồi thì trả thành công luôn
        var alreadySaved = await _savedJobRepository.IsSavedAsync(candidate.CandidateId, request.JobId, cancellationToken);
        if (alreadySaved)
        {
            return new SaveJobResponse(true, "Việc làm đã được lưu từ trước.");
        }

        var savedJob = new CandidateSavedJob
        {
            CandidateSavedJobId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            JobId = request.JobId,
            CreatedAt = DateTime.UtcNow
        };

        await _savedJobRepository.AddAsync(savedJob, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new SaveJobResponse(true, "Lưu việc làm thành công.", savedJob.CandidateSavedJobId);
    }
}
