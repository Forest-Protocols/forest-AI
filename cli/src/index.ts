#!/usr/bin/env node

import ansis from "ansis";
import { program, spinner } from "./program";

import "./commands/get";
import "./commands/get/protocol";
import "./commands/get/network";
import "./commands/get/offer";
import "./commands/get/provider";
import "./commands/get/validator";
import "./commands/get/pt-owner";

import "./commands/register";
import "./commands/register/pt-owner";
import "./commands/register/provider";
import "./commands/register/validator";

import "./commands/protocol";
import "./commands/protocol/create";
import "./commands/protocol/set";

import "./commands/network";
import "./commands/network/unpause";
import "./commands/network/pause";
import "./commands/network/set";
import "./commands/network/close-epoch";
import "./commands/network/emissions";

import "./commands/provider";
import "./commands/provider/register-in";
import "./commands/provider/register-offer";
import "./commands/provider/withdraw";
import "./commands/provider/update";
import "./commands/provider/pause-offer";
import "./commands/provider/close-offer";
import "./commands/provider/unpause-offer";
import "./commands/provider/topup-collateral";
import "./commands/provider/withdraw-collateral";

import "./commands/config";
import "./commands/config/set";
import "./commands/config/get";

import "./commands/wallet";
import "./commands/wallet/balance";
import "./commands/wallet/allowance";

import "./commands/validator";
import "./commands/validator/register-in";
import "./commands/validator/update";
import "./commands/validator/commit";
import "./commands/validator/reveal";
import "./commands/validator/topup-collateral";
import "./commands/validator/withdraw-collateral";

import "./commands/pt-owner";
import "./commands/pt-owner/update";

import "./commands/agreement";
import "./commands/agreement/withdraw";
import "./commands/agreement/enter";
import "./commands/agreement/close";
import "./commands/agreement/topup";
import "./commands/agreement/details";
import "./commands/agreement/list";

import "./commands/slasher";
import "./commands/slasher/unpause";
import "./commands/slasher/pause";

import "./commands/token";
import "./commands/token/unpause";
import "./commands/token/pause";

import "./commands/pipe";

import { loadAndParseAPISpecs } from "./commands/api";
import "./commands/api/import";

async function main() {
  await loadAndParseAPISpecs();

  try {
    await program.parseAsync();
    process.exit(0);
  } catch (err: any) {
    spinner.stop();
    console.error(ansis.red(`error: ${err?.message || err}`));
    process.exit(1);
  }
}

main();
