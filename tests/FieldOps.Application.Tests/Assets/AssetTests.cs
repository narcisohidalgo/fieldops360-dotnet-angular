using FieldOps.Domain.Entities;

namespace FieldOps.Application.Tests.Assets;

public sealed class AssetTests
{
    [Fact]
    public void Constructor_WithValidData_CreatesActiveAsset()
    {
        var facilityId = Guid.NewGuid();

        var asset = new Asset(
            facilityId,
            "  EQ-001  ",
            "  Tractor agrícola  ",
            "  Equipo de mantenimiento  ");

        Assert.NotEqual(Guid.Empty, asset.Id);
        Assert.Equal(facilityId, asset.FacilityId);
        Assert.Equal("EQ-001", asset.Code);
        Assert.Equal("Tractor agrícola", asset.Name);
        Assert.Equal("Equipo de mantenimiento", asset.Description);
        Assert.True(asset.IsActive);
    }

    [Fact]
    public void Constructor_WithEmptyFacilityId_ThrowsArgumentException()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Asset(
                Guid.Empty,
                "EQ-001",
                "Tractor agrícola"));

        Assert.Equal("facilityId", exception.ParamName);
    }

    [Theory]
    [InlineData("   ", "Tractor agrícola", "code")]
    [InlineData("EQ-001", "   ", "name")]
    public void Constructor_WithBlankRequiredField_ThrowsArgumentException(
        string code,
        string name,
        string expectedParameter)
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Asset(Guid.NewGuid(), code, name));

        Assert.Equal(expectedParameter, exception.ParamName);
    }

    [Fact]
    public void Constructor_WithCodeTooLong_ThrowsArgumentException()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Asset(
                Guid.NewGuid(),
                new string('X', 51),
                "Tractor agrícola"));

        Assert.Equal("code", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithNameTooLong_ThrowsArgumentException()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Asset(
                Guid.NewGuid(),
                "EQ-001",
                new string('X', 151)));

        Assert.Equal("name", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithDescriptionTooLong_ThrowsArgumentException()
    {
        var exception = Assert.Throws<ArgumentException>(
            () => new Asset(
                Guid.NewGuid(),
                "EQ-001",
                "Tractor agrícola",
                new string('X', 501)));

        Assert.Equal("description", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithBlankDescription_StoresNull()
    {
        var asset = new Asset(
            Guid.NewGuid(),
            "EQ-001",
            "Tractor agrícola",
            "   ");

        Assert.Null(asset.Description);
    }
}
