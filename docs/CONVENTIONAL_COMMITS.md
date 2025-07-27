# ✍️ Conventional Commits Guide

The **Conventional Commits** specification helps us write consistent, clear commit messages that make it easier to track changes, generate changelogs, and automate releases.

Official spec: [https://www.conventionalcommits.org/en/v1.0.0/](https://www.conventionalcommits.org/en/v1.0.0/)

---

## ✅ Commit Message Format

<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

makefile
Copy
Edit

### Example

```bash
feat: add dark mode toggle
fix(auth): resolve login redirect issue
docs(readme): update getting started instructions
style: reformat code with Prettier
refactor: simplify signup form logic
test: add unit tests for user service
chore: update dependencies
🔠 Types
Type	Purpose
feat	A new feature
fix	A bug fix
docs	Documentation-only changes
style	Code style changes (e.g., whitespace, formatting)
refactor	Code refactoring that doesn’t add features or fix bugs
perf	Performance improvements
test	Adding or updating tests
chore	Changes to build tools, CI, dependencies, etc.
build	Build system or external dependencies
ci	Changes to CI/CD configuration

🧠 Writing Good Messages
Use the imperative mood: add, not added or adds

Keep the description under 72 characters

Use the body (optional) for more context or reasoning

Add a footer (optional) for metadata like:

yaml
Copy
Edit
BREAKING CHANGE: updated user auth flow
Closes #42
🔧 Why We Use It
✅ Makes the history easier to read

📦 Enables automated changelogs and versioning

🚀 Works well with semantic release tools

🤝 Keeps the team aligned

📚 Resources
Conventional Commits Spec

commitlint

standard-version

semantic-release
```
