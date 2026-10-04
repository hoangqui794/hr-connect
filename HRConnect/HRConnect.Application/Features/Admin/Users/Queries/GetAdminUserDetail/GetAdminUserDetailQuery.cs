using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.Users.Queries.GetAdminUserDetail;

public sealed record GetAdminUserDetailQuery(Guid UserId) : IRequest<AdminUserDetailResponse>;

public sealed class GetAdminUserDetailQueryHandler : IRequestHandler<GetAdminUserDetailQuery, AdminUserDetailResponse>
{
    private readonly IAdminUserRepository _repository;

    public GetAdminUserDetailQueryHandler(IAdminUserRepository repository)
    {
        _repository = repository;
    }

    public async Task<AdminUserDetailResponse> Handle(
        GetAdminUserDetailQuery request,
        CancellationToken cancellationToken)
    {
        var user = await _repository.GetByIdWithRolesAsync(request.UserId, cancellationToken: cancellationToken)
            ?? throw new NotFoundException($"Không tìm thấy người dùng với mã {request.UserId}.");

        return new AdminUserDetailResponse
        {
            Data = AdminUserDetailDto.From(user, DateTime.UtcNow)
        };
    }
}
