using Xunit;

// Integration tests share a local SQL Server instance.
// Run test collections sequentially to avoid resource contention.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
