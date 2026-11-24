# Text to JavaScript Code (Text to Code)

## Goal

Generate functional fast Javascript code that solves the problem described in the prompt with the shortest code possible. 

## Evaluation

Generated code will be reviewed for:
- Correctness and functionality.
- Adherence to ES6+ syntax and JavaScript best practices.
- Clarity and conciseness.

## Actions

### `generateJavaScript()`

- **Params**:
  - `prompt` (string): A detailed description of the required functionality. Max 3000 characters.
- **Returns**:
  - **`javascript_code`** (string): A standalone JavaScript code snippet implementing the described functionality.

## Performance Requirements

- **Response Times**:
  - `generateJavaScript()`: Must return code within 30 seconds.
  
- **Rate Limits**:
  - Minimum of 2 requests per minute.
  - At least 200 API calls per subscription per month.

 
## Example

### Input

- **prompt**: "Create a function that calculates the factorial of a number using recursion."

### Output

```json
{
  "javascript_code": "function factorial(n) {\\n  if (n < 0) {\\n    throw new Error('Invalid input');\\n  }\\n  return n === 0 ? 1 : n * factorial(n - 1);\\n}\\n\\nconsole.log(factorial(5)); // Output: 120"
}
