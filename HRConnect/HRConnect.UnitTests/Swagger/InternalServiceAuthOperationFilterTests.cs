using FluentAssertions;
using HRConnect.Presentation.Swagger;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.OpenApi.Models;
using Moq;
using Swashbuckle.AspNetCore.SwaggerGen;
using Xunit;

namespace HRConnect.UnitTests.Swagger;

public class InternalServiceAuthOperationFilterTests
{
    private static readonly InternalServiceAuthOperationFilter Filter = new();

    [Fact]
    public void Apply_InternalHrRouteWithoutServiceMetadata_DoesNotAddServiceToken()
    {
        var operation = new OpenApiOperation();
        var context = CreateContext("api/v1/internal/jobs/review");

        Filter.Apply(operation, context);

        operation.Security.Should().BeEmpty();
    }

    [Fact]
    public void Apply_ServiceEndpointWithMetadata_UsesInternalServiceToken()
    {
        var operation = new OpenApiOperation();
        var context = CreateContext(
            "api/v1/internal/cvs/{cvId}/download-url",
            new InternalServiceAuthAttribute());

        Filter.Apply(operation, context);

        operation.Security.Should().ContainSingle();
        var securityScheme = operation.Security![0].Keys.Should().ContainSingle().Subject;
        securityScheme.Reference?.Id.Should().Be(InternalServiceAuthOperationFilter.SecuritySchemeName);
    }

    private static OperationFilterContext CreateContext(string relativePath, params object[] metadata)
    {
        var apiDescription = new ApiDescription
        {
            RelativePath = relativePath,
            ActionDescriptor = new ActionDescriptor { EndpointMetadata = metadata.ToList() }
        };

        return new OperationFilterContext(
            apiDescription,
            Mock.Of<ISchemaGenerator>(),
            new SchemaRepository(),
            typeof(InternalServiceAuthOperationFilterTests).GetMethod(nameof(Apply_InternalHrRouteWithoutServiceMetadata_DoesNotAddServiceToken))!);
    }
}
