import { createClerkClient } from "@clerk/backend";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  console.error("❌ CLERK_SECRET_KEY is missing in environment variables.");
  process.exit(1);
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!convexUrl) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL is missing in environment variables.");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey });
const convex = new ConvexHttpClient(convexUrl);

const PRIMARY_ADMIN_EMAIL = "drny85@gmail.com";
const PRIMARY_ADMIN_CLERK_ID = "user_3JSsegPcMNMPs5hqmqnpuy8ri6o";

async function main() {
  console.log("🔄 Starting Clerk -> Convex Users Synchronization...");
  console.log(`📡 Convex Deployment: ${convexUrl}`);

  const userList = await clerk.users.getUserList({ limit: 100 });
  console.log(`📋 Found ${userList.totalCount || userList.data.length} user(s) in Clerk.`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const user of userList.data) {
    const primaryEmailObj = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    ) || user.emailAddresses[0];

    const email = primaryEmailObj?.emailAddress?.toLowerCase() || "";
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
    const imageUrl = user.imageUrl || undefined;
    const phone = user.phoneNumbers[0]?.phoneNumber || undefined;

    const isAdmin =
      email === PRIMARY_ADMIN_EMAIL.toLowerCase() ||
      user.id === PRIMARY_ADMIN_CLERK_ID ||
      (user.publicMetadata as any)?.role === "admin";

    const role = isAdmin ? "admin" : "customer";

    const result = await convex.mutation(api.users.upsertUser, {
      clerkId: user.id,
      email,
      name,
      role,
      imageUrl,
      phone,
    });

    console.log(`  👤 [${result.action.toUpperCase()}] ${email || user.id} -> role: ${role}`);
    if (result.action === "created") createdCount++;
    if (result.action === "updated") updatedCount++;
  }

  console.log("\n🎉 Synchronization complete!");
  console.log(`   - Created: ${createdCount}`);
  console.log(`   - Updated: ${updatedCount}`);
  console.log(`   - Total Processed: ${userList.data.length}\n`);
}

main().catch((err) => {
  console.error("❌ Error running user sync:", err);
  process.exit(1);
});
