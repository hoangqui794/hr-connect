using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Auth.Common;

public static class CandidateRegistrationIdentity
{
    public static async Task<Candidate?> ResolveAsync(
        ICandidateRepository repository, string email, string? phone,
        CancellationToken cancellationToken, Guid? currentUserId = null)
    {
        var byEmail = await repository.GetByNormalizedEmailAsync(email, cancellationToken);
        var byPhone = string.IsNullOrWhiteSpace(phone) ? null
            : await repository.GetByNormalizedPhoneAsync(phone, cancellationToken);

        if (byEmail != null && byPhone != null && byEmail.CandidateId != byPhone.CandidateId)
            throw new ConflictException("Email và số điện thoại thuộc về hai hồ sơ ứng viên khác nhau.");

        if (byEmail == null && byPhone != null)
            throw new ConflictException("Không thể liên kết hồ sơ chỉ bằng số điện thoại. Email phải khớp với hồ sơ ứng viên.");

        if (byEmail != null)
        {
            if (byEmail.UserId.HasValue && byEmail.UserId != currentUserId)
                throw new ConflictException("Hồ sơ ứng viên đã được liên kết với một tài khoản khác.");

            if (!string.IsNullOrWhiteSpace(phone) && !string.IsNullOrWhiteSpace(byEmail.NormalizedPhone)
                && !string.Equals(phone, byEmail.NormalizedPhone, StringComparison.Ordinal))
                throw new ConflictException("Số điện thoại không khớp với hồ sơ ứng viên của email này.");
        }

        return byEmail;
    }
}
