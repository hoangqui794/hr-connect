using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ICandidateCvRepository
{
    Task<CandidateCv?> GetByIdAsync(Guid cvId, CancellationToken cancellationToken = default);

    Task<CandidateCv?> GetByCandidateIdAndCvIdAsync(Guid candidateId, Guid cvId, CancellationToken cancellationToken = default);

    Task<CandidateCv?> GetPrimaryByCandidateIdAsync(Guid candidateId, CancellationToken cancellationToken = default);

    Task<List<CandidateCv>> GetByCandidateIdAsync(Guid candidateId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CandidateCvUsageRecord>> GetPersonalCvUsageAsync(Guid candidateId, CancellationToken cancellationToken = default);

    Task<CandidateCv?> GetAdoptedBySourceCvIdAsync(Guid candidateId, Guid sourceCvId, CancellationToken cancellationToken = default);

    Task AddAsync(CandidateCv candidateCv, CancellationToken cancellationToken = default);

    void Update(CandidateCv candidateCv);

    void Delete(CandidateCv candidateCv);

    Task<bool> IsCvInUseAsync(Guid cvId, CancellationToken cancellationToken = default);
}

public sealed record CandidateCvUsageRecord(
    CandidateCv Cv,
    int SubmissionUsageCount,
    int ApplicationUsageCount);
