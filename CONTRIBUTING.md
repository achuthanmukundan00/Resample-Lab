# Contributing

Issues, PRs, and forks welcome. This is a small experimental project and all genuine help is appreciated.

## Issues

Bug reports, feature ideas, and questions are all fine. Just be specific:

- What you did, what you expected, what happened instead
- If it's a crash, paste the error (logs are your friend)
- If it's a feature request, explain the *why* — what problem does it solve for actual users?

## Pull Requests

Keep them focused. A good PR:

- Addresses one thing
- Has a descriptive title and summary
- Doesn't mix refactors with bugfixes unless they're the same change
- Passes existing tests (`pytest apps/api/tests/`)
- If it touches the frontend, test it in a browser

If your PR is large, open an issue first so we can talk about direction before you sink time into code.

## AI-generated contributions

This project is explicitly **non-AI** in its core processing — DSP via ffmpeg, numpy, and scipy. That doesn't mean AI tooling is banned, but here's the rule:

**Don't submit clanker slop.**

If you use an LLM to write code, that's fine, but *you* are responsible for what it produces. Review it. Understand it. Make sure it's correct, necessary, and follows the project's style. PRs that are obviously vomited out with no human review will be closed.

Good AI-assisted contribution: you describe what needs to change, the tool generates a draft, you clean it up, test it, and submit something thoughtful.

Clanker slop: a 500-line PR with hallucinated imports, broken logic, and a commit message of "fix: update code" that the submitter clearly never read.

Be the first kind, not the second.

## Code of conduct

Don't be a jerk. That's it.
