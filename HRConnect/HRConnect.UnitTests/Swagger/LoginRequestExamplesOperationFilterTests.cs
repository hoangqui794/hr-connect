using FluentAssertions;
using HRConnect.Presentation.Swagger;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.OpenApi.Models;
using Moq;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRConnect.UnitTests.Swagger;

public sealed class LoginRequestExamplesOperationFilterTests
{
    private static readonly LoginRequestExamplesOperationFilter Filter = new();

    [Fact]
    public void Apply_LoginOperation_AddsFiveRoleExamples()
    {
        var mediaType = new OpenApiMediaType();
        var operation = new OpenApiOperation
        {
            RequestBody = new OpenApiRequestBody
            {
                Content = new Dictionary<string, OpenApiMediaType>
                {
                    ["application/json"] = mediaType
                }
            }
        };

        Filter.Apply(operation, CreateContext("POST", "api/v1/auth/login"));

        mediaType.Examples.Should().HaveCount(5);
        mediaType.Examples.Keys.Should().BeEquivalentTo(
            "platformAdmin", "internalHr", "clientCompany", "affiliateRecruiter", "candidate");

        var candidate = mediaType.Examples["candidate"].Value.Should().BeOfType<Microsoft.OpenApi.Any.OpenApiObject>().Subject;
        candidate["email"].Should().BeOfType<Microsoft.OpenApi.Any.OpenApiString>()
            .Which.Value.Should().Be("candidate@gmail.com");
        candidate["password"].Should().BeOfType<Microsoft.OpenApi.Any.OpenApiString>()
            .Which.Value.Should().Be("111111Aa@");
    }

    [Theory]
    [InlineData("GET", "api/v1/auth/login")]
    [InlineData("POST", "api/v1/auth/register/candidate")]
    public void Apply_NonLoginOperation_DoesNotAddExamples(string method, string path)
    {
        var mediaType = new OpenApiMediaType();
        var operation = new OpenApiOperation
        {
            RequestBody = new OpenApiRequestBody
            {
                Content = new Dictionary<string, OpenApiMediaType>
                {
                    ["application/json"] = mediaType
                }
            }
        };

        Filter.Apply(operation, CreateContext(method, path));

        mediaType.Examples.Should().BeNullOrEmpty();
    }

    private static OperationFilterContext CreateContext(string method, string relativePath)
    {
        var apiDescription = new ApiDescription
        {
            HttpMethod = method,
            RelativePath = relativePath,
            ActionDescriptor = new ActionDescriptor()
        };

        return new OperationFilterContext(
            apiDescription,
            Mock.Of<ISchemaGenerator>(),
            new SchemaRepository(),
            typeof(LoginRequestExamplesOperationFilterTests)
                .GetMethod(nameof(Apply_LoginOperation_AddsFiveRoleExamples))!);
    }
}
