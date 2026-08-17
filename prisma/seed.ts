import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  {
    title: "PLIX Rosemary Hair Growth Serum",
    slug: "plix-rosemary-hair-growth-serum",
    brand: "Plix",
    category: "Hair Serum",
    volume: "50ml",
    mrp: 699,
    sellingPrice: 499,
    sku: "PLIX-RHS-50",
    stock: 42,
    rating: 4.6,
    reviewCount: 128,
    description:
      "Potent rosemary-infused hair serum that nourishes the scalp and supports visibly denser-looking hair.",
    benefits: ["Promotes healthier scalp", "Lightweight non-greasy formula", "Enriched with botanical oils"],
    ingredients: "Rosmarinus Officinalis Leaf Oil, Caprylic Triglyceride, Tocopherol.",
    usage: "Apply 3–4 drops on scalp nightly. Massage gently. Do not rinse.",
    images: ["/products/hair-oil-bottle.jpg", "/products/dropper-serum.jpg"],
  },
  {
    title: "PLIX Pomegranate Youth Renewal Serum",
    slug: "plix-pomegranate-youth-renewal-serum",
    brand: "Plix",
    category: "Face Essential",
    volume: "30ml",
    mrp: 899,
    sellingPrice: 649,
    sku: "PLIX-PYR-30",
    stock: 35,
    rating: 4.7,
    reviewCount: 96,
    description: "Antioxidant-rich pomegranate serum for glowing, youthful-looking skin.",
    benefits: ["Brightens dull skin", "Hydrates deeply", "Supports collagen look"],
    ingredients: "Punica Granatum Extract, Niacinamide, Hyaluronic Acid.",
    usage: "Apply 2–3 drops morning and night after cleansing.",
    images: ["/products/vitamin-c-serum.jpg", "/products/dropper-serum.jpg"],
  },
  {
    title: "PLIX Guava Glow Night Cream",
    slug: "plix-guava-glow-night-cream",
    brand: "Plix",
    category: "Night Cream",
    volume: "50g",
    mrp: 799,
    sellingPrice: 549,
    sku: "PLIX-GGN-50",
    stock: 28,
    rating: 4.5,
    reviewCount: 74,
    description: "Overnight guava cream that restores radiance while you sleep.",
    benefits: ["Overnight repair", "Softens texture", "Locks in moisture"],
    ingredients: "Psidium Guajava Extract, Shea Butter, Glycerin.",
    usage: "Massage onto face and neck as the last step of your night routine.",
    images: ["/products/pink-cream-jar.jpg", "/products/night-cream-jar.jpg"],
  },
  {
    title: "Pilgrim 2% Salicylic Acid Face Wash",
    slug: "pilgrim-salicylic-acid-face-wash",
    brand: "Pilgrim",
    category: "Face Essential",
    volume: "100ml",
    mrp: 450,
    sellingPrice: 349,
    sku: "PIL-SAFW-100",
    stock: 60,
    rating: 4.4,
    reviewCount: 210,
    description: "Gentle clarifying face wash with 2% salicylic acid for clearer-looking skin.",
    benefits: ["Unclogs pores", "Controls excess oil", "Fresh clean finish"],
    ingredients: "Salicylic Acid 2%, Aloe Vera, Glycerin.",
    usage: "Lather on damp face, massage 30 seconds, rinse. Use AM/PM.",
    images: ["/products/face-wash-tube.jpg"],
  },
  {
    title: "Pilgrim Hair Growth Oil",
    slug: "pilgrim-hair-growth-oil",
    brand: "Pilgrim",
    category: "Hair Serum",
    volume: "100ml",
    mrp: 650,
    sellingPrice: 499,
    sku: "PIL-HGO-100",
    stock: 40,
    rating: 4.3,
    reviewCount: 155,
    description: "Botanical hair oil blend to strengthen strands and soothe the scalp.",
    benefits: ["Reduces breakage look", "Nourishes scalp", "Adds natural shine"],
    ingredients: "Bhringraj, Amla, Coconut Oil, Rosemary.",
    usage: "Warm a few drops, massage into scalp, leave overnight, wash next day.",
    images: ["/products/hair-oil-bottle.jpg", "/products/dropper-serum.jpg"],
  },
  {
    title: "Mamaearth Rice Water Face Wash",
    slug: "mamaearth-rice-water-face-wash",
    brand: "Mamaearth",
    category: "Face Essential",
    volume: "100ml",
    mrp: 399,
    sellingPrice: 299,
    sku: "ME-RWF-100",
    stock: 80,
    rating: 4.5,
    reviewCount: 320,
    description: "Mild rice water cleanser for soft, glass-skin feel.",
    benefits: ["Gentle daily cleanse", "Toxins-free formula", "Suitable for most skin types"],
    ingredients: "Oryza Sativa (Rice) Water, Aloe Barbadensis.",
    usage: "Use morning and night. Avoid eye area.",
    images: ["/products/face-wash-tube.jpg", "/products/botanical-serum.jpg"],
  },
  {
    title: "Dr. Rashel Vitamin C Night Cream",
    slug: "dr-rashel-vitamin-c-night-cream",
    brand: "Dr. Rashel",
    category: "Night Cream",
    volume: "50g",
    mrp: 999,
    sellingPrice: 699,
    sku: "DR-VCNC-50",
    stock: 22,
    rating: 4.2,
    reviewCount: 88,
    description: "Vitamin C night cream for a brighter morning complexion.",
    benefits: ["Boosts glow", "Hydrating cream base", "Night recovery"],
    ingredients: "Ascorbic Acid, Shea Butter, Vitamin E.",
    usage: "Apply a pea-sized amount at night after serum.",
    images: ["/products/night-cream-jar.jpg", "/products/pink-cream-jar.jpg"],
  },
  {
    title: "Dr. Rashel Hyaluronic Acid Face Serum",
    slug: "dr-rashel-hyaluronic-acid-face-serum",
    brand: "Dr. Rashel",
    category: "Face Essential",
    volume: "30ml",
    mrp: 899,
    sellingPrice: 599,
    sku: "DR-HAFS-30",
    stock: 33,
    rating: 4.6,
    reviewCount: 141,
    description: "Multi-weight hyaluronic serum for plump, dewy skin.",
    benefits: ["Intense hydration", "Plumping effect", "Layers under moisturizer"],
    ingredients: "Sodium Hyaluronate, Panthenol, Allantoin.",
    usage: "Apply on damp skin AM/PM before cream.",
    images: ["/products/dropper-serum.jpg", "/products/botanical-serum.jpg"],
  },
  {
    title: "Biotique Bio Coconut Whitening Cream",
    slug: "biotique-bio-coconut-cream",
    brand: "Biotique",
    category: "Night Cream",
    volume: "50g",
    mrp: 299,
    sellingPrice: 249,
    sku: "BIO-BCC-50",
    stock: 55,
    rating: 4.1,
    reviewCount: 190,
    description: "Ayurvedic coconut cream for nourished, even-toned skin.",
    benefits: ["Ayurvedic formula", "Deep nourishment", "Soft finish"],
    ingredients: "Cocos Nucifera Oil, Ayurvedic extracts.",
    usage: "Apply nightly on cleansed face.",
    images: ["/products/clay-mask-jar.jpg", "/products/night-cream-jar.jpg"],
  },
  {
    title: "Dot & Key Night Reset Retinol Cream",
    slug: "dot-key-night-reset-retinol-cream",
    brand: "Dot & Key",
    category: "Night Cream",
    volume: "60ml",
    mrp: 845,
    sellingPrice: 695,
    sku: "DK-NRR-60",
    stock: 18,
    rating: 4.8,
    reviewCount: 260,
    description: "Encapsulated retinol night cream for smoother-looking skin.",
    benefits: ["Smooths fine lines look", "Barrier-friendly", "Night reset ritual"],
    ingredients: "Retinol, Ceramides, Niacinamide.",
    usage: "Use 2–3 nights a week. Always pair with SPF in the morning.",
    images: ["/products/pink-cream-jar.jpg", "/products/clay-mask-jar.jpg"],
  },
  {
    title: "Elorakart Botanical Glow Face Serum",
    slug: "elorakart-botanical-glow-face-serum",
    brand: "Elorakart",
    category: "Face Essential",
    volume: "30ml",
    mrp: 1299,
    sellingPrice: 899,
    sku: "EK-BGFS-30",
    stock: 50,
    rating: 4.9,
    reviewCount: 64,
    description:
      "Signature botanical serum with jojoba, vitamin E, and aloe for natural radiance.",
    benefits: [
      "Natural radiance booster with Jojoba Oil, Vitamin E, and Aloe Vera",
      "Hydrates and illuminates all skin types",
      "Cruelty-free and vegan",
    ],
    ingredients:
      "Simmondsia Chinensis (Jojoba) Seed Oil, Tocopherol (Vitamin E), Aloe Barbadensis Leaf Juice.",
    usage: "Press 2–3 drops onto face after cleansing. Follow with moisturizer.",
    images: ["/products/botanical-serum.jpg", "/products/dropper-serum.jpg"],
  },
  {
    title: "Elorakart Mist Bloom Eau de Parfum",
    slug: "elorakart-mist-bloom-edp",
    brand: "Elorakart",
    category: "Perfume",
    volume: "50ml",
    mrp: 1899,
    sellingPrice: 1499,
    sku: "EK-MB-50",
    stock: 25,
    rating: 4.7,
    reviewCount: 52,
    description: "Soft floral fragrance with notes of peony, bergamot, and warm musk.",
    benefits: ["Long-lasting trail", "Unisex soft floral", "Travel-friendly bottle"],
    ingredients: "Alcohol Denat., Parfum, Linalool, Limonene.",
    usage: "Spray on pulse points. Avoid rubbing.",
    images: ["/products/perfume-bottle.jpg"],
  },
  {
    title: "Mamaearth Onion Hair Serum",
    slug: "mamaearth-onion-hair-serum",
    brand: "Mamaearth",
    category: "Hair Serum",
    volume: "100ml",
    mrp: 449,
    sellingPrice: 349,
    sku: "ME-OHS-100",
    stock: 8,
    rating: 4.3,
    reviewCount: 400,
    description: "Onion seed oil serum for smoother, frizz-controlled hair.",
    benefits: ["Frizz control", "Adds shine", "Lightweight"],
    ingredients: "Onion Seed Oil, Argan Oil, Vitamin E.",
    usage: "Apply on damp or dry lengths. Style as usual.",
    images: ["/products/hair-oil-bottle.jpg", "/products/vitamin-c-serum.jpg"],
  },
];

const blogs = [
  {
    title: "The Perfect AM Skincare Routine for Glowing Skin",
    slug: "am-skincare-routine-glowing-skin",
    excerpt: "Build a simple morning ritual with cleanser, serum, and SPF that actually sticks.",
    coverImage: "/blog/am-routine.jpg",
    tags: ["skincare", "routine", "serum"],
    content: `## Start fresh

A glowing complexion starts with consistency. Begin with a gentle cleanser like rice water or salicylic wash depending on your skin type.

## Layer hydration

Serums with hyaluronic acid or botanical oils lock in moisture. Try our **Elorakart Botanical Glow Face Serum** for daily radiance.

## Seal and protect

Finish with a light moisturizer and broad-spectrum SPF. Never skip sunscreen—even on cloudy days.

### Related tips
- Patch test new actives
- Introduce one product at a time
- Keep routines under 5 steps for better adherence
`,
  },
  {
    title: "Best Serums for Glowing Skin in 2026",
    slug: "best-serums-for-glowing-skin",
    excerpt: "From vitamin C to rosemary scalp serums—our editor picks for every concern.",
    coverImage: "/blog/serums-guide.jpg",
    tags: ["serum", "guide", "face"],
    content: `## Why serums win

Serums deliver concentrated actives that creams alone cannot. Choose by concern: brightening, hydration, or scalp health.

## Our top picks
1. **Botanical Glow Face Serum** — jojoba + vitamin E
2. **PLIX Pomegranate Youth Renewal** — antioxidants
3. **Dr. Rashel HA Serum** — deep hydration

Pair with a compatible moisturizer and you will notice a healthier-looking glow within weeks.
`,
  },
  {
    title: "Haircare Guide: Serums, Oils & Scalp Care",
    slug: "haircare-guide-serums-oils",
    excerpt: "How to combine rosemary serum, growth oils, and weekly rituals for stronger-looking hair.",
    coverImage: "/blog/haircare.jpg",
    tags: ["haircare", "serum", "routine"],
    content: `## Scalp first

Healthy-looking hair begins at the scalp. Massage rosemary serum nightly and alternate with a nourishing oil once a week.

## Lengths care

Apply lightweight onion or argan serum on mid-lengths to tame frizz without weighing hair down.

## Weekly reset
- Clarify once a week if you use heavy oils
- Protect with heat protectant before styling
- Trim split ends every 8–10 weeks
`,
  },
];

async function main() {
  await prisma.stockLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.blogPost.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // Primary admin emails (Google OAuth must match one of these exactly).
  const ownerEmails = ["elorakart1@gmail.com", "elolrakart1@gmail.com"];
  for (const email of ownerEmails) {
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: "Elorakart Admin",
        role: "ADMIN",
        avatarUrl: null,
      },
      update: { role: "ADMIN", name: "Elorakart Admin" },
    });
  }

  // Optional bootstrap admin from ADMIN_EMAIL if different
  const bootstrap = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  if (bootstrap && !ownerEmails.includes(bootstrap)) {
    await prisma.user.upsert({
      where: { email: bootstrap },
      create: {
        email: bootstrap,
        name: "Elora Admin",
        role: "ADMIN",
        avatarUrl: null,
      },
      update: { role: "ADMIN" },
    });
  }

  for (const p of products) {
    const discount = Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100);
    await prisma.product.create({
      data: {
        title: p.title,
        slug: p.slug,
        description: p.description,
        brand: p.brand,
        volume: p.volume,
        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        discount,
        sku: p.sku,
        stock: p.stock,
        category: p.category,
        benefits: JSON.stringify(p.benefits),
        ingredients: p.ingredients,
        usage: p.usage,
        images: JSON.stringify(p.images),
        rating: p.rating,
        reviewCount: p.reviewCount,
      },
    });
  }

  for (const b of blogs) {
    await prisma.blogPost.create({
      data: {
        title: b.title,
        slug: b.slug,
        excerpt: b.excerpt,
        content: b.content,
        coverImage: b.coverImage,
        tags: JSON.stringify(b.tags),
        published: true,
      },
    });
  }

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

  for (const f of faqs) {
    await prisma.knowledgeArticle.create({
      data: {
        slug: f.slug,
        title: f.title,
        question: f.question,
        answer: f.answer,
        keywords: JSON.stringify(f.keywords),
        category: f.category,
        active: true,
      },
    });
  }

  console.log(
    `Seeded ${products.length} products, ${blogs.length} blogs, ${faqs.length} FAQs, admins`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
