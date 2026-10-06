using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRConnect.Presentation.Swagger;

/// <summary>
/// Adds selectable credentials for locally seeded demo accounts to the existing
/// login operation. Swagger UI is only enabled in Development; these examples do
/// not add routes or change authentication behavior.
/// </summary>
public sealed class LoginRequestExamplesOperationFilter : IOperationFilter
{
    private const string LoginPath = "api/v1/auth/login";
    private const string DemoPassword = "111111Aa@";

    private static readonly IReadOnlyDictionary<string, (string Summary, string Email)> Accounts =
        new Dictionary<string, (string Summary, string Email)>
        {
            ["platformAdmin"] = ("Platform Admin", "admin@gmail.com"),
            ["internalHr"] = ("Internal HR", "internalhr@gmail.com"),
            ["clientCompany"] = ("Client Company", "client@gmail.com"),
            ["affiliateRecruiter"] = ("Affiliate Recruiter", "affiliate@gmail.com"),
            ["candidate"] = ("Candidate", "candidate@gmail.com")
        };

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        if (!string.Equals(context.ApiDescription.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(context.ApiDescription.RelativePath?.Trim('/'), LoginPath, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (operation.RequestBody?.Content is null ||
            !operation.RequestBody.Content.TryGetValue("application/json", out var mediaType) ||
            mediaType is null)
        {
            return;
        }

        mediaType.Example = null;
        mediaType.Examples = Accounts.ToDictionary(
            account => account.Key,
            account => new OpenApiExample
            {
                Summary = account.Value.Summary,
                Description = "Tài khoản demo chỉ dùng để kiểm thử trực tiếp trong Swagger ở môi trường Development; frontend không phụ thuộc vào mẫu này.",
                Value = new OpenApiObject
                {
                    ["email"] = new OpenApiString(account.Value.Email),
                    ["password"] = new OpenApiString(DemoPassword)
                }
            });
    }
}
