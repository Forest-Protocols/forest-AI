# Text to Image Generation (Text to Image)

## Goal

Given a textual description, the model should generate a high-quality image that accurately represents the provided text. The goal is to maximize visual fidelity, creativity, and relevance to the text prompt.

## Evaluation

Image responses will be evaluated by human reviewers for relevance, visual quality, and creativity. The image should accurately reflect the text description, be visually appealing, and demonstrate creative interpretation of the prompt.

Additional automated scoring criteria:
- Image resolution and clarity
- Adherence to the specified dimensions and file size
- Originality and absence of artifacts

## Actions

### `generateImage()`
- **Params**:
  - `prompt` (string): Description of the image to be generated. Max 3000 characters.
  - `format` (ImageFormat) – The desired image format. Allowed values:
    - `"PNG"`
    - `"JPEG"`

- **Returns**:
  - `image url`: Image url to download as a single file.
    - Image must be in PNG or JPEG format.

## Performance Requirements
- Query response within 60 seconds.
- Rate limit of at least 2 requests per minute.
- Minimum 200 API calls per subscription per month.

## Constraints
- The generated images must not contain explicit, harmful, or inappropriate content.
- All images must be original and not contain plagiarized elements.

## Example

~~~~~~~
A serene lake surrounded by lush green pine forests under a vibrant orange and pink sunset sky.
In the foreground, there is a wooden pier extending into the lake, with a small lantern glowing warmly.
On the lake, a rowboat with two people wearing hats is gently drifting, while a family of ducks swims nearby.
In the background, snow-capped mountains are visible, partially shrouded in mist.
The scene is reflected on the still water, creating a mirror-like effect.
Artistic style: hyper-realistic, with intricate textures on the wood, water ripples, and detailed lighting effects.
~~~~~~~

![image](https://github.com/user-attachments/assets/cfbe6d46-67d1-4a52-8b15-8c7b46bf31ae)
