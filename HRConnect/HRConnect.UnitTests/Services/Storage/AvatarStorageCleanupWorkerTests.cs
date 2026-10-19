using HRConnect.Infrastructure.Services.Storage;

namespace HRConnect.UnitTests.Services.Storage;

public sealed class AvatarStorageCleanupWorkerTests
{
    [Theory]
    [InlineData("avatars/user/avatar.webp", true)]
    [InlineData("candidate-cvs/user/cv.pdf", false)]
    [InlineData("avatars/../candidate-cvs/cv.pdf", false)]
    [InlineData("", false)]
    public void IsAvatarKey_OnlyAcceptsSafeAvatarNamespace(string key, bool expected) =>
        Assert.Equal(expected, AvatarStorageCleanupWorker.IsAvatarKey(key));

    [Fact]
    public void CalculateRetryDelay_IsBounded()
    {
        Assert.Equal(TimeSpan.FromMinutes(2), AvatarStorageCleanupWorker.CalculateRetryDelay(1));
        Assert.Equal(TimeSpan.FromMinutes(60), AvatarStorageCleanupWorker.CalculateRetryDelay(AvatarStorageCleanupWorker.MaxAttempts));
    }
}
