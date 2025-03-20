use std::sync::Arc;
use ethers::{
    providers::{Provider, Ws, Http},
    types::{BlockNumber, Filter, Log, Transaction, TransactionReceipt, H256, U256},
    utils::format_units,
};
use jsonrpc_core::{IoHandler, Result};
use jsonrpc_ws_server::ServerBuilder;
use tokio::sync::mpsc;
use serde::{Deserialize, Serialize};
use crate::errors::{ForestError, ForestResult};

#[derive(Debug, Clone)]
pub struct BlockchainRpc {
    provider: Arc<Provider<Http>>,
    ws_provider: Option<Arc<Provider<Ws>>>,
    handler: Arc<IoHandler>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RpcConfig {
    pub http_url: String,
    pub ws_url: Option<String>,
    pub chain_id: u64,
}

impl BlockchainRpc {
    pub async fn new(config: RpcConfig) -> ForestResult<Self> {
        let http_provider = Provider::<Http>::try_from(&config.http_url)
            .map_err(|e| ForestError::ConfigurationError(format!("Failed to create HTTP provider: {}", e)))?;
        
        let ws_provider = if let Some(ws_url) = config.ws_url {
            Some(Provider::<Ws>::connect(&ws_url)
                .await
                .map_err(|e| ForestError::ConfigurationError(format!("Failed to create WS provider: {}", e)))?)
        } else {
            None
        };

        let handler = IoHandler::new();
        let handler = Arc::new(handler);

        Ok(Self {
            provider: Arc::new(http_provider),
            ws_provider: ws_provider.map(Arc::new),
            handler,
        })
    }

    pub async fn get_block_number(&self) -> ForestResult<u64> {
        self.provider
            .get_block_number()
            .await
            .map_err(|e| ForestError::NetworkError(format!("Failed to get block number: {}", e)))
            .map(|n| n.as_u64())
    }

    pub async fn get_balance(&self, address: &str) -> ForestResult<String> {
        let address = address.parse()
            .map_err(|e| ForestError::ValidationError(format!("Invalid address: {}", e)))?;
        
        let balance = self.provider
            .get_balance(address, None)
            .await
            .map_err(|e| ForestError::NetworkError(format!("Failed to get balance: {}", e)))?;

        Ok(format_units(balance, 18)
            .map_err(|e| ForestError::ValidationError(format!("Failed to format balance: {}", e)))?)
    }

    pub async fn get_transaction(&self, hash: &str) -> ForestResult<Transaction> {
        let hash = H256::from_str(hash)
            .map_err(|e| ForestError::ValidationError(format!("Invalid transaction hash: {}", e)))?;
        
        self.provider
            .get_transaction(hash)
            .await
            .map_err(|e| ForestError::NetworkError(format!("Failed to get transaction: {}", e)))?
            .ok_or_else(|| ForestError::NotFoundError("Transaction not found".to_string()))
    }

    pub async fn get_transaction_receipt(&self, hash: &str) -> ForestResult<TransactionReceipt> {
        let hash = H256::from_str(hash)
            .map_err(|e| ForestError::ValidationError(format!("Invalid transaction hash: {}", e)))?;
        
        self.provider
            .get_transaction_receipt(hash)
            .await
            .map_err(|e| ForestError::NetworkError(format!("Failed to get transaction receipt: {}", e)))?
            .ok_or_else(|| ForestError::NotFoundError("Transaction receipt not found".to_string()))
    }

    pub async fn get_logs(&self, filter: Filter) -> ForestResult<Vec<Log>> {
        self.provider
            .get_logs(&filter)
            .await
            .map_err(|e| ForestError::NetworkError(format!("Failed to get logs: {}", e)))
    }

    pub async fn subscribe_new_blocks(&self) -> ForestResult<mpsc::Receiver<u64>> {
        let (tx, rx) = mpsc::channel(100);
        
        if let Some(ws_provider) = &self.ws_provider {
            let handler = self.handler.clone();
            let tx = tx.clone();
            
            handler.add_method("eth_subscribe", move |params: Vec<String>| {
                if params[0] == "newHeads" {
                    // Handle new block subscription
                    Ok(jsonrpc_core::Value::String("subscription_id".to_string()))
                } else {
                    Err(jsonrpc_core::Error::invalid_params("Invalid subscription type"))
                }
            });

            // Start WebSocket server
            let server = ServerBuilder::new(handler)
                .start(&"127.0.0.1:3030".parse().unwrap())
                .expect("Unable to start RPC server");

            // Spawn background task to handle WebSocket messages
            tokio::spawn(async move {
                while let Some(block_number) = ws_provider
                    .watch_blocks()
                    .await
                    .map_err(|e| eprintln!("Error watching blocks: {}", e))
                    .ok()
                {
                    if tx.send(block_number.as_u64()).await.is_err() {
                        break;
                    }
                }
            });
        }

        Ok(rx)
    }

    pub async fn estimate_gas(&self, from: &str, to: &str, value: U256) -> ForestResult<u64> {
        let from = from.parse()
            .map_err(|e| ForestError::ValidationError(format!("Invalid from address: {}", e)))?;
        let to = to.parse()
            .map_err(|e| ForestError::ValidationError(format!("Invalid to address: {}", e)))?;

        self.provider
            .estimate_gas(from, to, value)
            .await
            .map_err(|e| ForestError::NetworkError(format!("Failed to estimate gas: {}", e)))
            .map(|g| g.as_u64())
    }

    pub async fn get_gas_price(&self) -> ForestResult<String> {
        self.provider
            .get_gas_price()
            .await
            .map_err(|e| ForestError::NetworkError(format!("Failed to get gas price: {}", e)))
            .map(|p| format_units(p, 9)
                .map_err(|e| ForestError::ValidationError(format!("Failed to format gas price: {}", e)))?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_blockchain_rpc_creation() {
        let config = RpcConfig {
            http_url: "http://localhost:8545".to_string(),
            ws_url: Some("ws://localhost:8546".to_string()),
            chain_id: 1,
        };

        let rpc = BlockchainRpc::new(config).await;
        assert!(rpc.is_ok());
    }
} 