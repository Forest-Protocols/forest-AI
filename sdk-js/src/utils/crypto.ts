/**
 * Calculates the SHA-256 hash of the given text or ArrayBuffer.
 * @param input - The text or ArrayBuffer to calculate the hash of.
 * @returns The SHA-256 hash of the given input.
 */
export async function calculateSHA256(
  input: string | ArrayBuffer
): Promise<string> {
  const { createHash } = await import("crypto");
  const hash = createHash("sha256");

  if (input instanceof ArrayBuffer) {
    hash.update(Buffer.from(input));
  } else {
    hash.update(input);
  }
  return hash.digest("hex");
}
