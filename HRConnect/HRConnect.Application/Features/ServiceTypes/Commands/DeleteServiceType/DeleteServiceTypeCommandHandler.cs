using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.ServiceTypes.Commands.DeleteServiceType;

public class DeleteServiceTypeCommandHandler : IRequestHandler<DeleteServiceTypeCommand, DeleteServiceTypeResponse>
{
    private readonly IServiceTypeRepository _serviceTypeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<DeleteServiceTypeCommandHandler> _logger;

    public DeleteServiceTypeCommandHandler(
        IServiceTypeRepository serviceTypeRepository,
        IUnitOfWork unitOfWork,
        ILogger<DeleteServiceTypeCommandHandler> logger)
    {
        _serviceTypeRepository = serviceTypeRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<DeleteServiceTypeResponse> Handle(DeleteServiceTypeCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra tồn tại ServiceType
        var serviceType = await _serviceTypeRepository.GetByIdAsync(request.Id, cancellationToken);
        if (serviceType == null)
        {
            _logger.LogWarning("Xóa loại dịch vụ thất bại: Không tìm thấy ID {Id}.", request.Id);
            throw new NotFoundException($"Không tìm thấy loại dịch vụ với ID: {request.Id}");
        }

        // 2. Kiểm tra ràng buộc tham chiếu (Job hoặc CommissionRule)
        var isReferenced = await _serviceTypeRepository.IsReferencedAsync(request.Id, cancellationToken);

        if (isReferenced)
        {
            // CASE 2: Đã được liên kết trong hệ thống -> Không hard delete mà chuyển is_active = false
            serviceType.IsActive = false;
            serviceType.UpdatedAt = DateTime.UtcNow;

            _serviceTypeRepository.Update(serviceType);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Loại dịch vụ ID {Id} (Code '{Code}') đang được sử dụng nên đã được ngưng hoạt động (deactivated) thay vì xóa vĩnh viễn.", serviceType.ServiceTypeId, serviceType.Code);

            return new DeleteServiceTypeResponse
            {
                Success = true,
                Message = "Service type is in use and has been deactivated instead.",
                IsDeactivated = true
            };
        }

        // CASE 1: Chưa từng được liên kết -> Cho phép hard delete
        _serviceTypeRepository.Delete(serviceType);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Xóa thành công loại dịch vụ ID {Id} (Code '{Code}').", serviceType.ServiceTypeId, serviceType.Code);

        return new DeleteServiceTypeResponse
        {
            Success = true,
            Message = "Service type deleted successfully.",
            IsDeactivated = false
        };
    }
}
