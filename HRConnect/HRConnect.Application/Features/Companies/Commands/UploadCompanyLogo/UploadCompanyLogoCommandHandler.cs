using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Companies.Commands.UploadCompanyLogo;

public sealed class UploadCompanyLogoCommandHandler(
    ICompanyUserRepository companyUsers,
    ICompanyRepository companies,
    IStorageCleanupJobRepository cleanupJobs,
    IFileStorageService storage,
    IAvatarImageProcessor imageProcessor,
    ICompanyLogoUrlResolver logoUrlResolver,
    IUnitOfWork unitOfWork,
    ILogger<UploadCompanyLogoCommandHandler> logger)
    : IRequestHandler<UploadCompanyLogoCommand, CompanyLogoResponse>
{
    public async Task<CompanyLogoResponse> Handle(UploadCompanyLogoCommand request, CancellationToken cancellationToken)
    {
        var membership = await companyUsers.GetByUserIdAsync(request.UserId, cancellationToken);
        if (membership?.Company is null)
            throw new NotFoundException("Không tìm thấy doanh nghiệp tương ứng với tài khoản này.");
        if (!string.Equals(membership.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenException("Tài khoản doanh nghiệp của bạn đang bị khóa hoặc không hoạt động.");

        ProcessedAvatarImage processed;
        try
        {
            processed = await imageProcessor.ProcessAsync(request.FileStream, cancellationToken);
        }
        catch (NotSupportedException ex) { throw new BadRequestException(ex.Message, "COMPANY_LOGO_UNSUPPORTED_MEDIA_TYPE"); }
        catch (InvalidDataException ex) { throw new BadRequestException(ex.Message, "COMPANY_LOGO_INVALID_IMAGE"); }

        var company = membership.Company;
        var objectKey = $"company-logos/{company.CompanyId:D}/{Guid.NewGuid():N}{processed.Extension}";
        string uploadedKey;
        try
        {
            await using var stream = processed.OpenReadStream();
            uploadedKey = await storage.UploadAsync(stream, objectKey, processed.ContentType, cancellationToken);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError(ex, "Company logo upload failed for company {CompanyId}", company.CompanyId);
            throw new InvalidOperationException("Hệ thống lưu trữ ảnh đang tạm thời gián đoạn. Vui lòng thử lại sau.", ex);
        }

        var now = DateTime.UtcNow;
        var oldKey = GetOwnedKey(company);
        try
        {
            await unitOfWork.BeginTransactionAsync(cancellationToken);
            company.LogoObjectKey = uploadedKey;
            company.LogoUrl = null;
            company.LogoUpdatedAt = now;
            company.UpdatedAt = now;
            companies.Update(company);
            if (!string.IsNullOrWhiteSpace(oldKey) && !string.Equals(oldKey, uploadedKey, StringComparison.Ordinal))
                await cleanupJobs.AddAsync(CreateCleanupJob(oldKey, "COMPANY_LOGO_REPLACED", now), cancellationToken);
            await unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch
        {
            await CompensateAsync(uploadedKey, cancellationToken);
            throw;
        }

        return new CompanyLogoResponse
        {
            Data = new CompanyLogoData
            {
                CompanyId = company.CompanyId,
                LogoUrl = logoUrlResolver.Resolve(company),
                UpdatedAt = now
            }
        };
    }

    internal static string? GetOwnedKey(Company company)
    {
        var prefix = $"company-logos/{company.CompanyId:D}/";
        var key = company.LogoObjectKey;
        if (string.IsNullOrWhiteSpace(key) && company.LogoUrl?.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) == true)
            key = company.LogoUrl;
        return key?.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) == true && !key.Contains("..", StringComparison.Ordinal) ? key : null;
    }

    private static StorageCleanupJob CreateCleanupJob(string objectKey, string reason, DateTime now) => new()
    {
        StorageCleanupJobId = Guid.NewGuid(), ObjectKey = objectKey, Reason = reason,
        Status = "PENDING", NextAttemptAt = now, CreatedAt = now, UpdatedAt = now
    };

    private async Task CompensateAsync(string objectKey, CancellationToken cancellationToken)
    {
        try
        {
            await storage.DeleteAsync(objectKey, cancellationToken.IsCancellationRequested ? CancellationToken.None : cancellationToken);
        }
        catch (Exception deleteException)
        {
            logger.LogError(deleteException, "Could not compensate uploaded company logo; recovery queued");
            try
            {
                var now = DateTime.UtcNow;
                await cleanupJobs.AddAsync(CreateCleanupJob(objectKey, "COMPANY_LOGO_UPLOAD_COMPENSATION", now), CancellationToken.None);
                await unitOfWork.SaveChangesAsync(CancellationToken.None);
            }
            catch (Exception queueException)
            {
                logger.LogCritical(queueException, "Could not queue company logo compensation");
            }
        }
    }
}
