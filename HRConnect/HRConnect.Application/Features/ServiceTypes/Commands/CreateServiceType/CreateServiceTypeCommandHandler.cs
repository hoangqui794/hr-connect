using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.ServiceTypes.DTOs;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.ServiceTypes.Commands.CreateServiceType;

public class CreateServiceTypeCommandHandler : IRequestHandler<CreateServiceTypeCommand, CreateServiceTypeResponse>
{
    private readonly IServiceTypeRepository _serviceTypeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<CreateServiceTypeCommandHandler> _logger;

    public CreateServiceTypeCommandHandler(
        IServiceTypeRepository serviceTypeRepository,
        IUnitOfWork unitOfWork,
        ILogger<CreateServiceTypeCommandHandler> logger)
    {
        _serviceTypeRepository = serviceTypeRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<CreateServiceTypeResponse> Handle(CreateServiceTypeCommand request, CancellationToken cancellationToken)
    {
        // 1. Chuẩn hóa mã Code thành UPPER_SNAKE_CASE
        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        // 2. Kiểm tra trùng lặp mã loại dịch vụ (Business Key)
        var exists = await _serviceTypeRepository.ExistsByCodeAsync(normalizedCode, null, cancellationToken);
        if (exists)
        {
            _logger.LogWarning("Tạo loại dịch vụ thất bại: Mã '{Code}' đã tồn tại.", normalizedCode);
            throw new ConflictException($"Mã loại dịch vụ '{normalizedCode}' đã tồn tại trong hệ thống.");
        }

        var now = DateTime.UtcNow;

        // 3. Khởi tạo thực thể mới (không tự động tạo commission rule)
        var serviceType = new ServiceType
        {
            ServiceTypeId = Guid.NewGuid(),
            Code = normalizedCode,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            IsActive = request.IsActive ?? true,
            CreatedAt = now,
            UpdatedAt = now
        };

        await _serviceTypeRepository.AddAsync(serviceType, cancellationToken);

        try
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi DB khi lưu ServiceType với mã '{Code}'.", normalizedCode);
            throw new ConflictException($"Mã loại dịch vụ '{normalizedCode}' đã tồn tại trong hệ thống.");
        }

        _logger.LogInformation("Tạo thành công loại dịch vụ mới: ID {Id}, Code '{Code}'.", serviceType.ServiceTypeId, normalizedCode);

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

        return new CreateServiceTypeResponse
        {
            Success = true,
            Message = "Tạo loại dịch vụ thành công.",
            Data = dto
        };
    }
}
