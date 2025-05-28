import { program } from "@/program";

export const validatorCommand = program
  .command("validator")
  .alias("val")
  .description("Validator specific commands");
