using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateBankAccount;

public class GetAffiliateBankAccountQueryHandler : IRequestHandler<GetAffiliateBankAccountQuery, AffiliateBankAccountResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfileRepository;
    private readonly ILogger<GetAffiliateBankAccountQueryHandler> _logger;

    public GetAffiliateBankAccountQueryHandler(
        IAffiliateProfileRepository affiliateProfileRepository,
        ILogger<GetAffiliateBankAccountQueryHandler> logger)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
        _logger = logger;
    }

    public async Task<AffiliateBankAccountResponse> Handle(GetAffiliateBankAccountQuery request, CancellationToken cancellationToken)
    {
        var profile = await _affiliateProfileRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (profile == null)
        {
            _logger.LogWarning("Không tìm thấy thông tin đối tác tuyển dụng cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin đối tác tuyển dụng tương ứng với tài khoản này.");
        }

        var isConfigured = !string.IsNullOrWhiteSpace(profile.BankName) 
                        && !string.IsNullOrWhiteSpace(profile.BankAccountNumber) 
                        && !string.IsNullOrWhiteSpace(profile.BankAccountHolder);

        return new AffiliateBankAccountResponse
        {
            Success = true,
            Message = "Lấy thông tin tài khoản ngân hàng thành công.",
            Data = new AffiliateBankAccountData
            {
                AffiliateId = profile.AffiliateId,
                DisplayName = profile.DisplayName,
                BankName = profile.BankName,
                BankAccountNumber = profile.BankAccountNumber,
                BankAccountHolder = profile.BankAccountHolder,
                BankBranch = profile.BankBranch,
                IsConfigured = isConfigured,
                UpdatedAt = profile.UpdatedAt
            }
        };
    }
}
