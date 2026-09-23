using System;
using System.Collections.Generic;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRConnect.Presentation.Swagger;

/// <summary>
/// Adjusts Swagger operation tags based on business domain ownership:
/// - POST /api/v1/jobs/{jobId}/apply -> Candidate Applications
/// - POST /api/v1/jobs/{jobId}/candidate-submissions -> Affiliate Submissions
/// Keeps underlying routes unchanged while ensuring clean Swagger documentation grouping.
/// </summary>
public class SwaggerEndpointTagFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var relativePath = context.ApiDescription.RelativePath?.Trim('/');
        var method = context.ApiDescription.HttpMethod;

        if (string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(relativePath))
        {
            if (string.Equals(relativePath, "api/v1/jobs/{jobId}/apply", StringComparison.OrdinalIgnoreCase))
            {
                operation.Tags = new List<OpenApiTag>
                {
                    new() { Name = "Candidate Applications" }
                };
            }
            else if (string.Equals(relativePath, "api/v1/jobs/{jobId}/candidate-submissions", StringComparison.OrdinalIgnoreCase))
            {
                operation.Tags = new List<OpenApiTag>
                {
                    new() { Name = "Affiliate Submissions" }
                };
            }
        }
    }
}
