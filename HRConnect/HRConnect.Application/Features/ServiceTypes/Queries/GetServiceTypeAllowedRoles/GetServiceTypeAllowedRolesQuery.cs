using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.ServiceTypes.Queries.GetServiceTypeAllowedRoles;

public sealed record GetServiceTypeAllowedRolesQuery(Guid ServiceTypeId)
    : IRequest<GetServiceTypeAllowedRolesResponse>;

public sealed record ServiceTypeAllowedRoleDto(
    Guid RoleId,
    string RoleCode,
    string RoleName,
    bool IsRoleActive,
    bool CanView,
    bool CanSubmit,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record GetServiceTypeAllowedRolesData(
    Guid ServiceTypeId,
    string ServiceTypeCode,
    string ServiceTypeName,
    IReadOnlyList<ServiceTypeAllowedRoleDto> Roles);

public sealed record GetServiceTypeAllowedRolesResponse(
    bool Success,
    string Message,
    GetServiceTypeAllowedRolesData Data);

public sealed class GetServiceTypeAllowedRolesQueryHandler
    : IRequestHandler<GetServiceTypeAllowedRolesQuery, GetServiceTypeAllowedRolesResponse>
{
    private readonly IServiceTypeRepository _serviceTypes;

    public GetServiceTypeAllowedRolesQueryHandler(IServiceTypeRepository serviceTypes) => _serviceTypes = serviceTypes;

    public async Task<GetServiceTypeAllowedRolesResponse> Handle(
        GetServiceTypeAllowedRolesQuery request,
        CancellationToken cancellationToken)
    {
        var serviceType = await _serviceTypes.GetByIdAsync(request.ServiceTypeId, cancellationToken)
            ?? throw new NotFoundException($"Không tìm thấy loại dịch vụ với ID: {request.ServiceTypeId}");

        var mappings = await _serviceTypes.GetAllowedRolesAsync(request.ServiceTypeId, cancellationToken);
        var roles = mappings.Select(mapping => new ServiceTypeAllowedRoleDto(
            mapping.RoleId,
            mapping.Role.Code,
            mapping.Role.Name,
            mapping.Role.IsActive,
            mapping.CanView,
            mapping.CanSubmit,
            mapping.CreatedAt,
            mapping.UpdatedAt)).ToList();

        return new(
            true,
            "Lấy cấu hình role được phép sử dụng Service Type thành công.",
            new(request.ServiceTypeId, serviceType.Code, serviceType.Name, roles));
    }
}
