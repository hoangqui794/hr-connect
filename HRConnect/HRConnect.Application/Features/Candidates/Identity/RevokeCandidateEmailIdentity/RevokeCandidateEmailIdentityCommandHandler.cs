using System.Security.Cryptography;
using System.Text;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Identity.RevokeCandidateEmailIdentity;

public sealed class RevokeCandidateEmailIdentityCommandHandler(
    ICandidateRepository candidateRepository,
    IUserEmailIdentityRepository identityRepository,
    IAuditLogService auditLogService,
    IUnitOfWork unitOfWork)
    : IRequestHandler<RevokeCandidateEmailIdentityCommand, RevokeCandidateEmailIdentityResponse>
{
    public async Task<RevokeCandidateEmailIdentityResponse> Handle(
        RevokeCandidateEmailIdentityCommand request,
        CancellationToken cancellationToken)
    {
        var candidate = await candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate.");
        if (candidate.Status != "ACTIVE" || candidate.MergedIntoCandidateId.HasValue)
            throw new ConflictException("Hồ sơ Candidate không còn hoạt động hoặc đã được hợp nhất.");

        var identity = await identityRepository.GetByIdAndUserIdAsync(
            request.EmailIdentityId, request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy email liên kết.");
        if (identity.Kind == "PRIMARY")
            throw new ConflictException("Không thể thu hồi email đăng nhập chính.", "PRIMARY_EMAIL_CANNOT_BE_REVOKED");
        if (identity.Status == "REVOKED")
            throw new ConflictException("Email liên kết đã được thu hồi trước đó.", "EMAIL_IDENTITY_ALREADY_REVOKED");
        if (identity.Kind != "ALIAS" || identity.Status != "VERIFIED")
            throw new ConflictException("Email liên kết chưa ở trạng thái có thể thu hồi.", "EMAIL_IDENTITY_NOT_REVOCABLE");
        if (identity.ConcurrencyToken != request.ConcurrencyToken)
            throw new ConflictException("Email liên kết đã thay đổi. Vui lòng tải lại dữ liệu.", "STALE_EMAIL_IDENTITY");

        var now = DateTime.UtcNow;
        var newToken = Guid.NewGuid();
        await unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            identity.Status = "REVOKED";
            identity.RevokedAt = now;
            identity.UpdatedAt = now;
            identity.ConcurrencyToken = newToken;
            identityRepository.Update(identity);
            await auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.CandidateEmailIdentityRevoked,
                EntityType = "USER_EMAIL_IDENTITY",
                EntityId = identity.EmailIdentityId,
                ActorUserId = request.UserId,
                OldValues = new { status = "VERIFIED" },
                NewValues = new
                {
                    status = "REVOKED",
                    revokedAt = now,
                    emailMasked = MaskEmail(identity.NormalizedEmail),
                    emailHash = Hash(identity.NormalizedEmail)
                }
            }, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            await unitOfWork.CommitTransactionAsync(cancellationToken);
            return new(true, identity.EmailIdentityId, identity.Status, now, newToken);
        }
        catch
        {
            await unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }
    }

    private static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0) return "***";
        var local = email[..at];
        return $"{local[..Math.Min(2, local.Length)]}***{email[at..]}";
    }

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}
