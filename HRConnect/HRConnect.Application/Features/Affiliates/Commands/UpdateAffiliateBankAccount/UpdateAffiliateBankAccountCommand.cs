using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateBankAccount;

public class UpdateAffiliateBankAccountCommand : IRequest<UpdateAffiliateBankAccountResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

    public string BankName { get; set; } = string.Empty;

    public string BankAccountNumber { get; set; } = string.Empty;

    public string BankAccountHolder { get; set; } = string.Empty;

    public string? BankBranch { get; set; }
}

public class UpdateAffiliateBankAccountResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Cập nhật thông tin tài khoản ngân hàng nhận hoa hồng thành công.";
    public UpdateAffiliateBankAccountData? Data { get; set; }
}

public class UpdateAffiliateBankAccountData
{
    public Guid AffiliateId { get; set; }
    public string? DisplayName { get; set; }
    public string BankName { get; set; } = string.Empty;
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankAccountHolder { get; set; } = string.Empty;
    public string? BankBranch { get; set; }
    public DateTime UpdatedAt { get; set; }
}
