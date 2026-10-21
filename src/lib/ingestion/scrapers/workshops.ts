// ─── Workshops and bootcamps scraper / provider ───────────────────
import type { ScrapedOpportunity } from "./types";

const WORKSHOP_SEEDS: Omit<ScrapedOpportunity, "sourceType" | "autoApprove" | "scraperName">[] = [
  {
    title: "Google Developer Student Clubs — Cloud & AI Study Jams",
    orgName: "Google Developers",
    description: "Hands-on workshops, skill badges, and labs on Google Cloud Platform, GenAI, and Vertex AI with mentorship and swag.",
    eligibility: "Open to university and college students interested in Cloud Computing and AI.",
    deadline: "2026-06-30",
    country: "Global",
    category: "Workshops",
    field: "Cloud & AI",
    applyLink: "https://developers.google.com/community/gdsc",
    requiredDocuments: ["Student ID", "GitHub Profile"],
    sourceUrl: "https://developers.google.com/community/gdsc",
  },
  {
    title: "AWS Skill Builder & Cloud Practitioner Immersion Day",
    orgName: "Amazon Web Services",
    description: "Free intensive virtual bootcamp covering foundational cloud concepts, architectural design, security, and preparation for AWS certifications.",
    eligibility: "Students and aspiring cloud architects from any branch/year.",
    deadline: "Rolling — monthly cohorts",
    country: "Global",
    category: "Workshops",
    field: "Cloud Computing",
    applyLink: "https://aws.amazon.com/training/digital/",
    requiredDocuments: ["Valid Email"],
    sourceUrl: "https://aws.amazon.com/training/digital/",
  },
  {
    title: "Meta Open Source Developer Immersion Workshop",
    orgName: "Meta Open Source",
    description: "Multi-week workshop series on contributing to major open-source ecosystems (React, PyTorch, Llama) with guidance from Meta engineers.",
    eligibility: "Students and early-career developers proficient in Git and at least one programming language.",
    deadline: "2026-07-15",
    country: "Global",
    category: "Workshops",
    field: "Open Source & Software Engineering",
    applyLink: "https://opensource.fb.com",
    requiredDocuments: ["GitHub Profile", "Resume"],
    sourceUrl: "https://opensource.fb.com",
  },
  {
    title: "NASSCOM FutureSkills Prime Emerging Tech Bootcamp",
    orgName: "NASSCOM & MeitY",
    description: "Government-backed skilling initiative in Artificial Intelligence, Big Data, Cybersecurity, and Internet of Things with industry-recognized certifications.",
    eligibility: "Indian students, graduates, and professionals seeking upskilling in deep tech.",
    deadline: "Rolling — check official site",
    country: "India",
    category: "Workshops",
    field: "Emerging Technologies",
    applyLink: "https://futureskillsprime.in",
    requiredDocuments: ["Aadhaar Number", "Academic Certificate"],
    sourceUrl: "https://futureskillsprime.in",
  },
  {
    title: "Microsoft Learn Student Ambassador AI Skills Challenge",
    orgName: "Microsoft",
    description: "Interactive learning sprint and technical workshops focusing on Azure AI Studio, Copilot development, and GitHub tools.",
    eligibility: "Enrolled college/university students aged 16+.",
    deadline: "2026-05-15",
    country: "Global",
    category: "Workshops",
    field: "Artificial Intelligence",
    applyLink: "https://studentambassadors.microsoft.com",
    requiredDocuments: ["Student Email or Proof of Enrollment"],
    sourceUrl: "https://studentambassadors.microsoft.com",
  },
];

export async function scrapeWorkshops(): Promise<ScrapedOpportunity[]> {
  return WORKSHOP_SEEDS.map((s) => ({
    ...s,
    sourceType: "trusted-feed",
    autoApprove: true,
    scraperName: "Workshops Feeds",
  }));
}
