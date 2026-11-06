const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')
test('private chat migration blocks old permissive storage policies and preserves other buckets and service access', async t => {
  const db = await PGlite.create(); t.after(() => db.close())
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);
    CREATE TABLE storage.objects(id text,bucket_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon,authenticated,service_role;
    CREATE POLICY legacy_broad ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
    INSERT INTO storage.buckets VALUES('team-chat-attachments','team-chat-attachments',true,NULL);
    INSERT INTO storage.objects VALUES('private-file','team-chat-attachments'),('avatar','avatars');`)
  const sql = fs.readFileSync('supabase/migrations/20261106170000_private_chat_attachments.sql', 'utf8')
  await db.exec(sql); await db.exec(sql)
  assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='team-chat-attachments'")).rows[0].public, false)
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`)
    assert.deepEqual((await db.query('SELECT id FROM storage.objects')).rows.map(r => r.id), ['avatar'])
    await assert.rejects(db.exec("INSERT INTO storage.objects VALUES('injected','team-chat-attachments')"), /row-level security/)
    assert.equal((await db.query("UPDATE storage.objects SET id='changed' WHERE bucket_id='team-chat-attachments' RETURNING id")).rows.length, 0)
    assert.equal((await db.query("DELETE FROM storage.objects WHERE bucket_id='team-chat-attachments' RETURNING id")).rows.length, 0)
    await db.exec('RESET ROLE')
  }
  await db.exec('SET ROLE service_role')
  assert.equal((await db.query("SELECT id FROM storage.objects WHERE bucket_id='team-chat-attachments'")).rows[0].id, 'private-file')
})
