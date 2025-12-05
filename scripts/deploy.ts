import pkg from "hardhat";
const { ethers } = pkg;

// Configuration: Add addresses to whitelist on deployment
// These addresses will have unlimited minting privileges
// Set via environment variable (comma-separated) or leave empty for deployer-only
const INITIAL_WHITELIST = process.env.INITIAL_WHITELIST_ADDRESSES
  ? process.env.INITIAL_WHITELIST_ADDRESSES.split(",").map(addr => addr.trim()).filter(addr => addr)
  : [];

async function main() {
  console.log("Deploying tFAKEUSD to Sepolia...\n");

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

  // Display whitelist configuration
  console.log("📝 Initial whitelist configuration:");
  console.log("  - Deployer (auto):", deployer.address);
  if (INITIAL_WHITELIST.length > 0) {
    INITIAL_WHITELIST.forEach((addr, i) => {
      console.log(`  - Additional ${i + 1}:`, addr);
    });
  } else {
    console.log("  - No additional addresses (set INITIAL_WHITELIST_ADDRESSES to add more)");
  }

  // Deploy the contract with initial whitelist
  console.log("\nDeploying contract...");
  const tFAKEUSD = await ethers.deployContract("tFAKEUSD", [INITIAL_WHITELIST]);
  await tFAKEUSD.waitForDeployment();

  const contractAddress = await tFAKEUSD.getAddress();
  console.log("\n✅ tFAKEUSD deployed successfully!");
  console.log("Contract address:", contractAddress);
  console.log("\n📋 Add this to your .env.local:");
  console.log(`NEXT_PUBLIC_TFAKEUSD_ADDRESS=${contractAddress}`);
  console.log("\n🔗 View on Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${contractAddress}`);

  // Mint some initial tokens to deployer for testing
  console.log("\n🪙 Minting initial tokens to deployer...");
  const mintTx = await tFAKEUSD.claim();
  await mintTx.wait();
  
  const deployerBalance = await tFAKEUSD.balanceOf(deployer.address);
  console.log("Deployer tFAKEUSD balance:", ethers.formatEther(deployerBalance), "tFAKEUSD");

  console.log("\n🎉 Deployment complete!");
  console.log("\n💡 To add more whitelisted addresses post-deployment, use:");
  console.log("   await tFAKEUSD.setWhitelist(address, true)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

