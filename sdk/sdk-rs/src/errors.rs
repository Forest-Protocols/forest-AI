use thiserror::Error;

#[derive(Error, Debug)]
pub enum ForestError {
    #[error("Authentication error: {0}")]
    AuthenticationError(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimitError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Resource not found: {0}")]
    NotFoundError(String),

    #[error("Server error: {0}")]
    ServerError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("Webhook error: {0}")]
    WebhookError(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl From<reqwest::Error> for ForestError {
    fn from(error: reqwest::Error) -> Self {
        if error.is_timeout() {
            ForestError::NetworkError("Request timeout".to_string())
        } else if error.is_connect() {
            ForestError::NetworkError("Connection error".to_string())
        } else {
            ForestError::NetworkError(error.to_string())
        }
    }
}

impl From<serde_json::Error> for ForestError {
    fn from(error: serde_json::Error) -> Self {
        ForestError::InvalidResponse(format!("JSON parsing error: {}", error))
    }
}

impl From<std::io::Error> for ForestError {
    fn from(error: std::io::Error) -> Self {
        ForestError::NetworkError(format!("IO error: {}", error))
    }
}

pub type ForestResult<T> = Result<T, ForestError>; 