using System.Security.Cryptography;
using System.Text;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Identity.MakeCandidatePrimaryEmailIdentity;

public sealed class MakeCandidatePrimaryEmailIdentityCommandHandler(
    ICandidateRepository candidateRepository,
    IUserRepository userRepository,
    IUserEmailIdentityRepository identityRepository,
    IAuditLogService auditLogService,
    IUnitOfWork unitOfWork)
    : IRequestHandler<MakeCandidatePrimaryEmailIdentityCommand, MakeCandidatePrimaryEmailIdentityResponse>
{
    public async Task<MakeCandidatePrimaryEmailIdentityResponse> Handle(
        MakeCandidatePrimaryEmailIdentityCommand request,
        CancellationToken cancellationToken)
    {
        var candidate = await candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate.");
        if (!string.Equals(candidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            candidate.MergedIntoCandidateId.HasValue)
            throw new ConflictException("Hồ sơ Candidate không còn hoạt động hoặc đã được hợp nhất.");

        var targetIdentity = await identityRepository.GetByIdAndUserIdAsync(
            request.EmailIdentityId, request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy email liên kết.");

        if (targetIdentity.Kind == "PRIMARY")
            throw new ConflictException("Email này đã là email đăng nhập chính.", "EMAIL_ALREADY_PRIMARY");
        if (targetIdentity.Status == "REVOKED")
            throw new ConflictException("Email liên kết đã bị thu hồi.", "EMAIL_IDENTITY_ALREADY_REVOKED");
        if (targetIdentity.Kind != "ALIAS" || targetIdentity.Status != "VERIFIED")
            throw new ConflictException("Chỉ email phụ đã xác minh mới có thể đặt làm email đăng nhập chính.", "EMAIL_IDENTITY_NOT_VERIFIED");
        if (request.ConcurrencyToken.HasValue &&
            request.ConcurrencyToken.Value != Guid.Empty &&
            targetIdentity.ConcurrencyToken != request.ConcurrencyToken.Value)
            throw new ConflictException("Email liên kết đã thay đổi. Vui lòng tải lại dữ liệu.", "STALE_EMAIL_IDENTITY");

        var currentPrimary = await identityRepository.GetPrimaryByUserIdAsync(request.UserId, cancellationToken);
        var user = await userRepository.GetByIdAsync(request.UserId, cancellationToken);

        var now = DateTime.UtcNow;
        var newToken = Guid.NewGuid();
        var oldPrimaryEmail = currentPrimary?.NormalizedEmail ?? user?.Email ?? string.Empty;

        await unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            if (currentPrimary != null && currentPrimary.EmailIdentityId != targetIdentity.EmailIdentityId)
            {
                currentPrimary.Kind = "ALIAS";
                currentPrimary.UpdatedAt = now;
                currentPrimary.ConcurrencyToken = Guid.NewGuid();
                identityRepository.Update(currentPrimary);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            targetIdentity.Kind = "PRIMARY";
            targetIdentity.UpdatedAt = now;
            targetIdentity.ConcurrencyToken = newToken;
            identityRepository.Update(targetIdentity);

            if (user != null)
            {
                user.Email = targetIdentity.Email;
                user.UpdatedAt = now;
                userRepository.Update(user);
            }

            candidate.Email = targetIdentity.Email;
            candidate.NormalizedEmail = targetIdentity.NormalizedEmail;
            candidate.UpdatedAt = now;
            candidateRepository.Update(candidate);

            await auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.CandidatePrimaryEmailChanged,
                EntityType = "USER_EMAIL_IDENTITY",
                EntityId = targetIdentity.EmailIdentityId,
                ActorUserId = request.UserId,
                OldValues = new
                {
                    previousPrimaryEmailMasked = MaskEmail(oldPrimaryEmail),
                    previousPrimaryEmailHash = string.IsNullOrEmpty(oldPrimaryEmail) ? null : Hash(oldPrimaryEmail)
                },
                NewValues = new
                {
                    kind = "PRIMARY",
                    status = "VERIFIED",
                    newPrimaryEmailMasked = MaskEmail(targetIdentity.NormalizedEmail),
                    newPrimaryEmailHash = Hash(targetIdentity.NormalizedEmail)
                }
            }, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);
            await unitOfWork.CommitTransactionAsync(cancellationToken);

            return new MakeCandidatePrimaryEmailIdentityResponse(
                true,
                "Đã đặt email này làm email đăng nhập chính.",
                targetIdentity.EmailIdentityId,
                targetIdentity.Email,
                targetIdentity.Kind,
                targetIdentity.Status,
                newToken);
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

