using HRConnect.Application.Features.ServiceTypes.DTOs;
using MediatR;

namespace HRConnect.Application.Features.ServiceTypes.Commands.CreateServiceType;

public class CreateServiceTypeCommand : IRequest<CreateServiceTypeResponse>
{
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool? IsActive { get; set; }
}

public class CreateServiceTypeResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Tạo loại dịch vụ thành công.";

    public ServiceTypeDto? Data { get; set; }
}
