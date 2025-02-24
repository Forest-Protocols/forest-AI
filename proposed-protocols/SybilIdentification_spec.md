# Sybil Account Identification

## Goal

Given a set of blockchain addresses on an EVM-compatible chain, the model should identify clusters of addresses likely controlled by the same entity (Sybil accounts). The goal is to maximize accuracy in detecting coordinated account behavior while minimizing false positives that could unfairly flag legitimate users.

## Evaluation

Results will be evaluated based on:

- Precision in identifying Sybil clusters (minimize false positives)
- Recall of known Sybil patterns (minimize false negatives)
- Explainability of cluster identification
- Processing speed for large address sets

Additional automated scoring criteria:
- Graph connectivity metrics for identified clusters
- Behavioral similarity scores within clusters
- Temporal pattern consistency
- Transaction volume and value distribution analysis

## Actions

### `analyzeSybilClusters()`
- **Params**:
  - `addresses` (array): List of blockchain addresses to analyze
  - `networkContext` (string): Blockchain network identifier (e.g., "ethereum", "arbitrum")
  - `analysisConfig` (object, optional):
    - `minClusterSize` (integer): Minimum number of addresses to form a cluster
    - `timeWindow` (integer): Analysis window in days
    - `similarityThreshold` (float): Threshold for behavioral similarity (0.0-1.0)

- **Returns**:
  - `clusters`: Array of identified Sybil clusters
    - Each cluster contains:
      - `addresses` (array): List of addresses in the cluster
      - `confidence` (float): Confidence score for the cluster (0.0-1.0)
      - `pattern` (string): Identified pattern type ("star", "chain", "tree")
      - `evidence` (object): Supporting metrics and patterns found
  - `metadata`: Analysis statistics and parameters used

### `validateAddress()`
- **Params**:
  - `address` (string): Single address to check
  - `networkContext` (string): Blockchain network identifier (e.g., "ethereum", "arbitrum")
  - `analysisConfig` (object, optional):
    - `timeWindow` (integer): Analysis window in days
    - `similarityThreshold` (float): Threshold for behavioral similarity (0.0-1.0)
- **Returns**:
  - `result`: Assessment object with Sybil risk score and explanation
    - `confidence` (float): Confidence score for the cluster (0.0-1.0)
    - `pattern` (string): Identified pattern type ("star", "chain", "tree")
    - `evidence` (object): Supporting metrics and patterns found

## Performance Requirements
- Process up to 100,000 addresses within 5 minutes
- Support real-time validation of individual addresses (<1s response)
- Handle at least 100 API calls per hour
- Maximum memory usage of 16GB for large cluster analysis

## Constraints
- Must preserve privacy by not requiring off-chain identity information
- Analysis must be deterministic - same input data should produce same results
- False positive rate must remain below 3%
- Must provide evidence/justification for all identified clusters

## Example

Input:
~~~~~~~
{
  "addresses": ["0x1234...", "0x5678...", ...],
  "networkContext": "arbitrum"
}
~~~~~~~

Output:
~~~~~~~
{
  "clusters": [
    {
      "addresses": ["0x1234...", "0x5678...", "0x9abc..."],
      "confidence": 0.95,
      "pattern": "star",
      "evidence": {
        "fundingSource": "0xdeff...",
        "behavioralSimilarity": 0.98,
        "temporalAlignment": 0.92,
        "transactionPattern": "sequential-funding"
      }
    },
    ...
  ],
  "metadata": {
    "addressesAnalyzed": 1000,
    "clustersFound": 3,
    "analysisTimeMs": 1200
  }
} 
~~~~~~~
