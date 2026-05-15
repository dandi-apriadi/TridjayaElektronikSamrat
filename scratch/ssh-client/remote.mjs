import { Client } from 'ssh2';

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const command = process.env.VPS_COMMAND;

if (!host || !password || !command) {
  console.error('Missing VPS_HOST, VPS_PASSWORD, or VPS_COMMAND');
  process.exit(2);
}

const conn = new Client();

conn
  .on('ready', () => {
    conn.exec(command, { pty: false }, (err, stream) => {
      if (err) {
        console.error(err.message);
        conn.end();
        process.exitCode = 1;
        return;
      }

      let exitCode = 0;
      stream
        .on('close', (code) => {
          exitCode = code ?? 0;
          conn.end();
          process.exitCode = exitCode;
        })
        .on('data', (data) => process.stdout.write(data))
        .stderr.on('data', (data) => process.stderr.write(data));
    });
  })
  .on('error', (err) => {
    console.error(err.message);
    process.exit(1);
  })
  .connect({
    host,
    port: Number(process.env.VPS_PORT || 22),
    username,
    password,
    readyTimeout: 20000,
    hostVerifier: () => true,
  });
