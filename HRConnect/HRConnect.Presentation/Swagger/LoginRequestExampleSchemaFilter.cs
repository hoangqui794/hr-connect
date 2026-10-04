using HRConnect.Application.Features.Auth.Commands.Login;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRConnect.Presentation.Swagger;

/// <summary>
/// Provides the seeded Affiliate account as the Swagger-only login example.
/// This does not change request handling or authentication defaults.
/// </summary>
public sealed class LoginRequestExampleSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (context.Type != typeof(LoginCommand))
            return;

        schema.Example = new OpenApiObject
        {
            ["email"] = new OpenApiString("affiliate@gmail.com"),
            ["password"] = new OpenApiString("111111Aa@")
        };
    }
}
