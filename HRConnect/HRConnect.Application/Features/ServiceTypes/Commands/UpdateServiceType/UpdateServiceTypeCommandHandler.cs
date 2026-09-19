using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.ServiceTypes.DTOs;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.ServiceTypes.Commands.UpdateServiceType;

public class UpdateServiceTypeCommandHandler : IRequestHandler<UpdateServiceTypeCommand, UpdateServiceTypeResponse>
{
    private readonly IServiceTypeRepository _serviceTypeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<UpdateServiceTypeCommandHandler> _logger;

    public UpdateServiceTypeCommandHandler(
        IServiceTypeRepository serviceTypeRepository,
        IUnitOfWork unitOfWork,
        ILogger<UpdateServiceTypeCommandHandler> logger)
    {
        _serviceTypeRepository = serviceTypeRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<UpdateServiceTypeResponse> Handle(UpdateServiceTypeCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra tồn tại ServiceType theo ID
        var serviceType = await _serviceTypeRepository.GetByIdAsync(request.Id, cancellationToken);
        if (serviceType == null)
        {
            _logger.LogWarning("Cập nhật loại dịch vụ thất bại: Không tìm thấy ID {Id}.", request.Id);
            throw new NotFoundException($"Không tìm thấy loại dịch vụ với ID: {request.Id}");
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        // 2. Quy tắc nghiệp vụ khi thay đổi Code (Business Key):
        // Nếu mã Code thay đổi, kiểm tra Service Type đã được liên kết với Job hoặc CommissionRule hay chưa.
        if (!string.Equals(serviceType.Code, normalizedCode, StringComparison.OrdinalIgnoreCase))
        {
            var isReferenced = await _serviceTypeRepository.IsReferencedAsync(request.Id, cancellationToken);
            if (isReferenced)
            {
                _logger.LogWarning("Cập nhật loại dịch vụ thất bại: Không được đổi Code của ID {Id} vì đã phát sinh dữ liệu liên kết.", request.Id);
                throw new ConflictException("Không thể thay đổi mã loại dịch vụ (Code) vì loại dịch vụ này đã phát sinh dữ liệu liên kết (Job hoặc Commission Rule).");
            }

            // Kiểm tra trùng lặp với bản ghi khác
            var exists = await _serviceTypeRepository.ExistsByCodeAsync(normalizedCode, request.Id, cancellationToken);
            if (exists)
            {
                _logger.LogWarning("Cập nhật loại dịch vụ thất bại: Mã '{Code}' đã tồn tại ở bản ghi khác.", normalizedCode);
                throw new ConflictException($"Mã loại dịch vụ '{normalizedCode}' đã tồn tại trong hệ thống.");
            }

            serviceType.Code = normalizedCode;
        }

        // 3. Cập nhật các thông tin còn lại
        serviceType.Name = request.Name.Trim();
        serviceType.Description = request.Description?.Trim();
        serviceType.IsActive = request.IsActive;
        serviceType.UpdatedAt = DateTime.UtcNow;

        _serviceTypeRepository.Update(serviceType);

        try
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi DB khi cập nhật ServiceType ID {Id}.", request.Id);
            throw new ConflictException($"Có lỗi xảy ra khi lưu thông tin loại dịch vụ: {ex.Message}");
        }

        _logger.LogInformation("Cập nhật thành công loại dịch vụ ID {Id}, Code '{Code}'.", serviceType.ServiceTypeId, serviceType.Code);

        var dto = new ServiceTypeDto
        {
            Id = serviceType.ServiceTypeId,
            Code = serviceType.Code,
            Name = serviceType.Name,
            Description = serviceType.Description,
            IsActive = serviceType.IsActive,
            CreatedAt = serviceType.CreatedAt,
            UpdatedAt = serviceType.UpdatedAt
        };

        return new UpdateServiceTypeResponse
        {
            Success = true,
            Message = "Cập nhật loại dịch vụ thành công.",
            Data = dto
        };
    }
}
