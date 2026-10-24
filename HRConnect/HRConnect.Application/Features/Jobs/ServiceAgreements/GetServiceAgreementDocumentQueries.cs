using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Constants;
using MediatR;

namespace HRConnect.Application.Features.Jobs.ServiceAgreements;

public sealed class AgreementDownloadUrlResponse
{
    public string DownloadUrl { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public string FileName { get; set; } = null!;
    public bool IsSigned { get; set; }
}

public sealed record GetServiceAgreementDownloadUrlQuery(Guid JobId, Guid AgreementId, bool? Signed = null) : IRequest<AgreementDownloadUrlResponse>;

public sealed class GetServiceAgreementDownloadUrlQueryHandler : IRequestHandler<GetServiceAgreementDownloadUrlQuery, AgreementDownloadUrlResponse>
{
    private readonly IServiceAgreementRepository _agreements;
    private readonly IJobRepository _jobs;
    private readonly IFileStorageService _storage;
    private readonly IAgreementPdfRenderer _pdfRenderer;
    private readonly IUnitOfWork _uow;

    public GetServiceAgreementDownloadUrlQueryHandler(
        IServiceAgreementRepository agreements,
        IJobRepository jobs,
        IFileStorageService storage,
        IAgreementPdfRenderer pdfRenderer,
        IUnitOfWork uow)
    {
        _agreements = agreements;
        _jobs = jobs;
        _storage = storage;
        _pdfRenderer = pdfRenderer;
        _uow = uow;
    }

    public async Task<AgreementDownloadUrlResponse> Handle(GetServiceAgreementDownloadUrlQuery request, CancellationToken ct)
    {
        var agreement = await _agreements.GetByIdForUpdateAsync(request.AgreementId, ct);
        if (agreement == null || agreement.JobId != request.JobId)
        {
            throw new NotFoundException("Không tìm thấy thỏa thuận dịch vụ yêu cầu.");
        }

        var isSigned = request.Signed ?? (agreement.Status == ServiceAgreementStatuses.Signed || !string.IsNullOrWhiteSpace(agreement.SignedDocumentStorageKey));
        var storageKey = (isSigned && !string.IsNullOrWhiteSpace(agreement.SignedDocumentStorageKey))
            ? agreement.SignedDocumentStorageKey
            : agreement.UnsignedDocumentStorageKey;

        // If storage key is missing, render on the fly and persist
        if (string.IsNullOrWhiteSpace(storageKey))
        {
            var job = await _jobs.GetByIdAsync(agreement.JobId, ct)
                      ?? throw new NotFoundException("Không tìm thấy tin tuyển dụng.");
            var pdfBytes = _pdfRenderer.RenderAgreementPdf(agreement, job, agreement.Company, isSigned);
            var fileType = isSigned ? "signed" : "unsigned";
            storageKey = $"companies/{agreement.CompanyId}/service-agreements/{agreement.ServiceAgreementId}/v{agreement.Version}/{fileType}.pdf";

            using var stream = new MemoryStream(pdfBytes);
            await _storage.UploadAsync(stream, storageKey, "application/pdf", ct);

            if (isSigned)
                agreement.SignedDocumentStorageKey = storageKey;
            else
                agreement.UnsignedDocumentStorageKey = storageKey;

            await _uow.SaveChangesAsync(ct);
        }

        var expiry = TimeSpan.FromMinutes(15);
        var presignedUrl = await _storage.GetPresignedDownloadUrlAsync(storageKey, expiry, ct);
        var ext = Path.GetExtension(storageKey);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".pdf";

        var isClientUpload = isSigned && !string.IsNullOrWhiteSpace(agreement.SignedDocumentStorageKey);
        var fileName = isClientUpload
            ? $"Hop_Dong_Da_Ky_{agreement.JobId.ToString()[..8]}_v{agreement.Version}{ext}"
            : $"Thoa_Thuan_Dich_Vu_{agreement.JobId.ToString()[..8]}_v{agreement.Version}{(isSigned ? "_Signed" : "")}.pdf";

        return new AgreementDownloadUrlResponse
        {
            DownloadUrl = presignedUrl,
            ExpiresAt = DateTime.UtcNow.Add(expiry),
            FileName = fileName,
            IsSigned = isSigned
        };
    }
}

public sealed record VerifyServiceAgreementPublicQuery(string VerificationCode) : IRequest<PublicServiceAgreementVerificationDto>;

public sealed class VerifyServiceAgreementPublicQueryHandler : IRequestHandler<VerifyServiceAgreementPublicQuery, PublicServiceAgreementVerificationDto>
{
    private readonly IServiceAgreementRepository _agreements;

    public VerifyServiceAgreementPublicQueryHandler(IServiceAgreementRepository agreements)
    {
        _agreements = agreements;
    }

    public async Task<PublicServiceAgreementVerificationDto> Handle(VerifyServiceAgreementPublicQuery request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.VerificationCode))
        {
            throw new BadRequestException("Vui lòng cung cấp mã tra cứu thỏa thuận dịch vụ.");
        }

        var agreement = await _agreements.GetByVerificationCodeAsync(request.VerificationCode.Trim().ToUpperInvariant(), ct);
        if (agreement == null)
        {
            return new PublicServiceAgreementVerificationDto
            {
                VerificationCode = request.VerificationCode,
                JobTitle = "Không tìm thấy",
                CompanyName = "Không tìm thấy",
                ServiceTypeCode = "UNKNOWN",
                Version = 0,
                Status = "NOT_FOUND",
                IsValid = false
            };
        }

        var isValid = agreement.Status == ServiceAgreementStatuses.Signed || agreement.Status == ServiceAgreementStatuses.LegacyConfirmed;

        return new PublicServiceAgreementVerificationDto
        {
            VerificationCode = agreement.VerificationCode,
            JobTitle = agreement.Job?.Title ?? "Tin tuyển dụng",
            CompanyName = agreement.CompanyNameSnapshot,
            ServiceTypeCode = agreement.ServiceTypeCode,
            Version = agreement.Version,
            Status = agreement.Status,
            SignedAt = agreement.SignedAt,
            DocumentSha256Hash = agreement.DocumentSha256Hash,
            IsValid = isValid
        };
    }
}
