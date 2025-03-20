pub const DEFAULT_TIMEOUT: u64 = 30_000; // 30 seconds
pub const DEFAULT_RETRY_ATTEMPTS: u32 = 3;
pub const DEFAULT_RETRY_DELAY: u64 = 1_000; // 1 second
pub const MAX_RETRY_DELAY: u64 = 10_000; // 10 seconds
pub const DEFAULT_PAGE_SIZE: u32 = 20;
pub const MAX_PAGE_SIZE: u32 = 100;

pub const API_VERSION: &str = "v1";
pub const DEFAULT_BASE_URL: &str = "https://api.forestprotocols.com";

pub const RATE_LIMIT_HEADER: &str = "X-RateLimit-Limit";
pub const RATE_LIMIT_REMAINING_HEADER: &str = "X-RateLimit-Remaining";
pub const RATE_LIMIT_RESET_HEADER: &str = "X-RateLimit-Reset";

pub const ERROR_CODES: &[(&str, &str)] = &[
    ("AUTH_ERROR", "Authentication failed"),
    ("RATE_LIMIT_ERROR", "Rate limit exceeded"),
    ("VALIDATION_ERROR", "Invalid input data"),
    ("NOT_FOUND", "Resource not found"),
    ("SERVER_ERROR", "Internal server error"),
    ("NETWORK_ERROR", "Network connection error"),
];

pub const SUPPORTED_EVENTS: &[&str] = &[
    "transaction.created",
    "transaction.updated",
    "transaction.completed",
    "transaction.failed",
    "webhook.created",
    "webhook.updated",
    "webhook.deleted",
    "rate_limit.exceeded",
];

pub const HTTP_STATUS_CODES: &[(u16, &str)] = &[
    (200, "OK"),
    (201, "Created"),
    (400, "Bad Request"),
    (401, "Unauthorized"),
    (403, "Forbidden"),
    (404, "Not Found"),
    (429, "Too Many Requests"),
    (500, "Internal Server Error"),
]; 