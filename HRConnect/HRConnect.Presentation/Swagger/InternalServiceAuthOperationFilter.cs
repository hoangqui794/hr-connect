using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRConnect.Presentation.Swagger;

/// <summary>
/// Marker attribute to identify endpoints that require internal service-to-service authentication (X-Service-Token).
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class | AttributeTargets.Interface)]
public class InternalServiceAuthAttribute : Attribute
{
}

/// <summary>
/// OpenAPI/Swagger operation filter that applies the InternalServiceToken security requirement
/// exclusively to internal service endpoints (e.g. /api/internal/cvs/* and /api/v1/internal/cvs/*).
/// Normal public/user endpoints remain protected by the standard JWT Bearer security scheme.
/// </summary>
public class InternalServiceAuthOperationFilter : IOperationFilter
{
    public const string SecuritySchemeName = "InternalServiceToken";

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var hasInternalMetadata = context.ApiDescription.ActionDescriptor.EndpointMetadata
            .OfType<InternalServiceAuthAttribute>()
            .Any();

        var isInternalPath = (context.ApiDescription.RelativePath?.Contains("api/internal", StringComparison.OrdinalIgnoreCase) == true)
            || (context.ApiDescription.RelativePath?.Contains("api/v1/internal", StringComparison.OrdinalIgnoreCase) == true);

        if (hasInternalMetadata || isInternalPath)
        {
            operation.Security = new List<OpenApiSecurityRequirement>
            {
                new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id = SecuritySchemeName
                            }
                        },
                        Array.Empty<string>()
                    }
                }
            };
        }
    }
}
