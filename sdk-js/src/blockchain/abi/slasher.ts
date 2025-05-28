export const SlasherABI = [
  { type: "constructor", inputs: [], stateMutability: "nonpayable" },
  {
    type: "function",
    name: "EPOCH_LENGTH",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "REVEAL_WINDOW",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "aggregateScores",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct ForestSlasher.EpochScoreAggregate[]",
        components: [
          { name: "ptAddr", type: "address", internalType: "address" },
          {
            name: "revenueAtEpochClose",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "provRanks",
            type: "uint256[2][]",
            internalType: "uint256[2][]",
          },
          {
            name: "valRanks",
            type: "uint256[2][]",
            internalType: "uint256[2][]",
          },
        ],
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "closeEpoch",
    inputs: [],
    outputs: [
      { name: "closedEpochNum", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "commit",
    inputs: [
      { name: "_commitHash", type: "bytes32", internalType: "bytes32" },
      { name: "_valAddr", type: "address", internalType: "address" },
      { name: "_ptAddr", type: "address", internalType: "address" },
      { name: "_detailsLink", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "computeCurrentEpochEndBlockNum",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "computeHash",
    inputs: [
      {
        name: "_provScores",
        type: "tuple[]",
        internalType: "struct ForestSlasher.ProviderScore[]",
        components: [
          { name: "provId", type: "uint24", internalType: "uint24" },
          { name: "score", type: "uint256", internalType: "uint256" },
          { name: "agreementId", type: "uint32", internalType: "uint32" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "forestToken",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IERC20" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCollateralBalanceOf",
    inputs: [
      { name: "_ptAddr", type: "address", internalType: "address" },
      { name: "_addr", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCurrentEpochEndBlockNum",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEpochScoresAggregate",
    inputs: [{ name: "_epoch", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct ForestSlasher.EpochScoreAggregate[]",
        components: [
          { name: "ptAddr", type: "address", internalType: "address" },
          {
            name: "revenueAtEpochClose",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "provRanks",
            type: "uint256[2][]",
            internalType: "uint256[2][]",
          },
          {
            name: "valRanks",
            type: "uint256[2][]",
            internalType: "uint256[2][]",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEpochScoresGranular",
    inputs: [{ name: "_ptAddr", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct ForestSlasher.EpochScoreGranular[]",
        components: [
          { name: "valId", type: "uint24", internalType: "uint24" },
          {
            name: "provScores",
            type: "tuple[]",
            internalType: "struct ForestSlasher.ProviderScore[]",
            components: [
              { name: "provId", type: "uint24", internalType: "uint24" },
              { name: "score", type: "uint256", internalType: "uint256" },
              { name: "agreementId", type: "uint32", internalType: "uint32" },
            ],
          },
          { name: "commitHash", type: "bytes32", internalType: "bytes32" },
          { name: "detailsLink", type: "string", internalType: "string" },
          {
            name: "status",
            type: "uint8",
            internalType: "enum ForestSlasher.CommitStatus",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getHashToIndex",
    inputs: [{ name: "_commitHash", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isValidEpochEndBlockNum",
    inputs: [
      { name: "_epochEndBlockNum", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "onlyWhenRegistryAndTokenSet",
    inputs: [],
    outputs: [],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registry",
    inputs: [],
    outputs: [
      { name: "", type: "address", internalType: "contract IForestRegistry" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "reveal",
    inputs: [
      { name: "_commitHash", type: "bytes32", internalType: "bytes32" },
      { name: "_valAddr", type: "address", internalType: "address" },
      { name: "_ptAddr", type: "address", internalType: "address" },
      {
        name: "_provScores",
        type: "tuple[]",
        internalType: "struct ForestSlasher.ProviderScore[]",
        components: [
          { name: "provId", type: "uint24", internalType: "uint24" },
          { name: "score", type: "uint256", internalType: "uint256" },
          { name: "agreementId", type: "uint32", internalType: "uint32" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setRegistryAndForestAddr",
    inputs: [
      { name: "_registryAddr", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "topupActorCollateral",
    inputs: [
      { name: "_ptAddr", type: "address", internalType: "address" },
      {
        name: "_actorType",
        type: "uint8",
        internalType: "enum ForestCommon.ActorType",
      },
      { name: "_sender", type: "address", internalType: "address" },
      { name: "_amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unpause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawActorCollateral",
    inputs: [
      { name: "_ptAddr", type: "address", internalType: "address" },
      {
        name: "_actorType",
        type: "uint8",
        internalType: "enum ForestCommon.ActorType",
      },
      { name: "_amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "ActorCollateralTopuped",
    inputs: [
      {
        name: "actorAddr",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ActorCollateralWithdrawn",
    inputs: [
      {
        name: "actorAddr",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "CommitRevealed",
    inputs: [
      {
        name: "hashValue",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "CommitSubmitted",
    inputs: [
      {
        name: "hashValue",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Paused",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Unpaused",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  { type: "error", name: "CommitmentAlreadySubmitted", inputs: [] },
  { type: "error", name: "EnforcedPause", inputs: [] },
  { type: "error", name: "ExpectedPause", inputs: [] },
  { type: "error", name: "InsufficientAmount", inputs: [] },
  { type: "error", name: "InvalidAddress", inputs: [] },
  { type: "error", name: "InvalidState", inputs: [] },
  { type: "error", name: "ObjectNotActive", inputs: [] },
  { type: "error", name: "OnlyOwnerAllowed", inputs: [] },
  { type: "error", name: "OnlyOwnerOrOperatorAllowed", inputs: [] },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
  },
  {
    type: "error",
    name: "ProviderDoesNotMatchAgreement",
    inputs: [
      { name: "_providerId", type: "uint24", internalType: "uint24" },
      { name: "_agreementId", type: "uint32", internalType: "uint32" },
    ],
  },
  { type: "error", name: "Unauthorized", inputs: [] },
  {
    type: "error",
    name: "ValidatorDoesNotMatchAgreement",
    inputs: [
      { name: "_validatorId", type: "uint24", internalType: "uint24" },
      { name: "_agreementId", type: "uint32", internalType: "uint32" },
    ],
  },
] as const;
