using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class UserTokenRepository : IUserTokenRepository
{
    private readonly ApplicationDbContext _context;

    public UserTokenRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(UserToken userToken, CancellationToken cancellationToken = default)
    {
        await _context.UserTokens.AddAsync(userToken, cancellationToken);
    }

    public async Task<UserToken?> GetLatestActiveOtpAsync(
        Guid userId, 
        string tokenType, 
        CancellationToken cancellationToken = default)
    {
        return await _context.UserTokens
            .Where(t => t.UserId == userId && t.TokenType == tokenType && t.UsedAt == null)
            .OrderByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public void Update(UserToken userToken)
    {
        _context.UserTokens.Update(userToken);
    }
}
