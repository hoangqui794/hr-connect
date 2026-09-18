namespace HRConnect.Application.Features.Auth.Commands.RegisterAffiliate;

public class RegisterAffiliateResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Registration successful. Please verify your email.";

    public RegisterAffiliateData? Data { get; set; }
}

public class RegisterAffiliateData
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string Status { get; set; } = "PENDING_EMAIL_VERIFICATION";
}
