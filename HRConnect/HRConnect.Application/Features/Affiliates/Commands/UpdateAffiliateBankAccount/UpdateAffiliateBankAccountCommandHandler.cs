using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateBankAccount;

public class UpdateAffiliateBankAccountCommandHandler : IRequestHandler<UpdateAffiliateBankAccountCommand, UpdateAffiliateBankAccountResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfileRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<UpdateAffiliateBankAccountCommandHandler> _logger;

    public UpdateAffiliateBankAccountCommandHandler(
        IAffiliateProfileRepository affiliateProfileRepository,
        IUnitOfWork unitOfWork,
        ILogger<UpdateAffiliateBankAccountCommandHandler> logger)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<UpdateAffiliateBankAccountResponse> Handle(
        UpdateAffiliateBankAccountCommand request,
        CancellationToken cancellationToken)
    {
        var profile = await _affiliateProfileRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (profile == null)
        {
            _logger.LogWarning("Không tìm thấy thông tin đối tác tuyển dụng cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin đối tác tuyển dụng tương ứng với tài khoản này.");
        }

        profile.BankName = request.BankName.Trim();
        profile.BankAccountNumber = request.BankAccountNumber.Trim();
        profile.BankAccountHolder = request.BankAccountHolder.Trim().ToUpperInvariant();
        profile.BankBranch = string.IsNullOrWhiteSpace(request.BankBranch) ? null : request.BankBranch.Trim();
        profile.UpdatedAt = DateTime.UtcNow;

        _affiliateProfileRepository.Update(profile);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Cập nhật thông tin tài khoản ngân hàng thành công cho UserId {UserId}", request.UserId);

        return new UpdateAffiliateBankAccountResponse
        {
            Success = true,
            Message = "Cập nhật thông tin tài khoản ngân hàng nhận hoa hồng thành công.",
            Data = new UpdateAffiliateBankAccountData
            {
                AffiliateId = profile.AffiliateId,
                DisplayName = profile.DisplayName,
                BankName = profile.BankName,
                BankAccountNumber = profile.BankAccountNumber,
                BankAccountHolder = profile.BankAccountHolder,
                BankBranch = profile.BankBranch,
                UpdatedAt = profile.UpdatedAt
            }
        };
    }
}
