using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.RefreshToken;

public record RefreshTokenCommand(string RefreshToken) : IRequest<RefreshTokenResponse>;
