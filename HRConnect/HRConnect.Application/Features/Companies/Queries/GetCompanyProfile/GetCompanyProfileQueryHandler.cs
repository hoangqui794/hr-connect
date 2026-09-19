using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Companies.Queries.GetCompanyProfile;

public class GetCompanyProfileQueryHandler : IRequestHandler<GetCompanyProfileQuery, CompanyProfileResponse>
{
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ILogger<GetCompanyProfileQueryHandler> _logger;

    public GetCompanyProfileQueryHandler(
        ICompanyUserRepository companyUserRepository,
        ILogger<GetCompanyProfileQueryHandler> logger)
    {
        _companyUserRepository = companyUserRepository;
        _logger = logger;
    }

    public async Task<CompanyProfileResponse> Handle(
        GetCompanyProfileQuery request,
        CancellationToken cancellationToken)
    {
        var companyUser = await _companyUserRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (companyUser == null || companyUser.Company == null)
        {
            _logger.LogWarning("Không tìm thấy thông tin công ty cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin công ty tương ứng với tài khoản này.");
        }

        var company = companyUser.Company;

        return new CompanyProfileResponse
        {
            Success = true,
            Message = "Lấy thông tin hồ sơ doanh nghiệp thành công.",
            Data = new CompanyProfileData
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
