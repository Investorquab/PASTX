# PASTX Deployment Plan

**Status:** planned. No live deployment is implied by this document.

## Environments

- **Local:** web app, API and fixtures; no real trade execution by default.
- **Integration:** controlled RPC and provider credentials; only test assets and explicitly approved transactions.
- **Demo/production:** public frontend and API with secret-managed configuration, monitoring and clear disclosures.

## Frontend

Vercel is a candidate for the web application. Configure the correct app root/build commands once the workspace is runnable. Do not expose server-only market-data keys through public client environment variables.

## API

Deploy the Fastify API to a Node-compatible host. Configure CORS for known origins, request limits, health checks, timeouts, rate limits and structured logs. Use managed secrets for credentials. PostgreSQL and Redis are optional and should only be provisioned when required.

## Network configuration

- Configure RPC endpoint and expected network identity explicitly.
- Validate chain/runtime identity on startup and before signing-sensitive flows.
- Do not silently switch to another network.
- Keep local, test and demo configuration distinct.
- Document whether an environment supports reads, writes, contracts and the exact settlement route.

## Release checklist

- clean install and reproducible build;
- checks and tests pass;
- environment variables documented without secret values;
- API and frontend URLs configured;
- RPC/network identity confirmed;
- wallet and Android signing behavior tested;
- transaction evidence captured and independently verifiable;
- rollback and incident response instructions documented;
- README accurately states known limitations.
