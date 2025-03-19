# GPU Renting Protocol

## Goal

The goal of the **GPU Renting Protocol** is to provide a decentralized marketplace for renting high-performance GPU resources. This protocol enables users to lease GPUs on demand, optimizing resource utilization and cost efficiency for AI/ML training, rendering, and scientific computations. The protocol ensures fair pricing, secure transactions, and real-time availability of computing resources.

## Evaluation

Validators will assess the quality and reliability of GPU resources based on the following criteria:

- **Hardware Specifications Compliance**: Ensuring that the provided GPUs match the advertised specifications (e.g., GPU model, memory, processing power).
- **Uptime and Availability**: Monitoring the service uptime and availability to ensure continuous access for renters.
- **Performance Benchmarking**: Running standardized GPU tests (e.g., FLOPS calculations, CUDA operations) to validate performance claims.
- **Network Latency and Stability**: Measuring the time taken for GPU resources to respond to computational tasks.
- **User Ratings and Reviews**: Collecting feedback from renters on the performance and reliability of the GPUs.
- **Security and Isolation**: Ensuring that rented GPUs are securely isolated between different users.

Hard constraints for zero scoring:

- GPUs failing to meet declared specifications.
- Frequent downtime exceeding a threshold (e.g., below 95% uptime).
- Unstable network connections leading to computation failures.

## Actions

### `registerGPUOffer()`

- **Params**:

  - `gpuType` (string, required): Type of GPU (e.g., NVIDIA, AMD).
  - `gpuModel` (string, required): Specific model (e.g., RTX 3090, A100).
  - `gpuCount` (integer, required): Number of GPUs available for rent.
  - `gpuMemory` (integer, required): GPU memory in GB.
  - `pricePerHour` (float, required): Cost in USD per hour.
  - `region` (string, required): Geographic location of the GPU.
  - `features` (array, optional): Additional features such as CUDA support, Tensor cores, etc.

- **Returns**:

  - `offerId` (string): Unique identifier for the registered GPU offer.
  - `status` (string): Confirmation message for offer registration.

### `rentGPU()`

- **Params**:

  - `offerId` (string, required): Unique identifier of the GPU offer.
  - `duration` (integer, required): Rental duration in hours.
  - `userId` (string, required): ID of the renting user.

- **Returns**:

  - `rentalId` (string): Unique identifier for the rental transaction.
  - `status` (string): Confirmation message indicating the GPU is reserved.

### `terminateRental()`

- **Params**:
  - `rentalId` (string, required): Unique identifier of the rental transaction.
- **Returns**:
  - `status` (string): Confirmation message that rental has ended.
  - `billingAmount` (float): Total cost incurred based on rental duration.

## Performance Requirements

- Query response time must be within **5 seconds** for rental actions.
- GPU offers must be **searchable within 2 seconds**.
- Must handle **at least 100 rental transactions per minute**.
- GPUs should maintain a **minimum uptime of 95%** to stay listed.

## Example

### Registering a GPU Offer

#### Input

```json
{
  "gpuType": "NVIDIA",
  "gpuModel": "RTX 3090",
  "gpuCount": 2,
  "gpuMemory": 24,
  "pricePerHour": 3.5,
  "region": "US-East",
  "features": ["CUDA Support", "Tensor Cores"]
}
```

#### Output

```json
{
  "offerId": "gpu123456",
  "status": "GPU offer successfully registered"
}
```

### Renting a GPU

#### Input

```json
{
  "offerId": "gpu123456",
  "duration": 4,
  "userId": "user789"
}
```

#### Output

```json
{
  "rentalId": "rental98765",
  "status": "GPU rental confirmed"
}
```

### Terminating a Rental

#### Input

```json
{
  "rentalId": "rental98765"
}
```

#### Output

```json
{
  "status": "Rental terminated successfully",
  "billingAmount": 14.0
}
```

#### Input 

```json
{
  "gpuType": "RTX 3090",
  "gpuCount": 2,
  "duration": 6,
  "region": "US-West",
  "pricePerHour": 2.5,
  "framework": "PyTorch"
}
```

#### Output

````json
{
  "rentalId": "abc123xyz",
  "gpuDetails": {
    "gpuModel": "RTX 3090",
    "gpuMemory": 24
  },
  "status": "Running",
  "expiresAt": "2025-03-01T12:00:00Z"
}
````
