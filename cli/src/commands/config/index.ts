import { program } from "@/program";

export const configCommand = program
  .command("config")
  .description("Sets or gets a CLI config");
