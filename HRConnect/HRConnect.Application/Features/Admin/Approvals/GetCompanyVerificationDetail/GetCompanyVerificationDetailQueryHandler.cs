using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.GetCompanyVerificationDetail;

public class GetCompanyVerificationDetailQueryHandler : IRequestHandler<GetCompanyVerificationDetailQuery, GetCompanyVerificationDetailResponse>
{
    private readonly ICompanyVerificationRequestRepository _companyVerificationRequestRepository;

    public GetCompanyVerificationDetailQueryHandler(ICompanyVerificationRequestRepository companyVerificationRequestRepository)
    {
        _companyVerificationRequestRepository = companyVerificationRequestRepository;
    }

    public async Task<GetCompanyVerificationDetailResponse> Handle(GetCompanyVerificationDetailQuery request, CancellationToken cancellationToken)
    {
        var verificationRequest = await _companyVerificationRequestRepository.GetByIdWithDetailsAsync(request.RequestId, cancellationToken);
        if (verificationRequest == null)
        {
            throw new NotFoundException("Không tìm thấy yêu cầu xác thực doanh nghiệp.");
        }

        return new GetCompanyVerificationDetailResponse
        {
            Success = true,
            Data = new CompanyVerificationDetailDto
            {
                VerificationRequestId = verificationRequest.CompanyVerificationRequestId,
                UserId = verificationRequest.SubmittedBy,
                Email = verificationRequest.SubmittedByNavigation.Email,
                DisplayName = verificationRequest.SubmittedByNavigation.DisplayName,
                Phone = verificationRequest.SubmittedByNavigation.Phone,
                CompanyId = verificationRequest.CompanyId,
                CompanyName = verificationRequest.Company.CompanyName,
                TaxCode = verificationRequest.Company.TaxCode,
                Industry = verificationRequest.Company.Industry,
                CompanySize = verificationRequest.Company.CompanySize,
                Website = verificationRequest.Company.Website,
                Address = verificationRequest.Company.Address,
                Description = verificationRequest.Company.Description,
                SubmittedPayload = verificationRequest.SubmittedPayload,
                Status = verificationRequest.Status,
                SubmittedAt = verificationRequest.SubmittedAt,
                ReviewedBy = verificationRequest.ReviewedBy,
                ReviewerName = verificationRequest.ReviewedByNavigation?.DisplayName,
                ReviewedAt = verificationRequest.ReviewedAt,
                ReviewNote = verificationRequest.ReviewNote
            }
        };
    }
}
