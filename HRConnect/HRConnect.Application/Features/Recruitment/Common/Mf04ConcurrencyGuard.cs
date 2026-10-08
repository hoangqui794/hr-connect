using HRConnect.Application.Common.Exceptions;

namespace HRConnect.Application.Features.Recruitment.Common;

public static class Mf04ConcurrencyGuard
{
    public static void EnsureMatches(Guid? suppliedToken, Guid currentToken, string resourceName)
    {
        // Persisted MF-04 records receive a non-empty token from PostgreSQL. Guid.Empty is kept
        // compatible only for transient/legacy objects that predate optimistic concurrency.
        if (currentToken == Guid.Empty)
        {
            return;
        }

        if (!suppliedToken.HasValue || suppliedToken.Value == Guid.Empty)
        {
            throw new BadRequestException($"Thiếu concurrencyToken của {resourceName}. Vui lòng tải lại dữ liệu.");
        }

        if (suppliedToken.Value != currentToken)
        {
            throw new ConflictException($"Dữ liệu {resourceName} đã bị thay đổi bởi người khác. Vui lòng tải lại trang.");
        }
    }
}
