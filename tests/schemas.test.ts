import { describe, expect, it } from "@jest/globals";
import { ZodError } from "zod";

import {
  createSessionSchema,
  directQuerySchema,
  modelNameSchema,
  modelSchema as chatModelSchema,
  modeSchema,
} from "../src/core/schemas.js";

describe("参数校验", () => {
  it("允许指定模型 opus/sonnet/haiku", () => {
    expect(() => modelNameSchema.parse("opus")).not.toThrow();
    expect(() => modelNameSchema.parse("sonnet")).not.toThrow();
    expect(() => modelNameSchema.parse("haiku")).not.toThrow();
  });

  it("createSessionSchema 拒绝非法模型", () => {
    expect(() =>
      createSessionSchema.parse({ model: "gpt", sessionId: "sess" })
    ).toThrow(ZodError);
  });

  it("directQuerySchema 拒绝非法模型", () => {
    expect(() =>
      directQuerySchema.parse({ prompt: "hi", model: "random" })
    ).toThrow(ZodError);
  });

  it("model 工具参数限制", () => {
    expect(() =>
      chatModelSchema.parse({ sessionId: "abc", model: "sonnet" })
    ).not.toThrow();

    expect(() =>
      chatModelSchema.parse({ sessionId: "abc", model: "bad" })
    ).toThrow(ZodError);
  });

  it("modeSchema 拒绝非法权限模式", () => {
    expect(() =>
      modeSchema.parse({ sessionId: "abc", permissionMode: "default" })
    ).not.toThrow();

    expect(() =>
      modeSchema.parse({ sessionId: "abc", permissionMode: "invalid" })
    ).toThrow(ZodError);
  });
});
