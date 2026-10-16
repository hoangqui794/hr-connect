using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace HRConnect.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly ApplicationDbContext _context;
    private readonly IRequestContext? _requestContext;
    private IDbContextTransaction? _currentTransaction;

    public UnitOfWork(ApplicationDbContext context, IRequestContext? requestContext = null)
    {
        _context = context;
        _requestContext = requestContext;
    }

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            return await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new ConflictException(
                "Dữ liệu vừa được xử lý bởi một yêu cầu khác. Vui lòng tải lại trạng thái mới nhất.",
                "CONCURRENT_UPDATE",
                ex);
        }
        catch (DbUpdateException ex) when (IsScheduledInterviewConflict(ex))
        {
            throw new ConflictException(
                "Hồ sơ đã có một lịch phỏng vấn đang chờ. Vui lòng tải lại trạng thái mới nhất.",
                "INTERVIEW_ALREADY_SCHEDULED",
                ex);
        }
        catch (DbUpdateException ex) when (TryGetRegistrationConflict(ex, out var message, out var errorCode))
        {
            throw new ConflictException(message, errorCode, ex);
        }
    }

    public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_currentTransaction != null)
        {
            return;
        }

        _currentTransaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        await SetDatabaseAuditContextAsync(cancellationToken);
    }

    private async Task SetDatabaseAuditContextAsync(CancellationToken cancellationToken)
    {
        var actorUserId = _requestContext?.UserId?.ToString() ?? string.Empty;
        var correlationId = _requestContext?.CorrelationId?.ToString() ?? string.Empty;
        var ipAddress = _requestContext?.IpAddress?.ToString() ?? string.Empty;
        var userAgent = _requestContext?.UserAgent ?? string.Empty;
        await _context.Database.ExecuteSqlInterpolatedAsync($$"""
            SELECT
                set_config('app.current_user_id', {{actorUserId}}, true),
                set_config('app.correlation_id', {{correlationId}}, true),
                set_config('app.ip_address', {{ipAddress}}, true),
                set_config('app.user_agent', {{userAgent}}, true)
            """, cancellationToken);
    }

    public async Task CommitTransactionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await _context.SaveChangesAsync(cancellationToken);

            if (_currentTransaction != null)
            {
                await _currentTransaction.CommitAsync(cancellationToken);
            }
        }
        catch (DbUpdateConcurrencyException ex)
        {
            await RollbackTransactionAsync(cancellationToken);
            throw new ConflictException(
                "Dữ liệu vừa được xử lý bởi một yêu cầu khác. Vui lòng tải lại trạng thái mới nhất.",
                "CONCURRENT_UPDATE",
                ex);
        }
        catch (DbUpdateException ex) when (IsScheduledInterviewConflict(ex))
        {
            await RollbackTransactionAsync(cancellationToken);
            throw new ConflictException(
                "Hồ sơ đã có một lịch phỏng vấn đang chờ. Vui lòng tải lại trạng thái mới nhất.",
                "INTERVIEW_ALREADY_SCHEDULED",
                ex);
        }
        catch (DbUpdateException ex) when (TryGetRegistrationConflict(ex, out var message, out var errorCode))
        {
            await RollbackTransactionAsync(cancellationToken);
            throw new ConflictException(message, errorCode, ex);
        }
        catch
        {
            await RollbackTransactionAsync(cancellationToken);
            throw;
        }
        finally
        {
            if (_currentTransaction != null)
            {
                await _currentTransaction.DisposeAsync();
                _currentTransaction = null;
            }
        }
    }

    public async Task RollbackTransactionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            if (_currentTransaction != null)
            {
                await _currentTransaction.RollbackAsync(cancellationToken);
            }
        }
        finally
        {
            if (_currentTransaction != null)
            {
                await _currentTransaction.DisposeAsync();
                _currentTransaction = null;
            }

            // A database rollback does not reset EF Core's tracked entity states.
            // Clear the failed unit of work so a later audit SaveChanges does not
            // retry the rejected ACCEPTED submission/application graph.
            _context.ChangeTracker.Clear();
        }
    }

    private static bool IsScheduledInterviewConflict(DbUpdateException exception)
    {
        return exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: "ux_interview_one_scheduled_per_application"
        };
    }

    private static bool TryGetRegistrationConflict(
        DbUpdateException exception,
        out string message,
        out string errorCode)
    {
        message = string.Empty;
        errorCode = string.Empty;

        if (exception.InnerException is not PostgresException
            {
                SqlState: PostgresErrorCodes.UniqueViolation
            } postgresException)
        {
            return false;
        }

        switch (postgresException.ConstraintName)
        {
            case "uq_user_email_identity_active_email":
                message = "Email này đã được sử dụng cho một tài khoản khác.";
                errorCode = "EMAIL_ALREADY_REGISTERED";
                return true;
            case "uq_company_tax_code":
                message = "Mã số thuế này đã được đăng ký cho một doanh nghiệp khác.";
                errorCode = "TAX_CODE_ALREADY_REGISTERED";
                return true;
            case "uq_affiliate_application_open":
                message = "Tài khoản đã có một hồ sơ Affiliate đang chờ xử lý.";
                errorCode = "AFFILIATE_APPLICATION_ALREADY_OPEN";
                return true;
            case "uq_company_verification_open":
                message = "Doanh nghiệp đã có một yêu cầu xác thực đang chờ xử lý.";
                errorCode = "COMPANY_VERIFICATION_ALREADY_OPEN";
                return true;
            default:
                return false;
        }
    }
}
