using FluentAssertions;
using HRConnect.Presentation.Swagger;
using Microsoft.OpenApi.Models;
using Moq;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRConnect.UnitTests.Swagger;

public class SwaggerTagOrderDocumentFilterTests
{
    [Fact]
    public void Apply_WhenAdminUsersIsUsed_AddsCatalogDescriptionInAdminOrder()
    {
        var document = new OpenApiDocument
        {
            Paths = new OpenApiPaths
            {
                ["/api/v1/admin/users"] = PathWithTag("Admin Users"),
                ["/api/v1/admin/approvals"] = PathWithTag("Admin Approvals")
            }
        };
        var context = new DocumentFilterContext(
            [],
            Mock.Of<ISchemaGenerator>(),
            new SchemaRepository());

        new SwaggerTagOrderDocumentFilter().Apply(document, context);

        document.Tags.Select(tag => tag.Name).Should().Equal("Admin Users", "Admin Approvals");
        document.Tags[0].Description.Should().Contain("tạm khóa");
    }

    private static OpenApiPathItem PathWithTag(string tag)
    {
        var item = new OpenApiPathItem();
        item.Operations[OperationType.Get] = new OpenApiOperation
        {
            Tags = [new OpenApiTag { Name = tag }]
        };
        return item;
    }
}
