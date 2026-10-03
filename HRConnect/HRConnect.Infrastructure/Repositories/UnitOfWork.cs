using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace HRConnect.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly ApplicationDbContext _context;
    private IDbContextTransaction? _currentTransaction;

    public UnitOfWork(ApplicationDbContext context)
    {
        _context = context;
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
    }

    public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_currentTransaction != null)
        {
            return;
        }

        _currentTransaction = await _context.Database.BeginTransactionAsync(cancellationToken);
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
}
