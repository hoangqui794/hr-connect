using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Common;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationCounts;

public sealed class GetRecruitmentApplicationCountsQueryHandler
    : IRequestHandler<GetRecruitmentApplicationCountsQuery, RecruitmentApplicationCountsResponse>
{
    private readonly IApplicationRepository _applications;
    private readonly ICompanyUserRepository _companyUsers;

    public GetRecruitmentApplicationCountsQueryHandler(IApplicationRepository applications, ICompanyUserRepository companyUsers)
    {
        _applications = applications;
        _companyUsers = companyUsers;
    }

    public async Task<RecruitmentApplicationCountsResponse> Handle(
        GetRecruitmentApplicationCountsQuery request, CancellationToken cancellationToken)
    {
        var groupBy = request.GroupBy?.Trim().ToLowerInvariant() switch
        {
            "job" => RecruitmentCountGroup.Job,
            "status" => RecruitmentCountGroup.Status,
            _ => throw new BadRequestException("groupBy chỉ nhận \"job\" hoặc \"status\"."),
        };

        Guid? companyId = null;
        if (request.IsClientCompanyUser)
        {
            var member = await _companyUsers.GetByUserIdAsync(request.UserId, cancellationToken);
            if (!CompanyMembershipPolicy.IsActive(member))
            {
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }
            companyId = member!.CompanyId;
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            throw new ForbiddenException("Bạn không có quyền truy cập danh sách tuyển dụng.");
        }

        var counts = await _applications.CountRecruitmentApplicationsAsync(
            companyId, request.JobId, request.Status, request.CandidateName, request.ServiceTypeCode, groupBy, cancellationToken);

        return new RecruitmentApplicationCountsResponse
        {
            Message = "Lấy số lượng hồ sơ tuyển dụng thành công.",
            Data = new RecruitmentApplicationCountsData
            {
                GroupBy = groupBy == RecruitmentCountGroup.Job ? "job" : "status",
                Total = counts.Values.Sum(),
                Counts = counts,
            },
        };
    }
}
