using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Finance.Commands.Settlement;
using HRConnect.Application.Features.Jobs.Commands.RecordJobPostingFeePayment;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Payments;

/// <summary>
/// Client pays one unpaid fee on the Công nợ page through VNPay. TargetType SERVICE_FEE takes a service_fee_id
/// (HH placement fee, SS deposit or settlement); POSTING_FEE takes the job_id of a CV_APPLICATION posting fee.
/// </summary>
public sealed record CreateVnPayPaymentCommand(string TargetType, Guid TargetId, Guid UserId, string ClientIp)
    : IRequest<VnPayPaymentLinkResponse>;

public sealed record VnPayPaymentLinkResponse(Guid OnlinePaymentId, string PaymentUrl);

/// <summary>
/// Applies a VNPay callback (IPN or the browser return). Both carry the same signed query, so either may arrive first;
/// the first one marks the fee paid and the other only reads the result.
/// </summary>
public sealed record ConfirmVnPayPaymentCommand(IReadOnlyDictionary<string, string> Query) : IRequest<VnPayConfirmResult>;

/// <summary>RspCode/Message follow VNPay's IPN contract: 00 ok, 01 order not found, 02 already confirmed, 04 wrong amount, 97 bad signature.</summary>
public sealed record VnPayConfirmResult(string RspCode, string Message, OnlinePaymentResultDto? Payment);

public sealed record OnlinePaymentResultDto(
    Guid OnlinePaymentId, string TargetType, Guid TargetId, decimal Amount, string CurrencyCode, string Status,
    string? ProviderTransactionNo, string? ResponseCode, DateTime? PaidAt);

public sealed class VnPayPaymentCommandHandlers(
    IVnPayGateway gateway,
    IOnlinePaymentRepository payments,
    ICompanyUserRepository companyUsers,
    IFinanceRepository finance,
    IJobRepository jobs,
    IUnitOfWork unitOfWork,
    ISender sender,
    IAppNotifier notifier,
    ILogger<VnPayPaymentCommandHandlers>? logger = null) :
    IRequestHandler<CreateVnPayPaymentCommand, VnPayPaymentLinkResponse>,
    IRequestHandler<ConfirmVnPayPaymentCommand, VnPayConfirmResult>
{
    private static readonly TimeSpan ProcessingClaimTimeout = TimeSpan.FromMinutes(5);

    public async Task<VnPayPaymentLinkResponse> Handle(CreateVnPayPaymentCommand request, CancellationToken cancellationToken)
    {
        if (!gateway.IsEnabled)
        {
            throw new ConflictException("Thanh toán VNPay chưa được bật. Vui lòng chuyển khoản theo hướng dẫn.", "VNPAY_DISABLED");
        }

        var companyUser = await companyUsers.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
        var (amount, currency, orderInfo) = await ResolvePayableAsync(request.TargetType, request.TargetId, companyUser.CompanyId, cancellationToken);

        if (currency != "VND" || amount != decimal.Truncate(amount))
        {
            throw new ConflictException("VNPay chỉ nhận khoản thanh toán bằng VND, số tiền tròn đồng.", "VNPAY_UNSUPPORTED_AMOUNT");
        }

        var now = DateTime.UtcNow;
        var active = await payments.GetActiveByTargetAsync(request.TargetType, request.TargetId, cancellationToken);
        if (active is { Status: OnlinePaymentStates.Processing })
        {
            throw new ConflictException(
                "Khoản thanh toán đang được VNPay xác nhận. Vui lòng chờ trong ít phút.",
                "VNPAY_PROCESSING");
        }

        if (active is { Status: OnlinePaymentStates.Pending })
        {
            var expiresAt = active.CreatedAt.Add(gateway.PaymentLifetime);
            if (expiresAt > now)
            {
                if (active.Amount != amount || active.CurrencyCode != currency)
                {
                    throw new ConflictException(
                        "Giá trị khoản phí đã thay đổi trong khi phiên thanh toán cũ còn hiệu lực. Vui lòng thử lại sau khi phiên cũ hết hạn.",
                        "VNPAY_AMOUNT_CHANGED");
                }

                return new VnPayPaymentLinkResponse(
                    active.OnlinePaymentId,
                    CreatePaymentUrl(active, orderInfo, request.ClientIp));
            }

            active.Status = OnlinePaymentStates.Failed;
            active.LastError = "Phiên thanh toán đã hết hạn trước khi VNPay xác nhận.";
            active.UpdatedAt = now;
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        var payment = new OnlinePayment
        {
            OnlinePaymentId = Guid.NewGuid(),
            Provider = OnlinePaymentProviders.VnPay,
            TargetType = request.TargetType,
            TargetId = request.TargetId,
            CompanyId = companyUser.CompanyId,
            Amount = amount,
            CurrencyCode = currency,
            Status = OnlinePaymentStates.Pending,
            CreatedBy = request.UserId,
            CreatedAt = now,
            UpdatedAt = now,
        };
        payment.TxnRef = payment.OnlinePaymentId.ToString("N");
        if (!await payments.TryAddPendingAsync(payment, cancellationToken))
        {
            var winner = await payments.GetActiveByTargetAsync(request.TargetType, request.TargetId, cancellationToken);
            if (winner is { Status: OnlinePaymentStates.Pending }
                && winner.Amount == amount && winner.CurrencyCode == currency
                && winner.CreatedAt.Add(gateway.PaymentLifetime) > now)
            {
                return new VnPayPaymentLinkResponse(
                    winner.OnlinePaymentId,
                    CreatePaymentUrl(winner, orderInfo, request.ClientIp));
            }

            throw new ConflictException(
                "Một phiên thanh toán khác đang được xử lý cho khoản phí này.",
                "VNPAY_PAYMENT_EXISTS");
        }

        return new VnPayPaymentLinkResponse(
            payment.OnlinePaymentId,
            CreatePaymentUrl(payment, orderInfo, request.ClientIp));
    }

    public async Task<VnPayConfirmResult> Handle(ConfirmVnPayPaymentCommand request, CancellationToken cancellationToken)
    {
        var callback = gateway.ReadCallback(request.Query);
        if (!callback.SignatureValid)
        {
            return new VnPayConfirmResult("97", "Invalid signature", null);
        }

        var payment = callback.TxnRef is null ? null : await payments.GetByTxnRefAsync(callback.TxnRef, cancellationToken);
        if (payment is null)
        {
            return new VnPayConfirmResult("01", "Order not found", null);
        }

        if (callback.Amount != (long)payment.Amount)
        {
            return new VnPayConfirmResult("04", "Invalid amount", ToDto(payment));
        }

        var now = DateTime.UtcNow;
        if (!await payments.TryClaimAsync(
                payment.OnlinePaymentId, now, now.Subtract(ProcessingClaimTimeout), cancellationToken))
        {
            var latest = callback.TxnRef is null
                ? null
                : await payments.GetByTxnRefAsync(callback.TxnRef, cancellationToken);
            return new VnPayConfirmResult("02", "Order already confirmed", ToDto(latest ?? payment));
        }

        payment.Status = OnlinePaymentStates.Processing;
        payment.ResponseCode = callback.ResponseCode;
        payment.ProviderTransactionNo = callback.TransactionNo;
        payment.BankCode = callback.BankCode;
        payment.UpdatedAt = now;

        if (!callback.IsSuccess)
        {
            payment.Status = OnlinePaymentStates.Failed;
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return new VnPayConfirmResult("00", "Confirm Success", ToDto(payment));
        }

        // Never later than now: the fee commands reject a payment date in the future.
        var paidAt = callback.PaidAtUtc is { } at && at <= now ? at : now;
        var reference = $"VNPAY-{callback.TransactionNo ?? payment.TxnRef}";
        payment.PaidAt = paidAt;
        var noticeContext = await ResolveNoticeContextAsync(payment, cancellationToken);
        try
        {
            try
            {
                // A previous attempt may have committed the fee before failing to save the online-payment state.
                if (!await WasAppliedWithReferenceAsync(payment, reference, cancellationToken))
                {
                    // The same commands Platform Admin uses, so the job opens, slots open and everyone is notified the same way.
                    if (payment.TargetType == OnlinePaymentTargets.ServiceFee)
                    {
                        await sender.Send(new RecordServiceFeePaymentCommand(payment.TargetId, paidAt, reference, payment.CreatedBy), cancellationToken);
                    }
                    else
                    {
                        await sender.Send(new RecordJobPostingFeePaymentCommand
                        {
                            JobId = payment.TargetId,
                            PaymentReference = reference,
                            PaidAt = paidAt,
                            UserId = payment.CreatedBy,
                        }, cancellationToken);
                    }
                }

                payment.Status = OnlinePaymentStates.Succeeded;
            }
            catch (Exception ex) when (ex is ConflictException or BadRequestException or NotFoundException)
            {
                // A retry after a late persistence failure is successful when the exact VNPay reference already paid the fee.
                if (await WasAppliedWithReferenceAsync(payment, reference, cancellationToken))
                {
                    payment.Status = OnlinePaymentStates.Succeeded;
                }
                else
                {
                    // The money arrived but the fee could not take it (for example Admin recorded a transfer meanwhile).
                    payment.Status = OnlinePaymentStates.NeedsReview;
                    payment.LastError = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
                }
            }

            try
            {
                await NotifyPlatformAdminsAsync(payment, noticeContext, reference, cancellationToken);
            }
            catch (Exception ex)
            {
                logger?.LogWarning(ex, "Không thể gửi thông báo thanh toán VNPay {OnlinePaymentId} tới Admin.", payment.OnlinePaymentId);
            }
            payment.UpdatedAt = DateTime.UtcNow;
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return new VnPayConfirmResult("00", "Confirm Success", ToDto(payment));
        }
        catch
        {
            // Unexpected failure (database, network): leave it PENDING so VNPay's IPN retry can apply it later.
            await payments.ReleaseClaimAsync(payment.OnlinePaymentId, CancellationToken.None);
            throw;
        }
    }

    private async Task<(decimal Amount, string Currency, string OrderInfo)> ResolvePayableAsync(
        string targetType, Guid targetId, Guid companyId, CancellationToken cancellationToken)
    {
        if (targetType == OnlinePaymentTargets.ServiceFee)
        {
            var fee = await finance.GetServiceFeeForUpdateAsync(targetId, cancellationToken);
            if (fee is null || fee.CompanyId != companyId)
            {
                throw new NotFoundException("Không tìm thấy khoản phí của doanh nghiệp.");
            }
            if (ServiceFeeKinds.OwedToClient.Contains(fee.Kind) || fee.Status is not (ServiceFeeStates.Pending or ServiceFeeStates.Due or ServiceFeeStates.Overdue))
            {
                throw new ConflictException("Khoản phí này không ở trạng thái cần thanh toán.", "FEE_NOT_PAYABLE");
            }
            if (fee.Placement?.Reconciliation is { Status: not PlacementReconciliationStates.Confirmed })
            {
                throw new ConflictException("Phí đang chờ HR Connect đối soát, chưa thanh toán được.", "FEE_NOT_PAYABLE");
            }
            return (fee.Amount, fee.CurrencyCode, "Thanh toan phi dich vu");
        }

        if (targetType == OnlinePaymentTargets.PostingFee)
        {
            var job = await jobs.GetByIdAsync(targetId, cancellationToken);
            if (job is null || job.CompanyId != companyId)
            {
                throw new NotFoundException("Không tìm thấy tin tuyển dụng của doanh nghiệp.");
            }
            var postingFee = await jobs.GetPostingFeeByJobIdAsync(targetId, cancellationToken);
            if (postingFee is null || postingFee.Status != JobPostingFeeStatuses.Pending || postingFee.Amount <= 0)
            {
                throw new ConflictException("Phí đăng tin này không ở trạng thái cần thanh toán.", "FEE_NOT_PAYABLE");
            }
            return (postingFee.Amount, postingFee.CurrencyCode, "Thanh toan phi dang tin");
        }

        throw new BadRequestException("Loại khoản thanh toán không hợp lệ.");
    }

    private string CreatePaymentUrl(OnlinePayment payment, string orderInfo, string clientIp)
    {
        var shortReference = payment.TxnRef[..Math.Min(8, payment.TxnRef.Length)].ToUpperInvariant();
        return gateway.CreatePaymentUrl(new VnPayPaymentRequest(
            payment.TxnRef,
            (long)payment.Amount,
            $"{orderInfo} {shortReference}",
            clientIp,
            payment.CreatedAt));
    }

    private async Task<bool> WasAppliedWithReferenceAsync(
        OnlinePayment payment, string reference, CancellationToken cancellationToken)
    {
        if (payment.TargetType == OnlinePaymentTargets.ServiceFee)
        {
            var fee = await finance.GetServiceFeeForUpdateAsync(payment.TargetId, cancellationToken);
            return fee?.Status == ServiceFeeStates.Paid
                && string.Equals(fee.PaymentReference, reference, StringComparison.Ordinal);
        }

        var postingFee = await jobs.GetPostingFeeByJobIdAsync(payment.TargetId, cancellationToken);
        return postingFee?.Status == JobPostingFeeStatuses.Paid
            && string.Equals(postingFee.PaymentReference, reference, StringComparison.Ordinal);
    }

    private async Task<PaymentNoticeContext> ResolveNoticeContextAsync(
        OnlinePayment payment, CancellationToken cancellationToken)
    {
        Guid? jobId = payment.TargetType == OnlinePaymentTargets.PostingFee ? payment.TargetId : null;
        if (payment.TargetType == OnlinePaymentTargets.ServiceFee)
        {
            var fee = await finance.GetServiceFeeForUpdateAsync(payment.TargetId, cancellationToken);
            jobId = fee?.JobId;
            if (jobId is null && fee?.PlacementId is Guid placementId)
            {
                jobId = (await finance.GetPlacementForFinanceAsync(placementId, cancellationToken))?.Application.JobId;
            }
        }

        var job = jobId is Guid id ? await jobs.GetByIdAsync(id, cancellationToken) : null;
        return new PaymentNoticeContext(
            job?.Company?.CompanyName ?? $"Doanh nghiệp {payment.CompanyId}",
            job?.Title ?? "khoản phí dịch vụ",
            job?.JobId);
    }

    private Task NotifyPlatformAdminsAsync(
        OnlinePayment payment, PaymentNoticeContext context, string reference,
        CancellationToken cancellationToken)
    {
        var succeeded = payment.Status == OnlinePaymentStates.Succeeded;
        var title = succeeded
            ? "Client đã thanh toán qua VNPay"
            : "Giao dịch VNPay cần kiểm tra";
        var message = succeeded
            ? $"{context.CompanyName} đã thanh toán {payment.Amount:N0} {payment.CurrencyCode} cho tin \"{context.JobTitle}\". Mã giao dịch: {reference}."
            : $"VNPay đã báo nhận {payment.Amount:N0} {payment.CurrencyCode} từ {context.CompanyName} cho tin \"{context.JobTitle}\", nhưng công nợ chưa thể tự cập nhật. Mã giao dịch: {reference}.";

        return notifier.NotifyRoleAsync("PLATFORM_ADMIN", new AppNotice(
            payment.TargetType == OnlinePaymentTargets.PostingFee ? "JOB" : "SERVICE_FEE",
            title,
            message,
            "ONLINE_PAYMENT",
            payment.OnlinePaymentId,
            "/admin/payouts"), cancellationToken);
    }

    private sealed record PaymentNoticeContext(string CompanyName, string JobTitle, Guid? JobId);

    private static OnlinePaymentResultDto ToDto(OnlinePayment p) =>
        new(p.OnlinePaymentId, p.TargetType, p.TargetId, p.Amount, p.CurrencyCode, p.Status, p.ProviderTransactionNo, p.ResponseCode, p.PaidAt);
}
