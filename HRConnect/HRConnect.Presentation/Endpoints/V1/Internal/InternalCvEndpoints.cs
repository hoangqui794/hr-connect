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
        // 1. Nhóm API nội bộ chuẩn theo yêu cầu: /api/internal/cvs
        var internalCvGroup = app.MapGroup("/api/internal/cvs")
                                 .WithTags("Internal APIs - CV Management")
                                 .WithMetadata(new InternalServiceAuthAttribute())
                                 .AddEndpointFilter<InternalServiceAuthFilter>();

        // 2. Nhóm route alias /api/v1/internal/cvs (đảm bảo tính nhất quán với versioning)
        var internalCvV1Group = app.MapGroup("/api/v1/internal/cvs")
                                   .WithTags("Internal APIs - CV Management")
                                   .WithMetadata(new InternalServiceAuthAttribute())
                                   .AddEndpointFilter<InternalServiceAuthFilter>();

        RegisterDownloadUrlEndpoint(internalCvGroup);
        RegisterDownloadUrlEndpoint(internalCvV1Group);

        return app;
    }

    private static void RegisterDownloadUrlEndpoint(RouteGroupBuilder group)
    {
        group.MapGet("/{cvId:guid}/download-url", async (
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
        .WithName($"GetInternalCvDownloadUrl_{group.GetHashCode()}")
        .WithSummary("Lấy URL tải xuống CV có chữ ký tạm thời cho dịch vụ nội bộ (AI Service MF-03)")
        .WithDescription("Sinh presigned URL có hiệu lực ngắn từ Cloudflare R2 để các dịch vụ nội bộ (như AI Service) tải tệp PDF mà không cần truy cập trực tiếp database hoặc Cloudflare R2 credentials.")
        .Produces<GetInternalCvDownloadUrlResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);
    }
}
