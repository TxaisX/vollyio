# Tooling / MCP Register (section 10.5)

`.mcp.json` today holds only the Supabase server. Any added server passes Sierra's gate BEFORE Thomas installs it.
Sierra gate, per candidate: publisher/provenance (official?) · exact tool scopes + permissions · security (no unexpected network/fs/secret access, least privilege) · necessity (cheapest tool for a real mission need) · licensing/terms · pinned version.
Section 9 approval covers account-touching parts (writing a hosted secret; enabling a server that can act on an external account) — owner delegated that gate to the agents for this mission, but destructive/account-acting servers stay conservative and Sierra-gated. New env → `.env.example`, never a committed secret.

| Server | Purpose | Scopes | Verifier | Decision ref | Pinned version |
|---|---|---|---|---|---|
| (none added yet) | | | | | |
