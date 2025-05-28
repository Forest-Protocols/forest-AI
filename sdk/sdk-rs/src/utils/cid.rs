use cid::Cid;
use multibase::Base;
use multihash::{Code, MultihashDigest};
use serde::{Deserialize, Serialize};

use crate::errors::{ForestError, ForestResult};

/// Generates a CID (Content Identifier) for the given data
/// 
/// # Arguments
/// * `data` - The data to generate a CID for
/// 
/// # Returns
/// A `ForestResult` containing the generated CID as a string
pub fn generate_cid<T: Serialize>(data: &T) -> ForestResult<String> {
    // Serialize the data to JSON
    let json_data = serde_json::to_vec(data)
        .map_err(|e| ForestError::ValidationError(format!("Failed to serialize data: {}", e)))?;

    // Create a multihash using SHA2-256
    let hash = Code::Sha2_256.digest(&json_data);

    // Create a CID with version 1 and dag-cbor codec
    let cid = Cid::new_v1(0x71, hash)
        .map_err(|e| ForestError::ValidationError(format!("Failed to create CID: {}", e)))?;

    // Convert to base58 string
    Ok(cid.to_string())
}

/// Validates a CID string
/// 
/// # Arguments
/// * `cid_str` - The CID string to validate
/// 
/// # Returns
/// A `ForestResult` containing the parsed CID if valid
pub fn validate_cid(cid_str: &str) -> ForestResult<Cid> {
    Cid::try_from(cid_str)
        .map_err(|e| ForestError::ValidationError(format!("Invalid CID: {}", e)))
}

/// Decodes a CID string into its components
/// 
/// # Arguments
/// * `cid_str` - The CID string to decode
/// 
/// # Returns
/// A `ForestResult` containing the decoded components
pub fn decode_cid(cid_str: &str) -> ForestResult<CidComponents> {
    let cid = validate_cid(cid_str)?;
    
    Ok(CidComponents {
        version: cid.version(),
        codec: cid.codec(),
        hash: cid.hash().to_string(),
        multibase: cid.to_string_of_base(Base::Base58Btc)
            .map_err(|e| ForestError::ValidationError(format!("Failed to get base58 string: {}", e)))?,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CidComponents {
    pub version: u64,
    pub codec: u64,
    pub hash: String,
    pub multibase: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_generate_cid() {
        let data = json!({
            "name": "test",
            "value": 42
        });

        let cid = generate_cid(&data).unwrap();
        assert!(!cid.is_empty());
        assert!(cid.starts_with("bafy"));
    }

    #[test]
    fn test_validate_cid() {
        let data = json!({
            "name": "test",
            "value": 42
        });

        let cid_str = generate_cid(&data).unwrap();
        let cid = validate_cid(&cid_str).unwrap();
        assert_eq!(cid.version(), 1);
        assert_eq!(cid.codec(), 0x71);
    }

    #[test]
    fn test_decode_cid() {
        let data = json!({
            "name": "test",
            "value": 42
        });

        let cid_str = generate_cid(&data).unwrap();
        let components = decode_cid(&cid_str).unwrap();
        
        assert_eq!(components.version, 1);
        assert_eq!(components.codec, 0x71);
        assert!(!components.hash.is_empty());
        assert!(!components.multibase.is_empty());
    }
} 