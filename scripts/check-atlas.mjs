/**
 * Why can't this machine reach Atlas?
 *
 *   TARGET_URI='mongodb+srv://…' node scripts/check-atlas.mjs
 *
 * A MongoServerSelectionError says only "it didn't work". This tests each layer
 * separately so the answer is a layer, not a guess:
 *
 *   DNS  fails -> wrong hostname, or the cluster was deleted
 *   TCP  fails -> firewall blocking outbound 27017 outright
 *   TLS  hangs -> the interesting one. The socket opens and the handshake is
 *                 then dropped. Either the network filters MongoDB traffic on
 *                 27017 (offices and some ISPs do this: a proxy answers the TCP
 *                 connect, then discards the TLS bytes), or the cluster is
 *                 paused, or the IP is not in Network Access.
 *   AUTH fails -> credentials. Note this is fast and explicit ("bad auth"),
 *                 never a timeout, so a timeout is never a password problem.
 *
 * The control test matters: TLS to port 443 on a public host proves outbound TLS
 * works in general, which isolates the failure to port 27017 specifically.
 *
 * The public IP is printed because switching to a phone hotspot is the usual
 * workaround and macOS keeps using Wi-Fi unless the old interface is off — if
 * the IP has not changed, the network has not changed.
 */
import { Resolver } from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import { MongoClient } from 'mongodb';
import { requireEnv } from '../lib/env.mjs';

const URI = requireEnv('TARGET_URI');
const host = URI.split('@')[1].split('/')[0].split('?')[0];

function line(label, status, detail) {
  const mark = status === 'OK' ? 'OK  ' : status === 'FAIL' ? 'FAIL' : status;
  console.log(`  ${label.padEnd(22)} ${mark.padEnd(8)} ${detail ?? ''}`);
}

function probe(kind, hostname, port, timeout) {
  return new Promise((resolve) => {
    const t = Date.now();
    const done = (status, detail) => resolve({ status, detail, ms: Date.now() - t });
    const sock =
      kind === 'tls'
        ? tls.connect({ host: hostname, port, servername: hostname, timeout }, () =>
            done('OK', `${Date.now() - t}ms`)
          )
        : net.createConnection({ host: hostname, port, timeout }, () => done('OK', `${Date.now() - t}ms`));
    sock.on('timeout', () => { sock.destroy(); done('FAIL', `timed out after ${Date.now() - t}ms`); });
    sock.on('error', (e) => { sock.destroy(); done('FAIL', e.code ?? e.message); });
    if (kind === 'tls') sock.on('secureConnect', () => { sock.destroy(); });
    else sock.on('connect', () => { sock.destroy(); });
  });
}

console.log(`\nChecking ${host}\n`);

try {
  const ip = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(8000) }).then((r) => r.text());
  line('public IP', '', ip);
} catch { line('public IP', '', '(could not determine)'); }

let shards = [];
try {
  shards = (await new Resolver().resolveSrv(`_mongodb._tcp.${host}`)).map((s) => s.name);
  line('1. DNS (SRV)', 'OK', `${shards.length} shard(s)`);
} catch (e) {
  line('1. DNS (SRV)', 'FAIL', `${e.code} — hostname wrong, or cluster deleted`);
  process.exit(1);
}

const shard = shards[0];
const tcp = await probe('tcp', shard, 27017, 8000);
line('2. TCP :27017', tcp.status, tcp.detail);

const tlsRes = await probe('tls', shard, 27017, 10000);
line('3. TLS :27017', tlsRes.status, tlsRes.detail);

const control = await probe('tls', 'api.github.com', 443, 8000);
line('4. TLS :443 (control)', control.status, control.detail);

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 10000 });
let mongo = 'FAIL';
let mongoDetail = '';
try {
  await client.connect();
  const dbs = await client.db('admin').admin().listDatabases();
  mongo = 'OK';
  mongoDetail = dbs.databases.map((d) => `${d.name} (${(d.sizeOnDisk / 1024).toFixed(0)}KB)`).join(', ');
} catch (e) {
  mongoDetail = e.name === 'MongoServerSelectionError' ? 'server selection timed out' : e.message.split('\n')[0];
} finally {
  await client.close().catch(() => {});
}
line('5. MongoDB handshake', mongo, mongoDetail);

console.log('\nVerdict:');
if (mongo === 'OK') {
  console.log('  Reachable. Run scripts/migrate-to-atlas.mjs.');
} else if (tcp.status === 'OK' && tlsRes.status === 'FAIL' && control.status === 'OK') {
  console.log('  Outbound TLS works on 443 but hangs on 27017, and the socket opens');
  console.log('  before dying. This network is filtering MongoDB traffic.');
  console.log('  Switch networks (phone hotspot) and re-run — confirm the public IP');
  console.log('  above actually changes, or the switch did not take effect.');
  console.log('  If the IP does change and it still fails, check the Atlas dashboard');
  console.log('  for a paused cluster.');
} else if (tcp.status === 'FAIL') {
  console.log('  Port 27017 is blocked outright. Same fix: a different network.');
} else {
  console.log('  See the failing layer above.');
}
console.log();
process.exit(mongo === 'OK' ? 0 : 1);
