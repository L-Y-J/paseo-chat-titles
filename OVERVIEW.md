# Chat Titles

Generates concise chat titles after a completed, meaningful task. Greetings wait until a task appears. Chat metadata changes without adding instructions, MCPs or permissions to working agents.

Choose Codex or Claude and a model under the plugin's Chat Titles settings. Defaults to GPT-6 Luna using the daemon user's existing Codex login; Claude defaults to Haiku. The selected provider's usage limits apply. Unsupported models leave the current title unchanged, without silently switching providers.

Requires a Paseo 0.12.x daemon and client, Node.js 22+, and an installed, authenticated CLI on a Linux or macOS host. Codex was verified with 0.162.1; older versions may lack required isolation flags. The plugin does not install software. See the repository README for CLI setup and non-default daemon homes.

Up to three user-message excerpts of 1,200 characters each go to the selected CLI/provider. Tool output, assistant messages, reasoning and files are excluded. Common token patterns are redacted, but secret detection is not comprehensive. Existing CLI authentication is used; credential files are not read directly by the plugin.

Helpers run in a scratch directory with a title-only prompt and invocation-specific restrictions. Claude disables tools, MCPs, skills, hooks and normal settings. Codex runs ephemerally in a read-only sandbox with user config, project instructions, discovered skills, hooks, plugins, connectors, shell/image tools and web search disabled. CLI flags are version-dependent. Working-agent configuration remains unchanged.

Names each eligible chat once and preserves other titles. Existing history is not bulk-renamed; eligible chats can be named on their next completed turn. Subagents, failed/canceled turns and archived chats are skipped. Manual-title detection follows Paseo's default naming convention; a rename between the final check and update can still race because Paseo 0.12 has no atomic title update guard.

Settings are shared by authorized clients of the same daemon. Local private state stores agent IDs, generated titles and attempt counts, not transcripts. Helpers are limited to two at a time, a 26-second deadline and three attempts per chat. Disabling or removing the plugin preserves chat titles.
