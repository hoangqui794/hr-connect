using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Companies.Directory;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Companies.Commands.UpdateCompanyProfile;

public class UpdateCompanyProfileCommandHandler : IRequestHandler<UpdateCompanyProfileCommand, UpdateCompanyProfileResponse>
{
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<UpdateCompanyProfileCommandHandler> _logger;
    private readonly ICompanyDirectoryRepository? _directory;

    public UpdateCompanyProfileCommandHandler(
        ICompanyUserRepository companyUserRepository,
        ICompanyRepository companyRepository,
        IUnitOfWork unitOfWork,
        ILogger<UpdateCompanyProfileCommandHandler> logger,
        ICompanyDirectoryRepository? directory = null)
    {
        _directory = directory;
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
        await ApplyTaxonomyAsync(company, request, cancellationToken);
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
                IndustryId = company.IndustryId,
                CompanySizeId = company.CompanySizeId,
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

    /// <summary>
    /// BE-02 A: an id must be an active industry / size (400 otherwise) and also refreshes the free-text column.
    /// Without an id the free text is matched to a code or name so old clients keep a linked value.
    /// </summary>
    private async Task ApplyTaxonomyAsync(HRConnect.Domain.Entities.Company company, UpdateCompanyProfileCommand request, CancellationToken cancellationToken)
    {
        if (_directory == null) return;

        if (request.IndustryId.HasValue)
        {
            var industry = await _directory.GetIndustryAsync(request.IndustryId.Value, cancellationToken);
            if (industry == null || !industry.IsActive)
                throw new BadRequestException("Ngành không tồn tại hoặc đã ngừng sử dụng.", "INDUSTRY_NOT_FOUND");
            company.IndustryId = industry.IndustryId;
            company.Industry = industry.NameEn;
        }
        else
        {
            var industries = await _directory.GetIndustriesAsync(includeInactive: false, cancellationToken);
            company.IndustryId = MatchIndustry(industries, company.Industry)?.IndustryId;
        }

        if (request.CompanySizeId.HasValue)
        {
            var size = await _directory.GetCompanySizeAsync(request.CompanySizeId.Value, cancellationToken);
            if (size == null || !size.IsActive)
                throw new BadRequestException("Quy mô công ty không tồn tại hoặc đã ngừng sử dụng.", "COMPANY_SIZE_NOT_FOUND");
            company.CompanySizeId = size.CompanySizeId;
            company.CompanySize = size.Code;
        }
        else
        {
            var sizes = await _directory.GetActiveCompanySizesAsync(cancellationToken);
            company.CompanySizeId = string.IsNullOrWhiteSpace(company.CompanySize) ? null
                : sizes.FirstOrDefault(s => string.Equals(s.Code, company.CompanySize, StringComparison.OrdinalIgnoreCase)
                                            || string.Equals(s.Label, company.CompanySize, StringComparison.OrdinalIgnoreCase))?.CompanySizeId;
        }
    }

    private static HRConnect.Domain.Entities.Industry? MatchIndustry(IEnumerable<HRConnect.Domain.Entities.Industry> industries, string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var value = text.Trim();
        return industries.FirstOrDefault(i => string.Equals(i.Code, value, StringComparison.OrdinalIgnoreCase)
                                              || string.Equals(i.NameEn, value, StringComparison.OrdinalIgnoreCase)
                                              || string.Equals(i.NameVi, value, StringComparison.OrdinalIgnoreCase));
    }
}
