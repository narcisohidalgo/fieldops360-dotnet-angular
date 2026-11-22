using FieldOps.Domain.Entities;

namespace FieldOps.Application.Tests.Assets;

public sealed class AssetUpdateTests
{
    [Fact]
    public void UpdateDetails_WithValidData_UpdatesNameAndDescription()
    {
        var facilityId = Guid.NewGuid();

        var asset = new Asset(
            facilityId,
            "EQ-001",
            "Tractor original",
            "Descripcion original");

        var originalId = asset.Id;

        asset.UpdateDetails(
            "  Tractor actualizado  ",
            "  Equipo de mantenimiento  ");

        Assert.Equal("Tractor actualizado", asset.Name);
        Assert.Equal("Equipo de mantenimiento", asset.Description);

        Assert.Equal(originalId, asset.Id);
        Assert.Equal(facilityId, asset.FacilityId);
        Assert.Equal("EQ-001", asset.Code);
        Assert.True(asset.IsActive);
    }

    [Fact]
    public void UpdateDetails_WithBlankName_ThrowsAndPreservesData()
    {
        var asset = CreateAsset();

        var exception = Assert.Throws<ArgumentException>(
            () => asset.UpdateDetails(
                "   ",
                "Nueva descripcion"));

        Assert.Equal("name", exception.ParamName);
        Assert.Equal("Tractor original", asset.Name);
        Assert.Equal("Descripcion original", asset.Description);
    }

    [Fact]
    public void UpdateDetails_WithNameTooLong_ThrowsArgumentException()
    {
        var asset = CreateAsset();

        var exception = Assert.Throws<ArgumentException>(
            () => asset.UpdateDetails(
                new string('X', 151),
                "Nueva descripcion"));

        Assert.Equal("name", exception.ParamName);
        Assert.Equal("Tractor original", asset.Name);
        Assert.Equal("Descripcion original", asset.Description);
    }

    [Fact]
    public void UpdateDetails_WithDescriptionTooLong_PreservesData()
    {
        var asset = CreateAsset();

        var exception = Assert.Throws<ArgumentException>(
            () => asset.UpdateDetails(
                "Tractor actualizado",
                new string('X', 501)));

        Assert.Equal("description", exception.ParamName);
        Assert.Equal("Tractor original", asset.Name);
        Assert.Equal("Descripcion original", asset.Description);
    }

    [Fact]
    public void UpdateDetails_WithBlankDescription_StoresNull()
    {
        var asset = CreateAsset();

        asset.UpdateDetails(
            "Tractor actualizado",
            "   ");

        Assert.Equal("Tractor actualizado", asset.Name);
        Assert.Null(asset.Description);
    }

    private static Asset CreateAsset()
    {
        return new Asset(
            Guid.NewGuid(),
            "EQ-001",
            "Tractor original",
            "Descripcion original");
    }
}
