# Cryptocurrency Analysis (Ticker to Investment Report)

## Goal

Given a cryptocurrency ticker symbol, the model should analyze market data, technical indicators, and relevant metrics to generate a comprehensive investment analysis report. The goal is to provide actionable insights while maintaining accuracy and considering multiple data sources for a well-rounded analysis.

## Evaluation

Results will be evaluated based on:

- Accuracy of market data and calculations
- Comprehensiveness of analysis (technical, fundamental, sentiment ...)
- Quality of risk assessment
- Clarity of investment recommendations
- Historical prediction accuracy

Additional automated scoring criteria:
- Data freshness (staleness penalties)
- Source diversity score
- Technical indicator consistency
- Sentiment analysis accuracy
- Risk metric coverage

## Actions

### `analyzeToken()`
- **Params**:
  - `ticker` (string): Cryptocurrency ticker symbol (e.g., "BTC", "ETH")
  - `analysisConfig` (object, optional):
    - `timeframe` (string): Analysis period ("24h", "7d", "30d", "1y")
    - `includeTechnicals` (boolean): Include technical analysis
    - `includeSentiment` (boolean): Include sentiment analysis
    - `includeOnChain` (boolean): Include on-chain metrics
    - `fiatCurrency` (string): Preferred fiat currency for values (default "USD")

- **Returns**:
  - `analysis`: Comprehensive analysis containing:
    - `marketData` (object):
      - `currentPrice` (float): Current price in fiat
      - `marketCap` (float): Market capitalization
      - `volume24h` (float): 24-hour trading volume
      - `priceChange` (object): Price changes across timeframes
      - `supply` (object): Circulating and total supply info
    - `impactfulContent` (object):
      - `news` (array): News articles related to the cryptocurrency
      - `socialMedia` (array): Social media posts related to the cryptocurrency
      - `technicalEvents` (array): Technical events related to the cryptocurrency
    - `technicalAnalysis` (object):
      - `indicators` (array): Technical indicator readings
      - `trendAnalysis` (object): Trend strength and direction
      - `supportResistance` (array): Key price levels
    - `sentimentAnalysis` (object):
      - `socialScore` (float): Social media sentiment (0.0-1.0)
      - `newsScore` (float): News sentiment analysis
      - `developerActivity` (object): Github/development metrics
    - `riskAnalysis` (object):
      - `volatilityScore` (float): Volatility assessment
      - `liquidityScore` (float): Liquidity assessment
      - `concentrationRisk` (object): Holder concentration data
    - `recommendation` (object):
      - `signal` (string): "BUY", "SELL", or "HOLD"
      - `confidence` (float): Confidence score (0.0-1.0)
      - `timeframe` (string): Recommended investment horizon
      - `riskLevel` (string): "LOW", "MEDIUM", "HIGH"

### `analyzeBatch()`
- **Params**:
  - `tickers` (array): Array of ticker symbols to analyze
  - `analysisConfig` (object, optional): Same as analyzeToken()

- **Returns**:
  - `results` (array): Array of analysis objects
  - `batchMetadata` (object):
    - `processedCount` (integer): Number of tickers analyzed
    - `timestamp` (integer): Analysis timestamp
    - `marketSnapshot` (object): Overall market conditions

## Performance Requirements
- Individual analysis completed in <5 seconds
- Support batch analysis of up to 10 tokens
- Real-time data freshness (max 15 minute delay)
- 24/7 availability with 99.9% uptime
- Rate limits: 60 requests per hour per API key

## Constraints
- Must use multiple data sources for verification
- Clear audit trail for all data points
- No storage of sensitive user data
- Rate limiting for API stability

## Example

Input:
~~~~~~~
{
  "ticker": "BTC",
  "analysisConfig": {
    "timeframe": "7d",
    "includeTechnicals": true,
    "includeSentiment": true,
    "includeOnChain": true,
    "fiatCurrency": "USD"
  }
}
~~~~~~~

Output:
~~~~~~~
{
  "analysis": {
    "marketData": {
      "currentPrice": 45320.12,
      "marketCap": 853000000000,
      "volume24h": 32000000000,
      "priceChange": {
        "24h": 4.2,
        "7d": -2.1,
        "30d": 15.3
      },
      "supply": {
        "circulating": 18700000,
        "total": 21000000
      },
      "impactfulContent": {
        "news": [
          {
            "title": "Major Bank Announces Bitcoin Integration",
            "source": "Bloomberg",
            "url": "https://bloomberg.com/crypto/article-123",
            "timestamp": 1678230000,
            "impactScore": 0.92,
            "sentiment": "POSITIVE"
          },
          {
            "title": "New Regulatory Framework Proposed",
            "source": "CoinDesk",
            "url": "https://coindesk.com/regulation/article-456",
            "timestamp": 1678220000,
            "impactScore": 0.87,
            "sentiment": "NEUTRAL"
          }
        ],
        "socialMedia": [
          {
            "platform": "Twitter",
            "author": "@CryptoInfluencer",
            "url": "https://twitter.com/status/123456789",
            "timestamp": 1678225000,
            "impactScore": 0.89,
            "sentiment": "POSITIVE"
          },
          {
            "platform": "Reddit",
            "subreddit": "r/cryptocurrency",
            "url": "https://reddit.com/r/cryptocurrency/123abc",
            "timestamp": 1678228000,
            "impactScore": 0.85,
            "sentiment": "POSITIVE"
          }
        ],
        "technicalEvents": [
          {
            "type": "TRADING_VOLUME_SPIKE",
            "description": "Unusual trading volume detected on Binance",
            "timestamp": 1678232000,
            "impactScore": 0.88
          }
        ]
      }
    },
    "technicalAnalysis": {
      "indicators": [
        {
          "name": "RSI",
          "value": 58.2,
          "signal": "NEUTRAL"
        },
        {
          "name": "MACD",
          "value": 245.12,
          "signal": "BULLISH"
        }
      ],
      "trendAnalysis": {
        "strength": 0.75,
        "direction": "UPWARD"
      },
      "supportResistance": [
        {
          "type": "SUPPORT",
          "price": 44200,
          "strength": 0.85
        },
        {
          "type": "RESISTANCE",
          "price": 46500,
          "strength": 0.92
        }
      ]
    },
    "sentimentAnalysis": {
      "socialScore": 0.82,
      "newsScore": 0.65,
      "developerActivity": {
        "commits7d": 47,
        "activeContributors": 28,
        "repositoryHealth": 0.92
      }
    },
    "riskAnalysis": {
      "volatilityScore": 0.68,
      "liquidityScore": 0.95,
      "concentrationRisk": {
        "top10Holders": 0.23,
        "walletDistribution": "MODERATE"
      }
    },
    "recommendation": {
      "signal": "BUY",
      "confidence": 0.82,
      "timeframe": "MEDIUM_TERM",
      "riskLevel": "MEDIUM"
    }
  },
  "metadata": {
    "timestamp": 1678234567,
    "dataFreshness": "2m",
    "sourcesUsed": ["CoinGecko", "Santiment", "GlassNode"]
  }
}
~~~~~~~ 