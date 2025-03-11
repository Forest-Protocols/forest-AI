# Lilypad Serverless GPU Compute 

## Goal

The goal of this protocol is to enable the execution of serverless GPU compute jobs for various tasks, such as running open source AI model inference. Workload tempaltes are defined in  DockerFile and lilypad_module.json.tmpl files. 

## Evaluation

Providers will be evaluated based on:

✅ Execution Speed: Time taken to complete the compute job.
✅ Correctness: Accuracy and correctness of the output.
✅ Reliability: Consistency in job execution and result delivery.

## Actions

### `run()`

- **Params**:
  - `container_template` (string): The container template to be used for the job.
  - `env_vars` (array): An array of environment variables to be passed to the container.

- **Returns**:
  - **`result`** (string): The output of the compute job.

## Performance Requirements
 
- **Rate Limits**:
  - Minimum of 100 requests per minute.
  - At least 200 API calls per subscription per month.

## Constraints

- **Execution Accuracy**:
  - The output must be accurate and relevant to the input prompt.
- **Environment Configuration**:
  - Environment variables must be correctly passed and utilized by the container.
- **Resource Management**:
  - Efficient use of GPU resources to ensure optimal performance.

## Example

### Input

- **container_template**: "github.com/noryev/module-llama2:6d4fd8c07b5f64907bd22624603c2dd54165c215"
- **env_vars**: ['PROMPT="what is a giant sand trout on arrakis?"']

### Output

```json
{
  "result": "A giant sand trout on Arrakis is a larval form of the sandworm, known for its role in the production of the spice melange."
}
```
