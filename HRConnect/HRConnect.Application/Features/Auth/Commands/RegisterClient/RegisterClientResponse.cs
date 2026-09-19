namespace HRConnect.Application.Features.Auth.Commands.RegisterClient;

public class RegisterClientResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Registration successful. Please verify your email.";

    public RegisterClientData? Data { get; set; }
}

public class RegisterClientData
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string Status { get; set; } = "PENDING_EMAIL_VERIFICATION";
}
