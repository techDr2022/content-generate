import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function techdrPasswordFromEnv(): string {
  const raw = process.env.TECHDR_PASSWORD?.trim();
  if (!raw) return "techDr";
  if (raw.length < 6) {
    throw new Error("TECHDR_PASSWORD must be at least 6 characters (or leave unset for default techDr).");
  }
  return raw;
}

async function main(): Promise<void> {
  const plain = techdrPasswordFromEnv();
  const passwordHash = await bcrypt.hash(plain, 10);

  const contact = await prisma.user.upsert({
    where: { email: "contact@techdr.in" },
    update: { passwordHash, name: "TechDr Contact" },
    create: {
      email: "contact@techdr.in",
      passwordHash,
      name: "TechDr Contact",
    },
  });

  await prisma.user.upsert({
    where: { email: "support@techdr.in" },
    update: { passwordHash, name: "TechDr Support" },
    create: {
      email: "support@techdr.in",
      passwordHash,
      name: "TechDr Support",
    },
  });

  await prisma.topicHistory.deleteMany({ where: { client: { userId: contact.id } } });
  await prisma.specialDay.deleteMany({ where: { client: { userId: contact.id } } });
  await prisma.generationJob.deleteMany({ where: { userId: contact.id } });
  await prisma.client.deleteMany({ where: { userId: contact.id } });

  const gyn = await prisma.client.create({
    data: {
      userId: contact.id,
      name: "Bloom Women's Clinic",
      doctorName: "Dr. Ananya Rao",
      specialty: ["Gynaecology", "Fertility & IVF"],
      services: [
        "Well-woman & preventive screening",
        "PCOS & hormonal health",
        "IVF & embryo transfer",
        "IUI (intrauterine insemination)",
      ],
      clinicName: "Bloom Women's Clinic",
      city: "Hyderabad",
      brandType: "clinic",
      postsPerMonth: 15,
      useCarousels: true,
      notes: "Focus on empathetic tone and evidence-based education.",
      specialDays: {
        create: [
          { label: "National Women's Health Week", date: "2026-05-10", type: "awareness" },
          { label: "Mother's Day", date: "2026-05-11", type: "festival" },
          { label: "PCOS Awareness", date: "2026-05-15", type: "campaign" },
        ],
      },
    },
  });

  const cardio = await prisma.client.create({
    data: {
      userId: contact.id,
      name: "Pulse Cardiac Center",
      doctorName: "Dr. Vikram Mehta",
      specialty: ["Cardiology"],
      services: ["Hypertension & lipid clinic", "Echocardiography", "Preventive cardiology", "Cardiac rehab"],
      clinicName: "Pulse Cardiac Center",
      city: "Mumbai",
      brandType: "hospital",
      postsPerMonth: 15,
      useCarousels: false,
      notes: "Highlight preventive cardiology and rehab.",
      specialDays: {
        create: [
          { label: "World Hypertension Day", date: "2026-05-17", type: "awareness" },
          { label: "Heart Health Week", date: "2026-05-20", type: "campaign" },
        ],
      },
    },
  });

  const derm = await prisma.client.create({
    data: {
      userId: contact.id,
      name: "Glow Dermatology Studio",
      doctorName: "Dr. Sarah Khanna",
      specialty: ["Dermatology & Cosmetology"],
      services: ["Acne & scar treatment", "Skin cancer screening", "Laser & light therapies", "Injectable aesthetics"],
      clinicName: "Glow Dermatology Studio",
      city: "Bengaluru",
      brandType: "personal",
      postsPerMonth: 15,
      useCarousels: false,
      notes: "Blend clinical dermatology with cosmetic education.",
      specialDays: {
        create: [
          { label: "Melanoma Monday", date: "2026-05-04", type: "awareness" },
          { label: "Summer Skin Safety", date: "2026-05-25", type: "campaign" },
          { label: "Eid-ul-Fitr", date: "2026-05-27", type: "festival" },
        ],
      },
    },
  });

  const clients = [gyn, cardio, derm];
  const now = new Date();
  for (const c of clients) {
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      await prisma.topicHistory.createMany({
        data: [
          {
            clientId: c.id,
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            topic: `${c.specialty[0]} screening checklist ${i}`,
            style: "Short Statement",
            postType: "Poster",
          },
          {
            clientId: c.id,
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            topic: `${c.specialty[0]} nutrition myths ${i}`,
            style: "Myth vs Fact",
            postType: "Poster",
          },
        ],
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete for TechDr users (demo clients on contact@techdr.in):", contact.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
