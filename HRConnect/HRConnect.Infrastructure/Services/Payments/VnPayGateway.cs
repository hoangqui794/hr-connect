using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using HRConnect.Application.Common.Interfaces;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Payments;

/// <summary>
/// VNPay merchant settings. Sandbox credentials come from https://sandbox.vnpayment.vn/devreg/ and are set as
/// VNPAY_TMN_CODE / VNPAY_HASH_SECRET; without them online payment is switched off.
/// </summary>
public sealed class VnPaySettings
{
    public const string SectionName = "VnPay";

    public string? TmnCode { get; set; }
    public string? HashSecret { get; set; }
    public string PaymentUrl { get; set; } = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    /// <summary>Frontend page VNPay sends the browser back to, e.g. https://&lt;fe&gt;/client/billing/vnpay-return.</summary>
    public string? ReturnUrl { get; set; }
    public int ExpireMinutes { get; set; } = 15;
}

/// <summary>VNPay 2.1.0: parameters sorted by name, URL-encoded, signed with HMAC-SHA512.</summary>
public sealed class VnPayGateway(IOptions<VnPaySettings> options) : IVnPayGateway
{
    private const string Version = "2.1.0";
    // VNPay reads and writes its dates in Vietnam time (GMT+7).
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    private readonly VnPaySettings _settings = options.Value;

    public bool IsEnabled =>
        !string.IsNullOrWhiteSpace(_settings.TmnCode)
        && !string.IsNullOrWhiteSpace(_settings.HashSecret)
        && !string.IsNullOrWhiteSpace(_settings.ReturnUrl);

    public string CreatePaymentUrl(VnPayPaymentRequest request)
    {
        if (!IsEnabled)
        {
            throw new InvalidOperationException("VNPay chưa được cấu hình.");
        }

        var created = request.CreatedAtUtc + VietnamOffset;
        var parameters = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["vnp_Version"] = Version,
            ["vnp_Command"] = "pay",
            ["vnp_TmnCode"] = _settings.TmnCode!,
            ["vnp_Amount"] = (request.Amount * 100).ToString(CultureInfo.InvariantCulture),
            ["vnp_CurrCode"] = "VND",
            ["vnp_TxnRef"] = request.TxnRef,
            ["vnp_OrderInfo"] = request.OrderInfo,
            ["vnp_OrderType"] = "other",
            ["vnp_Locale"] = "vn",
            ["vnp_ReturnUrl"] = _settings.ReturnUrl!,
            ["vnp_IpAddr"] = request.ClientIp,
            ["vnp_CreateDate"] = created.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture),
            ["vnp_ExpireDate"] = created.AddMinutes(_settings.ExpireMinutes).ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture),
        };

        var query = BuildQuery(parameters);
        return $"{_settings.PaymentUrl}?{query}&vnp_SecureHash={Sign(query)}";
    }

    public VnPayCallback ReadCallback(IReadOnlyDictionary<string, string> query)
    {
        var parameters = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var (key, value) in query)
        {
            if (key.StartsWith("vnp_", StringComparison.Ordinal)
                && key is not "vnp_SecureHash" and not "vnp_SecureHashType"
                && !string.IsNullOrEmpty(value))
            {
                parameters[key] = value;
            }
        }

        query.TryGetValue("vnp_SecureHash", out var receivedHash);
        var valid = IsEnabled
            && !string.IsNullOrEmpty(receivedHash)
            && CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(Sign(BuildQuery(parameters))),
                Encoding.ASCII.GetBytes(receivedHash.ToLowerInvariant()));

        string? Get(string key) => parameters.TryGetValue(key, out var v) ? v : null;
        long? amount = long.TryParse(Get("vnp_Amount"), NumberStyles.None, CultureInfo.InvariantCulture, out var raw) ? raw / 100 : null;
        DateTime? paidAt = DateTime.TryParseExact(Get("vnp_PayDate"), "yyyyMMddHHmmss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var local)
            ? DateTime.SpecifyKind(local - VietnamOffset, DateTimeKind.Utc)
            : null;

        return new VnPayCallback(
            valid, Get("vnp_TxnRef"), amount, Get("vnp_ResponseCode"), Get("vnp_TransactionStatus"),
            Get("vnp_TransactionNo"), Get("vnp_BankCode"), paidAt);
    }

    private static string BuildQuery(SortedDictionary<string, string> parameters) =>
        string.Join('&', parameters.Select(p => $"{WebUtility.UrlEncode(p.Key)}={WebUtility.UrlEncode(p.Value)}"));

    private string Sign(string data)
    {
        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(_settings.HashSecret!));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(data))).ToLowerInvariant();
    }
}
