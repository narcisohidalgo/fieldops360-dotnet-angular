# Build and publish
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

COPY FieldOps.Domain/FieldOps.Domain.csproj FieldOps.Domain/
COPY FieldOps.Application/FieldOps.Application.csproj FieldOps.Application/
COPY FieldOps.Infrastructure/FieldOps.Infrastructure.csproj FieldOps.Infrastructure/
COPY FieldOps.Api/FieldOps.Api.csproj FieldOps.Api/

RUN dotnet restore FieldOps.Api/FieldOps.Api.csproj

COPY . .

RUN dotnet publish FieldOps.Api/FieldOps.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false

# Database migrations
FROM build AS migrations

RUN dotnet tool install \
    --tool-path /tools \
    dotnet-ef \
    --version 10.0.14

ENTRYPOINT ["/tools/dotnet-ef", "database", "update", "--project", "FieldOps.Infrastructure/FieldOps.Infrastructure.csproj", "--startup-project", "FieldOps.Api/FieldOps.Api.csproj", "--configuration", "Release", "--no-build"]

# Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_HTTP_PORTS=8080

EXPOSE 8080

COPY --from=build /app/publish .

# Persistent ASP.NET Core Data Protection keys.
ENV HOME=/home/app

RUN mkdir -p /home/app/.aspnet/DataProtection-Keys \
    && chown -R $APP_UID /home/app/.aspnet \
    && chmod 700 /home/app/.aspnet/DataProtection-Keys

USER $APP_UID

ENTRYPOINT ["dotnet", "FieldOps.Api.dll"]
