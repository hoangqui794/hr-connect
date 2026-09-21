using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces;

public interface IJwtTokenGenerator
{
    (string Token, DateTime ExpiresAt) GenerateAccessToken(
        AppUser user,
        IEnumerable<string> roles,
        IEnumerable<string> permissions);

    string GenerateRefreshToken();
}
