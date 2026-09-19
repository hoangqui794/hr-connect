using System;
using MediatR;

namespace HRConnect.Application.Features.Auth.Queries.GetCurrentUser;

public record GetCurrentUserQuery(Guid? UserId = null) : IRequest<CurrentUserResponse>;
