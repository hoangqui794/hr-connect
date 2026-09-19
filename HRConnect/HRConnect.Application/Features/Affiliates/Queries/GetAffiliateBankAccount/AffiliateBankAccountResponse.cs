namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateBankAccount;

public class AffiliateBankAccountResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Lấy thông tin tài khoản ngân hàng thành công.";
    public AffiliateBankAccountData? Data { get; set; }
}

public class AffiliateBankAccountData
{
    public Guid AffiliateId { get; set; }
    public string? DisplayName { get; set; }
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountHolder { get; set; }
    public string? BankBranch { get; set; }
    public bool IsConfigured { get; set; }
    public DateTime UpdatedAt { get; set; }
}
