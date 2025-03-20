# Forest Protocols SDK - Rust

This is the Rust implementation of the Forest Protocols SDK, providing a type-safe and efficient way to interact with the Forest Protocols API.

## Features

- Type-safe API interactions
- Async/await support
- Comprehensive error handling
- Rate limiting and retry mechanisms
- Input validation
- Data transformation pipelines
- Blockchain transaction handling
- Webhook support

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
forest-sdk-rs = "0.1.0"
```

## Quick Start

```rust
use forest_sdk_rs::{
    types::ForestConfig,
    ForestClient,
    blockchain::BlockchainClient,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize the client
    let config = ForestConfig {
        api_key: "your_api_key".to_string(),
        base_url: "https://api.forestprotocols.com".to_string(),
        timeout: None,
    };

    let client = ForestClient::new(config)?;
    let blockchain_client = BlockchainClient::new(client);

    // Send a transaction
    let transaction = blockchain_client
        .send_transaction(&TransactionRequest {
            to: "0x...".to_string(),
            value: "1000000000000000000".to_string(), // 1 ETH
            data: None,
            gas_limit: None,
            gas_price: None,
            max_fee_per_gas: None,
            max_priority_fee_per_gas: None,
            nonce: None,
        })
        .await?;

    println!("Transaction sent: {:?}", transaction);
    Ok(())
}
```

## Examples

### Using Validation

```rust
use forest_sdk_rs::validation::{StringValidator, NumberValidator};

let string_validator = StringValidator::new()
    .with_min_length(3)
    .with_max_length(10)
    .with_pattern(r"^[a-z]+$");

let number_validator = NumberValidator::new()
    .with_min(0)
    .with_max(100);

string_validator.validate(&"abc".to_string())?;
number_validator.validate(&50)?;
```

### Using Pipelines

```rust
use forest_sdk_rs::pipe::{Pipeline, ValidationPipe, TransformPipe};

let mut pipeline = Pipeline::new();

// Add validation
pipeline.add_pipe(ValidationPipe::new(|x: &i32| {
    if *x > 0 {
        Ok(())
    } else {
        Err(ForestError::ValidationError("Value must be positive".to_string()))
    }
}));

// Add transformation
pipeline.add_pipe(TransformPipe::new(|x: i32| Ok(x.to_string())));

let result = pipeline.execute(42).await?;
```

### Rate Limiting

```rust
use forest_sdk_rs::utils::RateLimiter;

let mut limiter = RateLimiter::new(2); // 2 requests per second

for _ in 0..3 {
    limiter.wait_if_needed().await;
    // Make API request
}
```

## API Documentation

### ForestClient

The main client for interacting with the Forest Protocols API.

```rust
impl ForestClient {
    pub fn new(config: ForestConfig) -> ForestResult<Self>
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> ForestResult<T>
    pub async fn post<T: DeserializeOwned, B: Serialize>(&self, path: &str, body: &B) -> ForestResult<T>
    pub async fn put<T: DeserializeOwned, B: Serialize>(&self, path: &str, body: &B) -> ForestResult<T>
    pub async fn delete<T: DeserializeOwned>(&self, path: &str) -> ForestResult<T>
}
```

### BlockchainClient

Client for blockchain-specific operations.

```rust
impl BlockchainClient {
    pub fn new(client: ForestClient) -> Self
    pub async fn send_transaction(&self, request: &TransactionRequest) -> ForestResult<TransactionResponse>
    pub async fn get_transaction(&self, hash: &str) -> ForestResult<TransactionResponse>
    pub async fn get_transactions(&self, params: Option<HashMap<String, String>>) -> ForestResult<PaginatedResponse<Transaction>>
    pub async fn get_transaction_receipt(&self, hash: &str) -> ForestResult<TransactionReceipt>
    pub async fn get_transaction_logs(&self, hash: &str) -> ForestResult<Vec<Log>>
    pub async fn estimate_gas(&self, request: &TransactionRequest) -> ForestResult<u64>
    pub async fn get_gas_price(&self) -> ForestResult<String>
}
```

## Error Handling

The SDK uses custom error types for better error handling:

```rust
#[derive(Error, Debug)]
pub enum ForestError {
    #[error("Authentication error: {0}")]
    AuthenticationError(String),
    #[error("Rate limit exceeded: {0}")]
    RateLimitError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
    // ...
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 