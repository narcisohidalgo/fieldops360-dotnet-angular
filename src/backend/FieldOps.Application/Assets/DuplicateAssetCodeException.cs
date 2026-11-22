namespace FieldOps.Application.Assets;

public sealed class DuplicateAssetCodeException : Exception
{
    public DuplicateAssetCodeException(
        Guid facilityId,
        string code,
        Exception? innerException = null)
        : base(
            $"An asset with code '{code}' already exists " +
            $"in facility '{facilityId}'.",
            innerException)
    {
    }
}
