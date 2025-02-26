# Cultural Origin Analysis (Text to Cultural Markers)

## Goal

Given a text sample, the model should analyze writing patterns, linguistic markers, and cultural references to identify the likely cultural and linguistic background of the author. The goal is to provide accurate cultural origin assessment with clear supporting evidence while respecting privacy and avoiding harmful stereotyping.

## Evaluation

Results will be evaluated based on:

- Accuracy in identifying native language markers
- Detection of regional/cultural idioms and references
- Quality of linguistic pattern analysis
- Precision in distinguishing between similar cultural backgrounds
- Avoidance of discriminatory or biased assessments

Additional automated scoring criteria:
- Language pattern recognition accuracy
- Cultural reference identification rate
- False positive/negative rates for known origin samples
- Confidence score correlation with ground truth

## Actions

### `analyzeCulturalOrigin()`
- **Params**:
  - `text` (string): Text sample to analyze. Min 100, Max 100,000 characters
  - `analysisConfig` (object, optional):
    - `confidenceThreshold` (float): Minimum confidence for inclusion in results (0.0-1.0)
    - `maxResults` (integer): Maximum number of potential origins to return
    - `includeDialects` (boolean): Whether to include dialect-level analysis
    - `includeLinguisticFeatures` (boolean): Whether to return detailed linguistic markers

- **Returns**:
  - `analysis`: Cultural origin assessment containing:
    - `primaryOrigin` (object):
      - `region` (string): Identified primary cultural/geographic region
      - `confidence` (float): Confidence score (0.0-1.0)
      - `nativeLanguage` (string): Likely native language
    - `alternativeOrigins` (array): Other possible origins with lower confidence
    - `linguisticMarkers` (object):
      - `grammarPatterns` (array): Distinctive grammar usage
      - `vocabularyChoices` (array): Characteristic word choices
      - `idiomaticExpressions` (array): Region-specific phrases
    - `culturalReferences` (array): Identified cultural touchpoints

### `analyzeBatch()`
- **Params**:
  - `texts` (array): Array of text samples to analyze
  - `analysisConfig` (object, optional): Same as analyzeCulturalOrigin()

- **Returns**:
  - `results` (array): Array of analysis objects, each containing:
    - Same structure as analyzeCulturalOrigin() return
  - `batchMetadata` (object):
    - `processedCount` (integer): Number of texts analyzed
    - `averageConfidence` (float): Mean confidence across batch
    - `dominantRegions` (array): Most common regions identified
    - `processingTimeMs` (integer): Total processing time

## Performance Requirements
- Process individual texts in <1 second
- Handle batch analysis of up to 100 texts per minute
- Support at least 1,000 API calls per hour

## Constraints
- Must avoid cultural stereotyping or bias
- Privacy-preserving analysis without storing personal data
- Clear explanation for all assessments
- Minimum text length of 100 characters
- Batch size limited to 100 items per request
- Must handle multilingual text input

## Example

Single Text Input:
~~~~~~~
{
  "text": "The colour of the autumn leaves was particularly beautiful this year. I reckon we ought to organise a proper celebration for the Queen's Jubilee next month. Fancy a cuppa?",
  "analysisConfig": {
    "confidenceThreshold": 0.7,
    "includeDialects": true
  }
}
~~~~~~~

Output:
~~~~~~~
{
  "results": [{
    "analysis": {
      "primaryOrigin": {
        "region": "United Kingdom",
        "confidence": 0.92,
        "nativeLanguage": "English"
      },
      "alternativeOrigins": [
        {
          "region": "Australia",
          "confidence": 0.45,
          "nativeLanguage": "English"
        }
      ],
      "linguisticMarkers": {
        "grammarPatterns": [
          {
            "pattern": "reckon + that",
            "significance": "Common in British English",
            "confidence": 0.85
          }
        ],
        "vocabularyChoices": [
          {
            "word": "colour",
            "significance": "British spelling",
            "confidence": 0.95
          },
          {
            "word": "cuppa",
            "significance": "British informal",
            "confidence": 0.98
          }
        ],
        "idiomaticExpressions": [
          {
            "phrase": "fancy a cuppa",
            "origin": "British English",
            "confidence": 0.99
          }
        ]
      },
      "culturalReferences": [
        {
          "reference": "Queen's Jubilee",
          "significance": "British monarchy celebration",
          "confidence": 0.95
        }
      ]
    }
  }],
  "batchMetadata": {
    "processedCount": 1,
    "averageConfidence": 0.92,
    "dominantRegions": ["United Kingdom"],
    "processingTimeMs": 245
  }
}
~~~~~~~ 