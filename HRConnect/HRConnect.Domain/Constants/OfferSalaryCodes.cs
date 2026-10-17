namespace HRConnect.Domain.Constants;

public static class OfferSalaryBasisCodes
{
    public const string Gross = "GROSS";
    public const string Net = "NET";

    public static bool IsValid(string? value) => value is Gross or Net;
}

public static class OfferSalaryPeriodCodes
{
    public const string Monthly = "MONTHLY";
    public const string Annual = "ANNUAL";

    public static bool IsValid(string? value) => value is Monthly or Annual;
}

public static class OfferSalaryErrorCodes
{
    public const string Incomplete = "OFFER_SALARY_INCOMPLETE";
    public const string HeadhuntRequiresGross = "HEADHUNT_REQUIRES_GROSS";
    public const string InvalidBasis = "INVALID_SALARY_BASIS";
    public const string InvalidPeriod = "INVALID_SALARY_PERIOD";
}
