#!/usr/bin/env node

import pkg from "@infisical/sdk";
const { InfisicalClient } = pkg;
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Configuration
const config = {
  environment: "prod",
  paths: {
    frontend: "/Env-Variables/frontend",
    backend: "/Env-Variables/backend",
  },
  outputFiles: {
    frontend: join(projectRoot, ".env"),
    backend: join(projectRoot, "src-tauri", ".env"),
  },
};

// Utility functions
function log(message) {
  console.log(`[fetch-secrets] ${message}`);
}

function error(message) {
  console.error(`[fetch-secrets] ERROR: ${message}`);
}

function ensureDirectoryExists(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function formatSecretsAsEnv(secrets) {
  return secrets
    .map((secret) => `${secret.secretKey}=${secret.secretValue}`)
    .join("\n");
}

async function initializeInfisicalClient() {
  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  if (!clientId || !clientSecret || !projectId) {
    throw new Error(
      "INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, and INFISICAL_PROJECT_ID must be set"
    );
  }

  log("Initializing Infisical SDK client...");

  try {
    const client = new InfisicalClient({
      auth: {
        universalAuth: {
          clientId: clientId,
          clientSecret: clientSecret,
        },
      },
    });

    log("✅ Infisical SDK client initialized successfully");
    return { client, projectId };
  } catch (err) {
    throw new Error(`Failed to initialize Infisical client: ${err.message}`);
  }
}

async function discoverSecretStructure(client, projectId) {
  log("Discovering secret structure...");

  try {
    // List all secrets in root to understand the structure
    log("Listing all secrets in root:");
    const rootSecrets = await client.listSecrets({
      environment: config.environment,
      projectId: projectId,
      path: "/",
    });

    if (rootSecrets.length > 0) {
      console.log(`Found ${rootSecrets.length} secrets in root:`);
      rootSecrets.forEach((secret) => {
        console.log(`  - ${secret.secretKey}`);
      });
    } else {
      log("No secrets found in root path");
    }

    // Try to list secrets in the expected folders
    const foldersToCheck = [
      "/Env-Variables/frontend",
      "/Env-Variables/backend",
    ];

    for (const folderPath of foldersToCheck) {
      try {
        log(`Checking folder: ${folderPath}`);
        const folderSecrets = await client.listSecrets({
          environment: config.environment,
          projectId: projectId,
          path: folderPath,
        });

        if (folderSecrets.length > 0) {
          console.log(
            `Found ${folderSecrets.length} secrets in ${folderPath}:`
          );
          folderSecrets.forEach((secret) => {
            console.log(`  - ${secret.secretKey}`);
          });
        } else {
          log(`No secrets found in ${folderPath}`);
        }
      } catch (err) {
        log(`Could not access ${folderPath}: ${err.message}`);
      }
    }
  } catch (err) {
    log(`Error during discovery: ${err.message}`);
  }
}

async function fetchSecrets(client, projectId, secretPath, outputFile, label) {
  log(`Fetching ${label} secrets from path: ${secretPath}`);

  // Ensure output directory exists
  ensureDirectoryExists(outputFile);

  // Try different path formats
  const pathVariants = [
    secretPath, // Original path (e.g., "/Env-Variables/frontend")
    secretPath.replace(/^\//, ""), // Without leading slash (e.g., "Env-Variables/frontend")
    "/", // Root path as fallback
  ];

  for (let i = 0; i < pathVariants.length; i++) {
    const currentPath = pathVariants[i];
    const isRootFallback = currentPath === "/";

    log(
      `Attempt ${i + 1}: Trying path "${currentPath}"${
        isRootFallback ? " (root fallback)" : ""
      }`
    );

    try {
      const secrets = await client.listSecrets({
        environment: config.environment,
        projectId: projectId,
        path: currentPath,
      });

      if (secrets.length > 0) {
        const envContent = formatSecretsAsEnv(secrets);
        writeFileSync(outputFile, envContent);
        log(`✅ ${label} secrets saved to ${outputFile}`);

        return true;
      } else {
        log(`❌ No secrets found in path "${currentPath}"`);
      }
    } catch (err) {
      log(`❌ Failed with path "${currentPath}": ${err.message}`);
    }
  }

  throw new Error(`Failed to fetch ${label} secrets from any path variant`);
}

async function main() {
  try {
    log("Starting secret fetching process...");

    // Initialize Infisical client
    const { client, projectId } = await initializeInfisicalClient();

    // Discover structure (for debugging)
    await discoverSecretStructure(client, projectId);

    // Fetch secrets
    await fetchSecrets(
      client,
      projectId,
      config.paths.frontend,
      config.outputFiles.frontend,
      "frontend"
    );

    // Try to fetch backend secrets, but don't fail if they don't exist
    try {
      await fetchSecrets(
        client,
        projectId,
        config.paths.backend,
        config.outputFiles.backend,
        "backend"
      );
    } catch (err) {
      log(
        `⚠️  Backend secrets not found, creating empty .env file: ${err.message}`
      );
      // Create empty backend .env file
      ensureDirectoryExists(config.outputFiles.backend);
      writeFileSync(config.outputFiles.backend, "# No backend secrets found\n");
    }

    log("✅ All secrets fetched successfully!");
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, fetchSecrets, initializeInfisicalClient };
