using System;
using HRConnect.Application.Features.ServiceTypes.DTOs;
using MediatR;

namespace HRConnect.Application.Features.ServiceTypes.Commands.UpdateServiceType;

public class UpdateServiceTypeCommand : IRequest<UpdateServiceTypeResponse>
{
    public Guid Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
}

public class UpdateServiceTypeResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Cập nhật loại dịch vụ thành công.";

    public ServiceTypeDto? Data { get; set; }
}
