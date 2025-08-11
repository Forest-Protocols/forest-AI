import { networkCommand } from ".";
import {
  ActorType,
  actorTypeToString,
  AddressSchema,
  DECIMALS,
  ForestPublicClientType,
  ForestTokenABI,
  IndexerAgreement,
  IndexerOffer,
  IndexerReward,
  MONTH_IN_SECONDS,
  Status,
  Token,
} from "@forest-protocols/sdk";
import { spinner } from "@/program";
import {
  createSlasherInstance,
  createTokenInstance,
  indexerClient,
} from "@/client";
import { Address, formatUnits } from "viem";
import { table as formatTable } from "table";
import Decimal from "decimal.js";
import { green, yellow } from "ansis";
import { createViemPublicClient } from "@/utils";
import { formatAddress, resolveENSName, resolveToName } from "@/utils/address";
import { stringify } from "csv";
import { writeFileSync } from "fs";

const tableBorder = {
  topBody: `-`,
  topJoin: `+`,
  topLeft: `+`,
  topRight: `+`,
  bottomBody: `-`,
  bottomJoin: `+`,
  bottomLeft: `+`,
  bottomRight: `+`,
  bodyLeft: `|`,
  bodyRight: `|`,
  bodyJoin: `|`,
  joinBody: `-`,
  joinLeft: `+`,
  joinRight: `+`,
  joinJoin: `+`,
  joinMiddleDown: `+`,
  joinMiddleUp: `+`,
  joinMiddleLeft: `+`,
  joinMiddleRight: `+`,
};
const tableHorizontalLineDrawer = (i: number, size: number) =>
  (i >= 0 && i <= 2) || i === size;

networkCommand
  .command("emissions")
  .description("Shows of the emissions of the Network")
  .option(
    "--protocol <ptAddress>",
    "Show all emissions for protocol owners, providers and validators of a specific protocol"
  )
  .option(
    "--providers",
    "Show all emissions for providers of a specific protocol (required to call --protocol with <ptAddress>)"
  )
  .option(
    "--validators",
    "Show all emissions for validators of a specific protocol (required to call --protocol with <ptAddress>)"
  )
  .option(
    "--pto",
    "Show all emissions for pto of a specific protocol (required to call --protocol with <ptAddress>)"
  )
  .option(
    "--save <output>",
    "Save the emissions to a file as CSV or JSON (if the output is given as .json)"
  )
  .option(
    "--granular-data <actorAddressOrId>",
    "Show granular validation details for a specific actor in a protocol (required to call --protocol with <ptAddress>)"
  )
  .action(
    async (options: {
      protocol?: string;
      pto?: boolean;
      providers?: boolean;
      validators?: boolean;
      granularData?: string;
      save?: string;
    }) => {
      if (
        !options.protocol &&
        (options.pto || options.providers || options.validators)
      ) {
        throw new Error(
          "You must specify Protocol address via --protocol to use any of the following options: --pto, --providers and --validators"
        );
      }

      if (options.granularData && !options.protocol) {
        throw new Error(
          "You must specify Protocol address via --protocol to use --granular-data"
        );
      }

      const client = createViemPublicClient();
      const token = createTokenInstance(client);
      const saveOptionGiven = options.save !== undefined;
      let data: any[][] | undefined = undefined;

      if (options.protocol) {
        const ptAddress = await resolveENSName(options.protocol);

        if (options.pto) {
          data = await printProtocolOwnerEmissions(
            ptAddress,
            token,
            saveOptionGiven
          );
        } else if (options.providers) {
          data = await printProvidersEmissions(
            ptAddress,
            client,
            token,
            saveOptionGiven
          );
        } else if (options.validators) {
          data = await printValidatorsEmissions(
            ptAddress,
            client,
            token,
            saveOptionGiven
          );
        } else if (options.granularData) {
          const addressValidation = AddressSchema.safeParse(
            options.granularData
          );
          let address = "";

          if (addressValidation.success) {
            address = addressValidation.data;
          } else {
            const id = parseInt(options.granularData);

            if (!isNaN(id)) {
              address = id.toString();
            } else {
              address = await resolveENSName(options.granularData);
            }
          }

          data = await printGranularScores(
            ptAddress,
            address as Address,
            token,
            saveOptionGiven
          );
        } else {
          data = await printProtocolEmissions(
            ptAddress,
            token,
            saveOptionGiven
          );
        }
      } else {
        data = await printProtocolsEmissions(client, token, saveOptionGiven);
      }

      if (saveOptionGiven) {
        if (!data || data.length === 0) {
          throw new Error("No data to save");
        }

        const headers = data[0];
        const rows: any[] = [];

        data = data.slice(1);
        for (const row of data) {
          const rowObject: any = {};
          for (let i = 0; i < headers.length; i++) {
            rowObject[headers[i]] = row[i];
          }
          rows.push(rowObject);
        }

        if (options.save!.endsWith(".json")) {
          writeFileSync(options.save!, JSON.stringify(rows, null, 2));
        } else {
          const csv = await new Promise<string>((resolve, reject) => {
            stringify(rows, { header: true }, (err, output) => {
              if (err) {
                return reject(err);
              }
              resolve(output);
            });
          });

          writeFileSync(options.save!, csv);
        }

        console.log(green(`Saved to ${options.save}`));
      }
    }
  );

async function printProtocolsEmissions(
  client: ForestPublicClientType,
  token: Token,
  save?: boolean
) {
  spinner.start("Getting network state");
  const network = await indexerClient.getNetworkState();
  const epochLength = BigInt(network.epochLength.value);
  const epochEndBlock = BigInt(network.current.epochEndBlock.value);
  const targetEpoch = epochEndBlock - epochLength;

  spinner.text = "Getting reward information";
  const [rewards, maxEmissions] = await Promise.all([
    getAllRewards(targetEpoch),
    !save ? token.calculateCurrentTokensEmission() : Promise.resolve(0n),
  ]);
  const totalEmission = calculateTotalEmission(rewards);

  spinner.text = "Getting Protocols data";
  const protocols = await Promise.all(
    sumProtocolsEmissions(rewards).map(async (data) => {
      return {
        ...data,
        ...(await indexerClient.getProtocolByAddress(data.address as Address)),
        ensName: resolveToName(data.address as Address),
      };
    })
  );

  // TODO: This data should be indexed by the indexer so we don't need to fetch it from the blockchain
  spinner.text = "Reading blockchain data";
  const logs = await getLastEpochRewardMintedEvents(client, token);

  spinner.text = "Resolving ENS names";
  await Promise.all(protocols.map((protocol) => protocol.ensName));

  const data: any[][] = [];
  let hasMissingName = false;

  for (const protocol of protocols) {
    const ensName = await protocol.ensName;

    if (!protocol.name) {
      hasMissingName = true;
    }

    data.push([
      protocol.name || yellow("* N/A"),
      ensName
        ? `${ensName} (${formatAddress(protocol.address)})`
        : formatAddress(protocol.address),
      new Decimal(protocol.emission)
        .div(totalEmission)
        .mul(100)
        .toNumber()
        .toFixed(2),
      Number(formatUnits(protocol.emission, DECIMALS.FOREST)).toFixed(2),
      Number(
        formatUnits(
          (logs.find(
            (log) =>
              log.args.ptAddr?.toLowerCase() === protocol.address.toLowerCase()
          )?.args.revenueAtEpochClose || 0n) * BigInt(MONTH_IN_SECONDS),
          DECIMALS.USDC
        )
      ).toFixed(2),
    ]);
  }

  data.sort((a, b) => b[2] - a[2]);
  spinner.stop();
  const table = [
    [
      "Name",
      "Address",
      "Emission\nShare (%)",
      "Token Emission\n(FOREST)",
      "Total\nRevenue ($)",
    ],
    ...data,
  ];

  if (save) {
    return table;
  }

  console.log(green(`Epoch: ${targetEpoch.toString()}`));
  console.log(
    green(
      `Max Emissions: ${Number(
        formatUnits(maxEmissions, DECIMALS.FOREST)
      ).toFixed(2)} FOREST`
    )
  );

  if (table.length > 1) {
    process.stdout.write(
      formatTable(table, {
        header: {
          content: "Protocols Emissions",
          alignment: "center",
        },
        drawHorizontalLine: tableHorizontalLineDrawer,
        border: tableBorder,
      })
    );
  } else {
    console.log(yellow("Network doesn't have any protocols yet"));
  }
  if (hasMissingName) {
    console.log(yellow(`* Name of the Protocol is not available`));
  }

  console.log();
}

async function printProtocolEmissions(
  ptAddress: Address,
  token: Token,
  save?: boolean
) {
  spinner.start("Getting network state");
  const network = await indexerClient.getNetworkState();
  const epochLength = BigInt(network.epochLength.value);
  const epochEndBlock = BigInt(network.current.epochEndBlock.value);
  const targetEpoch = epochEndBlock - epochLength;

  spinner.text = "Getting emissions information";
  const [rewards, maxEmissions] = await Promise.all([
    getAllRewards(targetEpoch),
    !save ? token.calculateCurrentTokensEmission() : Promise.resolve(0n),
  ]);
  const protocolTotalEmission = calculateTotalEmission(rewards, { ptAddress });

  spinner.text = "Getting Protocol data";
  const protocol = await indexerClient.getProtocolByAddress(ptAddress);
  const actors = (await indexerClient.getProtocolActors(ptAddress)).map(
    (actor) => ({ ...actor, ensName: resolveToName(actor.ownerAddress) })
  );
  const actorsEmissions = sumProtocolActorsEmissions(rewards);
  const data: any[][] = [];
  let hasMissingName = false;

  spinner.text = "Resolving ENS names";
  await Promise.all(actors.map((actor) => actor.ensName));

  for (const actor of actors) {
    const emissionInfo = actorsEmissions.find(
      (emission) => emission.id === actor.actorId
    );
    const ensName = await actor.ensName;

    if (!actor.name) {
      hasMissingName = true;
    }

    data.push([
      actor.actorId,
      actor.name || yellow("* N/A"),
      ensName
        ? `${ensName} (${formatAddress(actor.ownerAddress)})`
        : formatAddress(actor.ownerAddress),
      actorTypeToString(actor.actorType),
      (emissionInfo
        ? Number(formatUnits(emissionInfo.totalEmission, DECIMALS.FOREST))
        : 0
      ).toFixed(2),
    ]);
  }

  data.sort((a, b) => b[4] - a[4]);
  spinner.stop();

  const table = [
    ["ID", "Name", "Address", "Role", "Token Emission\n(FOREST)"],
    ...data,
  ];

  if (save) {
    return table;
  }

  console.log(green(`Epoch: ${targetEpoch.toString()}`));
  console.log(
    green(
      `Max Emissions: ${Number(
        formatUnits(maxEmissions, DECIMALS.FOREST)
      ).toFixed(2)} FOREST`
    )
  );
  console.log(
    green(
      `Protocol Emissions: ${Number(
        formatUnits(protocolTotalEmission, DECIMALS.FOREST)
      ).toFixed(2)} FOREST`
    )
  );
  console.log(green(`Shares:`));
  console.log(
    green(
      `  Protocol Owner: ${(protocol.ptOwnerEmissionShare / 100).toFixed(2)}%`
    )
  );
  console.log(
    green(`  Providers: ${(protocol.providerEmissionShare / 100).toFixed(2)}%`)
  );
  console.log(
    green(
      `  Validators: ${(protocol.validatorEmissionShare / 100).toFixed(2)}%`
    )
  );
  if (table.length > 1) {
    process.stdout.write(
      formatTable(table, {
        header: {
          content: "Protocol Emissions",
          alignment: "center",
        },
        drawHorizontalLine: tableHorizontalLineDrawer,
        border: tableBorder,
      })
    );
  } else {
    console.log(yellow("No Actors found in the Protocol"));
  }
  if (hasMissingName) {
    console.log(yellow(`* Name of the Actor is not available`));
  }

  console.log();
}

async function printProtocolOwnerEmissions(
  ptAddress: Address,
  token: Token,
  save?: boolean
) {
  spinner.start("Getting network state");
  const network = await indexerClient.getNetworkState();
  const epochLength = BigInt(network.epochLength.value);
  const epochEndBlock = BigInt(network.current.epochEndBlock.value);
  const targetEpoch = epochEndBlock - epochLength;

  spinner.text = "Getting reward information";
  const [rewards, maxEmissions] = await Promise.all([
    getAllRewards(targetEpoch),
    !save ? token.calculateCurrentTokensEmission() : Promise.resolve(0n),
  ]);
  const protocolTotalEmission = calculateTotalEmission(rewards, { ptAddress });

  spinner.text = "Getting Protocol data";
  const protocol = await indexerClient.getProtocolByAddress(ptAddress);
  const owner = await indexerClient.getActorByIdOrAddress(protocol.ownerId);
  const ownerEmissions = rewards.reduce((acc, reward) => {
    if (reward.ownerId === owner.id) {
      return acc + BigInt(reward.amount);
    }
    return acc;
  }, 0n);

  spinner.text = "Resolving ENS names";
  const ensName = await resolveToName(owner.ownerAddress);
  const hasMissingName = !owner.name;

  const data: any[][] = [
    [
      owner.id,
      owner.name || yellow("* N/A"),
      ensName
        ? `${ensName} (${formatAddress(owner.ownerAddress)})`
        : formatAddress(owner.ownerAddress),
      Number(formatUnits(ownerEmissions, DECIMALS.FOREST)).toFixed(2),
    ],
  ];

  data.sort((a, b) => b[4] - a[4]);
  spinner.stop();
  const table = [
    ["ID", "Name", "Address", "Token Emission\n(FOREST)"],
    ...data,
  ];

  if (save) {
    return table;
  }

  console.log(green(`Epoch: ${targetEpoch.toString()}`));
  console.log(
    green(
      `Max Emissions: ${Number(
        formatUnits(maxEmissions, DECIMALS.FOREST)
      ).toFixed(2)} FOREST`
    )
  );
  console.log(
    green(
      `Protocol Emissions: ${Number(
        formatUnits(protocolTotalEmission, DECIMALS.FOREST)
      ).toFixed(2)} FOREST`
    )
  );
  console.log(
    green(
      `Protocol Owner Share: ${(protocol.ptOwnerEmissionShare / 100).toFixed(
        2
      )}%`
    )
  );

  process.stdout.write(
    formatTable(table, {
      header: {
        content: "Protocol Owner Emissions",
        alignment: "center",
      },
      drawHorizontalLine: tableHorizontalLineDrawer,
      border: tableBorder,
    })
  );
  if (hasMissingName) {
    console.log(yellow(`* Name of the Actor is not available`));
  }
  console.log();
}

async function printProvidersEmissions(
  ptAddress: Address,
  client: ForestPublicClientType,
  token: Token,
  save?: boolean
) {
  spinner.start("Getting network state");
  const network = await indexerClient.getNetworkState();
  const epochLength = BigInt(network.epochLength.value);
  const epochEndBlock = BigInt(network.current.epochEndBlock.value);
  const targetEpoch = epochEndBlock - epochLength;
  const slasher = createSlasherInstance(client);

  spinner.text = "Getting reward information";
  const [rewards, maxEmissions] = await Promise.all([
    getAllRewards(targetEpoch),
    !save ? token.calculateCurrentTokensEmission() : Promise.resolve(0n),
  ]);
  const protocolTotalEmission = calculateTotalEmission(rewards, { ptAddress });

  spinner.text = "Getting Protocol data";
  const protocol = await indexerClient.getProtocolByAddress(ptAddress);

  // TODO: This can be indexed by the indexer so we don't need to fetch it from the blockchain
  spinner.text = "Getting rank details";
  const aggregatedResults = await slasher.getEpochScoresAggregated(targetEpoch);

  spinner.text = "Getting Providers data";
  const actors = await indexerClient.getProtocolActors(ptAddress);
  const providers = actors
    .filter((actor) => actor.actorType === ActorType.Provider)
    .map((provider) => ({
      ...provider,
      ensName: resolveToName(provider.ownerAddress),
    }));
  const actorsEmissions = sumProtocolActorsEmissions(rewards);

  spinner.text = "Resolving ENS names";
  await Promise.all(providers.map((provider) => provider.ensName));

  let hasMissingName = false;
  const data: any[][] = await Promise.all(
    providers.map(async (actor) => {
      const emissionInfo = actorsEmissions.find(
        (emission) => emission.id === actor.actorId
      );
      const ensName = await actor.ensName;

      if (!actor.name) {
        hasMissingName = true;
      }

      // Find Provider rank
      let rank = 0n;
      for (const result of aggregatedResults) {
        const providerRank = result.provRanks.find(
          (prv) => prv[0] === BigInt(actor.actorId)
        );

        if (providerRank) {
          rank = providerRank[1];
          break;
        }
      }

      return [
        actor.actorId,
        actor.name || yellow("* N/A"),
        ensName
          ? `${ensName} (${formatAddress(actor.ownerAddress)})`
          : formatAddress(actor.ownerAddress),
        rank,
        (emissionInfo
          ? Number(formatUnits(emissionInfo.totalEmission, DECIMALS.FOREST))
          : 0
        ).toFixed(2),
        Number(
          formatUnits(
            (await getTotalValueServed(actor.ownerAddress, ptAddress)) *
              BigInt(MONTH_IN_SECONDS),
            DECIMALS.USDC
          )
        ).toFixed(2),
      ];
    })
  );

  data.sort((a, b) => b[4] - a[4]);
  spinner.stop();

  const table = [
    [
      "ID",
      "Name",
      "Address",
      "Rank",
      "Token Emission\n(FOREST)",
      "Total\nRevenue ($)",
    ],
    ...data,
  ];

  if (save) {
    return table;
  }

  console.log(green(`Epoch: ${targetEpoch.toString()}`));
  console.log(
    green(
      `Max Emissions: ${Number(
        formatUnits(maxEmissions, DECIMALS.FOREST)
      ).toFixed(2)} FOREST`
    )
  );
  console.log(
    green(
      `Protocol Emissions: ${Number(
        formatUnits(protocolTotalEmission, DECIMALS.FOREST)
      ).toFixed(2)} FOREST`
    )
  );
  console.log(
    green(
      `Providers Share: ${(protocol.providerEmissionShare / 100).toFixed(2)}%`
    )
  );

  if (table.length > 1) {
    process.stdout.write(
      formatTable(table, {
        header: {
          content: "Providers Emissions",
          alignment: "center",
        },
        drawHorizontalLine: tableHorizontalLineDrawer,
        border: tableBorder,
      })
    );
  } else {
    console.log(yellow("No Providers found in the Protocol"));
  }

  if (hasMissingName) {
    console.log(yellow(`* Name of the Actor is not available`));
  }
  console.log();
}

async function printValidatorsEmissions(
  ptAddress: Address,
  client: ForestPublicClientType,
  token: Token,
  save?: boolean
) {
  spinner.start("Getting network state");
  const network = await indexerClient.getNetworkState();
  const epochLength = BigInt(network.epochLength.value);
  const epochEndBlock = BigInt(network.current.epochEndBlock.value);
  const targetEpoch = epochEndBlock - epochLength;
  const slasher = createSlasherInstance(client);

  spinner.text = "Getting reward information";
  const [rewards, maxEmissions] = await Promise.all([
    getAllRewards(targetEpoch),
    !save ? token.calculateCurrentTokensEmission() : Promise.resolve(0n),
  ]);
  const protocolTotalEmission = calculateTotalEmission(rewards, { ptAddress });

  spinner.text = "Getting Protocol data";
  const protocol = await indexerClient.getProtocolByAddress(ptAddress);

  // TODO: This can be indexed by the indexer so we don't need to fetch it from the blockchain
  spinner.text = "Getting rank details";
  const aggregatedResults = await slasher.getEpochScoresAggregated(targetEpoch);

  spinner.text = "Getting Validators data";
  const actors = await indexerClient.getProtocolActors(ptAddress);

  const validators = actors
    .filter((actor) => actor.actorType === ActorType.Validator)
    .map((validator) => ({
      ...validator,
      ensName: resolveToName(validator.ownerAddress),
    }));
  const actorsEmissions = sumProtocolActorsEmissions(rewards);

  spinner.text = "Resolving ENS names";
  await Promise.all(validators.map((validator) => validator.ensName));

  let hasMissingName = false;
  const data: any[][] = await Promise.all(
    validators.map(async (actor) => {
      const emissionInfo = actorsEmissions.find(
        (emission) => emission.id === actor.actorId
      );
      const ensName = await actor.ensName;

      if (!actor.name) {
        hasMissingName = true;
      }

      // Find Validator rank
      let rank = 0n;
      for (const result of aggregatedResults) {
        const validatorRank = result.valRanks.find(
          (prv) => prv[0] === BigInt(actor.actorId)
        );

        if (validatorRank) {
          rank = validatorRank[1];
          break;
        }
      }

      return [
        actor.actorId,
        actor.name || yellow("* N/A"),
        ensName
          ? `${ensName} (${formatAddress(actor.ownerAddress)})`
          : formatAddress(actor.ownerAddress),
        rank,
        (emissionInfo
          ? Number(formatUnits(emissionInfo.totalEmission, DECIMALS.FOREST))
          : 0
        ).toFixed(2),
      ];
    })
  );

  data.sort((a, b) => b[4] - a[4]);
  spinner.stop();

  const table = [
    ["ID", "Name", "Address", "Rank", "Token Emission\n(FOREST)"],
    ...data,
  ];

  if (save) {
    return table;
  }

  console.log(green(`Epoch: ${targetEpoch.toString()}`));
  console.log(
    green(
      `Max Emissions: ${Number(
        formatUnits(maxEmissions, DECIMALS.FOREST)
      ).toFixed(2)} FOREST`
    )
  );
  console.log(
    green(
      `Protocol Emissions: ${Number(
        formatUnits(protocolTotalEmission, DECIMALS.FOREST)
      ).toFixed(2)} FOREST`
    )
  );
  console.log(
    green(
      `Validators Share: ${(protocol.validatorEmissionShare / 100).toFixed(2)}%`
    )
  );

  if (table.length > 1) {
    process.stdout.write(
      formatTable(table, {
        header: {
          content: "Validators Emissions",
          alignment: "center",
        },
        drawHorizontalLine: tableHorizontalLineDrawer,
        border: tableBorder,
      })
    );
  } else {
    console.log(yellow("No Validators found in the Protocol"));
  }

  if (hasMissingName) {
    console.log(yellow(`* Name of the Actor is not available`));
  }
  console.log();
}

async function printGranularScores(
  ptAddress: Address,
  actorIdOrAddress: Address | number,
  token: Token,
  save?: boolean
) {
  spinner.start("Getting network state");
  const network = await indexerClient.getNetworkState();
  const epochLength = BigInt(network.epochLength.value);
  const epochEndBlock = BigInt(network.current.epochEndBlock.value);
  const targetEpoch = epochEndBlock - epochLength;
  const maxEmissions = !save
    ? await token.calculateCurrentTokensEmission()
    : 0n;

  spinner.text = "Getting Actor data";
  const actor = await indexerClient.getActorByIdOrAddress(actorIdOrAddress);

  if (!actor) {
    throw new Error(`Actor ${actorIdOrAddress} not found`);
  }

  let actorType: "providerId" | "validatorId";

  if (actor.type === ActorType.Provider) {
    actorType = "providerId";
  } else if (actor.type === ActorType.Validator) {
    actorType = "validatorId";
  } else {
    throw new Error(`Provider or Validator not found`);
  }

  spinner.text = "Getting Granular Scores";
  const scores = await indexerClient.getGranularScores({
    [actorType]: actor.id,
    epochNum: targetEpoch,
    protocolAddr: ptAddress,
  });

  const data: any[][] = scores.map((score) => [
    score.agreementId,
    score.providerId || score.validatorId,
    score.score,
    `TX Hash : ${score.revealTxHash}\nCID     : https://peerbench.ai/inspect/${score.detailsLink}`,
  ]);

  data.sort((a, b) => b[2] - a[2]);
  spinner.stop();

  if (save) {
    return [
      [
        "Agreement ID",
        actorType === "providerId" ? "Validator ID" : "Provider ID",
        "Score",
        "TX Hash",
        "CID",
        "Inspect",
      ],
      ...scores.map((score) => [
        score.agreementId,
        score.providerId || score.validatorId,
        score.score,
        score.revealTxHash,
        score.detailsLink,
        `https://peerbench.ai/inspect/${score.detailsLink}`,
      ]),
    ];
  }

  console.log(green(`Epoch: ${targetEpoch.toString()}`));
  console.log(
    green(
      `Max Emissions: ${Number(
        formatUnits(maxEmissions, DECIMALS.FOREST)
      ).toFixed(2)} FOREST`
    )
  );

  if (data.length > 0) {
    process.stdout.write(
      formatTable(
        [
          [
            "Agreement ID",
            actorType === "providerId" ? "Validator ID" : "Provider ID",
            "Score",
            "Details",
          ],
          ...data,
        ],
        {
          header: {
            content: `${
              actor.name
                ? `"${actor.name}" (${actorTypeToString(
                    actor.type
                  )}) Granular Scores`
                : "Granular Scores"
            } `,
            alignment: "center",
          },
          border: tableBorder,
        }
      )
    );
  } else {
    console.log(yellow("No Granular Scores found for the Actor"));
  }
  console.log();
}

// TODO: Temporary. This should be exposed by the indexer.
async function getTotalValueServed(
  providerAddress: Address,
  ptAddress: Address
) {
  const agreements: IndexerAgreement[] = await indexerClient
    .getAgreements({
      protocolAddress: ptAddress,
      status: Status.Active,
      providerAddress: providerAddress.toLowerCase() as Address,
      limit: 100,
      autoPaginate: true,
    })
    .then((res) => res.data);

  let totalValueServed = 0n;

  // Fetch offers of the agreements
  const offers: Record<string, IndexerOffer> = {};
  for (const agreement of agreements) {
    if (!offers[agreement.offerId]) {
      offers[agreement.offerId] = await indexerClient
        .getOffers({
          offerId: agreement.offerId,
          protocolAddress: ptAddress.toLowerCase() as Address,
        })
        .then(({ data }) => data[0]);
    }

    totalValueServed += BigInt(offers[agreement.offerId].fee);
  }

  return totalValueServed;
}

function sumProtocolActorsEmissions(rewards: IndexerReward[]) {
  const actors: Record<
    string,
    {
      id: number;
      totalEmission: bigint;
    }
  > = {};

  for (const reward of rewards) {
    if (!actors[reward.ownerId]) {
      actors[reward.ownerId] = {
        id: reward.ownerId,
        totalEmission: 0n,
      };
    }

    actors[reward.ownerId].totalEmission += BigInt(reward.amount);
  }

  return Array.from(Object.values(actors));
}

function sumProtocolsEmissions(rewards: IndexerReward[]) {
  const protocols: Record<
    string,
    {
      address: string;
      emission: bigint;
      totalRevenue: bigint;
    }
  > = {};

  for (const reward of rewards) {
    if (!protocols[reward.protocolAddress]) {
      protocols[reward.protocolAddress] = {
        address: reward.protocolAddress,
        emission: 0n,
        totalRevenue: 0n,
      };
    }

    protocols[reward.protocolAddress].emission += BigInt(reward.amount);
  }

  return Array.from(Object.values(protocols));
}

function calculateTotalEmission(
  rewards: IndexerReward[],
  filter?: { ptAddress?: Address; actorId?: number }
) {
  return rewards.reduce((acc, reward) => {
    // If Protocol address is given then only sum the rewards for that protocol
    if (filter?.ptAddress !== undefined) {
      if (
        reward.protocolAddress.toLowerCase() === filter.ptAddress.toLowerCase()
      ) {
        return acc + BigInt(reward.amount);
      }
      return acc;
    }
    if (filter?.actorId !== undefined) {
      if (reward.ownerId === filter.actorId) {
        return acc + BigInt(reward.amount);
      }
      return acc;
    }
    return acc + BigInt(reward.amount);
  }, 0n);
}

async function getAllRewards(epoch: bigint, ptAddress?: Address) {
  const rewards: IndexerReward[] = await indexerClient
    .getRewards({
      epoch,
      limit: 100,
      protocolAddress: ptAddress?.toLowerCase() as Address,
      autoPaginate: true,
    })
    .then((res) => res.data);

  return rewards;
}

async function getLastEpochRewardMintedEvents(
  client: ForestPublicClientType,
  token: Token
) {
  const fromBlock = await token.getLastEmissionsEpochBlockNum();
  const logs = await client.getContractEvents({
    abi: ForestTokenABI,
    eventName: "RewardsMinted",
    fromBlock,
    toBlock: fromBlock,
  });

  return logs;
}
