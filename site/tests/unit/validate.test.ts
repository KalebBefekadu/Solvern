import { describe, expect, it } from "vitest";
import { callbackLeadSchema } from "@/lib/leads/schema";
import { contactErrors, isEmail, isPhone, isZip } from "@/lib/leads/validate";

describe("client validators", () => {
  it("match the server on common input", () => {
    const cases: [string, string, string][] = [
      ["30305", "(404) 555-0100", "dana@example.com"],
      ["30305-1234", "404.555.0100", "d.smith+home@example.co"],
      ["3030", "555-0100", "dana@"],
      ["abcde", "", "dana example.com"],
    ];
    const base = { type: "callback", existingJob: "no", topic: "Help or advice", message: "Hello", firstName: "D", lastName: "S", preferredContact: "phone" };
    for (const [zip, phone, email] of cases) {
      const client = contactErrors((k) => ({ zip, phone, email })[k as "zip"]);
      const server = callbackLeadSchema.safeParse({ ...base, zip, phone, email });
      const serverFields = server.success ? [] : server.error.issues.map((i) => String(i.path[0]));
      expect(Object.keys(client).sort(), `${zip} ${phone} ${email}`).toEqual(serverFields.sort());
    }
  });

  it("accept and reject the obvious cases", () => {
    expect(isZip(" 30305 ")).toBe(true);
    expect(isPhone("+1 404 555 0100")).toBe(true);
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
  });
});
