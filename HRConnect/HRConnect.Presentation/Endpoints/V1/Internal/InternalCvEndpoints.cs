using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Internal.Queries.GetInternalCvDownloadUrl;
using HRConnect.Infrastructure.Authentication;
using HRConnect.Presentation.Swagger;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace HRConnect.Presentation.Endpoints.V1.Internal;

public static class InternalCvEndpoints
{
    public static IEndpointRouteBuilder MapInternalCvEndpoints(this IEndpointRouteBuilder app)
    {
        // Nhóm API nội bộ chuẩn đồng bộ phiên bản v1: /api/v1/internal/cvs
        var internalCvGroup = app.MapGroup("/api/v1/internal/cvs")
                                 .WithTags("Internal APIs - CV Management")
                                 .WithMetadata(new InternalServiceAuthAttribute())
                                 .AddEndpointFilter<InternalServiceAuthFilter>();

        internalCvGroup.MapGet("/{cvId:guid}/download-url", async (
            Guid cvId,
            [FromQuery] int? expiryMinutes,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var query = new GetInternalCvDownloadUrlQuery(cvId, expiryMinutes);
                var result = await sender.Send(query, cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status500InternalServerError);
            }
        })
        .WithName("GetInternalCvDownloadUrl")
        .WithSummary("Lấy URL tải xuống CV có chữ ký tạm thời cho dịch vụ nội bộ (AI Service MF-03)")
        .WithDescription("Sinh presigned URL có hiệu lực ngắn từ Cloudflare R2 để các dịch vụ nội bộ (như AI Service) tải tệp PDF mà không cần truy cập trực tiếp database hoặc Cloudflare R2 credentials.")
        .Produces<GetInternalCvDownloadUrlResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        return app;
    }
}
