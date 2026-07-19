# Tail'ed

> A platform to help tech students grow, connect, and land internships—with community at its core.

[![Contributors](https://contrib.rocks/image?repo=tailed-community/dashboard)](https://github.com/tailed-community/dashboard/graphs/contributors)

![GitHub contributors](https://img.shields.io/github/contributors/tailed-community/dashboard?color=orange)

![GitHub stars](https://img.shields.io/github/stars/tailed-community/dashboard?style=social)
![GitHub forks](https://img.shields.io/github/forks/tailed-community/dashboard?style=social)

![GitHub issues](https://img.shields.io/github/issues/tailed-community/dashboard)
![GitHub pull requests](https://img.shields.io/github/issues-pr/tailed-community/dashboard)
![License](https://img.shields.io/github/license/tailed-community/dashboard)

## 🌟 About

Tail'ed Community is a comprehensive platform designed to empower tech students by providing tools for:

- **Portfolio Building**: Showcase your projects and skills
- **Community Connection**: Connect with fellow students and professionals
- **Internship Opportunities**: Discover and apply for tech internships
- **Skill Development**: Track your learning journey and progress

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- Firebase CLI (for development)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/tailed-community/dashboard.git
cd dashboard
```

2. **Install dependencies**

```bash
npm install
# or
pnpm install
```

3. **Set up environment variables**

```bash
cp .env.example .env.local
# Edit .env.local with your Firebase configuration
```

4. **Start the development server**

```bash
npm run dev
# or
pnpm dev
```

5. **Open your browser**
   Visit [http://localhost:5174](http://localhost:5173)

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: TailwindCSS + shadcn/ui
- **Backend**: Firebase (Firestore, Functions, Auth)
- **Validation**: Zod
- **Forms**: React Hook Form
- **State Management**: React Hooks + Context
- **Internationalization**: Paraglide JS

## 📦 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── layout/         # Layout components
├── pages/              # Page components
│   ├── (auth)/         # Authentication pages
│   └── (dashboard)/    # Dashboard pages
├── lib/                # Utility functions and configs
├── hooks/              # Custom React hooks
├── contexts/           # React contexts
├── types/              # TypeScript type definitions
└── paraglide/          # Internationalization
```

## 🤝 Contributing

We welcome contributions from developers of all skill levels!

### Quick Contribution Guide

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feat/amazing-feature`
3. **Make your changes**
4. **Run tests**: `npm test`
5. **Commit your changes**: `git commit -m 'feat: add amazing feature'`
6. **Push to your branch**: `git push origin feat/amazing-feature`
7. **Open a Pull Request**

For detailed guidelines, please read our [Contributing Guide](./CONTRIBUTING.md).

### Good First Issues

New to the project? Look for issues labeled [`good first issue`](https://github.com/tailed-community/dashboard/labels/good%20first%20issue).

## 📚 Documentation

- [Contributing Guidelines](./CONTRIBUTING.md)
- [Code of Conduct](./docs/CODE_OF_CONDUCT.md)
- [Architecture Decision Records](./docs/adr/)
- [API Documentation](./docs/api/)

## 🧪 Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
npm run type-check      # Run TypeScript checks

# Firebase
npm run dev             # Start with Firebase emulators
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## 🚀 Deployment

The application is deployed on Firebase Hosting with automatic deployments from the `main` branch.

```bash
# Deploy to Firebase
npm run build
firebase deploy
```

## 🐛 Bug Reports

Found a bug? Please create an issue using our [bug report template](https://github.com/tailed-community/dashboard/issues/new?template=bug_report.md).

## 💡 Feature Requests

Have an idea? We'd love to hear it! Create a [feature request](https://github.com/tailed-community/dashboard/issues/new?template=feature_request.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- All our amazing [contributors](https://github.com/tailed-community/dashboard/graphs/contributors)
- The open source community for the fantastic tools and libraries
- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components

## 📞 Support

- 💬 [GitHub Discussions](https://github.com/tailed-community/dashboard/discussions)
- 🐛 [Report Issues](https://github.com/tailed-community/dashboard/issues)
- 📧 [Contact Us](mailto:contact@tailed.ca)

---

<div align="center">
  Made with ❤️ by the Tail'ed Community
</div>
