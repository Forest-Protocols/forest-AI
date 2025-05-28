use std::collections::HashSet;
use std::sync::Arc;
use std::future::Future;
use std::pin::Pin;
use axum::{
    extract::{State, Path},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use secp256k1::{PublicKey, SecretKey};
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;

use crate::{
    errors::{ForestError, ForestResult},
    pipe::{Pipe, Pipeline},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    pub sub: String,  // Subject (public key)
    pub exp: i64,     // Expiration time
    pub iat: i64,     // Issued at
}

#[derive(Debug, Clone)]
pub struct RestPipeConfig {
    pub port: u16,
    pub allowed_keys: HashSet<String>,
    pub allow_all: bool,
}

#[derive(Debug, Clone)]
pub struct RestPipe {
    config: RestPipeConfig,
    allowed_keys: Arc<RwLock<HashSet<String>>>,
}

impl RestPipe {
    pub fn new(config: RestPipeConfig) -> Self {
        Self {
            allowed_keys: Arc::new(RwLock::new(config.allowed_keys)),
            config,
        }
    }

    pub async fn start(&self) -> ForestResult<()> {
        let app = Router::new()
            .route("/health", get(health_check))
            .route("/message/:recipient", post(send_message))
            .layer(TraceLayer::new_for_http())
            .with_state(self.clone());

        let addr = format!("0.0.0.0:{}", self.config.port).parse()
            .map_err(|e| ForestError::ConfigurationError(format!("Invalid port: {}", e)))?;

        axum::Server::bind(&addr)
            .serve(app.into_make_service())
            .await
            .map_err(|e| ForestError::ConfigurationError(format!("Failed to start server: {}", e)))?;

        Ok(())
    }

    pub async fn add_allowed_key(&self, public_key: String) {
        let mut keys = self.allowed_keys.write().await;
        keys.insert(public_key);
    }

    pub async fn remove_allowed_key(&self, public_key: &str) {
        let mut keys = self.allowed_keys.write().await;
        keys.remove(public_key);
    }

    async fn verify_jwt(&self, token: &str) -> ForestResult<JwtClaims> {
        let validation = Validation::new(Algorithm::ES256K);
        let token_data = decode::<JwtClaims>(
            token,
            &DecodingKey::from_ec_pem(b"YOUR_PUBLIC_KEY_PEM").unwrap(),
            &validation,
        )
        .map_err(|e| ForestError::AuthenticationError(format!("Invalid JWT: {}", e)))?;

        Ok(token_data.claims)
    }

    async fn verify_sender(&self, public_key: &str) -> ForestResult<()> {
        if self.config.allow_all {
            return Ok(());
        }

        let keys = self.allowed_keys.read().await;
        if !keys.contains(public_key) {
            return Err(ForestError::AuthenticationError(
                "Sender's public key is not in the allowed list".to_string(),
            ));
        }

        Ok(())
    }
}

impl Pipe<String> for RestPipe {
    fn process(&self, input: String) -> Pin<Box<dyn Future<Output = ForestResult<String>> + Send>> {
        let pipe = self.clone();
        Box::pin(async move {
            // In a real implementation, this would send the message through the REST API
            // For now, we'll just return the input as is
            Ok(input)
        })
    }
}

async fn health_check() -> impl IntoResponse {
    StatusCode::OK
}

async fn send_message(
    State(pipe): State<RestPipe>,
    Path(recipient): Path<String>,
    headers: HeaderMap,
    body: String,
) -> impl IntoResponse {
    // Extract and verify JWT
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                "Missing or invalid Authorization header".to_string(),
            )
        })?;

    let claims = pipe
        .verify_jwt(auth_header)
        .await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e.to_string()))?;

    // Verify sender
    pipe.verify_sender(&claims.sub)
        .await
        .map_err(|e| (StatusCode::FORBIDDEN, e.to_string()))?;

    // Process message
    // TODO: Implement message processing logic

    Ok((StatusCode::OK, "Message sent successfully".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[tokio::test]
    async fn test_jwt_verification() {
        let config = RestPipeConfig {
            port: 3000,
            allowed_keys: HashSet::new(),
            allow_all: true,
        };

        let pipe = RestPipe::new(config);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let claims = JwtClaims {
            sub: "test_public_key".to_string(),
            exp: now + 3600,
            iat: now,
        };

        let token = encode(
            &Header::new(Algorithm::ES256K),
            &claims,
            &EncodingKey::from_ec_pem(b"YOUR_PRIVATE_KEY_PEM").unwrap(),
        )
        .unwrap();

        let verified_claims = pipe.verify_jwt(&token).await;
        assert!(verified_claims.is_ok());
    }

    #[tokio::test]
    async fn test_rest_pipe_in_pipeline() {
        let config = RestPipeConfig {
            port: 3000,
            allowed_keys: HashSet::new(),
            allow_all: true,
        };

        let mut pipeline = Pipeline::new();
        pipeline.add_pipe(RestPipe::new(config));

        let result = pipeline.execute("test message".to_string()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test message");
    }
} 