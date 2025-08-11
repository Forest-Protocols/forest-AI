import { Slasher } from "@forest-protocols/sdk";
import { tokenomicsService } from "../network/tokenomics.service";
import { spinner } from "@/program";
import { red } from "ansis";
import { createSlasherInstance } from "@/client";
import { ProtocolsEpochInfoAggregated } from "@/commands/network/types";
import { ActorService } from "./base-actor-service";

class SlasherService extends ActorService {
  private slasher: Slasher;

  constructor() {
    super();
    this.slasher = createSlasherInstance(this.client);
  }

  get slasherInstance() {
    return this.slasher;
  }

  async fetchLastClosedEpochResults() {
    const aggregatedResults =
      await tokenomicsService.getEpochScoresAggregated();
    if (aggregatedResults.length === 0) {
      spinner.fail(red(`No results found for the last epoch`));
      return;
    }
    return aggregatedResults;
  }

  getProviderRank(
    aggregatedResults: ProtocolsEpochInfoAggregated[],
    providerId: number
  ) {
    for (const result of aggregatedResults) {
      const found = result.provRanks.find(
        (prv) => Number(prv.id) === providerId
      );
      if (found) return found;
    }
    return null;
  }
  getValidatorRank(
    aggregatedResults: ProtocolsEpochInfoAggregated[],
    validatorId: number
  ) {
    for (const result of aggregatedResults) {
      const found = result.valRanks.find(
        (val) => Number(val.id) === validatorId
      );
      if (found) return found;
    }
    return null;
  }
}
export const slasherService = new SlasherService();
