# Contributing to Tail'ed

We're excited that you're interested in contributing to Tail'ed! This document provides guidelines and information for contributors.

## 🎯 Project Vision

Tail'ed is a platform designed to empower tech students by providing tools for portfolio building, community connection, internship opportunities, and skill development. Every contribution should align with this mission.

## 🚀 Quick Start for Contributors

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/dashboard.git
cd dashboard

# Add the original repository as upstream
git remote add upstream https://github.com/tailed-community/dashboard.git
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase configuration

# Start development server with Firebase emulators
npm run dev
```

### 3. Create a Feature Branch

```bash
# Create and switch to a new feature branch
git checkout -b feat/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

## 📋 Types of Contributions

We welcome various types of contributions:

### 🐛 Bug Reports

- Use the [bug report template](https://github.com/tailed-community/dashboard/issues/new?template=bug_report.md)
- Include steps to reproduce, expected behavior, and actual behavior
- Add screenshots or error logs when applicable

### ✨ Feature Requests

- Use the [feature request template](https://github.com/tailed-community/dashboard/issues/new?template=feature_request.md)
- Explain the problem you're trying to solve
- Describe your proposed solution
- Consider alternative solutions

### 🔧 Code Contributions

- Bug fixes
- New features
- Performance improvements
- Code refactoring
- Documentation improvements

### 📚 Documentation

- README improvements
- API documentation
- Code comments
- Tutorial content

## 🛠️ Development Guidelines

### Tech Stack Requirements

Our project uses:

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: TailwindCSS + shadcn/ui
- **Backend**: Firebase (Firestore, Functions, Auth)
- **Validation**: Zod
- **Forms**: React Hook Form
- **State Management**: React Hooks + Context
- **Internationalization**: Paraglide JS

### Code Standards

#### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` type unless absolutely necessary
- Use Zod for runtime validation

#### React

- Use functional components with hooks
- Follow React best practices and hooks rules
- Use proper component composition
- Implement proper error boundaries

#### Styling

- Use TailwindCSS for styling
- Follow shadcn/ui component patterns
- Ensure responsive design
- Maintain consistent spacing and typography

#### Firebase

- Use Firebase SDK best practices
- Implement proper security rules
- Follow Firestore data modeling guidelines
- Use Firebase Functions for server-side logic

### Code Quality

#### Linting and Formatting

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check
```

#### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

#### Commit Standards

We use [Conventional Commits](./docs/CONVENTIONAL_COMMITS.md):

```bash
# Examples
git commit -m "feat: add user profile dashboard"
git commit -m "fix: resolve authentication redirect issue"
git commit -m "docs: update API documentation"
git commit -m "style: improve button component styling"
git commit -m "refactor: optimize database queries"
```

Use `npm run cz` for interactive commit creation.

## 🔄 Pull Request Process

### Before Submitting

1. **Sync with upstream**:

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   git push origin main
   ```

2. **Rebase your feature branch**:

   ```bash
   git checkout feat/your-feature-name
   git rebase main
   ```

3. **Run quality checks**:
   ```bash
   npm run lint
   npm run type-check
   npm test
   npm run build
   ```

### PR Requirements

- **Clear title**: Use conventional commit format
- **Description**: Explain what changes you made and why
- **Tests**: Include tests for new functionality
- **Documentation**: Update relevant documentation
- **Screenshots**: Include before/after screenshots for UI changes

### PR Template

```markdown
## Description

Brief description of changes made

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Tests pass locally
- [ ] Manual testing completed
- [ ] Screenshots included (if applicable)

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No breaking changes (or properly documented)
```

## 🎨 UI/UX Guidelines

### Design Principles

- **Accessibility**: Follow WCAG 2.1 guidelines
- **Responsive**: Mobile-first design approach
- **Consistent**: Use design system components
- **Intuitive**: Clear navigation and user flows

### Component Guidelines

- Use shadcn/ui components as base
- Extend components following established patterns
- Maintain consistent spacing using Tailwind classes
- Implement proper loading and error states

## 🏗️ Architecture Guidelines

### Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui base components
│   └── layout/         # Layout-specific components
├── pages/              # Page components (route-based)
├── lib/                # Utility functions and configs
├── hooks/              # Custom React hooks
├── contexts/           # React contexts for state
├── types/              # TypeScript type definitions
└── paraglide/          # Internationalization files
```

### File Naming

- Use kebab-case for files and folders
- Use PascalCase for React components
- Use camelCase for functions and variables
- Include `.types.ts` suffix for type-only files

### Import Organization

```typescript
// 1. React and external libraries
import React from "react";
import { useForm } from "react-hook-form";

// 2. Internal utilities and configs
import { cn } from "@/lib/utils";

// 3. Components
import { Button } from "@/components/ui/button";

// 4. Types
import type { UserProfile } from "@/types/user";
```

## 🔧 Firebase Development

### Local Development

- Always use Firebase emulators for development
- Import/export emulator data for consistency
- Test security rules locally

### Functions Development

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Build functions
npm run build
```

### Database Guidelines

- Use proper Firestore data modeling
- Implement proper indexing
- Follow security rule best practices
- Use subcollections appropriately

## 🌍 Internationalization

We use Paraglide JS for internationalization:

### Adding New Messages

1. Add messages to `messages/en.json` and `messages/fr.json`
2. Run `npm run inlang-compile` to generate types
3. Use messages in components:

   ```typescript
   import * as m from "@/paraglide/messages";

   export function WelcomeMessage() {
     return <h1>{m.welcome()}</h1>;
   }
   ```

## 🎯 Good First Issues

New contributors should look for issues labeled:

- `good first issue`: Perfect for newcomers
- `documentation`: Documentation improvements
- `help wanted`: Community help needed
- `bug`: Bug fixes (usually well-defined scope)

## 🆘 Getting Help

- **GitHub Discussions**: Ask questions and share ideas
- **Issues**: Report bugs or request features
- **Discord**: Join our community chat (link in README)

## 📚 Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## 🏆 Recognition

Contributors are recognized in:

- README contributors section
- Release notes for significant contributions
- Special mentions in community updates

## 📜 License

By contributing to Tail'ed, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Tail'ed! Together, we're building a platform that empowers tech students worldwide. 🚀
