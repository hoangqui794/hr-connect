using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IUserTokenRepository
{
    Task AddAsync(UserToken userToken, CancellationToken cancellationToken = default);

    Task<UserToken?> GetLatestActiveOtpAsync(Guid userId, string tokenType, CancellationToken cancellationToken = default);

    Task InvalidateActiveTokensAsync(Guid userId, string tokenType, CancellationToken cancellationToken = default);

    void Update(UserToken userToken);
}
