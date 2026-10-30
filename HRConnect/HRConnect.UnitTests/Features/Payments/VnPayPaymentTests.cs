using System.Net;
using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Finance.Commands.Settlement;
using HRConnect.Application.Features.Payments;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Services.Payments;
using MediatR;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Payments;

public sealed class VnPayPaymentTests
{
    private const string Secret = "TESTSECRETKEY123";

    private static VnPayGateway Gateway(bool configured = true) => new(Options.Create(new VnPaySettings
    {
        TmnCode = configured ? "TESTTMN1" : null,
        HashSecret = Secret,
        ReturnUrl = "http://localhost:5173/client/billing/vnpay-return",
    }));

    /// <summary>A callback query signed the way VNPay signs it.</summary>
    private static Dictionary<string, string> SignedCallback(string txnRef, long amountVnd, string responseCode = "00")
    {
        var fields = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["vnp_Amount"] = (amountVnd * 100).ToString(),
            ["vnp_BankCode"] = "NCB",
            ["vnp_PayDate"] = "20261030180000",
            ["vnp_ResponseCode"] = responseCode,
            ["vnp_TmnCode"] = "TESTTMN1",
            ["vnp_TransactionNo"] = "14123456",
            ["vnp_TransactionStatus"] = responseCode,
            ["vnp_TxnRef"] = txnRef,
        };
        var data = string.Join('&', fields.Select(f => $"{WebUtility.UrlEncode(f.Key)}={WebUtility.UrlEncode(f.Value)}"));
        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(Secret));
        var query = new Dictionary<string, string>(fields)
        {
            ["vnp_SecureHash"] = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(data))),
        };
        return query;
    }

    [Fact]
    public void Payment_url_carries_the_amount_times_100_and_a_signature_VNPay_can_check()
    {
        var url = Gateway().CreatePaymentUrl(new VnPayPaymentRequest("abc123", 1_500_000, "Thanh toan phi", "127.0.0.1", DateTime.UtcNow));

        url.Should().StartWith("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?");
        url.Should().Contain("vnp_Amount=150000000").And.Contain("vnp_TxnRef=abc123").And.Contain("vnp_SecureHash=");
        var query = url[(url.IndexOf('?') + 1)..].Split('&')
            .Select(p => p.Split('=', 2))
            .ToDictionary(p => p[0], p => WebUtility.UrlDecode(p[1]));
        Gateway().ReadCallback(query).SignatureValid.Should().BeTrue();
    }

    [Fact]
    public void Callback_with_a_changed_amount_fails_the_signature()
    {
        var query = SignedCallback("abc123", 1_500_000);
        query["vnp_Amount"] = "100";

        Gateway().ReadCallback(query).SignatureValid.Should().BeFalse();
    }

    [Fact]
    public void Callback_reads_amount_in_VND_and_pay_date_in_UTC()
    {
        var callback = Gateway().ReadCallback(SignedCallback("abc123", 1_500_000));

        callback.SignatureValid.Should().BeTrue();
        callback.IsSuccess.Should().BeTrue();
        callback.Amount.Should().Be(1_500_000);
        callback.PaidAtUtc.Should().Be(new DateTime(2026, 10, 30, 11, 0, 0, DateTimeKind.Utc));
    }

    private sealed class Harness
    {
        public readonly Mock<IOnlinePaymentRepository> Payments = new();
        public readonly Mock<ICompanyUserRepository> CompanyUsers = new();
        public readonly Mock<IFinanceRepository> Finance = new();
        public readonly Mock<IJobRepository> Jobs = new();
        public readonly Mock<IUnitOfWork> Uow = new();
        public readonly Mock<ISender> Sender = new();
        public bool Claimed;

        public Harness(OnlinePayment? existing = null)
        {
            Payments.Setup(p => p.GetByTxnRefAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((string txn, CancellationToken _) => existing?.TxnRef == txn ? existing : null);
            // Only the first callback claims the payment.
            Payments.Setup(p => p.TryClaimAsync(It.IsAny<Guid>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(() => !Claimed && (Claimed = true));
        }

        public VnPayPaymentCommandHandlers Handlers(bool configured = true) => new(
            Gateway(configured), Payments.Object, CompanyUsers.Object, Finance.Object, Jobs.Object, Uow.Object, Sender.Object);
    }

    private static OnlinePayment Pending(decimal amount = 42_000_000) => new()
    {
        OnlinePaymentId = Guid.NewGuid(),
        Provider = OnlinePaymentProviders.VnPay,
        TargetType = OnlinePaymentTargets.ServiceFee,
        TargetId = Guid.NewGuid(),
        CompanyId = Guid.NewGuid(),
        Amount = amount,
        TxnRef = "txn001",
        Status = OnlinePaymentStates.Pending,
        CreatedBy = Guid.NewGuid(),
    };

    [Fact]
    public async Task Successful_callback_records_the_fee_as_paid_once()
    {
        var payment = Pending();
        var h = new Harness(payment);

        var first = await h.Handlers().Handle(new ConfirmVnPayPaymentCommand(SignedCallback("txn001", 42_000_000)), default);
        var second = await h.Handlers().Handle(new ConfirmVnPayPaymentCommand(SignedCallback("txn001", 42_000_000)), default);

        first.RspCode.Should().Be("00");
        payment.Status.Should().Be(OnlinePaymentStates.Succeeded);
        second.RspCode.Should().Be("02");
        h.Sender.Verify(s => s.Send(
            It.Is<RecordServiceFeePaymentCommand>(c => c.ServiceFeeId == payment.TargetId && c.PaymentReference == "VNPAY-14123456" && c.CurrentUserId == payment.CreatedBy),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Callback_with_a_different_amount_is_refused_and_records_nothing()
    {
        var h = new Harness(Pending(42_000_000));

        var result = await h.Handlers().Handle(new ConfirmVnPayPaymentCommand(SignedCallback("txn001", 1_000)), default);

        result.RspCode.Should().Be("04");
        h.Sender.Invocations.Should().BeEmpty();
    }

    [Fact]
    public async Task Cancelled_payment_is_marked_failed_and_the_fee_stays_unpaid()
    {
        var payment = Pending();
        var h = new Harness(payment);

        var result = await h.Handlers().Handle(new ConfirmVnPayPaymentCommand(SignedCallback("txn001", 42_000_000, "24")), default);

        result.RspCode.Should().Be("00");
        payment.Status.Should().Be(OnlinePaymentStates.Failed);
        h.Sender.Invocations.Should().BeEmpty();
    }

    [Fact]
    public async Task Paid_by_VNPay_after_Admin_recorded_a_transfer_is_kept_for_review()
    {
        var payment = Pending();
        var h = new Harness(payment);
        h.Sender.Setup(s => s.Send(It.IsAny<RecordServiceFeePaymentCommand>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ConflictException("Chỉ ghi nhận thanh toán cho công nợ PENDING, DUE hoặc OVERDUE."));

        await h.Handlers().Handle(new ConfirmVnPayPaymentCommand(SignedCallback("txn001", 42_000_000)), default);

        payment.Status.Should().Be(OnlinePaymentStates.NeedsReview);
        payment.LastError.Should().Contain("PENDING");
    }

    [Fact]
    public async Task Unexpected_failure_puts_the_payment_back_so_the_IPN_retry_can_apply_it()
    {
        var payment = Pending();
        var h = new Harness(payment);
        h.Sender.Setup(s => s.Send(It.IsAny<RecordServiceFeePaymentCommand>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("database down"));

        var act = () => h.Handlers().Handle(new ConfirmVnPayPaymentCommand(SignedCallback("txn001", 42_000_000)), default);

        await act.Should().ThrowAsync<InvalidOperationException>();
        h.Payments.Verify(p => p.ReleaseClaimAsync(payment.OnlinePaymentId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Unknown_order_and_bad_signature_get_VNPay_error_codes()
    {
        var h = new Harness();
        var forged = SignedCallback("txn001", 42_000_000);
        forged["vnp_SecureHash"] = "00";

        (await h.Handlers().Handle(new ConfirmVnPayPaymentCommand(SignedCallback("nope", 1)), default)).RspCode.Should().Be("01");
        (await h.Handlers().Handle(new ConfirmVnPayPaymentCommand(forged), default)).RspCode.Should().Be("97");
    }

    [Fact]
    public async Task Client_cannot_pay_another_company_fee()
    {
        var h = new Harness();
        var userId = Guid.NewGuid();
        h.CompanyUsers.Setup(c => c.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = Guid.NewGuid() });
        h.Finance.Setup(f => f.GetServiceFeeForUpdateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ServiceFee { ServiceFeeId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), Amount = 1_000, CurrencyCode = "VND", Status = ServiceFeeStates.Pending });

        var act = () => h.Handlers().Handle(new CreateVnPayPaymentCommand(OnlinePaymentTargets.ServiceFee, Guid.NewGuid(), userId, "127.0.0.1"), default);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Pay_button_is_refused_while_VNPay_is_not_configured()
    {
        var act = () => new Harness().Handlers(configured: false)
            .Handle(new CreateVnPayPaymentCommand(OnlinePaymentTargets.ServiceFee, Guid.NewGuid(), Guid.NewGuid(), "127.0.0.1"), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("VNPAY_DISABLED");
    }

    [Fact]
    public async Task Pending_fee_of_own_company_gets_a_payment_link()
    {
        var h = new Harness();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var feeId = Guid.NewGuid();
        h.CompanyUsers.Setup(c => c.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId });
        h.Finance.Setup(f => f.GetServiceFeeForUpdateAsync(feeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ServiceFee { ServiceFeeId = feeId, CompanyId = companyId, Amount = 42_000_000, CurrencyCode = "VND", Status = ServiceFeeStates.Due });

        var link = await h.Handlers().Handle(new CreateVnPayPaymentCommand(OnlinePaymentTargets.ServiceFee, feeId, userId, "127.0.0.1"), default);

        link.PaymentUrl.Should().Contain("vnp_Amount=4200000000");
        h.Payments.Verify(p => p.AddAsync(It.Is<OnlinePayment>(o => o.TargetId == feeId && o.Amount == 42_000_000 && o.Status == OnlinePaymentStates.Pending), It.IsAny<CancellationToken>()), Times.Once);
    }
}
