using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.RegisterCandidate;

public record RegisterCandidateCommand(
    string Email,
    string Password,
    string FullName,
    string? Phone = null
) : IRequest<RegisterCandidateResponse>;

public class RegisterCandidateResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Registration successful. Please verify your email.";

    public RegisterCandidateData? Data { get; set; }
}

public class RegisterCandidateData
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string Status { get; set; } = "PENDING";
}
