import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { demoProfiles, sampleProfile } from "../src/lib/fixtures";

// Real PostgreSQL (PGlite) running 001 → 003, exercising RLS as members.
const jamie = "11111111-1111-4111-8111-111111111111",
  lena = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333";
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
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${jamie}'),('${lena}'),('${outsider}');`,
  );
  for (const m of ["001_initial.sql", "002_phase2.sql", "003_phase2_2.sql"])
    await db.exec(migration(m));
  const profiles = [
    { ...sampleProfile(), id: jamie, approved: true, fictional: false },
    { ...demoProfiles[0], id: lena, fictional: false },
    { ...demoProfiles[10], id: outsider, fictional: false },
  ];
  for (const p of profiles)
    await db.query("insert into public.profiles(id,data) values($1,$2)", [
      p.id,
      JSON.stringify(p),
    ]);
  await asUser(jamie);
  await db.query("select public.record_decision($1,'interested')", [lena]);
  await asUser(lena);
  await db.query("select public.record_decision($1,'interested')", [jamie]);
}, 30000);
afterAll(async () => {
  await db?.close();
});

const readHandle = async (viewer: string, owner: string) => {
  await asUser(viewer);
  return (
    await db.query<{ instagram_handle: string }>(
      "select instagram_handle from public.member_social where owner_id=$1",
      [owner],
    )
  ).rows;
};

describe("Phase 2.2 database authorization", () => {
  it("keeps a hidden Instagram username private, even from a match", async () => {
    await asUser(jamie);
    await db.query(
      "insert into public.member_social(owner_id,instagram_handle,instagram_visible) values($1,'jamie.hikes',false)",
      [jamie],
    );
    expect(await readHandle(jamie, jamie)).toHaveLength(1);
    expect(await readHandle(lena, jamie)).toHaveLength(0);
    expect(await readHandle(outsider, jamie)).toHaveLength(0);
    // It never appears inside the widely readable profile data.
    await asUser(lena);
    const { rows } = await db.query<{ data: unknown }>(
      "select data from public.profiles where id=$1",
      [jamie],
    );
    expect(JSON.stringify(rows)).not.toContain("jamie.hikes");
  });
  it("shows a username only after the owner turns visibility on, and never to a blocked person", async () => {
    await asUser(jamie);
    await db.query(
      "update public.member_social set instagram_visible=true where owner_id=$1",
      [jamie],
    );
    expect(await readHandle(lena, jamie)).toHaveLength(1);
    expect(await readHandle(outsider, jamie)).toHaveLength(1);
    await asUser(outsider);
    await db.query("select public.block_person($1)", [jamie]);
    expect(await readHandle(outsider, jamie)).toHaveLength(0);
  });
  it("lets only the owner write, and validates the username", async () => {
    await asUser(lena);
    await expect(
      db.query(
        "insert into public.member_social(owner_id,instagram_handle) values($1,'impostor')",
        [jamie],
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "update public.member_social set instagram_handle='hacked' where owner_id=$1 returning owner_id",
          [jamie],
        )
      ).rows,
    ).toHaveLength(0);
    for (const bad of [
      "Has Space",
      ".dot",
      "dot.",
      "two..dots",
      "x".repeat(31),
      "UPPER",
    ])
      await expect(
        db.query(
          "insert into public.member_social(owner_id,instagram_handle) values($1,$2)",
          [lena, bad],
        ),
      ).rejects.toThrow();
    await db.query(
      "insert into public.member_social(owner_id,instagram_handle) values($1,'lena_reads')",
      [lena],
    );
    // Removal deletes the row entirely.
    await db.query("delete from public.member_social where owner_id=$1", [
      lena,
    ]);
    expect(await readHandle(lena, lena)).toHaveLength(0);
  });
  it("stores a verified venue reference on a proposal and rejects malformed ones", async () => {
    await asUser(jamie);
    const match = (
      await db.query<{ id: string }>("select id from public.matches")
    ).rows[0].id;
    const insert = (venue: unknown) =>
      db.query<{ id: string }>(
        "insert into public.date_proposals(match_id,proposer_id,category,title,starts_at,ends_at,venue) values($1,$2,'cultural-event','Concert','2026-11-15T14:00:00Z','2026-11-15T16:00:00Z',$3) returning id",
        [match, jamie, venue === null ? null : JSON.stringify(venue)],
      );
    const ok = await insert({
      kind: "event",
      id: "ticketon-hans-zimmer-astana-2026-11-15",
      name: "«The Music of Hans Zimmer»",
      url: "https://ticketon.kz/en/concerts/event/the-music-of-hans-zimmer-tynda-music-v-astane",
    });
    expect(ok.rows).toHaveLength(1);
    await expect(
      insert({ kind: "booking", id: "x", name: "x" }),
    ).rejects.toThrow();
    await expect(insert({ kind: "place", name: "no id" })).rejects.toThrow();
    await expect(
      insert({ kind: "place", id: "x", name: "x".repeat(3000) }),
    ).rejects.toThrow();
    // Still pending until the other person accepts (002 rules unchanged).
    const status = await db.query<{ status: string }>(
      "select status from public.date_proposals where id=$1",
      [ok.rows[0].id],
    );
    expect(status.rows[0].status).toBe("proposed");
  });
  it("deleting an account removes its Instagram row", async () => {
    await asUser(jamie);
    await db.query("select public.delete_my_data()");
    await db.exec("reset role");
    expect(
      (
        await db.query("select * from public.member_social where owner_id=$1", [
          jamie,
        ])
      ).rows,
    ).toHaveLength(0);
  });
});
