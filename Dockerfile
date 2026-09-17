# Stage 1: Base Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# Stage 2: Build SDK
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Copy csproj files for optimal layer caching
COPY ["HRConnect.sln", "./"]
COPY ["HRConnect.Domain/HRConnect.Domain.csproj", "HRConnect.Domain/"]
COPY ["HRConnect.Application/HRConnect.Application.csproj", "HRConnect.Application/"]
COPY ["HRConnect.Infrastructure/HRConnect.Infrastructure.csproj", "HRConnect.Infrastructure/"]
COPY ["HRConnect.Presentation/HRConnect.Presentation.csproj", "HRConnect.Presentation/"]

# Restore dependencies
RUN dotnet restore "HRConnect.sln"

# Copy the rest of the source code
COPY . .

# Build the presentation project
WORKDIR "/src/HRConnect.Presentation"
RUN dotnet build "HRConnect.Presentation.csproj" -c $BUILD_CONFIGURATION -o /app/build --no-restore

# Stage 3: Publish
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "HRConnect.Presentation.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false --no-restore

# Stage 4: Final Image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Run as non-root user for security (.NET 8 standard)
USER $APP_UID

ENTRYPOINT ["dotnet", "HRConnect.Presentation.dll"]
