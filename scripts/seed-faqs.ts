import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const faqs = [
  {
    slug: "shipping-times",
    title: "Shipping times",
    question: "How long does shipping take?",
    answer:
      "Orders are typically processed within 1–2 business days. Delivery across India usually takes 3–7 business days depending on your pincode. You will receive tracking details by email once the courier picks up your parcel.",
    keywords: ["shipping", "delivery", "how long", "days", "courier", "dispatch"],
    category: "SHIPPING",
  },
  {
    slug: "track-order",
    title: "Track an order",
    question: "How do I track my order?",
    answer:
      "Sign in to your account and ask the chat assistant about your order, or check the shipping confirmation email for the AWB / tracking link. Tracking appears after the order status moves to SHIPPED.",
    keywords: ["track", "tracking", "awb", "where is my order", "shipment"],
    category: "SHIPPING",
  },
  {
    slug: "returns-policy",
    title: "Returns & exchanges",
    question: "What is your return policy?",
    answer:
      "Unopened products in original packaging may be eligible for return or exchange within 7 days of delivery. Opened skincare items generally cannot be returned for hygiene reasons. Contact support with your order number to start a request.",
    keywords: ["return", "refund", "exchange", "policy", "damaged"],
    category: "RETURNS",
  },
  {
    slug: "payment-methods",
    title: "Payment methods",
    question: "What payment methods do you accept?",
    answer:
      "We accept secure online payments via Razorpay (UPI, cards, netbanking, and supported wallets). Cash on delivery may not be available for all pincodes.",
    keywords: ["payment", "razorpay", "upi", "card", "cod", "pay"],
    category: "PAYMENT",
  },
  {
    slug: "cancel-order",
    title: "Cancel an order",
    question: "Can I cancel my order?",
    answer:
      "You can request cancellation from your order page while the order is still PENDING, PAID, or PROCESSING (before it ships). Once shipped, please wait for delivery and use the returns process if eligible.",
    keywords: ["cancel", "cancellation", "stop order"],
    category: "ORDERS",
  },
  {
    slug: "contact-support",
    title: "Contact support",
    question: "How do I contact Elorakart support?",
    answer:
      "Use this chat for quick help, or email contactus@elorakart.com. For unresolved issues, create a support ticket from chat and our team will reply within the stated turnaround time.",
    keywords: ["contact", "email", "support", "help", "phone"],
    category: "SUPPORT",
  },
  {
    slug: "ingredients-safety",
    title: "Ingredients & safety",
    question: "Are your products safe / natural?",
    answer:
      "Elorakart focuses on botanical-forward formulas. Each product page lists key ingredients, benefits, and usage. If you have allergies, review the ingredients list carefully or ask us about a specific product before purchasing.",
    keywords: ["ingredients", "natural", "organic", "safe", "allergy", "botanical"],
    category: "PRODUCT",
  },
  {
    slug: "stock-availability",
    title: "Stock availability",
    question: "How do I know if a product is in stock?",
    answer:
      "Product pages and the shop catalog show live stock. Out-of-stock items cannot be added to cart. You can also ask this chat about a product name and we will check availability.",
    keywords: ["stock", "available", "out of stock", "inventory"],
    category: "PRODUCT",
  },
  {
    slug: "account-login",
    title: "Account & login",
    question: "Do I need an account?",
    answer:
      "You can browse without an account. Sign in with Google to view your personal order history, request cancellations, and get order-specific help from this assistant.",
    keywords: ["account", "login", "sign in", "google", "profile"],
    category: "ACCOUNT",
  },
  {
    slug: "tat-tickets",
    title: "Support ticket TAT",
    question: "How fast will you reply to a ticket?",
    answer:
      "General support tickets have a 24-hour turnaround target. Order-related tickets have a 48-hour turnaround target. You will receive a ticket number when a ticket is created from chat.",
    keywords: ["tat", "ticket", "response time", "sla", "how fast"],
    category: "SUPPORT",
  },
];

async function main() {
  for (const f of faqs) {
    await prisma.knowledgeArticle.upsert({
      where: { slug: f.slug },
      create: {
        slug: f.slug,
        title: f.title,
        question: f.question,
        answer: f.answer,
        keywords: JSON.stringify(f.keywords),
        category: f.category,
        active: true,
      },
      update: {
        title: f.title,
        question: f.question,
        answer: f.answer,
        keywords: JSON.stringify(f.keywords),
        category: f.category,
        active: true,
      },
    });
  }
  console.log(`Upserted ${faqs.length} FAQ articles`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
