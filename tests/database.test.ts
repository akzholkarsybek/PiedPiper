import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { sampleProfile, demoProfiles } from "../src/lib/fixtures";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
async function asUser(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${a}'),('${b}'),('${outsider}');`,
  );
  // gen_random_uuid is built into PostgreSQL. Hosted Supabase also enables pgcrypto.
  const sql = readFileSync(
    new URL("../supabase/migrations/001_initial.sql", import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(sql);
  const profiles = [
    { ...sampleProfile(), id: a, approved: true, fictional: false },
    { ...demoProfiles[0], id: b, fictional: false },
    { ...demoProfiles[10], id: outsider, fictional: false },
  ];
  for (const profile of profiles)
    await db.query("insert into public.profiles(id,data) values($1,$2)", [
      profile.id,
      JSON.stringify(profile),
    ]);
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("Actual PostgreSQL RLS and RPC authorization", () => {
  it("anonymous users cannot read profiles or messages", async () => {
    await db.exec("set role anon");
    await expect(db.query("select * from public.profiles")).rejects.toThrow();
    await expect(db.query("select * from public.messages")).rejects.toThrow();
  });
  it("members cannot edit another profile or fabricate a mutual match", async () => {
    await asUser(a);
    const res = await db.query(
      "update public.profiles set data=data where id=$1 returning id",
      [b],
    );
    expect(res.rows).toHaveLength(0);
    await expect(
      db.query("insert into public.matches(user_a,user_b) values($1,$2)", [
        a,
        b,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.decisions(owner_id,target_id,decision) values($1,$2,'interested')",
        [b, a],
      ),
    ).rejects.toThrow();
  });
  it("creates no match until both people approve and creates only one after both approve", async () => {
    await asUser(a);
    await db.query("select public.record_decision($1,$2)", [b, "interested"]);
    expect((await db.query("select * from public.matches")).rows).toHaveLength(
      0,
    );
    await asUser(b);
    await db.query("select public.record_decision($1,$2)", [a, "interested"]);
    await db.query("select public.record_decision($1,$2)", [a, "interested"]);
    expect((await db.query("select * from public.matches")).rows).toHaveLength(
      1,
    );
  });
  it("isolates messages to match members and prevents impersonation", async () => {
    await asUser(a);
    const { rows } = await db.query<{ id: string }>(
      "select id from public.matches",
    );
    const match = rows[0].id;
    await db.query(
      "insert into public.messages(match_id,sender_id,body) values($1,$2,$3)",
      [match, a, "A real human message"],
    );
    await expect(
      db.query(
        "insert into public.messages(match_id,sender_id,body) values($1,$2,$3)",
        [match, b, "Impersonation"],
      ),
    ).rejects.toThrow();
    await asUser(outsider);
    expect((await db.query("select * from public.messages")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query(
        "insert into public.messages(match_id,sender_id,body) values($1,$2,$3)",
        [match, outsider, "Intrusion"],
      ),
    ).rejects.toThrow();
  });
  it("only lets the subject answer a relevant question, and never persists a declined answer", async () => {
    await asUser(a);
    const q = await db.query<{ id: string }>(
      "insert into public.compatibility_questions(requester_id,subject_id,dimension) values($1,$2,$3) returning id",
      [a, b, "children"],
    );
    await expect(
      db.query("select public.answer_question($1,$2,$3)", [
        q.rows[0].id,
        "yes",
        true,
      ]),
    ).rejects.toThrow();
    await asUser(b);
    await db.query("select public.answer_question($1,$2,$3)", [
      q.rows[0].id,
      "private answer",
      false,
    ]);
    const saved = await db.query<{
      shared_answer: string | null;
      status: string;
    }>("select shared_answer,status from public.compatibility_questions");
    expect(saved.rows[0]).toMatchObject({
      shared_answer: null,
      status: "declined",
    });
    await asUser(a);
    await expect(
      db.query(
        "insert into public.compatibility_questions(requester_id,subject_id,dimension) values($1,$2,$3)",
        [a, b, "children"],
      ),
    ).rejects.toThrow();
  });
  it("rejects irrelevant and already known questions", async () => {
    await asUser(a);
    await expect(
      db.query(
        "insert into public.compatibility_questions(requester_id,subject_id,dimension) values($1,$2,$3)",
        [a, b, "smoking"],
      ),
    ).rejects.toThrow();
  });
  it("enforces the same hard preferences even when API validation is bypassed", async () => {
    await asUser(a);
    await db.query(
      `update public.profiles set data=jsonb_set(data,'{preferences,minAge}','40') where id=$1`,
      [a],
    );
    await expect(
      db.query("select public.record_decision($1,$2)", [b, "interested"]),
    ).rejects.toThrow();
    await db.query(
      `update public.profiles set data=jsonb_set(data,'{preferences,minAge}','27') where id=$1`,
      [a],
    );
  });
  it("blocks access to existing messages in both directions", async () => {
    await asUser(a);
    await db.query("select public.block_person($1,$2)", [
      b,
      "Test safety report",
    ]);
    expect((await db.query("select * from public.messages")).rows).toHaveLength(
      0,
    );
    await asUser(b);
    expect((await db.query("select * from public.messages")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from public.profiles where id=$1", [a])).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select public.record_decision($1,$2)", [a, "interested"]),
    ).rejects.toThrow();
  });
  it("deletes application data and related messages but preserves the authentication identity", async () => {
    await asUser(a);
    await db.query("select public.delete_my_data()");
    await db.exec("reset role");
    expect(
      (await db.query("select * from public.profiles where id=$1", [a])).rows,
    ).toHaveLength(0);
    expect((await db.query("select * from public.messages")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from auth.users where id=$1", [a])).rows,
    ).toHaveLength(1);
  });
});
