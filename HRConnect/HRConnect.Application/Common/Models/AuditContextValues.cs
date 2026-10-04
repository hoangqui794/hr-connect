namespace HRConnect.Application.Common.Models;

public static class AuditActorTypes
{
    public const string User = "USER";
    public const string Anonymous = "ANONYMOUS";
    public const string System = "SYSTEM";
    public const string Service = "SERVICE";
    public const string DatabaseTrigger = "DATABASE_TRIGGER";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        User, Anonymous, System, Service, DatabaseTrigger
    };
}

public static class AuditSources
{
    public const string Api = "API";
    public const string Application = "APPLICATION";
    public const string BackgroundWorker = "BACKGROUND_WORKER";
    public const string Integration = "INTEGRATION";
    public const string DatabaseTrigger = "DATABASE_TRIGGER";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Api, Application, BackgroundWorker, Integration, DatabaseTrigger
    };
}
