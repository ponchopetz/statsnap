// In-memory MongoDB for backend tests.
//
// mongodb-memory-server downloads a mongod binary on first use (~100MB,
// cached under ~/.cache/mongodb-binaries). If a `mongod` is already on PATH
// (Homebrew locally) it is used instead, which skips the download. Set
// MONGOMS_SYSTEM_BINARY yourself to override either choice.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");

if (!process.env.MONGOMS_SYSTEM_BINARY) {
  try {
    const found = execSync("which mongod", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (found) process.env.MONGOMS_SYSTEM_BINARY = found;
  } catch {
    // no system mongod; mongodb-memory-server will download one
  }
}

let server = null;

export async function startMongo() {
  server = await MongoMemoryServer.create();
  const uri = server.getUri();
  await mongoose.connect(uri, { dbName: "statsnap-test" });

  // Belt and braces: whatever happens with env files, the connected host
  // must be the in-memory server on loopback, never a remote cluster.
  const { host } = mongoose.connection;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing to run tests against non-local MongoDB host: ${host}`);
  }
  return uri;
}

export async function clearCollections() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export async function stopMongo() {
  await mongoose.disconnect();
  if (server) await server.stop();
  server = null;
}
