using FieldOps.Domain.Entities;

namespace FieldOps.Application.Tests.Assets;

public sealed class AssetStateTests
{
    [Fact]
    public void Deactivate_WithActiveAsset_SetsIsActiveToFalse()
    {
        var facilityId = Guid.NewGuid();

        var asset = new Asset(
            facilityId,
            "EQ-001",
            "Tractor agricola",
            "Equipo de mantenimiento");

        var originalId = asset.Id;

        Assert.True(asset.IsActive);

        asset.Deactivate();

        Assert.False(asset.IsActive);

        Assert.Equal(originalId, asset.Id);
        Assert.Equal(facilityId, asset.FacilityId);
        Assert.Equal("EQ-001", asset.Code);
        Assert.Equal("Tractor agricola", asset.Name);
        Assert.Equal("Equipo de mantenimiento", asset.Description);
    }

    [Fact]
    public void Activate_WithInactiveAsset_SetsIsActiveToTrue()
    {
        var asset = CreateAsset();

        asset.Deactivate();

        Assert.False(asset.IsActive);

        asset.Activate();

        Assert.True(asset.IsActive);

        Assert.Equal("EQ-001", asset.Code);
        Assert.Equal("Tractor agricola", asset.Name);
    }

    [Fact]
    public void Deactivate_WhenAlreadyInactive_RemainsInactive()
    {
        var asset = CreateAsset();

        asset.Deactivate();
        asset.Deactivate();

        Assert.False(asset.IsActive);
        Assert.Equal("EQ-001", asset.Code);
    }

    [Fact]
    public void Activate_WhenAlreadyActive_RemainsActive()
    {
        var asset = CreateAsset();

        Assert.True(asset.IsActive);

        asset.Activate();
        asset.Activate();

        Assert.True(asset.IsActive);
        Assert.Equal("EQ-001", asset.Code);
    }

    private static Asset CreateAsset()
    {
        return new Asset(
            Guid.NewGuid(),
            "EQ-001",
            "Tractor agricola",
            "Equipo de mantenimiento");
    }
}
