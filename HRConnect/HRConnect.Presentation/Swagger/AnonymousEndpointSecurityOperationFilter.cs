using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRConnect.Presentation.Swagger;

/// <summary>
/// Removes the global Bearer requirement from anonymous endpoints. Public
/// submission-consent endpoints are reserved for unregistered candidates and
/// authenticate solely with the one-time email token.
/// </summary>
public sealed class AnonymousEndpointSecurityOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var isAnonymous = context.ApiDescription.ActionDescriptor.EndpointMetadata
            .OfType<IAllowAnonymous>()
            .Any();
        if (!isAnonymous) return;

        // An empty requirement object explicitly overrides the document-level
        // Bearer requirement while keeping the operation available anonymously.
        operation.Security = [new OpenApiSecurityRequirement()];
    }
}
