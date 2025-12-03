import pkg from "hardhat";
const { ethers } = pkg;

// Configuration - update these as needed
const TFAKEUSD_ADDRESS = process.env.NEXT_PUBLIC_TFAKEUSD_ADDRESS || "0xd0DF684Ef778b4b13A2307087C6265396CE80cCb";
// Backend signer - this should be a dedicated key for signing withdrawals
// For now, using deployer as backend signer (update in production)
const BACKEND_SIGNER = process.env.BACKEND_SIGNER_ADDRESS || ""; // Will use deployer if empty

async function main() {
  console.log("Deploying FakeDexEscrow to Sepolia...\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    console.error("ERROR: Deployer has no ETH for gas!");
    console.log("Get Sepolia ETH from: https://sepoliafaucet.com/");
    process.exit(1);
  }

  // Use deployer as backend signer if not specified
  const backendSigner = BACKEND_SIGNER || deployer.address;
  console.log("Backend signer:", backendSigner);
  console.log("tFAKEUSD address:", TFAKEUSD_ADDRESS);

  // Deploy the escrow contract
  console.log("\n📦 Deploying FakeDexEscrow...");
  const FakeDexEscrow = await ethers.getContractFactory("FakeDexEscrow");
  const escrow = await FakeDexEscrow.deploy(TFAKEUSD_ADDRESS, backendSigner);
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  console.log("✅ FakeDexEscrow deployed at:", escrowAddress);

  // Whitelist the escrow contract in tFAKEUSD so it can mint unlimited
  console.log("\n🔑 Whitelisting escrow in tFAKEUSD...");
  const tFAKEUSD = await ethers.getContractAt("tFAKEUSD", TFAKEUSD_ADDRESS);
  
  try {
    const whitelistTx = await tFAKEUSD.setWhitelist(escrowAddress, true);
    await whitelistTx.wait();
    console.log("✅ Escrow whitelisted in tFAKEUSD!");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("⚠️  Could not whitelist escrow (may need owner):", errorMessage);
    console.log("   You'll need to manually call setWhitelist on tFAKEUSD");
  }

  // Verify deployment
  console.log("\n📋 Verifying deployment...");
  const faucetAmount = await escrow.faucetAmount();
  const faucetCooldown = await escrow.faucetCooldown();
  console.log("  Faucet amount:", ethers.formatEther(faucetAmount), "tFAKEUSD");
  console.log("  Faucet cooldown:", Number(faucetCooldown) / 3600, "hours");
  console.log("  Max withdrawal per tx:", "No limit (0)");
  console.log("  Daily withdrawal limit:", "No limit (0)");

  // Output for .env.local
  console.log("\n" + "=".repeat(60));
  console.log("📋 Add these to your .env.local:\n");
  console.log(`NEXT_PUBLIC_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`BACKEND_SIGNER_PRIVATE_KEY=<your-backend-private-key>`);
  console.log("\n" + "=".repeat(60));

  console.log("\n🔗 View on Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${escrowAddress}`);

  console.log("\n🎉 Deployment complete!");
  console.log("\n⚠️  Next steps:");
  console.log("1. If whitelisting failed, manually whitelist escrow in tFAKEUSD");
  console.log("2. Update lib/contracts.ts with the new escrow address");
  console.log("3. Set up backend signer private key for withdrawal signatures");
  console.log("4. Test claimToTrading() and withdraw() functions");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

