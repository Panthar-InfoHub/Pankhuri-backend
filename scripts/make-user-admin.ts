import { config } from "dotenv";
import { PrismaClient, UserRole } from "../src/prisma/generated/prisma/client";

// Load environment variables
config();

const prisma = new PrismaClient();

async function makeUserAdmin() {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log("Usage: npm run make-admin -- <email_or_phone>");
      console.log("\nExample:");
      console.log("  npm run make-admin -- user@example.com");
      console.log("  npm run make-admin -- +1234567890");
      process.exit(1);
    }

    const identifier = args[0];
    console.log(`\n🔍 Looking for user: ${identifier}\n`);

    // Find user by email or phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
    });

    if (!user) {
      console.error(`❌ User not found with email/phone: ${identifier}`);
      console.log("\nTip: Make sure the user exists. Login first to create the user.");
      process.exit(1);
    }

    if (user.role === UserRole.admin) {
      console.log("✅ User is already an admin!");
      console.log("\nUser Details:");
      console.log("   ID:", user.id);
      console.log("   Email:", user.email || "N/A");
      console.log("   Phone:", user.phone || "N/A");
      console.log("   Display Name:", user.displayName || "N/A");
      console.log("   Role:", user.role);
      return;
    }

    // Update user to admin
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.admin },
    });

    console.log("✅ User successfully updated to admin!\n");
    console.log("User Details:");
    console.log("   ID:", updatedUser.id);
    console.log("   Email:", updatedUser.email || "N/A");
    console.log("   Phone:", updatedUser.phone || "N/A");
    console.log("   Display Name:", updatedUser.displayName || "N/A");
    console.log("   Role:", updatedUser.role);
    console.log("   Status:", updatedUser.status);

    console.log("\n🔑 Next Steps:");
    console.log("1. Login again using Google/Phone to get a new JWT token");
    console.log("2. The new token will include admin role");
    console.log("3. You can now access all admin endpoints!");
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

makeUserAdmin();
