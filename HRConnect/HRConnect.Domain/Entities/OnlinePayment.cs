namespace HRConnect.Domain.Entities;

/// <summary>
/// One attempt by a Client to pay a fee through an online gateway (VNPay). When the gateway confirms the payment,
/// the fee is recorded as paid the same way Platform Admin records a bank transfer, with the gateway's transaction number
/// as the payment reference.
/// </summary>
public sealed class OnlinePayment
{
    public Guid OnlinePaymentId { get; set; }
    public string Provider { get; set; } = null!;
    /// <summary>SERVICE_FEE (target = service_fee_id) or POSTING_FEE (target = job_id).</summary>
    public string TargetType { get; set; } = null!;
    public Guid TargetId { get; set; }
    public Guid CompanyId { get; set; }
    public decimal Amount { get; set; }
    public string CurrencyCode { get; set; } = "VND";
    /// <summary>Our order id sent to the gateway (vnp_TxnRef).</summary>
    public string TxnRef { get; set; } = null!;
    public string Status { get; set; } = OnlinePaymentStates.Pending;
    public string? ProviderTransactionNo { get; set; }
    public string? BankCode { get; set; }
    public string? ResponseCode { get; set; }
    public string? LastError { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public static class OnlinePaymentStates
{
    public const string Pending = "PENDING";
    /// <summary>A gateway callback is being applied; stops the IPN and the return page from applying it twice.</summary>
    public const string Processing = "PROCESSING";
    public const string Succeeded = "SUCCEEDED";
    public const string Failed = "FAILED";
    /// <summary>The gateway took the money but the fee could not be marked paid (for example Admin had already recorded it).</summary>
    public const string NeedsReview = "NEEDS_REVIEW";
}

public static class OnlinePaymentTargets
{
    public const string ServiceFee = "SERVICE_FEE";
    public const string PostingFee = "POSTING_FEE";
}

public static class OnlinePaymentProviders
{
    public const string VnPay = "VNPAY";
}
