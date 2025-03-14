# GPU Compute  

## Goal

The goal of this protocol is to enable the launch of GPU virtual machines (VMs) for compute-intensive tasks. Providers can offer various GPU types, each with different performance characteristics and pricing.

## Evaluation

Providers will be evaluated based on:

✅ GPU VM Launch Speed: Time taken to launch a new GPU VM.
✅ GPU Performance: Benchmark performance of the GPU.
✅ Availability: Uptime and reliability of the GPU VM.

## Actions

### `launchGPUVM()`

- **Params**:
  - `GPU_type` (string): Type of GPU to be used (e.g., NVIDIA A100, NVIDIA V100).
  - `Cluster_size` (integer): Number of GPU VMs to launch in the cluster.
  - `ssh_pub_key` (string): SSH public key for accessing the VM.

- **Returns**:
  - **`gpu_vm_id`** (string): Unique identifier for the launched GPU VM.
  - **`vm_connection_string`** (string): Connection string to access the GPU VM.

## Example

### Input

- **GPU_type**: "NVIDIA A100"
- **Cluster_size**: 2
- **ssh_pub_key**: "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAr..."

### Output

```json
{
  "gpu_vm_id": "vm-12345",
  "vm_connection_string": "ssh user@vm-12345.compute.provider.com"
}
