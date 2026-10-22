using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IServiceAgreementRepository
{
    Task<ServiceAgreement?> GetByIdAsync(Guid agreementId, CancellationToken cancellationToken = default);

    Task<ServiceAgreement?> GetByIdForUpdateAsync(Guid agreementId, CancellationToken cancellationToken = default);

    Task<ServiceAgreement?> GetCurrentByJobIdAsync(Guid jobId, CancellationToken cancellationToken = default);

    Task<ServiceAgreement?> GetByVerificationCodeAsync(string verificationCode, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ServiceAgreement>> GetHistoryByJobIdAsync(Guid jobId, CancellationToken cancellationToken = default);

    Task AddAsync(ServiceAgreement agreement, CancellationToken cancellationToken = default);

    Task<ServiceAgreementSignatureChallenge?> GetActiveChallengeAsync(
        Guid agreementId,
        Guid signerUserId,
        DateTime nowUtc,
        CancellationToken cancellationToken = default);

    Task AddChallengeAsync(ServiceAgreementSignatureChallenge challenge, CancellationToken cancellationToken = default);

    Task<int> GetChallengeCountTodayAsync(Guid signerUserId, DateTime todayUtc, CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
