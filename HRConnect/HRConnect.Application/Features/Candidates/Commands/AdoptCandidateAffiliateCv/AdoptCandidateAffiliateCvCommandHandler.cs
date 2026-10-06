using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.AdoptCandidateAffiliateCv;

public sealed class AdoptCandidateAffiliateCvCommandHandler
    : IRequestHandler<AdoptCandidateAffiliateCvCommand, AdoptCandidateAffiliateCvResponse>
{
    private readonly ICandidateRepository _candidates;
    private readonly ICandidateCvRepository _candidateCvs;
    private readonly ISubmissionRepository _submissions;
    private readonly ICvStorageService _storage;

    public AdoptCandidateAffiliateCvCommandHandler(
        ICandidateRepository candidates,
        ICandidateCvRepository candidateCvs,
        ISubmissionRepository submissions,
        ICvStorageService storage)
    {
        _candidates = candidates;
        _candidateCvs = candidateCvs;
        _submissions = submissions;
        _storage = storage;
    }

    public async Task<AdoptCandidateAffiliateCvResponse> Handle(
        AdoptCandidateAffiliateCvCommand request,
        CancellationToken cancellationToken)
    {
        var candidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate của tài khoản hiện tại.");
        if (!string.Equals(candidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            candidate.MergedIntoCandidateId.HasValue)
            throw new ConflictException(
                "Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất.",
                "CANDIDATE_NOT_ACTIVE");

        var detail = await _submissions.GetCandidateAffiliateCvDetailAsync(
            candidate.CandidateId, request.SourceCvId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy CV do Affiliate đã nộp cho Candidate này.");
        if (!string.Equals(detail.DocumentStatus, "ACTIVE", StringComparison.Ordinal) ||
            detail.AcceptedSubmissionCount == 0)
            throw new ConflictException(
                "Chỉ có thể nhận CV vào kho cá nhân sau khi Candidate đã đồng ý ít nhất một lần nộp sử dụng CV này.",
                "AFFILIATE_CV_NOT_ADOPTABLE");

        var existing = await _candidateCvs.GetAdoptedBySourceCvIdAsync(
            candidate.CandidateId, request.SourceCvId, cancellationToken);
        if (existing != null)
            return Map(existing, request.SourceCvId, true, "CV này đã có trong kho CV cá nhân.");

        var adopted = await _storage.AdoptAffiliateCvAsync(
            candidate.CandidateId,
            request.UserId,
            request.SourceCvId,
            request.Title,
            cancellationToken);

        return new AdoptCandidateAffiliateCvResponse(
            true,
            "Đã nhận CV vào kho cá nhân. Bản CV dùng trong lịch sử ứng tuyển vẫn được giữ nguyên.",
            new CandidateAffiliateCvAdoptionData(
                request.SourceCvId,
                adopted.CvId,
                adopted.Title,
                adopted.FileName,
                adopted.IsPrimary,
                adopted.Status,
                false,
                adopted.CreatedAt));
    }

    private static AdoptCandidateAffiliateCvResponse Map(
        Domain.Entities.CandidateCv cv,
        Guid sourceCvId,
        bool alreadyAdopted,
        string message) =>
        new(
            true,
            message,
            new CandidateAffiliateCvAdoptionData(
                sourceCvId,
                cv.CvId,
                cv.Title,
                cv.FileName,
                cv.IsPrimary,
                cv.Status,
                alreadyAdopted,
                cv.CreatedAt));
}
