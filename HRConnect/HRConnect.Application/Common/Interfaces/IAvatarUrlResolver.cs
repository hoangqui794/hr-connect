using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces;

public interface IAvatarUrlResolver
{
    string? Resolve(AppUser user);
}
