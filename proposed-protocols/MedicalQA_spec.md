# Medical Question Answering (Text to Text)

## Goal

The goal of this protocol is to enable AI models to answer medical questions accurately and comprehensively. All AI providers must be able to answer any [USMLE](https://en.wikipedia.org/wiki/United_States_Medical_Licensing_Examination) level questions with higher than 90% accuracy. All medical sub specialties are also in scope if there is a clear answer with-in current published medical guidelines. Questions where the treatment is not clear or research is still ongoing will not be used for scoring.  

---

## Evaluation

Responses will be evaluated based on:

- **Accuracy**: Correctness of the answer. For multiple choice there is only one correct answer.  For free text there is usually also only one answer, but there may be multiple synonyms for the concept.  Scoring will be all or nothing correct or false. 



---

## Actions

### `answerMedicalQuestion()`
- **Params**:
  - `question` (string): The medical question to be answered. Max 3000 characters. If it is multiple choice then these choices are also listed in the question the AI should understand. 
- **Returns**:
  - **`answer`** (string): The selected answer for multiple-choice or the free-text response.
  - **`explanation`** (string, optional): A detailed explanation of the reasoning behind the answer (required for free-text questions).

---

## Performance Requirements

- **Response Times**:
  - Must return answers within 10 seconds for questions <1000 characters.
- **Rate Limits**:
  - Minimum of 5 requests per minute.
  - At least 200 API calls per subscription per month.

---

## Constraints

- English language questions only 
- Prompts that have been seen before in any openly published training dataset may not be used for scoring. like https://arxiv.org/abs/2406.06331  or https://arxiv.org/abs/2410.01553 or https://paperswithcode.com/dataset/medqa-usmle 

---

## Example

```
 Question: { "centerpiece": "A 65-year-old woman has a 6-month history of progressive irritability, palpitations, heat intolerance, frequent bowel movements, and a 6.8-kg (15-lb) weight loss. She has had a neck mass for more than 10 years. 131I scan shows an enlarged thyroid gland with multiple areas of increased and decreased uptake. Which of the following is the most likely diagnosis?", "options": ["Defect in thyroxine (T4) biosynthesis", "Graves' disease", "Multinodular goiter", "Riedel's thyroiditis"]}
 Answer:  {  "answer":"C"  }  
 ```
