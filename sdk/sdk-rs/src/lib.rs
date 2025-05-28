mod blockchain;
mod constants;
mod errors;
mod pipe;
mod types;
mod utils;
mod validation;

use std::time::Duration;

use reqwest::Client;
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::{
    constants::{DEFAULT_BASE_URL, DEFAULT_TIMEOUT},
    errors::{ForestError, ForestResult},
    types::{ForestConfig, ForestResponse, PaginatedResponse},
};

pub use crate::{
    blockchain::BlockchainClient,
    errors::ForestError,
    types::{ForestConfig, ForestResponse, PaginatedResponse},
};

pub struct ForestClient {
    client: Client,
    config: ForestConfig,
}

impl ForestClient {
    pub fn new(config: ForestConfig) -> ForestResult<Self> {
        let client = Client::builder()
            .timeout(Duration::from_millis(config.timeout.unwrap_or(DEFAULT_TIMEOUT)))
            .build()
            .map_err(|e| ForestError::ConfigurationError(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self { client, config })
    }

    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> ForestResult<T> {
        let url = format!("{}/{}", self.config.base_url, path.trim_start_matches('/'));
        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .send()
            .await?;

        self.handle_response(response).await
    }

    pub async fn post<T: DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> ForestResult<T> {
        let url = format!("{}/{}", self.config.base_url, path.trim_start_matches('/'));
        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(body)
            .send()
            .await?;

        self.handle_response(response).await
    }

    pub async fn put<T: DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> ForestResult<T> {
        let url = format!("{}/{}", self.config.base_url, path.trim_start_matches('/'));
        let response = self
            .client
            .put(&url)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(body)
            .send()
            .await?;

        self.handle_response(response).await
    }

    pub async fn delete<T: DeserializeOwned>(&self, path: &str) -> ForestResult<T> {
        let url = format!("{}/{}", self.config.base_url, path.trim_start_matches('/'));
        let response = self
            .client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .send()
            .await?;

        self.handle_response(response).await
    }

    async fn handle_response<T: DeserializeOwned>(
        &self,
        response: reqwest::Response,
    ) -> ForestResult<T> {
        let status = response.status();
        let headers = response.headers().clone();
        let body = response.text().await?;

        // Check for rate limiting
        if let Some(limit) = headers.get("X-RateLimit-Limit") {
            if let Some(remaining) = headers.get("X-RateLimit-Remaining") {
                if remaining.to_str().unwrap_or("0").parse::<u32>().unwrap_or(0) == 0 {
                    return Err(ForestError::RateLimitError("Rate limit exceeded".to_string()));
                }
            }
        }

        // Parse response body
        let value: Value = serde_json::from_str(&body)?;

        // Handle error responses
        if !status.is_success() {
            let error_message = value
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Unknown error");
            return Err(match status {
                reqwest::StatusCode::UNAUTHORIZED => ForestError::AuthenticationError(error_message.to_string()),
                reqwest::StatusCode::FORBIDDEN => ForestError::AuthenticationError(error_message.to_string()),
                reqwest::StatusCode::NOT_FOUND => ForestError::NotFoundError(error_message.to_string()),
                reqwest::StatusCode::TOO_MANY_REQUESTS => ForestError::RateLimitError(error_message.to_string()),
                _ => ForestError::ServerError(error_message.to_string()),
            });
        }

        // Parse successful response
        let response: ForestResponse<T> = serde_json::from_value(value)?;
        Ok(response.data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_creation() {
        let config = ForestConfig {
            api_key: "test_key".to_string(),
            base_url: DEFAULT_BASE_URL.to_string(),
            timeout: Some(DEFAULT_TIMEOUT),
        };

        let client = ForestClient::new(config).unwrap();
        assert_eq!(client.config.api_key, "test_key");
    }
} 