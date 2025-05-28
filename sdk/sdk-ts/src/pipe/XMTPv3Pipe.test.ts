import { expect, test, describe } from "vitest";
import { XMTPv3Pipe } from "./XMTPv3Pipe";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { PipeMethod, PipeResponseCode } from "./AbstractPipe";

describe("Life cycle", () => {
  test("Init & close random Pipe", { timeout: 30_000 }, async () => {
    const key = generatePrivateKey();
    const pipe = new XMTPv3Pipe(key);

    await pipe.init("dev");
    await pipe.close();
  });

  test("Init & close multiple Pipes", { timeout: 30_000 }, async () => {
    const keyA = generatePrivateKey();
    const pipeA = new XMTPv3Pipe(keyA);

    const keyB = generatePrivateKey();
    const pipeB = new XMTPv3Pipe(keyB);

    await Promise.all([pipeA.init("dev"), pipeB.init("dev")]);
    await Promise.all([pipeA.close(), pipeB.close()]);
  });

  test(
    "Init & close Pipe for the same account multiple times",
    { timeout: 30_000 },
    async () => {
      const key = generatePrivateKey();
      const pipe1 = new XMTPv3Pipe(key);
      const pipe2 = new XMTPv3Pipe(key);

      await pipe1.init("dev");
      await pipe2.init("dev");
      await Promise.all([pipe1.close(), pipe2.close()]);
    }
  );
});

describe("Messaging", () => {
  test("Send message through Pipe", { timeout: 30_000 }, async () => {
    const keyA = generatePrivateKey();
    const accountA = privateKeyToAccount(keyA);
    const pipeA = new XMTPv3Pipe(keyA);

    const keyB = generatePrivateKey();
    const pipeB = new XMTPv3Pipe(keyB);

    await Promise.all([pipeA.init("dev"), pipeB.init("dev")]);

    pipeA.route(PipeMethod.GET, "/endpoint", async (req) => {
      return {
        code: PipeResponseCode.OK,
        body: {
          value: req.body,
          result: "Ok",
        },
      };
    });

    const body = { value: "Hello world!" };
    const res = await pipeB.send(accountA.address, {
      method: PipeMethod.GET,
      path: "/endpoint",
      body,
    });

    expect.soft(res.code).toBe(PipeResponseCode.OK);
    expect.soft(res.body).toEqual({
      value: body,
      result: "Ok",
    });

    await Promise.all([pipeA.close(), pipeB.close()]);
  });
});
