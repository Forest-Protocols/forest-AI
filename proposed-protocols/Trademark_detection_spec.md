# Trademark Detection (Image to Text)

## Goal

The goal of this subnet is to detect visual trademarks in an image and generate a report highlighting potential trademark issues. This will help legal teams automate the process of checking for potential trademark infringements.

## Evaluation

Responses will be evaluated based on:

✅ Accuracy in detecting trademarks.
✅ Location of trademark inside image
✅ Correct reference to currently active trademark registry 

Currently, only US trademarks are required, but it is expected that the best providers will include more international registries. 
 

## Actions

### `detectTrademarks()`

- **Params**:
  
  - `image` (file, max 1MB): Image file to be analyzed for trademarks. Supported formats: JPEG, PNG.
  - `threshold` (float, optional): Confidence threshold for detection. Default is 0.5.
  
- **Returns**:

  - **`report`** (JSON): A detailed report of detected trademarks, including:
    - `trademark_name` (string): The name of the detected trademark.
    - `confidence` (float): Confidence score of the detection.
    - `bounding_box` (object): Coordinates of the detected trademark in the image.
    - `potential_issues`  Optional(array): List of potential trademark issues and recommendations.

## Performance Requirements

- **Response Times**:
  - `detectTrademarks()`: Must return a report within 30 seconds.
  
- **Rate Limits**:
  - Minimum 2 requests per minute.
  - At least 200 API calls per subscription per month.

## Constraints

- **Detection Accuracy**:
  - Trademarks must be detected with a confidence level of at least 50%.
- **Image Quality**:
  - Images must be clear and free of significant distortions or obstructions.
- **Report Clarity**:
  - The generated report must be clear, detailed, and actionable for legal teams.

## Example

### Input

- **Image**: An image file containing various logos and trademarks.
- **Threshold**: 0.6

### Output

```json
{
  "report": [
    {
      "trademark_name": "Nike",
      "confidence": 0.85,
      "trademark_registry":"https://tsdr.uspto.gov/#caseNumber=73361064&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch"
      "bounding_box": {
        "x_min": 100,
        "y_min": 150,
        "x_max": 200,
        "y_max": 250
      },

    },
    {
      "trademark_name": "Nike",
      "confidence": 0.78,      "trademark_registry":"https://tsdr.uspto.gov/#caseNumber=74291743&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch"
      "bounding_box": {
        "x_min": 300,
        "y_min": 400,
        "x_max": 400,
        "y_max": 500
      },
 
    }
  ]
}