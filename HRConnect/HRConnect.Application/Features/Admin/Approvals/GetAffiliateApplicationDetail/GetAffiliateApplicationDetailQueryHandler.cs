using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.GetAffiliateApplicationDetail;

public class GetAffiliateApplicationDetailQueryHandler : IRequestHandler<GetAffiliateApplicationDetailQuery, GetAffiliateApplicationDetailResponse>
{
    private readonly IAffiliateApplicationRepository _affiliateApplicationRepository;

    public GetAffiliateApplicationDetailQueryHandler(IAffiliateApplicationRepository affiliateApplicationRepository)
    {
        _affiliateApplicationRepository = affiliateApplicationRepository;
    }

    public async Task<GetAffiliateApplicationDetailResponse> Handle(GetAffiliateApplicationDetailQuery request, CancellationToken cancellationToken)
    {
        var application = await _affiliateApplicationRepository.GetByIdWithDetailsAsync(request.ApplicationId, cancellationToken);
        if (application == null)
        {
            throw new NotFoundException("Không tìm thấy đơn đăng ký Affiliate.");
        }

        return new GetAffiliateApplicationDetailResponse
        {
            Success = true,
            Data = new AffiliateApplicationDetailDto
            {
                ApplicationId = application.AffiliateApplicationId,
                UserId = application.UserId,
                Email = application.User.Email,
                DisplayName = application.DisplayName ?? application.User.DisplayName,
                Phone = application.Phone ?? application.User.Phone,
                AffiliateType = application.AffiliateType,
                TaxInformation = application.TaxInformation,
                ContactPerson = application.ContactPerson,
                Address = application.Address,
                SubmittedData = application.SubmittedData,
                Status = application.Status,
                SubmittedAt = application.SubmittedAt,
                ReviewedBy = application.ReviewedBy,
                ReviewerName = application.ReviewedByNavigation?.DisplayName,
                ReviewedAt = application.ReviewedAt,
                ReviewNote = application.ReviewNote
            }
        };
    }
}
