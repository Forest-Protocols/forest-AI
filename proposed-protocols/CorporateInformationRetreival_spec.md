# Corporate Public Information Retrieval (Text to JSON)

## Goal

The goal of this subnet is to generate accurate and factual answers to questions about any company with an online presence. Users should be able to inquire about various aspects of a company, such as its founding date, venture capital raised, LinkedIn profiles of founders, and descriptions of core products or services.

## Evaluation

Responses will be evaluated based on:

✅ Accuracy: The information provided must be factually correct.
✅ Relevance: The response should directly address the user's question.
✅ Completeness: The response should be thorough and cover all aspects of the question.

Additional automated scoring criteria:

- Information Accuracy Index (IAI): Measures the correctness of the provided information.
- Response Relevance Score (RRS): Assesses how well the response matches the user's query.
- Data Completeness Rate (DCR): Evaluates the comprehensiveness of the response.

## Actions

### `getCompanyInfo()`

- **Params**:
  - `question` (string): The user's question about the company. Max 2000 characters.
  - `company_name` Optional(string): The name of the company in question. Max 100 characters.
  - `company_url` Optional(string): DNS name of companies primary homepage. 
  
- **Returns**:
  - **`answer`** (JSON): structured data answering users query, may including:
    - `founding_date` (string, optional): The date the company was founded.
    - `vc_capital_raised` (string, optional): The amount of venture capital raised by the company.
    - `founder_profiles` (array, optional): LinkedIn profile links of the company's founders.
    - `product_descriptions` (array, optional): Descriptions of the core products or services offered by the company.
    - ... 

## Performance Requirements

- **Response Times**:
  - `getCompanyInfo()`: Must return an answer within 3 seconds.
  
- **Rate Limits**:
  - Minimum 100 requests per minute.
  - At least 1000 API calls per subscription per month.



## Example

### Input

- **Question**: "When was company X founded?"
- **Company Name**: "Company X"

### Output

```json
{
  "answer": {
    "founding_date": "January 1, 2000"
  }
}