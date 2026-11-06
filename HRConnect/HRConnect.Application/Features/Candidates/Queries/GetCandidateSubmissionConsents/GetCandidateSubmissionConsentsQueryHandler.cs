using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.SubmissionConsents.GetSubmissionConsent;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateSubmissionConsents;

public sealed class GetCandidateSubmissionConsentsQueryHandler(
    ICandidateRepository candidateRepository,
    ISubmissionRepository submissionRepository)
    : IRequestHandler<GetCandidateSubmissionConsentsQuery, CandidateSubmissionConsentsResponse>
{
    private static readonly HashSet<string> AllowedStatuses =
        ["PENDING", "CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED"];

    public async Task<CandidateSubmissionConsentsResponse> Handle(
        GetCandidateSubmissionConsentsQuery request,
        CancellationToken cancellationToken)
    {
        var candidate = await candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate.");
        if (candidate.Status != "ACTIVE" || candidate.MergedIntoCandidateId.HasValue)
            throw new ConflictException("Hồ sơ Candidate không còn hoạt động hoặc đã được hợp nhất.");

        var status = string.IsNullOrWhiteSpace(request.Status) ? "PENDING" : request.Status.Trim().ToUpperInvariant();
        if (!AllowedStatuses.Contains(status))
            throw new BadRequestException("Trạng thái consent không hợp lệ.");

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var (records, total) = await submissionRepository.GetCandidateSubmissionConsentsAsync(
            candidate.CandidateId, status, page, pageSize, cancellationToken);
        var now = DateTime.UtcNow;

        return new CandidateSubmissionConsentsResponse
        {
            Data = new CandidateSubmissionConsentsData
            {
                Items = records.Select(record =>
                {
                    var actionable = record.ConsentStatus == "PENDING" &&
                                     record.SubmissionStatus == "PENDING_CONSENT" &&
                                     record.ExpiresAt > now;
                    var currency = string.IsNullOrWhiteSpace(record.CurrencyCode) ? "VND" : record.CurrencyCode;
                    var salaryNegotiable = record.SalaryNegotiable || (record.SalaryMin == null && record.SalaryMax == null);
                    var expReq = GetSubmissionConsentQueryHandler.FormatExperienceRequirement(
                        record.MinExperienceYears,
                        record.MaxExperienceYears);
                    var workMode = GetSubmissionConsentQueryHandler.ResolveWorkMode(
                        record.EmploymentType,
                        record.WorkingTime);

                    return new CandidateSubmissionConsentItem
                    {
                        SubmissionId = record.SubmissionId,
                        ConsentStatus = record.ConsentStatus,
                        SubmissionStatus = record.SubmissionStatus,
                        JobId = record.JobId,
                        JobTitle = record.JobTitle,
                        CompanyId = record.CompanyId,
                        CompanyName = record.CompanyName,
                        CvId = record.CvId,
                        CvTitle = record.CvTitle,
                        CvFileName = record.CvFileName,
                        CvFileSizeBytes = record.CvFileSizeBytes,
                        AffiliateUserId = record.AffiliateUserId,
                        AffiliateDisplayName = record.AffiliateDisplayName,
                        AffiliateEmail = record.AffiliateEmail,
                        AffiliatePhone = record.AffiliatePhone,
                        PitchText = record.PitchText,
                        CandidateConditionSummary = record.PitchText,
                        SalaryMin = record.SalaryMin,
                        SalaryMax = record.SalaryMax,
                        CurrencyCode = currency,
                        SalaryCurrency = currency,
                        SalaryNegotiable = salaryNegotiable,
                        IsSalaryNegotiable = salaryNegotiable,
                        JobLocation = record.JobLocation,
                        WorkLocation = record.JobLocation,
                        WorkMode = workMode,
                        EmploymentType = record.EmploymentType,
                        MinExperienceYears = record.MinExperienceYears,
                        MaxExperienceYears = record.MaxExperienceYears,
                        ExperienceRequirement = expReq,
                        RequestedAt = record.RequestedAt,
                        ExpiresAt = record.ExpiresAt,
                        RespondedAt = record.RespondedAt,
                        IsActionable = actionable,
                        RemainingSeconds = actionable ? Math.Max(0, (long)(record.ExpiresAt - now).TotalSeconds) : 0
                    };
                }).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = (int)Math.Ceiling(total / (double)pageSize)
            }
        };
    }
}
