import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { sampleProfile, demoProfiles } from "../src/lib/fixtures";

// Real PostgreSQL (PGlite) running both migrations, exercising RLS as members.
const jamie = "11111111-1111-4111-8111-111111111111",
  lena = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333",
  sophie = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
async function asUser(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
const migration = (name: string) =>
  readFileSync(
    new URL(`../supabase/migrations/${name}`, import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
const availability = (tz = "America/New_York") =>
  JSON.stringify({
    timeZone: tz,
    slots: [{ day: "sat", start: "08:00", end: "12:00" }],
    openToMeetingSoon: true,
    preference: "weekend",
  });
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${jamie}'),('${lena}'),('${outsider}'),('${sophie}');`,
  );
  await db.exec(migration("001_initial.sql"));
  await db.exec(migration("002_phase2.sql"));
  const profiles = [
    { ...sampleProfile(), id: jamie, approved: true, fictional: false },
    { ...demoProfiles[0], id: lena, fictional: false },
    { ...demoProfiles[10], id: outsider, fictional: false },
    { ...demoProfiles[2], id: sophie, fictional: false, readyToConnect: false },
  ];
  for (const p of profiles)
    await db.query("insert into public.profiles(id,data) values($1,$2)", [
      p.id,
      JSON.stringify(p),
    ]);
  // Jamie and Lena become a mutual match through the only allowed path.
  await asUser(jamie);
  await db.query("select public.record_decision($1,'interested')", [lena]);
  await asUser(lena);
  await db.query("select public.record_decision($1,'interested')", [jamie]);
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("Phase 2 database authorization", () => {
  it("keeps the 001 rules and blocks new interest in a paused person", async () => {
    await asUser(jamie);
    await expect(
      db.query("select public.record_decision($1,'interested')", [sophie]),
    ).rejects.toThrow();
    // Control: the same pair is eligible once Sophie resumes.
    await asUser(sophie);
    await db.query(
      `update public.profiles set data=jsonb_set(data,'{readyToConnect}','true') where id=$1`,
      [sophie],
    );
    await asUser(jamie);
    await db.query("select public.record_decision($1,'pass')", [sophie]);
    await db.query("select public.record_decision($1,'interested')", [sophie]);
    // Pausing preserves an existing match and its messages.
    await asUser(lena);
    await db.query(
      `update public.profiles set data=jsonb_set(data,'{readyToConnect}','false') where id=$1`,
      [lena],
    );
    const { rows } = await db.query<{ id: string }>(
      "select id from public.matches",
    );
    expect(rows).toHaveLength(1);
    await db.query(
      "insert into public.messages(match_id,sender_id,body) values($1,$2,'Still here')",
      [rows[0].id, lena],
    );
    await db.query(
      `update public.profiles set data=jsonb_set(data,'{readyToConnect}','true') where id=$1`,
      [lena],
    );
  });
  it("availability is private until shared, and only with a mutual match", async () => {
    await asUser(jamie);
    await db.query(
      "insert into public.member_planning(owner_id,availability,share_availability) values($1,$2,false)",
      [jamie, availability()],
    );
    await asUser(lena);
    expect(
      (
        await db.query(
          "select * from public.member_planning where owner_id=$1",
          [jamie],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.member_planning(owner_id,availability) values($1,$2)",
        [jamie, availability()],
      ),
    ).rejects.toThrow();
    await asUser(jamie);
    await db.query(
      "update public.member_planning set share_availability=true where owner_id=$1",
      [jamie],
    );
    await asUser(lena);
    expect(
      (
        await db.query(
          "select * from public.member_planning where owner_id=$1",
          [jamie],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "update public.member_planning set share_availability=false where owner_id=$1 returning owner_id",
          [jamie],
        )
      ).rows,
    ).toHaveLength(0);
    await asUser(outsider);
    expect(
      (await db.query("select * from public.member_planning")).rows,
    ).toHaveLength(0);
  });
  it("rejects malformed availability", async () => {
    await asUser(lena);
    await expect(
      db.query(
        "insert into public.member_planning(owner_id,availability) values($1,$2)",
        [lena, JSON.stringify({ slots: "every day" })],
      ),
    ).rejects.toThrow();
  });
  it("date proposals: members only; a proposal is not confirmed until the other person accepts", async () => {
    await asUser(jamie);
    const match = (
      await db.query<{ id: string }>("select id from public.matches")
    ).rows[0].id;
    const insert = (proposer: string, status = "proposed") =>
      db.query<{ id: string }>(
        "insert into public.date_proposals(match_id,proposer_id,category,title,starts_at,ends_at,status) values($1,$2,'museum','An afternoon at an art museum','2026-11-21T13:00:00Z','2026-11-21T15:00:00Z',$3) returning id",
        [match, proposer, status],
      );
    await expect(insert(lena)).rejects.toThrow(); // impersonation
    await expect(insert(jamie, "accepted")).rejects.toThrow(); // cannot self-confirm
    const id = (await insert(jamie)).rows[0].id;
    await expect(
      db.query("select public.respond_date_proposal($1,'accepted')", [id]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "update public.date_proposals set status='accepted' where id=$1",
        [id],
      ),
    ).rejects.toThrow();
    await asUser(outsider);
    expect(
      (await db.query("select * from public.date_proposals")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select public.respond_date_proposal($1,'accepted')", [id]),
    ).rejects.toThrow();
    await asUser(lena);
    await db.query("select public.respond_date_proposal($1,'accepted')", [id]);
    await expect(
      db.query("select public.respond_date_proposal($1,'declined')", [id]),
    ).rejects.toThrow();
    await db.query("select public.respond_date_proposal($1,'withdrawn')", [id]);
    const row = await db.query<{ status: string }>(
      "select status from public.date_proposals where id=$1",
      [id],
    );
    expect(row.rows[0].status).toBe("withdrawn");
  });
  it("blocking hides shared availability and proposals; deletion cascades", async () => {
    await asUser(lena);
    await db.query("select public.block_person($1)", [jamie]);
    expect(
      (
        await db.query(
          "select * from public.member_planning where owner_id=$1",
          [jamie],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.date_proposals")).rows,
    ).toHaveLength(0);
    await asUser(jamie);
    await db.query("select public.delete_my_data()");
    await db.exec("reset role");
    expect(
      (
        await db.query(
          "select * from public.member_planning where owner_id=$1",
          [jamie],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.date_proposals")).rows,
    ).toHaveLength(0);
  });
});
