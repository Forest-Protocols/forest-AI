use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{
    errors::{ForestError, ForestResult},
    types::{ForestClient, PaginatedResponse},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub hash: String,
    pub from: String,
    pub to: String,
    pub value: String,
    pub data: Option<String>,
    pub nonce: u64,
    pub gas_limit: u64,
    pub gas_price: String,
    pub max_fee_per_gas: Option<String>,
    pub max_priority_fee_per_gas: Option<String>,
    pub chain_id: u64,
    pub status: TransactionStatus,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionStatus {
    Pending,
    Confirmed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRequest {
    pub to: String,
    pub value: String,
    pub data: Option<String>,
    pub gas_limit: Option<u64>,
    pub gas_price: Option<String>,
    pub max_fee_per_gas: Option<String>,
    pub max_priority_fee_per_gas: Option<String>,
    pub nonce: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResponse {
    pub transaction: Transaction,
    pub receipt: Option<TransactionReceipt>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionReceipt {
    pub transaction_hash: String,
    pub block_number: u64,
    pub block_hash: String,
    pub gas_used: u64,
    pub effective_gas_price: String,
    pub status: bool,
    pub logs: Vec<Log>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Log {
    pub address: String,
    pub topics: Vec<String>,
    pub data: String,
    pub block_number: u64,
    pub transaction_hash: String,
    pub log_index: u64,
    pub block_hash: String,
    pub transaction_index: u64,
}

pub struct BlockchainClient {
    client: ForestClient,
}

impl BlockchainClient {
    pub fn new(client: ForestClient) -> Self {
        Self { client }
    }

    pub async fn send_transaction(
        &self,
        request: &TransactionRequest,
    ) -> ForestResult<TransactionResponse> {
        self.client
            .post("/v1/transactions", request)
            .await
    }

    pub async fn get_transaction(&self, hash: &str) -> ForestResult<TransactionResponse> {
        self.client
            .get(&format!("/v1/transactions/{}", hash))
            .await
    }

    pub async fn get_transactions(
        &self,
        params: Option<HashMap<String, String>>,
    ) -> ForestResult<PaginatedResponse<Transaction>> {
        let path = if let Some(params) = params {
            let query_string: String = params
                .iter()
                .map(|(k, v)| format!("{}={}", k, v))
                .collect::<Vec<_>>()
                .join("&");
            format!("/v1/transactions?{}", query_string)
        } else {
            "/v1/transactions".to_string()
        };

        self.client.get(&path).await
    }

    pub async fn get_transaction_receipt(&self, hash: &str) -> ForestResult<TransactionReceipt> {
        self.client
            .get(&format!("/v1/transactions/{}/receipt", hash))
            .await
    }

    pub async fn get_transaction_logs(
        &self,
        hash: &str,
    ) -> ForestResult<Vec<Log>> {
        self.client
            .get(&format!("/v1/transactions/{}/logs", hash))
            .await
    }

    pub async fn estimate_gas(&self, request: &TransactionRequest) -> ForestResult<u64> {
        #[derive(Deserialize)]
        struct GasEstimate {
            gas_limit: u64,
        }

        let response: GasEstimate = self.client
            .post("/v1/transactions/estimate-gas", request)
            .await?;

        Ok(response.gas_limit)
    }

    pub async fn get_gas_price(&self) -> ForestResult<String> {
        #[derive(Deserialize)]
        struct GasPrice {
            gas_price: String,
        }

        let response: GasPrice = self.client
            .get("/v1/transactions/gas-price")
            .await?;

        Ok(response.gas_price)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::DEFAULT_BASE_URL;

    #[tokio::test]
    async fn test_blockchain_client_creation() {
        let config = crate::types::ForestConfig {
            api_key: "test_key".to_string(),
            base_url: DEFAULT_BASE_URL.to_string(),
            timeout: None,
        };

        let client = ForestClient::new(config).unwrap();
        let blockchain_client = BlockchainClient::new(client);
        assert!(blockchain_client.client.config.api_key == "test_key");
    }
} 