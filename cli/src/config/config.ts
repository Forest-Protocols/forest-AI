import { z } from "zod";

type SchemaType<T> = z.Schema<T> | z.ZodEffects<z.ZodTypeAny>;
type Schema<T> = SchemaType<T> | z.ZodOptional<SchemaType<T>>;
type Default<T> = T | (() => T);

/**
 * A single configuration
 */
export class Config<T = unknown> {
  private currentValue?: T;
  private schema: Schema<T>;
  private optionValue?: T;
  private envName?: string;
  private defaultValue?: T;

  /**
   * Name of the configuration
   */
  name: string;

  constructor(options: {
    schema: Schema<T>;
    name: string;
    defaultValue?: Default<T>;
    envName?: string;
    value?: unknown;
  }) {
    this.schema = options.schema;
    this.name = options.name;
    this.envName = options.envName;

    if (typeof options.defaultValue === "function") {
      this.defaultValue = (options.defaultValue as () => T)();
    } else {
      this.defaultValue = options.defaultValue;
    }

    this.load(options.value);
  }

  /**
   * Validates the given value with the config schema and returns the result
   */
  validate(value?: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.error) {
      const error = result.error.errors[0];
      throw new Error(`Invalid config "${this.name}": ${error.message}`);
    }

    return result.data;
  }

  /**
   * Loads the given value to the configuration. Also can be used to load corresponding "option"
   * @param value
   * @param to
   */
  load(value?: unknown, to?: "option") {
    // Load the given value as the "option value" for this configuration
    if (to === "option") {
      this.optionValue = this.parseValue(value);
    } else {
      // Load the value as the current value of the configuration
      this.currentValue = this.parseValue(value);
    }
  }

  private parseValue(value?: unknown): T | undefined {
    // If value is undefined, we'll use
    // defaultValue so no need to validate
    if (value === undefined) {
      return;
    }

    return this.validate(value);
  }

  /**
   * Checks if there is a corresponding env variable for this configuration
   * @returns Returns the value if it is found, otherwise `undefined`
   */
  private getEnvValue() {
    if (this.envName !== undefined) {
      const envValue =
        process.env[`${(this.envName || this.name).toUpperCase()}`];
      if (envValue !== undefined) return this.parseValue(envValue);
    }
  }

  /**
   * Tells where this configuration taken from.
   */
  get takenFrom() {
    if (this.optionValue !== undefined) {
      return "option";
    }

    if (this.getEnvValue() !== undefined) {
      return "env";
    }

    if (this.currentValue === undefined) {
      return "default";
    }

    return "config";
  }

  /**
   * Value of the configuration. Checks and returns the first one which isn't undefined;
   * - option
   * - env variable
   * - config file
   * - default value (if presents)
   */
  get value(): T {
    return (this.optionValue ||
      this.getEnvValue() ||
      this.currentValue ||
      this.defaultValue) as T;
  }
}
