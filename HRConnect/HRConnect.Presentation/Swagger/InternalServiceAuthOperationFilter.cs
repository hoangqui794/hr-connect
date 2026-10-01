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
/// only to endpoints explicitly marked with <see cref="InternalServiceAuthAttribute"/>.
/// Other endpoints, including internal HR routes, inherit the standard JWT Bearer security scheme.
/// </summary>
public class InternalServiceAuthOperationFilter : IOperationFilter
{
    public const string SecuritySchemeName = "InternalServiceToken";

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var hasInternalMetadata = context.ApiDescription.ActionDescriptor.EndpointMetadata
            .OfType<InternalServiceAuthAttribute>()
            .Any();

        if (hasInternalMetadata)
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
