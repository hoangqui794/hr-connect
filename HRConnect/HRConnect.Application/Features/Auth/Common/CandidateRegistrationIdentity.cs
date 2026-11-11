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
        {
            if (byPhone.UserId.HasValue && byPhone.UserId != currentUserId)
                throw new ConflictException("Số điện thoại này đã được sử dụng bởi một tài khoản khác.");
        }

        if (byEmail == null && byPhone != null)
        {
            if (byPhone.UserId.HasValue && byPhone.UserId != currentUserId)
                throw new ConflictException("Số điện thoại này đã được sử dụng bởi một tài khoản khác.");

            throw new ConflictException("Không thể liên kết hồ sơ chỉ bằng số điện thoại. Email phải khớp với hồ sơ ứng viên.");
        }

        if (byEmail != null)
        {
            if (byEmail.UserId.HasValue && byEmail.UserId != currentUserId)
                throw new ConflictException("Hồ sơ ứng viên đã được liên kết với một tài khoản khác.");

            // Chỉ ném lỗi không khớp SĐT nếu tài khoản đã liên kết với currentUserId mà SĐT truyền vào lại khác với SĐT đã lưu.
            // Nếu byEmail.UserId == null (hồ sơ unclaimed do Affiliate nộp), cho phép ứng viên đăng ký với SĐT cá nhân của họ.
            if (byEmail.UserId.HasValue && byEmail.UserId == currentUserId
                && !string.IsNullOrWhiteSpace(phone) && !string.IsNullOrWhiteSpace(byEmail.NormalizedPhone)
                && !string.Equals(phone, byEmail.NormalizedPhone, StringComparison.Ordinal))
            {
                throw new ConflictException("Số điện thoại không khớp với hồ sơ ứng viên của email này.");
            }
        }

        return byEmail;
    }
}
