use std::time::{Duration, Instant};
use tokio::time::sleep;

use crate::errors::{ForestError, ForestResult};

pub mod cid;

pub use cid::{generate_cid, validate_cid, decode_cid, CidComponents};

pub async fn retry_with_backoff<F, Fut, T>(
    f: F,
    max_attempts: u32,
    initial_delay: Duration,
    max_delay: Duration,
) -> ForestResult<T>
where
    F: Fn() -> Fut,
    Fut: Future<Output = ForestResult<T>>,
{
    let mut attempt = 0;
    let mut delay = initial_delay;

    loop {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                attempt += 1;
                if attempt >= max_attempts {
                    return Err(e);
                }

                sleep(delay).await;
                delay = min(delay * 2, max_delay);
            }
        }
    }
}

pub fn min<T: Ord>(a: T, b: T) -> T {
    if a <= b {
        a
    } else {
        b
    }
}

pub fn format_hex_string(s: &str) -> String {
    if s.starts_with("0x") {
        s.to_string()
    } else {
        format!("0x{}", s)
    }
}

pub fn parse_hex_string(s: &str) -> ForestResult<String> {
    let s = s.trim_start_matches("0x");
    if s.chars().all(|c| c.is_ascii_hexdigit()) {
        Ok(s.to_string())
    } else {
        Err(ForestError::ValidationError("Invalid hex string".to_string()))
    }
}

pub fn format_wei_to_eth(wei: &str) -> ForestResult<String> {
    let wei = wei.parse::<u128>().map_err(|_| {
        ForestError::ValidationError("Invalid wei value".to_string())
    })?;
    Ok(format!("{:.18}", wei as f64 / 1e18))
}

pub fn format_eth_to_wei(eth: &str) -> ForestResult<String> {
    let eth = eth.parse::<f64>().map_err(|_| {
        ForestError::ValidationError("Invalid ETH value".to_string())
    })?;
    Ok(format!("{}", (eth * 1e18) as u128))
}

pub struct RateLimiter {
    requests_per_second: u32,
    last_request: Instant,
}

impl RateLimiter {
    pub fn new(requests_per_second: u32) -> Self {
        Self {
            requests_per_second,
            last_request: Instant::now(),
        }
    }

    pub async fn wait_if_needed(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_request);
        let min_interval = Duration::from_secs(1) / self.requests_per_second;

        if elapsed < min_interval {
            sleep(min_interval - elapsed).await;
        }

        self.last_request = Instant::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_hex_string() {
        assert_eq!(format_hex_string("123"), "0x123");
        assert_eq!(format_hex_string("0x123"), "0x123");
    }

    #[test]
    fn test_parse_hex_string() {
        assert!(parse_hex_string("123").is_ok());
        assert!(parse_hex_string("0x123").is_ok());
        assert!(parse_hex_string("xyz").is_err());
    }

    #[test]
    fn test_format_wei_to_eth() {
        assert_eq!(format_wei_to_eth("1000000000000000000").unwrap(), "1.000000000000000000");
        assert!(format_wei_to_eth("invalid").is_err());
    }

    #[test]
    fn test_format_eth_to_wei() {
        assert_eq!(format_eth_to_wei("1.0").unwrap(), "1000000000000000000");
        assert!(format_eth_to_wei("invalid").is_err());
    }

    #[tokio::test]
    async fn test_rate_limiter() {
        let mut limiter = RateLimiter::new(2);
        let start = Instant::now();

        limiter.wait_if_needed().await;
        limiter.wait_if_needed().await;
        limiter.wait_if_needed().await;

        let elapsed = start.elapsed();
        assert!(elapsed >= Duration::from_secs(1));
    }
} 