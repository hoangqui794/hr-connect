using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Storage;

public class CvStorageService : ICvStorageService
{
    private readonly IFileStorageService _fileStorageService;
    private readonly ICandidateCvRepository _candidateCvRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly R2Settings _settings;
    private readonly ILogger<CvStorageService> _logger;

    public CvStorageService(
        IFileStorageService fileStorageService,
        ICandidateCvRepository candidateCvRepository,
        IUnitOfWork unitOfWork,
        IOptions<R2Settings> options,
        ILogger<CvStorageService> logger)
    {
        _fileStorageService = fileStorageService;
        _candidateCvRepository = candidateCvRepository;
        _unitOfWork = unitOfWork;
        _settings = options.Value;
        _logger = logger;
    }

    public async Task<UploadCvResult> UploadCvPdfAsync(
        Guid candidateId,
        Stream fileStream,
        string fileName,
        long fileSizeBytes,
        string? title = null,
        bool isPrimary = false,
        CancellationToken cancellationToken = default)
    {
        // 1. Validate đầu vào tập tin
        ValidatePdfFile(fileStream, fileName, fileSizeBytes);

        // 2. Tạo mã định danh duy nhất và object key chuẩn
        var cvId = Guid.NewGuid();
        var objectKey = $"candidates/{candidateId}/cvs/{cvId}.pdf";

        // 3. Upload tệp lên Cloudflare R2
        string uploadedKey;
        try
        {
            uploadedKey = await _fileStorageService.UploadAsync(
                fileStream,
                objectKey,
                "application/pdf",
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi upload CV lên R2 cho CandidateId: {CandidateId}", candidateId);
            throw new InvalidOperationException("Không thể lưu trữ tệp CV lên hệ thống lưu trữ đám mây.", ex);
        }

        // 4. Lưu metadata vào cơ sở dữ liệu với cơ chế compensation
        var now = DateTime.UtcNow;
        var cvTitle = !string.IsNullOrWhiteSpace(title)
            ? title.Trim()
            : Path.GetFileNameWithoutExtension(fileName);

        if (cvTitle.Length > 180)
        {
            cvTitle = cvTitle.Substring(0, 180);
        }

        try
        {
            // Nếu đánh dấu là CV chính, hạ cờ is_primary của các CV cũ
            if (isPrimary)
            {
                var currentPrimary = await _candidateCvRepository.GetPrimaryByCandidateIdAsync(candidateId, cancellationToken);
                if (currentPrimary != null)
                {
                    currentPrimary.IsPrimary = false;
                    currentPrimary.UpdatedAt = now;
                    _candidateCvRepository.Update(currentPrimary);
                }
            }

            var candidateCv = new CandidateCv
            {
                CvId = cvId,
                CandidateId = candidateId,
                Title = cvTitle,
                CreationMethod = "FILE_UPLOAD",
                SourceFileUrl = uploadedKey, // Lưu object key ổn định thay vì temporary URL
                FileName = Path.GetFileName(fileName),
                MimeType = "application/pdf",
                FileSizeBytes = fileSizeBytes,
                IsPrimary = isPrimary,
                Status = "ACTIVE",
                CreatedAt = now,
                UpdatedAt = now
            };

            await _candidateCvRepository.AddAsync(candidateCv, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Lưu CV vào CSDL thành công cho CandidateId={CandidateId}, CvId={CvId}, Key={Key}",
                candidateId, cvId, uploadedKey);

            return new UploadCvResult
            {
                CvId = cvId,
                CandidateId = candidateId,
                Title = cvTitle,
                ObjectKey = uploadedKey,
                FileName = candidateCv.FileName,
                MimeType = candidateCv.MimeType,
                FileSizeBytes = fileSizeBytes,
                IsPrimary = isPrimary,
                Status = candidateCv.Status,
                CreatedAt = now
            };
        }
        catch (Exception dbEx)
        {
            _logger.LogError(dbEx, "Lỗi lưu CSDL sau khi upload R2 thành công. Tiến hành bồi hoàn (compensation delete): Key={Key}", objectKey);

            // Bồi hoàn xóa object trên R2 để tránh rác mồ côi (orphan object)
            try
            {
                await _fileStorageService.DeleteAsync(objectKey, CancellationToken.None);
                _logger.LogInformation("Đã bồi hoàn xóa đối tượng R2 thành công: Key={Key}", objectKey);
            }
            catch (Exception compEx)
            {
                _logger.LogError(compEx, "Thất bại khi bồi hoàn xóa đối tượng R2: Key={Key}", objectKey);
            }

            throw new InvalidOperationException("Không thể lưu thông tin hồ sơ CV vào cơ sở dữ liệu.", dbEx);
        }
    }

    public async Task<CvDownloadUrlResult> GetCvDownloadUrlAsync(
        Guid cvId,
        TimeSpan? expiry = null,
        CancellationToken cancellationToken = default)
    {
        var cv = await _candidateCvRepository.GetByIdAsync(cvId, cancellationToken);
        if (cv == null)
        {
            throw new NotFoundException($"Không tìm thấy CV với mã {cvId}.");
        }

        if (string.IsNullOrWhiteSpace(cv.SourceFileUrl))
        {
            throw new BadRequestException("CV này không có tệp lưu trữ hợp lệ trên hệ thống đám mây.");
        }

        var expirySpan = expiry ?? TimeSpan.FromMinutes(_settings.PresignedUrlExpiryMinutes);

        var downloadUrl = await _fileStorageService.GetPresignedDownloadUrlAsync(
            cv.SourceFileUrl,
            expirySpan,
            cancellationToken);

        return new CvDownloadUrlResult
        {
            CvId = cvId,
            FileName = cv.FileName ?? $"{cvId}.pdf",
            MimeType = cv.MimeType ?? "application/pdf",
            DownloadUrl = downloadUrl,
            ExpiresAt = DateTime.UtcNow.Add(expirySpan)
        };
    }

    public async Task DeleteCvAsync(
        Guid cvId,
        CancellationToken cancellationToken = default)
    {
        var cv = await _candidateCvRepository.GetByIdAsync(cvId, cancellationToken);
        if (cv == null)
        {
            throw new NotFoundException($"Không tìm thấy CV với mã {cvId}.");
        }

        var objectKey = cv.SourceFileUrl;
        _candidateCvRepository.Delete(cv);
        // Commit the relational delete first. A concurrent Submission referencing this CV
        // will make this operation fail before the R2 object can be removed.
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(objectKey))
        {
            try
            {
                await _fileStorageService.DeleteAsync(objectKey, cancellationToken);
            }
            catch (Exception ex)
            {
                // DB is already the source of truth. A failed external cleanup leaves an
                // orphan object, which is safer than deleting a file still used by history.
                _logger.LogWarning(ex, "Đã xóa metadata CV {CvId} nhưng chưa thể dọn tệp R2 {Key}", cvId, objectKey);
            }
        }

        _logger.LogInformation("Đã xóa metadata CV {CvId}; hoàn tất yêu cầu dọn tệp lưu trữ nếu có.", cvId);
    }

    private void ValidatePdfFile(Stream stream, string fileName, long fileSizeBytes)
    {
        if (stream == null || stream == Stream.Null)
        {
            throw new BadRequestException("Tập tin tải lên không được rỗng.");
        }

        if (string.IsNullOrWhiteSpace(fileName))
        {
            throw new BadRequestException("Tên tập tin không được để trống.");
        }

        var extension = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(extension) || !extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Chỉ cho phép tải lên tập tin có định dạng PDF (.pdf).");
        }

        if (fileSizeBytes <= 0)
        {
            throw new BadRequestException("Kích thước tập tin phải lớn hơn 0 byte.");
        }

        if (fileSizeBytes > _settings.MaxCvFileSizeBytes)
        {
            throw new BadRequestException($"Kích thước tập tin ({fileSizeBytes / (1024 * 1024)}MB) vượt quá giới hạn tối đa cho phép là {_settings.MaxCvFileSizeMb}MB.");
        }
    }
}
