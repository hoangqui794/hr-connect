using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.ServiceTypes.Commands.ReplaceServiceTypeAllowedRoles;

public sealed record AllowedRoleInput(Guid RoleId, bool CanView, bool CanSubmit);

public sealed class ReplaceServiceTypeAllowedRolesCommand : IRequest<ReplaceServiceTypeAllowedRolesResponse>
{
    public Guid ServiceTypeId { get; set; }

    public IReadOnlyList<AllowedRoleInput> Roles { get; init; } = Array.Empty<AllowedRoleInput>();
}

public sealed record UpdatedAllowedRoleDto(Guid RoleId, bool CanView, bool CanSubmit);

public sealed record ReplaceServiceTypeAllowedRolesData(
    Guid ServiceTypeId,
    string ServiceTypeCode,
    IReadOnlyList<UpdatedAllowedRoleDto> Roles);

public sealed record ReplaceServiceTypeAllowedRolesResponse(
    bool Success,
    string Message,
    ReplaceServiceTypeAllowedRolesData Data);

public sealed class ReplaceServiceTypeAllowedRolesCommandHandler
    : IRequestHandler<ReplaceServiceTypeAllowedRolesCommand, ReplaceServiceTypeAllowedRolesResponse>
{
    private readonly IServiceTypeRepository _serviceTypes;
    private readonly IRoleRepository _roles;
    private readonly IUnitOfWork _unitOfWork;

    public ReplaceServiceTypeAllowedRolesCommandHandler(
        IServiceTypeRepository serviceTypes,
        IRoleRepository roles,
        IUnitOfWork unitOfWork)
    {
        _serviceTypes = serviceTypes;
        _roles = roles;
        _unitOfWork = unitOfWork;
    }

    public async Task<ReplaceServiceTypeAllowedRolesResponse> Handle(
        ReplaceServiceTypeAllowedRolesCommand request,
        CancellationToken cancellationToken)
    {
        var serviceType = await _serviceTypes.GetByIdAsync(request.ServiceTypeId, cancellationToken)
            ?? throw new NotFoundException($"Khong tim thay loai dich vu voi ID: {request.ServiceTypeId}");

        var roleIds = request.Roles.Select(role => role.RoleId).ToHashSet();
        var existingRoles = await _roles.GetByIdsAsync(roleIds, cancellationToken);
        if (existingRoles.Count != roleIds.Count)
        {
            throw new BadRequestException("Danh sach role co roleId khong ton tai.");
        }

        var mappings = request.Roles.Select(role => new ServiceTypeAllowedRole
        {
            ServiceTypeId = request.ServiceTypeId,
            RoleId = role.RoleId,
            CanView = role.CanView,
            CanSubmit = role.CanSubmit
        }).ToList();

        await _serviceTypes.ReplaceAllowedRolesAsync(request.ServiceTypeId, mappings, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var data = new ReplaceServiceTypeAllowedRolesData(
            request.ServiceTypeId,
            serviceType.Code,
            mappings.Select(mapping => new UpdatedAllowedRoleDto(
                mapping.RoleId,
                mapping.CanView,
                mapping.CanSubmit)).ToList());

        return new(
            true,
            "Cap nhat cau hinh role duoc phep su dung Service Type thanh cong.",
            data);
    }
}
