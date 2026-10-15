import type { Member } from "../domain";
export const DEMO_PASSWORD = "DemoPass2026!";
export type ResetTicket = {
  memberId: string;
  issuedAt: number;
  used: boolean;
};
export function passwordError(value: string) {
  return [...value].length < 12 || [...value].length > 128
    ? "密碼須為 12～128 字元。"
    : ["password1234", "123456789012", "qwerty123456"].includes(
          value.toLowerCase(),
        )
      ? "請避免常見弱密碼。"
      : "";
}
export function demoLogin(
  members: Member[],
  identity: string,
  password: string,
) {
  return password === DEMO_PASSWORD
    ? members.find((m) =>
        [m.code, m.email, m.phone].some(
          (v) => v && v.toLowerCase() === identity.trim().toLowerCase(),
        ),
      )?.id
    : undefined;
}
export function consumeReset(
  ticket: ResetTicket | null,
  now: number,
  password: string,
  confirmation: string,
): ResetTicket {
  if (
    !ticket ||
    ticket.used ||
    now - ticket.issuedAt >= 30 * 60000 ||
    now < ticket.issuedAt
  )
    throw new Error("連結已使用或逾期，請重新申請。");
  if (passwordError(password)) throw new Error(passwordError(password));
  if (password !== confirmation) throw new Error("兩次密碼不一致。");
  return { ...ticket, used: true };
}
export function contactPatch(
  member: Member,
  members: Member[],
  kind: "phone" | "email",
  input: string,
  password: string,
): Partial<Member> {
  if (password !== DEMO_PASSWORD) throw new Error("示範密碼不正確。");
  const value = input.trim();
  const normalized = kind === "email" ? value.toLowerCase() : value;
  if (
    kind === "email"
      ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ||
        normalized.length > 254
      : !/^\+[1-9]\d{6,14}$/.test(normalized)
  )
    throw new Error(
      kind === "email"
        ? "請輸入有效 Email。"
        : "電話須含國碼，例如 +886912345678。",
    );
  if (
    members.some(
      (m) =>
        m.id !== member.id &&
        m[kind].toLowerCase() === normalized.toLowerCase(),
    )
  )
    throw new Error("此登入識別已被使用。");
  return { [kind]: value };
}
export function codePatch(
  member: Member,
  members: Member[],
  input: string,
  password: string,
): Partial<Member> {
  if (password !== DEMO_PASSWORD) throw new Error("示範密碼不正確。");
  const code = input.trim().toLowerCase();
  if ((member.codeChanges ?? 0) >= 1) throw new Error("帳號代號僅能修改一次。");
  if (!/^[a-z0-9_]{6,20}$/.test(code))
    throw new Error("代號須為 6～20 字元英文字母、數字或底線。");
  if (
    members.some(
      (m) =>
        m.code.toLowerCase() === code ||
        m.retiredCodes?.some((old) => old.toLowerCase() === code),
    )
  )
    throw new Error("代號已使用或已保留。");
  return {
    code,
    codeChanges: 1,
    retiredCodes: [...(member.retiredCodes ?? []), member.code],
  };
}
export function profilePatch(name: string, callName: string): Partial<Member> {
  if (
    ![name, callName].every(
      (value) => value.trim().length > 0 && [...value.trim()].length <= 100,
    )
  )
    throw new Error("姓名與 call name 須為 1～100 字元。");
  return { name: name.trim(), callName: callName.trim() };
}
export function resetUsable(
  ticket: ResetTicket | null,
  activeTicket: ResetTicket | null,
  now: number,
) {
  return (
    !!ticket &&
    ticket === activeTicket &&
    !ticket.used &&
    now >= ticket.issuedAt &&
    now - ticket.issuedAt < 30 * 60000
  );
}
