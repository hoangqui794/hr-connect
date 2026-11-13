using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Auth.Commands.SplitAccount;

public class ConfirmSplitRegisterCommandHandler : IRequestHandler<ConfirmSplitRegisterCommand, ConfirmSplitRegisterResponse>
{
    private const int MaxFailedAttempts = 5;

    private readonly IUserRepository _userRepository;
    private readonly IUserEmailIdentityRepository _userEmailIdentityRepository;
    private readonly ICandidateRepository _candidateRepository;
    private readonly IRoleRepository _roleRepository;
    private readonly IUserRoleRepository _userRoleRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly IAuditLogService _auditLogService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IOtpService _otpService;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IPhoneNormalizer _phoneNormalizer;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ConfirmSplitRegisterCommandHandler> _logger;

    public ConfirmSplitRegisterCommandHandler(
        IUserRepository userRepository,
        IUserEmailIdentityRepository userEmailIdentityRepository,
        ICandidateRepository candidateRepository,
        IRoleRepository roleRepository,
        IUserRoleRepository userRoleRepository,
        IUserTokenRepository userTokenRepository,
        IAuditLogService auditLogService,
        IPasswordHasher passwordHasher,
        IOtpService otpService,
        IEmailNormalizer emailNormalizer,
        IPhoneNormalizer phoneNormalizer,
        IUnitOfWork unitOfWork,
        ILogger<ConfirmSplitRegisterCommandHandler> logger)
    {
        _userRepository = userRepository;
        _userEmailIdentityRepository = userEmailIdentityRepository;
        _candidateRepository = candidateRepository;
        _roleRepository = roleRepository;
        _userRoleRepository = userRoleRepository;
        _userTokenRepository = userTokenRepository;
        _auditLogService = auditLogService;
        _passwordHasher = passwordHasher;
        _otpService = otpService;
        _emailNormalizer = emailNormalizer;
        _phoneNormalizer = phoneNormalizer;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<ConfirmSplitRegisterResponse> Handle(ConfirmSplitRegisterCommand request, CancellationToken cancellationToken)
    {
        var normalizedEmail = _emailNormalizer.Normalize(request.Email);
        var normalizedPhone = _phoneNormalizer.Normalize(request.Phone);

        if (string.IsNullOrWhiteSpace(normalizedEmail))
            throw new BadRequestException("Email không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.Otp))
            throw new BadRequestException("Vui lòng nhập mã OTP.");

        var activeIdentity = await _userEmailIdentityRepository.GetActiveByNormalizedEmailAsync(normalizedEmail, cancellationToken);
        if (activeIdentity == null || string.Equals(activeIdentity.Kind, "PRIMARY", StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Email này không phải là email phụ để có thể tách tài khoản.");
        }

        var token = await _userTokenRepository.GetLatestActiveOtpAsync(activeIdentity.UserId, "SPLIT_EMAIL_OTP", cancellationToken);
        if (token == null)
            throw new BadRequestException("Không tìm thấy yêu cầu xác thực tách tài khoản hoặc mã OTP đã hết hạn.");

        if (token.AttemptCount >= MaxFailedAttempts)
            throw new BadRequestException("Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu mã mới.");

        if (DateTime.UtcNow > token.ExpiresAt)
            throw new BadRequestException("Mã OTP đã hết hạn. Vui lòng yêu cầu mã xác thực mới.");

        var isOtpValid = _otpService.VerifyOtp(request.Otp.Trim(), token.TokenHash);
        if (!isOtpValid)
        {
            token.AttemptCount++;
            _userTokenRepository.Update(token);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var remaining = MaxFailedAttempts - token.AttemptCount;
            if (remaining <= 0)
                throw new BadRequestException("Mã OTP không chính xác. Bạn đã hết số lần thử. Mã này đã bị vô hiệu hóa.");

            throw new BadRequestException($"Mã OTP không chính xác. Bạn còn {remaining} lần thử lại.");
        }

        var now = DateTime.UtcNow;
        token.UsedAt = now;
        _userTokenRepository.Update(token);

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            // 1. Thu hồi liên kết email phụ cũ và lưu ngay để thỏa mãn ràng buộc database
            // (ck_user_email_identity_revoked_at yêu cầu revoked_at IS NOT NULL,
            // và uq_user_email_identity_active_email loại trừ các bản ghi status = 'REVOKED')
            activeIdentity.Status = "REVOKED";
            activeIdentity.RevokedAt = now;
            activeIdentity.UpdatedAt = now;
            activeIdentity.ConcurrencyToken = Guid.NewGuid();
            _userEmailIdentityRepository.Update(activeIdentity);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // 2. Tạo AppUser mới độc lập (ACTIVE ngay vì đã xác thực OTP)
            var newUser = new AppUser
            {
                UserId = Guid.NewGuid(),
                Email = request.Email.Trim(),
                PasswordHash = _passwordHasher.Hash(request.Password),
                DisplayName = request.FullName.Trim(),
                Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
                NormalizedPhone = string.IsNullOrWhiteSpace(request.Phone) ? null : normalizedPhone,
                Status = "ACTIVE",
                EmailVerifiedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };
            await _userRepository.AddAsync(newUser, cancellationToken);

            // 3. Tạo UserEmailIdentity mới là PRIMARY của user mới
            var primaryIdentity = new UserEmailIdentity
            {
                EmailIdentityId = Guid.NewGuid(),
                UserId = newUser.UserId,
                Email = newUser.Email,
                NormalizedEmail = normalizedEmail,
                Kind = "PRIMARY",
                Status = "VERIFIED",
                VerificationSource = "SPLIT_REGISTRATION",
                VerifiedAt = now,
                CreatedAt = now,
                UpdatedAt = now,
                ConcurrencyToken = Guid.NewGuid()
            };
            await _userEmailIdentityRepository.AddAsync(primaryIdentity, cancellationToken);

            // 4. Gán vai trò CANDIDATE
            var candidateRole = await _roleRepository.GetByCodeAsync("CANDIDATE", cancellationToken);
            if (candidateRole == null)
                throw new InvalidOperationException("Vai trò CANDIDATE chưa được thiết lập.");

            var userRole = new UserRole
            {
                UserId = newUser.UserId,
                RoleId = candidateRole.RoleId,
                AssignmentSource = "REGISTRATION",
                AssignedAt = now,
                Status = "ACTIVE"
            };
            await _userRoleRepository.AddAsync(userRole, cancellationToken);

            // 5. Khôi phục hoặc tạo hồ sơ Candidate
            var existingCandidate = await _candidateRepository.GetByNormalizedEmailAsync(normalizedEmail, cancellationToken);
            if (existingCandidate != null)
            {
                var previousOwnerUserId = existingCandidate.UserId;
                existingCandidate.Status = "ACTIVE";
                existingCandidate.MergedIntoCandidateId = null;
                existingCandidate.UserId = newUser.UserId;
                existingCandidate.FullName = request.FullName.Trim();
                if (!string.IsNullOrWhiteSpace(request.Phone))
                {
                    existingCandidate.Phone = request.Phone.Trim();
                    existingCandidate.NormalizedPhone = normalizedPhone;
                }
                existingCandidate.UpdatedAt = now;
                _candidateRepository.Update(existingCandidate);

                if (previousOwnerUserId.HasValue && previousOwnerUserId.Value != newUser.UserId)
                {
                    // Lưu trước để giải phóng ràng buộc unique candidate_user_id_key cho previousOwnerUserId
                    await _unitOfWork.SaveChangesAsync(cancellationToken);
                    await EnsurePreviousOwnerHasCandidateAsync(
                        previousOwnerUserId.Value,
                        existingCandidate.CandidateId,
                        existingCandidate.NormalizedPhone,
                        now,
                        cancellationToken);
                }
            }
            else
            {
                var newCandidate = new Candidate
                {
                    CandidateId = Guid.NewGuid(),
                    UserId = newUser.UserId,
                    FullName = request.FullName.Trim(),
                    Email = request.Email.Trim(),
                    Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
                    NormalizedEmail = normalizedEmail,
                    NormalizedPhone = string.IsNullOrWhiteSpace(request.Phone) ? null : normalizedPhone,
                    ProfileVisibility = "PRIVATE",
                    Status = "ACTIVE",
                    CreatedAt = now,
                    UpdatedAt = now
                };
                await _candidateRepository.AddAsync(newCandidate, cancellationToken);
            }

            // 6. Ghi Audit Log
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = "ACCOUNT_SPLIT_AND_REGISTERED",
                EntityType = "APP_USER",
                EntityId = newUser.UserId,
                NewValues = new { email = normalizedEmail, oldOwnerUserId = activeIdentity.UserId },
                Source = AuditSources.Api
            }, cancellationToken);

            await _unitOfWork.CommitTransactionAsync(cancellationToken);

            _logger.LogInformation("Tách tài khoản thành công cho email {Email}. UserId mới: {UserId}",
                normalizedEmail, newUser.UserId);

            return new ConfirmSplitRegisterResponse
            {
                Data = new ConfirmSplitRegisterData
                {
                    UserId = newUser.UserId,
                    Email = newUser.Email,
                    Status = newUser.Status
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi hoàn tất tách tài khoản cho email {Email}", normalizedEmail);
            await _unitOfWork.RollbackTransactionAsync(CancellationToken.None);
            throw;
        }
    }

    private async Task EnsurePreviousOwnerHasCandidateAsync(
        Guid previousOwnerUserId,
        Guid splitCandidateId,
        string? splitCandidateNormalizedPhone,
        DateTime now,
        CancellationToken cancellationToken)
    {
        if (await _candidateRepository.GetByUserIdAsync(previousOwnerUserId, cancellationToken) != null)
            return;

        var archivedPlaceholder = await _candidateRepository.GetArchivedMergedSourceAsync(splitCandidateId, cancellationToken);
        if (archivedPlaceholder != null)
        {
            archivedPlaceholder.Status = "ACTIVE";
            archivedPlaceholder.MergedIntoCandidateId = null;
            archivedPlaceholder.UserId = previousOwnerUserId;
            if (!string.IsNullOrWhiteSpace(splitCandidateNormalizedPhone) &&
                string.Equals(archivedPlaceholder.NormalizedPhone, splitCandidateNormalizedPhone, StringComparison.Ordinal))
            {
                archivedPlaceholder.Phone = null;
                archivedPlaceholder.NormalizedPhone = null;
            }
            archivedPlaceholder.UpdatedAt = now;
            _candidateRepository.Update(archivedPlaceholder);
            return;
        }

        var previousUser = await _userRepository.GetByIdAsync(previousOwnerUserId, cancellationToken);
        var previousNormalizedEmail = previousUser != null
            ? _emailNormalizer.Normalize(previousUser.Email)
            : null;
        var hasPhoneConflict = !string.IsNullOrWhiteSpace(splitCandidateNormalizedPhone) &&
            string.Equals(previousUser?.NormalizedPhone, splitCandidateNormalizedPhone, StringComparison.Ordinal);

        var fallbackCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = previousOwnerUserId,
            FullName = string.IsNullOrWhiteSpace(previousUser?.DisplayName) ? "Ứng viên" : previousUser.DisplayName,
            Email = previousUser?.Email,
            NormalizedEmail = string.IsNullOrWhiteSpace(previousNormalizedEmail) ? null : previousNormalizedEmail,
            Phone = hasPhoneConflict ? null : previousUser?.Phone,
            NormalizedPhone = hasPhoneConflict ? null : previousUser?.NormalizedPhone,
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE",
            CreatedAt = now,
            UpdatedAt = now
        };
        await _candidateRepository.AddAsync(fallbackCandidate, cancellationToken);
    }
}
