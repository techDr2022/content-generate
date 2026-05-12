"use strict";

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

/** Repo root (parent of /scripts) */
const root = path.join(__dirname, "..");

function loadRootEnv() {
  const files = [path.join(root, ".env"), path.join(root, "server", ".env")];
  for (const file of files) {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file, override: true });
    }
  }
}

loadRootEnv();
