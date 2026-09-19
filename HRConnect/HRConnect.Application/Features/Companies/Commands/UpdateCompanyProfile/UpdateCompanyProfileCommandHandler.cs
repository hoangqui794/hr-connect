using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Companies.Commands.UpdateCompanyProfile;

public class UpdateCompanyProfileCommandHandler : IRequestHandler<UpdateCompanyProfileCommand, UpdateCompanyProfileResponse>
{
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<UpdateCompanyProfileCommandHandler> _logger;

    public UpdateCompanyProfileCommandHandler(
        ICompanyUserRepository companyUserRepository,
        ICompanyRepository companyRepository,
        IUnitOfWork unitOfWork,
        ILogger<UpdateCompanyProfileCommandHandler> logger)
    {
        _companyUserRepository = companyUserRepository;
        _companyRepository = companyRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<UpdateCompanyProfileResponse> Handle(
        UpdateCompanyProfileCommand request,
        CancellationToken cancellationToken)
    {
        var companyUser = await _companyUserRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (companyUser == null || companyUser.Company == null)
        {
            _logger.LogWarning("Không tìm thấy thông tin công ty để cập nhật cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin công ty tương ứng với tài khoản này.");
        }

        if (!string.Equals(companyUser.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Tài khoản doanh nghiệp của UserId {UserId} đang ở trạng thái không hoạt động ({Status})", request.UserId, companyUser.Status);
            throw new ForbiddenException("Tài khoản doanh nghiệp của bạn đang bị khóa hoặc không hoạt động.");
        }

        var company = companyUser.Company;
        string? newTaxCode = string.IsNullOrWhiteSpace(request.TaxCode) ? null : request.TaxCode.Trim();

        if (!string.IsNullOrEmpty(newTaxCode) && !string.Equals(company.TaxCode, newTaxCode, StringComparison.OrdinalIgnoreCase))
        {
            var taxCodeExists = await _companyRepository.ExistsByTaxCodeAsync(newTaxCode, company.CompanyId, cancellationToken);
            if (taxCodeExists)
            {
                _logger.LogWarning("Mã số thuế {TaxCode} đã tồn tại cho công ty khác khi cập nhật cho CompanyId {CompanyId}", newTaxCode, company.CompanyId);
                throw new BadRequestException("Mã số thuế này đã được sử dụng bởi một công ty khác.");
            }
        }

        var now = DateTime.UtcNow;

        company.CompanyName = request.CompanyName.Trim();
        company.TaxCode = newTaxCode;
        company.Industry = string.IsNullOrWhiteSpace(request.Industry) ? null : request.Industry.Trim();
        company.CompanySize = string.IsNullOrWhiteSpace(request.CompanySize) ? null : request.CompanySize.Trim();
        company.Website = string.IsNullOrWhiteSpace(request.Website) ? null : request.Website.Trim();
        company.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        company.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        company.UpdatedAt = now;

        _companyRepository.Update(company);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Cập nhật thông tin công ty {CompanyId} thành công cho UserId {UserId}", company.CompanyId, request.UserId);

        return new UpdateCompanyProfileResponse
        {
            Success = true,
            Message = "Cập nhật hồ sơ doanh nghiệp thành công.",
            Data = new UpdateCompanyProfileData
            {
                CompanyId = company.CompanyId,
                CompanyName = company.CompanyName,
                TaxCode = company.TaxCode,
                Industry = company.Industry,
                CompanySize = company.CompanySize,
                Website = company.Website,
                Address = company.Address,
                Description = company.Description,
                VerificationStatus = company.VerificationStatus,
                VerifiedAt = company.VerifiedAt,
                RoleInCompany = companyUser.RoleInCompany,
                IsPrimaryContact = companyUser.IsPrimaryContact,
                CreatedAt = company.CreatedAt,
                UpdatedAt = company.UpdatedAt
            }
        };
    }
}
