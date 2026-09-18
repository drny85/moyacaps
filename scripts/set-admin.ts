import { createClerkClient } from "@clerk/backend";

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  console.error("❌ CLERK_SECRET_KEY is missing in environment variables.");
  process.exit(1);
}

const targetEmail = process.argv[2] || "drny85@gmail.com";

const clerk = createClerkClient({ secretKey });

async function main() {
  console.log(`🔍 Searching for Clerk user with email: ${targetEmail}...`);
  const userList = await clerk.users.getUserList();

  const user = userList.data.find((u) =>
    u.emailAddresses.some((e) => e.emailAddress.toLowerCase() === targetEmail.toLowerCase())
  );

  if (!user) {
    console.error(`❌ User with email ${targetEmail} not found in Clerk.`);
    console.log("Existing users:", userList.data.map((u) => u.emailAddresses[0]?.emailAddress));
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.id} (${user.firstName || ""} ${user.lastName || ""})`);

  console.log("⚙️ Stamping publicMetadata: { role: 'admin' }...");
  const updatedUser = await clerk.users.updateUserMetadata(user.id, {
    publicMetadata: {
      role: "admin",
    },
  });

  console.log("🎉 Success! User updated successfully.");
  console.log("User details:", {
    id: updatedUser.id,
    email: targetEmail,
    publicMetadata: updatedUser.publicMetadata,
  });
}

main().catch((err) => {
  console.error("❌ Failed to set admin role:", err);
  process.exit(1);
});
