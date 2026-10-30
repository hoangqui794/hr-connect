namespace HRConnect.Application.Common.Interfaces;

/// <summary>Amount is in VND (whole đồng); the gateway multiplies by 100 itself.</summary>
public sealed record VnPayPaymentRequest(string TxnRef, long Amount, string OrderInfo, string ClientIp, DateTime CreatedAtUtc);

/// <summary>What VNPay sent back on the IPN or the return URL. Amount is in VND, already divided by 100.</summary>
public sealed record VnPayCallback(
    bool SignatureValid,
    string? TxnRef,
    long? Amount,
    string? ResponseCode,
    string? TransactionStatus,
    string? TransactionNo,
    string? BankCode,
    DateTime? PaidAtUtc)
{
    public bool IsSuccess => ResponseCode == "00" && TransactionStatus == "00";
}

/// <summary>VNPay payment gateway (sandbox or production, from configuration).</summary>
public interface IVnPayGateway
{
    /// <summary>False when the merchant code or the hash secret is not configured; the Client then sees no VNPay button.</summary>
    bool IsEnabled { get; }

    string CreatePaymentUrl(VnPayPaymentRequest request);

    VnPayCallback ReadCallback(IReadOnlyDictionary<string, string> query);
}
