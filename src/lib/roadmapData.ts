export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  keyTopics: string[];
  recommendedProject: string;
  estimatedWeeks: string;
}

export interface RoadmapPhase {
  phaseTitle: string;
  items: RoadmapItem[];
}

export interface RoadmapData {
  roleId: string;
  roleTitle: string;
  category: "role" | "skill";
  overview: string;
  targetTimeline: string;
  phases: RoadmapPhase[];
}

export const PRESET_ROADMAPS: Record<string, RoadmapData> = {
  // ─── ROLE-BASED ROADMAPS ──────────────────────────────────────────────
  "frontend": {
    roleId: "frontend",
    roleTitle: "Frontend Developer",
    category: "role",
    overview: "Master modern web development from semantic HTML/CSS to advanced React ecosystems, state management, and performance tuning.",
    targetTimeline: "6 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Web Foundations & Modern JavaScript",
        items: [
          {
            id: "fe-1",
            title: "HTML5, Semantic Markup & SEO",
            description: "Build accessible, responsive page skeletons using HTML5 tags, accessibility standards (ARIA), and SEO best practices.",
            requiredSkills: ["HTML5", "ARIA", "Semantic Markup"],
            keyTopics: ["Document Structure", "Meta tags & OpenGraph", "Forms & Client Validation", "Screen Readers"],
            recommendedProject: "Build an Accessible Developer Portfolio page with 100/100 Lighthouse score.",
            estimatedWeeks: "2 Weeks"
          },
          {
            id: "fe-2",
            title: "Modern CSS, Flexbox, Grid & Tailwind",
            description: "Master modern CSS styling without relying on legacy hacks, including CSS Grid, Flexbox, responsive design, and Tailwind CSS.",
            requiredSkills: ["CSS3", "Flexbox", "CSS Grid", "Tailwind CSS"],
            keyTopics: ["Box Model", "Grid Template Areas", "Media Queries & Mobile-first", "Tailwind utility patterns"],
            recommendedProject: "Build a responsive E-commerce Product Page with interactive galleries and cart layouts.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "fe-3",
            title: "Deep JavaScript (ES6+) & DOM Manipulation",
            description: "Understand scopes, closures, async/await, event loops, promises, and dynamic DOM manipulation.",
            requiredSkills: ["JavaScript", "ES6+", "Async/Await", "DOM API"],
            keyTopics: ["Closures & Prototypes", "Event Bubbling & Delegation", "Fetch API & Promises", "Event Loop microtasks"],
            recommendedProject: "Build an interactive Kanban Task Board with drag-and-drop and LocalStorage persistence.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Modern Frontend Frameworks & Ecosystem",
        items: [
          {
            id: "fe-4",
            title: "React.js Core & Hooks Mastery",
            description: "Component lifecycle, JSX, hooks (useState, useEffect, useMemo, useCallback, useRef), and unidirectional data flow.",
            requiredSkills: ["React", "React Hooks", "Component Design"],
            keyTopics: ["Virtual DOM diffing", "Custom Hooks", "Context API", "Component Re-render optimization"],
            recommendedProject: "Build a Real-time Weather & Air Quality Dashboard with API polling and interactive charts.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "fe-5",
            title: "TypeScript for Frontend",
            description: "Add static typing to React applications to prevent runtime bugs and improve code maintainability.",
            requiredSkills: ["TypeScript", "Type Inference", "Generics"],
            keyTopics: ["Interfaces vs Types", "Typing React Props & Events", "Generics", "Utility Types (Pick, Omit, Partial)"],
            recommendedProject: "Refactor your React project to TypeScript with strict mode enabled and zero any types.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "fe-6",
            title: "Next.js & Server-Side Rendering (SSR/SSG)",
            description: "Modern fullstack frontend with Next.js App Router, Server Components (RSC), SEO optimization, and API routing.",
            requiredSkills: ["Next.js", "Server Components", "SSR/SSG"],
            keyTopics: ["App Router & Layouts", "Client vs Server Components", "Static Site Generation", "Dynamic Route Handlers"],
            recommendedProject: "Build a full-fledged Developer Blog with MDX, dynamic tagging, and dynamic OG images.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 3: State Management, Testing & Production Readiness",
        items: [
          {
            id: "fe-7",
            title: "Global State Management & Server State",
            description: "Master client cache and global state with tools like Zustand, Redux Toolkit, or TanStack React Query.",
            requiredSkills: ["Zustand", "TanStack Query", "State Management"],
            keyTopics: ["Client State vs Server Cache", "Optimistic Updates", "Infinite Query & Pagination", "Cache Invalidation"],
            recommendedProject: "Build a Real-time Social Feed with infinite scroll, like counters, and instant cache updates.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "fe-8",
            title: "Frontend Testing, CI/CD & Performance Audit",
            description: "Write unit and component tests with Vitest / React Testing Library, and optimize Core Web Vitals.",
            requiredSkills: ["Testing", "Vitest", "Lighthouse", "Core Web Vitals"],
            keyTopics: ["Unit testing components", "Mocking API calls", "LCP / FID / CLS optimization", "Vercel / GitHub Actions CI"],
            recommendedProject: "Configure GitHub Actions CI pipeline to run lints, typechecks, and tests before automated deployment.",
            estimatedWeeks: "2 Weeks"
          }
        ]
      }
    ]
  },

  "backend": {
    roleId: "backend",
    roleTitle: "Backend Developer",
    category: "role",
    overview: "Master backend architectures, REST & GraphQL APIs, database design (SQL & NoSQL), authentication, caching, and scalable microservices.",
    targetTimeline: "6 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Languages, Runtime & API Fundamentals",
        items: [
          {
            id: "be-1",
            title: "Node.js / Express or Python / FastAPI",
            description: "Understand server runtime, event-driven I/O, middleware architecture, and designing clean RESTful endpoints.",
            requiredSkills: ["Node.js", "Express", "REST APIs", "Async Programming"],
            keyTopics: ["Event Loop & Streams", "Middleware pipeline", "Error handling architecture", "Request validation & Zod/Pydantic"],
            recommendedProject: "Build a production-grade URL Shortener & Analytics API with custom aliases and click tracking.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "be-2",
            title: "Relational Databases (PostgreSQL / MySQL)",
            description: "Design relational schemas, write complex joins, understand ACID transactions, indexing, and query execution plans.",
            requiredSkills: ["PostgreSQL", "SQL", "Database Design", "Indexing"],
            keyTopics: ["Normalization (1NF to 3NF)", "Indexes (B-Tree, GIN)", "Foreign keys & Cascade rules", "Transactions & Isolation Levels"],
            recommendedProject: "Design an E-commerce Order Management Schema with inventory locking and payment reconciliation.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Authentication, Security & NoSQL",
        items: [
          {
            id: "be-3",
            title: "Auth, JWTs, OAuth2 & Security Best Practices",
            description: "Implement secure user authentication, role-based access control (RBAC), bcrypt hashing, and rate limiting.",
            requiredSkills: ["Authentication", "JWT", "OAuth2", "Security"],
            keyTopics: ["Access & Refresh tokens", "Session vs Token Auth", "CSRF, XSS, and SQL Injection prevention", "Rate limiting"],
            recommendedProject: "Build a multi-tenant Authentication Service with email verification and Google OAuth2 login.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "be-4",
            title: "NoSQL & Document Databases (MongoDB / Firestore)",
            description: "Understand unstructured data modeling, aggregation pipelines, document references, and sharding strategies.",
            requiredSkills: ["MongoDB", "Firestore", "NoSQL Modeling"],
            keyTopics: ["Embedding vs Referencing", "Aggregation Framework", "Compound Indexing", "Real-time subscriptions"],
            recommendedProject: "Build a Multi-room Real-time Chat Backend with message history and typing indicators.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 3: Caching, Queues & Distributed Systems",
        items: [
          {
            id: "be-5",
            title: "In-Memory Caching with Redis",
            description: "Supercharge API response times using Redis as an in-memory cache, session store, and distributed lock.",
            requiredSkills: ["Redis", "Caching Strategies", "Pub/Sub"],
            keyTopics: ["Cache-aside pattern", "TTL & Eviction policies", "Redis Data types (Hashes, Sorted Sets)", "Pub/Sub & Queues"],
            recommendedProject: "Implement a Live Leaderboard and API Caching layer for an online tournament API.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "be-6",
            title: "Message Brokers (Kafka / RabbitMQ / BullMQ)",
            description: "Decouple heavy tasks from user requests using asynchronous queues and event-driven architecture.",
            requiredSkills: ["Message Queues", "BullMQ", "Event-Driven Architecture"],
            keyTopics: ["Producer-Consumer model", "Dead Letter Queues", "Idempotency", "Background PDF/Email processing"],
            recommendedProject: "Build a Background Video/Document Processing Service that sends push/email alerts when complete.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      }
    ]
  },

  "fullstack": {
    roleId: "fullstack",
    roleTitle: "Full Stack Developer",
    category: "role",
    overview: "Bridge client and server seamlessly: React/Next.js frontend, Node.js/Python backend, SQL/NoSQL databases, and full CI/CD deployment.",
    targetTimeline: "7 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Fullstack Architecture & Monorepos",
        items: [
          {
            id: "fs-1",
            title: "Unified TypeScript End-to-End",
            description: "Write type-safe APIs sharing schema definitions between client and server using tRPC, Zod, and Next.js.",
            requiredSkills: ["TypeScript", "Fullstack", "Zod", "tRPC"],
            keyTopics: ["End-to-end type safety", "Monorepo tooling (Turborepo/npm workspaces)", "Shared validation models", "API contracts"],
            recommendedProject: "Build a Type-safe Task Collaboration app where API schema changes reflect on the frontend at compile-time.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "fs-2",
            title: "Database Modeling & ORMs (Prisma / Drizzle)",
            description: "Model relational database tables, run automated migrations, and seed mock data using modern ORMs.",
            requiredSkills: ["Prisma", "Drizzle ORM", "PostgreSQL", "Database Migrations"],
            keyTopics: ["Declarative schema definitions", "Migration workflows", "Relational queries & transactions", "Connection pooling"],
            recommendedProject: "Build a Multi-vendor Marketplace database schema with categories, reviews, and transaction auditing.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Complex Workflows, Payments & WebSockets",
        items: [
          {
            id: "fs-3",
            title: "Payment Gateway Integration (Stripe / Razorpay)",
            description: "Handle webhooks, subscription billing, idempotency keys, and checkout flows securely.",
            requiredSkills: ["Stripe", "Payment Gateways", "Webhooks"],
            keyTopics: ["Webhook signature verification", "Subscription lifecycles", "Handling failed payments", "Invoice generation"],
            recommendedProject: "Build a SaaS Subscription Portal with tiered pricing, upgrade/downgrade logic, and invoice PDF generation.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "fs-4",
            title: "Real-time Collaboration & WebSockets",
            description: "Live real-time bidirectional messaging and document syncing using Socket.io or WebSockets.",
            requiredSkills: ["WebSockets", "Socket.io", "Real-time sync"],
            keyTopics: ["Socket connections & rooms", "Reconnection strategies", "Optimistic concurrency", "Presence indicators"],
            recommendedProject: "Build a Google Docs style Collaborative Rich Text Editor with live user cursors and changes.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 3: Production Deployment & Observability",
        items: [
          {
            id: "fs-5",
            title: "Dockerization & Cloud Hosting (AWS / Render / Vercel)",
            description: "Containerize multi-tier apps, configure environment variables safely, and set up custom domain DNS.",
            requiredSkills: ["Docker", "Vercel", "Cloud Hosting", "CI/CD"],
            keyTopics: ["Multi-container setups", "Environment secrets management", "CDN caching headers", "Automated preview branches"],
            recommendedProject: "Deploy a production-grade Fullstack SaaS app with automated staging environments on pull requests.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      }
    ]
  },

  "android": {
    roleId: "android",
    roleTitle: "Android Developer",
    category: "role",
    overview: "Build high-performance native Android applications using modern Kotlin, Jetpack Compose, Coroutines, MVVM, and Room DB.",
    targetTimeline: "6 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Kotlin Core & Jetpack Compose UI",
        items: [
          {
            id: "and-1",
            title: "Kotlin Language & Coroutines",
            description: "Master Kotlin null safety, extension functions, Coroutines for background tasks, and Flow for asynchronous streams.",
            requiredSkills: ["Kotlin", "Coroutines", "Kotlin Flow"],
            keyTopics: ["Null safety & Lambdas", "Dispatchers (IO vs Main)", "Cold vs Hot Streams (Flow)", "Exception handling in coroutines"],
            recommendedProject: "Build a Crypto Price Tracker app with live polling and background price alert notifications.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "and-2",
            title: "Modern Declarative UI with Jetpack Compose",
            description: "Build reactive, smooth Android interfaces using Compose state, modifiers, navigation, and Material 3 design.",
            requiredSkills: ["Jetpack Compose", "Material 3", "State Management"],
            keyTopics: ["Recomposition principles", "State hoisting", "LazyColumn / LazyRow performance", "Compose Navigation"],
            recommendedProject: "Build a Spotify-inspired Music Player UI with smooth animations, dark mode, and interactive playlist screens.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Android Architecture & Local Persistence",
        items: [
          {
            id: "and-3",
            title: "MVVM Architecture & Hilt Dependency Injection",
            description: "Separate business logic from UI using Android ViewModel, Repositories, and Hilt / Dagger DI.",
            requiredSkills: ["MVVM", "Hilt", "Clean Architecture"],
            keyTopics: ["ViewModel lifecycle", "Dependency injection scopes", "Repository pattern", "Unit testing ViewModels"],
            recommendedProject: "Build a News Reader app that fetches articles from a REST API and caches them offline.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "and-4",
            title: "Offline-First Storage with Room & Retrofit",
            description: "Store relational data locally with Room SQLite ORM and sync remote REST APIs using Retrofit & Moshi.",
            requiredSkills: ["Room DB", "Retrofit", "Offline-First"],
            keyTopics: ["Room Entities, DAOs & TypeConverters", "Network bound resource pattern", "Interceptors & Auth headers", "WorkManager"],
            recommendedProject: "Build an Offline-First Personal Finance Tracker with category spending breakdowns and CSV export.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      }
    ]
  },

  "ios": {
    roleId: "ios",
    roleTitle: "iOS Developer",
    category: "role",
    overview: "Develop sleek Apple ecosystem apps using Swift, SwiftUI, Combine, SwiftData/CoreData, and Xcode development workflows.",
    targetTimeline: "6 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Swift & SwiftUI Declarative UI",
        items: [
          {
            id: "ios-1",
            title: "Swift 6 & Modern Concurrency (Async/Await)",
            description: "Master Swift protocols, optionals, memory management (ARC), Actors, and structured async/await tasks.",
            requiredSkills: ["Swift", "Async/Await", "ARC", "Protocols"],
            keyTopics: ["Optionals & Guard statements", "Structures vs Classes", "Actors & Thread safety", "Generics in Swift"],
            recommendedProject: "Build a Recipe & Meal Planning command-line and interactive UI tool with asynchronous API lookups.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "ios-2",
            title: "SwiftUI & Apple Design Guidelines",
            description: "Create native iOS user experiences using Views, ViewModifiers, State, Binding, and NavigationStack.",
            requiredSkills: ["SwiftUI", "Apple HIG", "State & Binding"],
            keyTopics: ["@State, @Binding, @Observable", "NavigationStack & Sheets", "Custom animations & haptics", "Dynamic Island & Widgets"],
            recommendedProject: "Build a sleek Fitness Habit Tracker app with weekly ring progress widgets and interactive animations.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Local Persistence, Networking & App Store",
        items: [
          {
            id: "ios-3",
            title: "SwiftData / Core Data & URLSession",
            description: "Persist complex schemas locally with SwiftData and perform robust HTTP requests with URLSession.",
            requiredSkills: ["SwiftData", "Core Data", "URLSession", "JSON Parsing"],
            keyTopics: ["@Model macro & schema relationships", "Codable protocol", "Offline syncing", "Error handling in network calls"],
            recommendedProject: "Build an Offline-First Notes & Journal app with iCloud sync and tag filtering.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "ios-4",
            title: "iOS Testing, TestFlight & App Store Deployment",
            description: "Write XCTest unit and UI tests, configure certificates, identifiers, profiles, and publish to TestFlight.",
            requiredSkills: ["XCTest", "TestFlight", "App Store Submission"],
            keyTopics: ["Unit testing view models", "UI automation tests", "Fastlane build automation", "Privacy manifests & App Review guidelines"],
            recommendedProject: "Package, sign, and deploy your iOS app to TestFlight with automated continuous integration.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      }
    ]
  },

  "aiml": {
    roleId: "aiml",
    roleTitle: "AI & Machine Learning Engineer",
    category: "role",
    overview: "From foundational linear algebra and data preprocessing to deep learning, transformers, LLM prompt engineering, and RAG pipelines.",
    targetTimeline: "7 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Mathematics, Python & Data Foundations",
        items: [
          {
            id: "ai-1",
            title: "Mathematics for ML: Linear Algebra & Calculus",
            description: "Vectors, matrices, eigenvalues, gradients, loss surfaces, and partial derivatives essential for understanding neural networks.",
            requiredSkills: ["Linear Algebra", "Calculus", "Probability & Statistics"],
            keyTopics: ["Matrix Multiplications", "Gradient Descent", "Normal Distributions & Bayes Theorem", "Cost Functions"],
            recommendedProject: "Implement Linear Regression and Logistic Regression from scratch using only pure Python and NumPy.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "ai-2",
            title: "NumPy, Pandas & Exploratory Data Analysis (EDA)",
            description: "Clean, transform, and visualize complex datasets to extract statistical patterns.",
            requiredSkills: ["NumPy", "Pandas", "Matplotlib", "Seaborn"],
            keyTopics: ["Data imputation", "Feature Scaling & One-hot encoding", "Outlier detection", "Vectorized operations"],
            recommendedProject: "Perform comprehensive EDA on a Kaggle Student Placement or Housing dataset with insights report.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Classical Machine Learning & Deep Learning",
        items: [
          {
            id: "ai-3",
            title: "Scikit-Learn & Classical Supervised/Unsupervised ML",
            description: "Master Decision Trees, Random Forests, XGBoost, SVM, and Clustering algorithms.",
            requiredSkills: ["Scikit-Learn", "XGBoost", "Model Evaluation"],
            keyTopics: ["Cross-validation & Overfitting", "ROC-AUC, Precision, Recall", "Hyperparameter tuning", "Ensemble methods"],
            recommendedProject: "Build a Loan Default Prediction Model and evaluate feature importances using SHAP.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "ai-4",
            title: "PyTorch & Deep Neural Networks",
            description: "Understand Tensors, Backpropagation, CNNs for computer vision, and RNNs/LSTMs for sequences.",
            requiredSkills: ["PyTorch", "Deep Learning", "Neural Networks"],
            keyTopics: ["Autograd engine", "Custom Datasets & DataLoaders", "Convolutional layers & Transfer Learning", "Loss functions"],
            recommendedProject: "Train a ResNet transfer learning model to classify skin diseases or plant leaves with >92% accuracy.",
            estimatedWeeks: "5 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 3: LLMs, Prompt Engineering, RAG & MLOps",
        items: [
          {
            id: "ai-5",
            title: "Transformers & Attention Mechanism",
            description: "Understand Self-Attention, Multi-Head Attention, Encoder-Decoder architectures, and Hugging Face pipelines.",
            requiredSkills: ["Transformers", "Hugging Face", "Tokenization"],
            keyTopics: ["Attention is All You Need architecture", "BERT vs GPT", "Tokenizers (BPE, WordPiece)", "Model Quantization"],
            recommendedProject: "Fine-tune an open-source model (like Llama 3 8B or Mistral) for a domain QA task using LoRA.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "ai-6",
            title: "Retrieval-Augmented Generation (RAG) & Vector DBs",
            description: "Build production AI agents that query private documents using Embeddings, Vector Databases, and LangChain/LlamaIndex.",
            requiredSkills: ["RAG", "Vector DB (Pinecone/Chroma)", "LangChain", "Embeddings"],
            keyTopics: ["Chunking strategies", "Cosine similarity", "Hybrid search (BM25 + Dense)", "Guardrails & Hallucination mitigation"],
            recommendedProject: "Build a Chat with Any Research Paper application with citation highlighting and hallucination checks.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      }
    ]
  },

  "data-analyst": {
    roleId: "data-analyst",
    roleTitle: "Data Analyst & Business Intelligence",
    category: "role",
    overview: "Transform raw data into business intelligence: Advanced SQL, Excel modeling, interactive Power BI/Tableau dashboards, and storytelling.",
    targetTimeline: "5 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Advanced SQL & Data Wrangling",
        items: [
          {
            id: "da-1",
            title: "Advanced SQL Queries & Window Functions",
            description: "Master CTEs, window functions (ROW_NUMBER, RANK, LEAD, LAG), conditional aggregations, and subqueries.",
            requiredSkills: ["SQL", "Window Functions", "CTEs", "Data Aggregation"],
            keyTopics: ["Partition by & Order by", "Cumulative sums & Moving averages", "Self-joins", "Query performance optimization"],
            recommendedProject: "Analyze a 1-million row E-commerce sales database to calculate Customer Lifetime Value (CLV) and cohort retention.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "da-2",
            title: "Python for Data Analysis (Pandas & NumPy)",
            description: "Automate reporting, clean dirty spreadsheets, merge multiple sources, and perform statistical exploratory analysis.",
            requiredSkills: ["Python", "Pandas", "NumPy", "Data Cleaning"],
            keyTopics: ["Handling missing data", "Grouping & Pivot tables", "DateTime operations", "Automating Excel reports"],
            recommendedProject: "Build an automated Python script that ingests weekly messy CSV exports and outputs clean analysis tables.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Business Dashboards & Data Storytelling",
        items: [
          {
            id: "da-3",
            title: "Power BI & Tableau Dashboard Architecture",
            description: "Design executive dashboards with DAX measures, dimensional modeling (Star Schema), and interactive drill-downs.",
            requiredSkills: ["Power BI", "Tableau", "DAX", "Data Modeling"],
            keyTopics: ["Star vs Snowflake schema", "DAX calculated measures", "Row-level security (RLS)", "UI layout & Color psychology"],
            recommendedProject: "Build an Executive Sales & Profitability Dashboard with interactive KPI filters and regional breakdowns.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "da-4",
            title: "A/B Testing & Business Hypothesis Evaluation",
            description: "Formulate business hypotheses, calculate sample sizes, run hypothesis tests (p-values, z-test, t-test), and communicate findings.",
            requiredSkills: ["A/B Testing", "Statistics", "Hypothesis Testing"],
            keyTopics: ["Null vs Alternative hypothesis", "Type I and Type II errors", "Statistical significance", "Executive presentation deck"],
            recommendedProject: "Evaluate a Marketing Landing Page A/B test dataset and present findings and business recommendations in a slide deck.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      }
    ]
  },

  "devops": {
    roleId: "devops",
    roleTitle: "DevOps & Cloud Engineer",
    category: "role",
    overview: "Master Linux systems, containerization with Docker, Kubernetes orchestration, CI/CD pipelines, and Infrastructure as Code (Terraform).",
    targetTimeline: "6 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Linux, Shell Scripting & Networking",
        items: [
          {
            id: "do-1",
            title: "Linux Operating System & Bash Scripting",
            description: "File permissions, systemd services, SSH keys, process management, and automating server setups.",
            requiredSkills: ["Linux", "Bash", "SSH", "System Administration"],
            keyTopics: ["Permissions & Sudo", "Systemd service daemons", "Bash loops & cron jobs", "Log monitoring with journalctl"],
            recommendedProject: "Write an automated Bash backup script that snapshots database files and rotates archives.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "do-2",
            title: "Computer Networking & Web Servers",
            description: "DNS, TCP/IP, OSI model, SSL/TLS certificates, reverse proxies with Nginx, and HTTP status codes.",
            requiredSkills: ["Networking", "Nginx", "SSL/TLS", "DNS"],
            keyTopics: ["Reverse Proxy & Load Balancing", "Certbot & Let's Encrypt SSL", "Subnetting & CIDR basics", "HTTP/2 & WebSockets"],
            recommendedProject: "Configure an Nginx reverse proxy with SSL termination and rate limiting for a multi-service web app.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Docker, Containers & CI/CD",
        items: [
          {
            id: "do-3",
            title: "Docker & Containerization Mastery",
            description: "Write multi-stage Dockerfiles, minimize image sizes, manage Docker volumes, and compose multi-container apps.",
            requiredSkills: ["Docker", "Docker Compose", "Multi-stage Builds"],
            keyTopics: ["Image layers caching", "Docker network bridges", "Volume persistence", "Security: Non-root containers"],
            recommendedProject: "Containerize a Fullstack Next.js + Node + Redis + PostgreSQL application using Docker Compose.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "do-4",
            title: "CI/CD Pipelines (GitHub Actions / GitLab CI)",
            description: "Automate testing, linting, building Docker images, and deploying to staging/production on every pull request.",
            requiredSkills: ["GitHub Actions", "CI/CD", "Automated Deployments"],
            keyTopics: ["Workflow triggers", "Secrets management", "Docker image tagging & publishing", "Zero-downtime deployments"],
            recommendedProject: "Set up a complete CI/CD pipeline that tests code, builds Docker images, and triggers deployment automatically.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 3: Kubernetes & Infrastructure as Code (IaC)",
        items: [
          {
            id: "do-5",
            title: "Kubernetes (K8s) Orchestration",
            description: "Pods, Deployments, Services, Ingress controllers, ConfigMaps, Secrets, and Helm charts for enterprise deployments.",
            requiredSkills: ["Kubernetes", "Helm", "Cluster Management"],
            keyTopics: ["Self-healing deployments", "Horizontal Pod Autoscaling (HPA)", "Ingress routing", "Helm packaging"],
            recommendedProject: "Deploy a high-availability microservice cluster on local Minikube/Kind with Helm and HPA autoscaling.",
            estimatedWeeks: "5 Weeks"
          },
          {
            id: "do-6",
            title: "Terraform & AWS Cloud Basics",
            description: "Provision cloud infrastructure programmatically using Terraform (EC2, S3, RDS, VPC).",
            requiredSkills: ["Terraform", "AWS", "Infrastructure as Code"],
            keyTopics: ["Terraform state management", "VPC & Security Groups", "S3 & IAM policies", "Drift detection"],
            recommendedProject: "Provision a secure AWS VPC with public and private subnets, an EC2 web instance, and an RDS database via Terraform.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      }
    ]
  },

  "cybersecurity": {
    roleId: "cybersecurity",
    roleTitle: "Cybersecurity Analyst & Pentester",
    category: "role",
    overview: "Explore network security, ethical hacking, OWASP Top 10 vulnerabilities, cryptography, and defensive incident response.",
    targetTimeline: "6 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Networking & Security Fundamentals",
        items: [
          {
            id: "sec-1",
            title: "Network Security & Packet Analysis (Wireshark)",
            description: "Understand TCP/IP 3-way handshakes, ARP spoofing, Wireshark packet inspection, and firewall rules.",
            requiredSkills: ["Networking", "Wireshark", "Nmap", "Firewalls"],
            keyTopics: ["Packet sniffing", "Port scanning with Nmap", "VLANs & VPNs", "IDS/IPS systems"],
            recommendedProject: "Perform a security audit of your local network: scan open ports, identify running services, and map vulnerabilities.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "sec-2",
            title: "Cryptography & Public Key Infrastructure (PKI)",
            description: "Symmetric vs Asymmetric encryption (AES, RSA), hashing algorithms (SHA-256), and digital signatures.",
            requiredSkills: ["Cryptography", "PKI", "Hashing", "SSL/TLS"],
            keyTopics: ["Diffie-Hellman key exchange", "Salting & Rainbow table defenses", "Certificate Authorities", "PGP keys"],
            recommendedProject: "Build a secure end-to-end encrypted messaging script using Python cryptography libraries.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Web Application Security (OWASP Top 10)",
        items: [
          {
            id: "sec-3",
            title: "OWASP Top 10 Vulnerabilities & Burp Suite",
            description: "Identify and exploit SQL Injection (SQLi), Cross-Site Scripting (XSS), CSRF, IDOR, and Broken Access Control.",
            requiredSkills: ["Web Security", "OWASP Top 10", "Burp Suite"],
            keyTopics: ["Intercepting HTTP traffic with Burp", "Stored vs Reflected XSS", "SQLMap & manual SQLi", "IDOR exploitation"],
            recommendedProject: "Solve beginner-to-intermediate labs on PortSwigger Web Security Academy for SQLi and XSS.",
            estimatedWeeks: "5 Weeks"
          },
          {
            id: "sec-4",
            title: "Linux Privilege Escalation & Ethical Hacking",
            description: "Enumerate system misconfigurations, SUID binaries, kernel exploits, and vulnerable cron jobs.",
            requiredSkills: ["Linux Security", "Privilege Escalation", "Metasploit"],
            keyTopics: ["SUID & Capabilities", "Sudo misconfigurations", "LinPEAS automated enumeration", "Reverse shells"],
            recommendedProject: "Root 5 distinct 'Easy' rated machines on TryHackMe or HackTheBox and write vulnerability reports.",
            estimatedWeeks: "5 Weeks"
          }
        ]
      }
    ]
  },

  "blockchain": {
    roleId: "blockchain",
    roleTitle: "Blockchain & Web3 Developer",
    category: "role",
    overview: "Build decentralized applications (dApps), write smart contracts in Solidity, audit security, and connect wallets with Ethers.js.",
    targetTimeline: "6 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Cryptography & Ethereum Architecture",
        items: [
          {
            id: "bc-1",
            title: "Blockchain Architecture & EVM Mechanics",
            description: "Understand distributed consensus (PoW vs PoS), Ethereum Virtual Machine (EVM), gas mechanics, and transactions.",
            requiredSkills: ["Blockchain Basics", "EVM", "Consensus", "Cryptography"],
            keyTopics: ["Merkle Trees", "Gas limits & base fees", "Public/Private key pairs", "Blocks & Nonce"],
            recommendedProject: "Implement a minimal proof-of-work blockchain simulation in Node.js or Python.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "bc-2",
            title: "Solidity Smart Contract Development",
            description: "Master Solidity syntax, data types, mappings, events, modifiers, inheritance, and OpenZeppelin standards.",
            requiredSkills: ["Solidity", "Smart Contracts", "OpenZeppelin"],
            keyTopics: ["ERC-20 & ERC-721 token standards", "Reentrancy guard", "View vs Pure functions", "Payable functions & Fallbacks"],
            recommendedProject: "Write and test an ERC-20 Crowdfunding smart contract with deadline and refund mechanics.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: dApp Frontend & Web3 Integrations",
        items: [
          {
            id: "bc-3",
            title: "Hardhat / Foundry Testing & Deployment",
            description: "Write automated tests for smart contracts, simulate forks of mainnet, and deploy to Sepolia testnets.",
            requiredSkills: ["Hardhat", "Foundry", "Smart Contract Testing"],
            keyTopics: ["Fuzz testing", "Gas optimization analysis", "Deploy scripts", "Contract verification on Etherscan"],
            recommendedProject: "Write 100% test coverage suite for an NFT Staking contract using Foundry.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "bc-4",
            title: "Connecting Frontends with Wagmi & Viem",
            description: "Build reactive Next.js frontends that interact with Web3 wallets (MetaMask, Rainbow) and read contract states.",
            requiredSkills: ["Wagmi", "Viem", "Web3 Frontend", "Next.js"],
            keyTopics: ["Wallet connection modal", "Contract reads & writes", "Transaction confirmations & receipt polling", "IPFS metadata hosting"],
            recommendedProject: "Build an interactive NFT Minting and Staking dApp with live on-chain updates and wallet connect.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      }
    ]
  },

  // ─── SKILL & LANGUAGE BASED ROADMAPS ──────────────────────────────────
  "python": {
    roleId: "python",
    roleTitle: "Python Mastery",
    category: "skill",
    overview: "Master Python from core syntax, OOP, generators, and decorators to async programming, packaging, and high-performance libraries.",
    targetTimeline: "4 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Language Syntax & Advanced Pythonic Idioms",
        items: [
          {
            id: "py-1",
            title: "Data Structures, Comprehensions & Control Flow",
            description: "Lists, tuples, sets, dictionaries, list/dict comprehensions, and Python's built-in collections module.",
            requiredSkills: ["Python Basics", "Collections", "Comprehensions"],
            keyTopics: ["Defaultdict & Counter", "Unpacking (*args, **kwargs)", "Itertools module", "Memory efficiency with Tuples"],
            recommendedProject: "Build an automated Log File Parser and Aggregator that processes server logs into statistics.",
            estimatedWeeks: "2 Weeks"
          },
          {
            id: "py-2",
            title: "Object-Oriented Programming (OOP) & Dunder Methods",
            description: "Classes, inheritance, encapsulation, polymorphism, and magic dunder methods (__str__, __repr__, __eq__, __iter__).",
            requiredSkills: ["Python OOP", "Dunder Methods", "Dataclasses"],
            keyTopics: ["Class vs Instance methods", "@dataclass and @property", "Multiple inheritance & MRO", "Custom Iterators"],
            recommendedProject: "Build an Object-Oriented Banking Simulation system with account validation and ledger audits.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Decorators, Generators & Asynchronous Python",
        items: [
          {
            id: "py-3",
            title: "Decorators, Context Managers & Generators",
            description: "Write custom function decorators, class decorators, custom `with` statement context managers, and memory-saving generators.",
            requiredSkills: ["Decorators", "Generators", "Context Managers"],
            keyTopics: ["Higher-order functions", "functools.wraps", "Yield vs Return", "@contextmanager"],
            recommendedProject: "Build an API Rate Limiter and Performance Timing decorator library for backend endpoints.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "py-4",
            title: "Asyncio & High-Concurrency Networking",
            description: "Execute thousands of concurrent tasks without threading using Python's native asyncio and aiohttp.",
            requiredSkills: ["Asyncio", "Async Programming", "aiohttp"],
            keyTopics: ["Event loop mechanics", "async/await syntax", "asyncio.gather vs TaskGroup", "Handling race conditions"],
            recommendedProject: "Build an Asynchronous Web Scraper that downloads and checks links for 500 pages in under 10 seconds.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      }
    ]
  },

  "javascript": {
    roleId: "javascript",
    roleTitle: "JavaScript & TypeScript",
    category: "skill",
    overview: "Deep dive into the runtime engine, V8 optimization, execution contexts, prototype chains, TypeScript type systems, and async flow.",
    targetTimeline: "4 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Deep JavaScript Runtime & Mechanics",
        items: [
          {
            id: "js-1",
            title: "Execution Context, Call Stack & Event Loop",
            description: "Understand exactly how JavaScript executes: execution contexts, lexical environments, closures, and the event loop.",
            requiredSkills: ["Event Loop", "Closures", "Call Stack"],
            keyTopics: ["Microtasks vs Macrotasks", "Variable Hoisting & Temporal Dead Zone", "Memory Leaks & Garbage Collection", "Prototypal Inheritance"],
            recommendedProject: "Write your own lightweight Promise implementation from scratch adhering to the Promises/A+ spec.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "js-2",
            title: "Modern ES2022+ Features & Functional Programming",
            description: "Immutability, pure functions, array methods (reduce, flatMap), optional chaining, and nullish coalescing.",
            requiredSkills: ["ESNext", "Functional Programming", "Array Methods"],
            keyTopics: ["Currying & Function Composition", "Structured clone API", "WeakMap & WeakSet", "ES Modules"],
            recommendedProject: "Build a Functional Utility Library similar to Lodash implementing 20+ utility functions.",
            estimatedWeeks: "2 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Professional TypeScript",
        items: [
          {
            id: "js-3",
            title: "Advanced TypeScript Types & Generics",
            description: "Master conditional types, template literal types, mapped types, keyof/typeof, and generic constraints.",
            requiredSkills: ["TypeScript", "Generics", "Type Gymnastics"],
            keyTopics: ["Infer keyword", "Mapped & Conditional Types", "Type narrowing & User-defined Type Guards", "Declaration merging"],
            recommendedProject: "Build a strictly typed Form Validation Library that validates nested objects with autocomplete error types.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      }
    ]
  },

  "dsa": {
    roleId: "dsa",
    roleTitle: "Data Structures & Algorithms (C++)",
    category: "skill",
    overview: "Comprehensive computer science algorithms and problem solving: Trees, Graphs, Dynamic Programming, and Competitive Programming.",
    targetTimeline: "5 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Fundamental Data Structures & Sorting",
        items: [
          {
            id: "dsa-1",
            title: "Arrays, Two Pointers & Sliders",
            description: "Time & Space complexity (Big-O), Two-pointer technique, Sliding window patterns, and Prefix sums.",
            requiredSkills: ["Big-O", "Two Pointers", "Sliding Window"],
            keyTopics: ["Asymptotic notation", "In-place array manipulations", "Kadane's Algorithm", "Binary Search variants"],
            recommendedProject: "Solve 30 classic LeetCode Medium problems covering Two Pointers and Sliding Window patterns.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "dsa-2",
            title: "Linked Lists, Stacks, Queues & HashMaps",
            description: "Pointer manipulation, Monotonic Stacks, Priority Queues (Heaps), and Collision resolution in Hash Tables.",
            requiredSkills: ["Stacks", "Queues", "Heaps", "Hash Tables"],
            keyTopics: ["Fast & Slow pointers (Floyd's cycle)", "Next Greater Element using Monotonic Stack", "Min/Max Heap implementations", "LRU Cache"],
            recommendedProject: "Implement an LRU (Least Recently Used) Cache from scratch using a Doubly Linked List and HashMap.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Trees, Graphs & Dynamic Programming",
        items: [
          {
            id: "dsa-3",
            title: "Binary Trees, BSTs & Tries",
            description: "Tree traversals (In-order, Pre-order, Post-order, Level-order), Lowest Common Ancestor, and Prefix Tries.",
            requiredSkills: ["Binary Trees", "BST", "Tries", "Recursion"],
            keyTopics: ["DFS vs BFS on Trees", "Validating Binary Search Trees", "Diameter & Max Path Sum", "Autocomplete using Tries"],
            recommendedProject: "Build a Fast Prefix Autocomplete Search engine in C++ using a Trie data structure.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "dsa-4",
            title: "Graph Algorithms (BFS, DFS, Dijkstra, Topo Sort)",
            description: "Adjacency lists, shortest paths with Dijkstra, topological sorting (Kahn's), and Disjoint Set Union (DSU).",
            requiredSkills: ["Graphs", "Dijkstra", "Topological Sort", "DSU"],
            keyTopics: ["Detecting cycles in directed/undirected graphs", "Shortest path algorithms", "Bipartite graphs", "Minimum Spanning Tree (Kruskal)"],
            recommendedProject: "Build a Shortest Path Navigation visualizer comparing BFS and Dijkstra algorithms.",
            estimatedWeeks: "4 Weeks"
          },
          {
            id: "dsa-5",
            title: "Dynamic Programming (DP) Mastery",
            description: "Memoization (Top-down) vs Tabulation (Bottom-up), 0/1 Knapsack, Longest Common Subsequence, and Matrix Chain Multiplication.",
            requiredSkills: ["Dynamic Programming", "Memoization", "Tabulation"],
            keyTopics: ["Identifying optimal substructure", "State space reduction", "1D vs 2D DP grids", "Bitmask Dynamic Programming"],
            recommendedProject: "Solve 25 classic DP problems on LeetCode/Codeforces and document recurrence relations for each.",
            estimatedWeeks: "4 Weeks"
          }
        ]
      }
    ]
  },

  "docker-k8s": {
    roleId: "docker-k8s",
    roleTitle: "Docker & Kubernetes",
    category: "skill",
    overview: "Containerize applications, orchestrate multi-node microservices, configure ingress controllers, and manage zero-downtime rollouts.",
    targetTimeline: "3 Months",
    phases: [
      {
        phaseTitle: "Phase 1: Deep Docker & Containerization",
        items: [
          {
            id: "dk-1",
            title: "Docker Architecture, Images & Security",
            description: "Understand Linux cgroups, namespaces, writing clean multi-stage Dockerfiles, and scanning vulnerabilities with Trivy.",
            requiredSkills: ["Docker", "Containers", "Image Optimization"],
            keyTopics: ["Namespaces & Cgroups", "Minimizing image size with Alpine/Distroless", "Multi-stage builds", "Non-root user execution"],
            recommendedProject: "Dockerize a production Node.js + Python app and reduce image footprint by over 70% with multi-stage builds.",
            estimatedWeeks: "2 Weeks"
          },
          {
            id: "dk-2",
            title: "Multi-Service Orchestration with Docker Compose",
            description: "Configure networks, volumes, health checks, environment variables, and startup dependencies across services.",
            requiredSkills: ["Docker Compose", "Networking", "Volumes"],
            keyTopics: ["Custom bridge networks", "Named volumes for databases", "Depends_on with condition: service_healthy", "Compose profiles"],
            recommendedProject: "Set up a full local developer stack (Frontend, Backend, Redis, Postgres, Mailhog) via a single `docker compose up`.",
            estimatedWeeks: "2 Weeks"
          }
        ]
      },
      {
        phaseTitle: "Phase 2: Kubernetes Cluster Architecture",
        items: [
          {
            id: "dk-3",
            title: "Kubernetes Core: Pods, Deployments & Services",
            description: "Control plane components (API server, etcd, scheduler), worker node components (kubelet, kube-proxy), and YAML manifests.",
            requiredSkills: ["Kubernetes", "K8s Manifests", "Deployments"],
            keyTopics: ["Rolling update strategies", "ClusterIP vs NodePort vs LoadBalancer", "Liveness and Readiness probes", "ConfigMaps & Secrets"],
            recommendedProject: "Deploy a scalable web application on Minikube with automated self-healing and zero-downtime rolling updates.",
            estimatedWeeks: "3 Weeks"
          },
          {
            id: "dk-4",
            title: "Helm Package Manager & Ingress Routing",
            description: "Package Kubernetes manifests into reusable Helm charts, manage values.yaml, and route external traffic with Nginx Ingress.",
            requiredSkills: ["Helm", "Ingress Controllers", "Cert-Manager"],
            keyTopics: ["Helm templating syntax", "Helm release rollbacks", "Path-based & Host-based Ingress routing", "Automatic TLS with Cert-Manager"],
            recommendedProject: "Create a custom Helm chart for your microservices and deploy with automatic HTTPS ingress.",
            estimatedWeeks: "3 Weeks"
          }
        ]
      }
    ]
  }
};
