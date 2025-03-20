import { Hex, PrivateKeyAccount } from "viem";
import {
  AbstractPipe,
  PipeRouteHandler,
  PipeRequest,
  PipeResponse,
  PipeMethod,
  PipeResponseCode,
  PipeSendRequest,
} from "./AbstractPipe";
import { privateKeyToAccount } from "viem/accounts";
import { Client, XmtpEnv } from "@xmtp/xmtp-js";
import { v7 as uuidv7 } from "uuid";
import { PipeError } from "@/errors";
import { pathToRegexp } from "path-to-regexp";

export class XMTPPipe extends AbstractPipe {
  private xmtpClient: Client | null = null;
  private account: PrivateKeyAccount;
  private listening = false;

  constructor(privateKey: Hex) {
    super();
    this.account = privateKeyToAccount(privateKey);
  }

  override async init(params: XmtpEnv | Client) {
    if (params instanceof Client) {
      this.xmtpClient = params;
    } else {
      this.xmtpClient = await Client.create(
        {
          signMessage: async (message: string) =>
            this.account.signMessage({ message }),
          getAddress: async () => this.account.address,
        },
        {
          env: params,
        }
      );
    }
  }

  async send(to: string, req: PipeSendRequest): Promise<PipeResponse> {
    this.checkInit();

    const requestId = uuidv7();
    const conversation = await this.xmtpClient!.conversations.newConversation(
      to
    );

    const stream = await conversation.streamMessages();
    const responseWatcher = new Promise<PipeResponse>(async (res, rej) => {
      const timeout = setTimeout(() => {
        clearTimeout(timeout);
        stream.return();
        rej(
          new Error(
            `Timeout achieved, no response received for request id ${requestId}`
          )
        );
      }, req.timeout || 30 * 1000);

      for await (const message of stream) {
        if (message.senderAddress === this.account.address) {
          continue;
        }
        try {
          const data: PipeResponse = JSON.parse(message.content);
          if (data.id == requestId) {
            clearTimeout(timeout);
            return res(data);
          }
        } catch (err) {
          console.error("XMTP Error:", err);
          continue;
        }
      }
    });

    // Wait a little bit to be sure that listening process has been started
    await new Promise((res) => setTimeout(res, 500));

    await conversation.send(
      JSON.stringify({
        id: requestId,
        ...req,
      })
    );

    return await responseWatcher;
  }

  route(method: PipeMethod, path: string, handler: PipeRouteHandler): void {
    // If the listener is not running, that means
    // we hadn't created a route handler until now.
    if (!this.listening) {
      this.listen();
      this.listening = true;
    }

    const route = this.routes[path];

    if (!route) {
      this.routes[path] = {
        [method]: handler,
      };
      return;
    }

    this.routes[path][method] = handler;
  }

  async close() {
    this.checkInit();
    await this.xmtpClient!.close();
  }

  private async sendXMTPMessage(to: string, content: string) {
    this.checkInit();
    const conversation = await this.xmtpClient!.conversations.newConversation(
      to
    );

    await conversation.send(content);
  }

  private async processRequest(senderAddress: string, req: PipeRequest) {
    if (!req.path.startsWith("/")) {
      req.path = `/${req.path}`;
    }

    // A dummy protocol and domain to parse path and query params.
    const url = new URL(`forest://protocols.io${req.path}`);

    // Parse query params
    req.params = {
      ...(req.params || {}),
      ...url.searchParams,
    };

    // Extract the pure path
    req.path = url.pathname;

    // Search for the requested path
    for (const [path, handlers] of Object.entries(this.routes)) {
      const { regexp, keys } = pathToRegexp(path);
      const result = regexp.exec(req.path);
      const routeHandler = handlers[req.method];

      // Path is not matched, keep looking
      if (result === null) {
        continue;
      }

      // Handler not found for the given method
      if (!routeHandler) {
        break;
      }

      // Place path params
      req.pathParams = {};

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i].name;
        const value = result[i + 1]; // Skip first full matched string
        req.pathParams[key] = value;
      }

      try {
        const response = await routeHandler({
          ...req,
          requester: senderAddress,
        });

        await this.sendXMTPMessage(
          senderAddress,
          JSON.stringify({
            code: PipeResponseCode.OK, // Use OK code by default
            ...response, // Include response data returned by route handler
            id: req.id, // Use the same ID with the request
          })
        );
      } catch (err) {
        if (err instanceof PipeError) {
          await this.sendXMTPMessage(
            senderAddress,
            JSON.stringify({
              id: req.id,
              code: err.code,
              body: err.meta.body || { message: "Internal server error" },
            } as PipeResponse)
          );
        } else {
          await this.sendXMTPMessage(
            senderAddress,
            JSON.stringify({
              id: req.id,
              code: PipeResponseCode.INTERNAL_SERVER_ERROR,
              body: { message: "Internal server error" },
            } as PipeResponse)
          );
          console.error("XMTP Error:", err);
        }
      } finally {
        return;
      }
    }

    // If the route handler is not found for this path, send not found
    const notFoundResponse: PipeResponse = {
      code: PipeResponseCode.NOT_FOUND,
      body: {
        message: `${req.method} ${req.path} is not found`,
      },
      id: req.id,
    };

    await this.sendXMTPMessage(senderAddress, JSON.stringify(notFoundResponse));
  }

  private async listen() {
    this.checkInit();

    for await (const message of await this.xmtpClient!.conversations.streamAllMessages()) {
      if (message.senderAddress === this.account.address) {
        continue;
      }

      try {
        const req: PipeRequest = JSON.parse(message.content);
        this.processRequest(message.senderAddress, req);
      } catch (err) {
        console.error("XMTP Error:", err);
        continue;
      }
    }
  }

  private checkInit() {
    if (!this.xmtpClient) {
      throw new Error(
        "Pipe client (XMTP) has not been initialized (call init() before start to use it)"
      );
    }
  }
}
