using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRConnect.Presentation.Swagger;

/// <summary>
/// Removes the global Bearer requirement from anonymous endpoints. Submission
/// consent endpoints advertise Bearer as optional because linked candidates must
/// authenticate while unregistered candidates are authorized by the email token.
/// </summary>
public sealed class AnonymousEndpointSecurityOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var isAnonymous = context.ApiDescription.ActionDescriptor.EndpointMetadata
            .OfType<IAllowAnonymous>()
            .Any();
        if (!isAnonymous) return;

        var path = context.ApiDescription.RelativePath ?? string.Empty;
        if (path.StartsWith("api/v1/submission-consents/", StringComparison.OrdinalIgnoreCase))
        {
            operation.Security =
            [
                new OpenApiSecurityRequirement(),
                new OpenApiSecurityRequirement
                {
                    [new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                    }] = Array.Empty<string>()
                }
            ];
            return;
        }

        operation.Security = new List<OpenApiSecurityRequirement>();
    }
}
