using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Companies.Commands.UploadCompanyLogo;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Companies.Commands.DeleteCompanyLogo;

public sealed class DeleteCompanyLogoCommandHandler(
    ICompanyUserRepository companyUsers,
    ICompanyRepository companies,
    IStorageCleanupJobRepository cleanupJobs,
    IUnitOfWork unitOfWork,
    ILogger<DeleteCompanyLogoCommandHandler> logger)
    : IRequestHandler<DeleteCompanyLogoCommand, CompanyLogoResponse>
{
    public async Task<CompanyLogoResponse> Handle(DeleteCompanyLogoCommand request, CancellationToken cancellationToken)
    {
        var membership = await companyUsers.GetByUserIdAsync(request.UserId, cancellationToken);
        if (membership?.Company is null)
            throw new NotFoundException("Không tìm thấy doanh nghiệp tương ứng với tài khoản này.");
        if (!string.Equals(membership.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenException("Tài khoản doanh nghiệp của bạn đang bị khóa hoặc không hoạt động.");

        var company = membership.Company;
        var oldKey = UploadCompanyLogoCommandHandler.GetOwnedKey(company);
        var hadLogo = !string.IsNullOrWhiteSpace(company.LogoObjectKey) || !string.IsNullOrWhiteSpace(company.LogoUrl);
        var now = DateTime.UtcNow;
        if (hadLogo)
        {
            await unitOfWork.BeginTransactionAsync(cancellationToken);
            company.LogoObjectKey = null;
            company.LogoUrl = null;
            company.LogoUpdatedAt = now;
            company.UpdatedAt = now;
            companies.Update(company);
            if (!string.IsNullOrWhiteSpace(oldKey))
            {
                await cleanupJobs.AddAsync(new StorageCleanupJob
                {
                    StorageCleanupJobId = Guid.NewGuid(), ObjectKey = oldKey, Reason = "COMPANY_LOGO_DELETED",
                    Status = "PENDING", NextAttemptAt = now, CreatedAt = now, UpdatedAt = now
                }, cancellationToken);
            }
            await unitOfWork.CommitTransactionAsync(cancellationToken);
        }

        logger.LogInformation("Company logo cleared for company {CompanyId}; cleanup queued: {CleanupQueued}", company.CompanyId, oldKey is not null);
        return new CompanyLogoResponse
        {
            Message = hadLogo ? "Xóa logo doanh nghiệp thành công." : "Doanh nghiệp hiện chưa có logo.",
            Data = new CompanyLogoData { CompanyId = company.CompanyId, LogoUrl = null, UpdatedAt = now }
        };
    }
}
