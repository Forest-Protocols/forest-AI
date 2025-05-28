import { program } from "@/program";

export const slasherCommand = program
  .command("slasher")
  .alias("sl")
  .description("Forest Slasher specific actions")
  .usage("<command>");
