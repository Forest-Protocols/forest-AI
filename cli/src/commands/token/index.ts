import { program } from "@/program";

export const tokenCommand = program
  .command("token")
  .alias("tkn")
  .description("Forest Token specific actions")
  .usage("<command>");
