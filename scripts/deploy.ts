import pkg from "hardhat";
const { ethers } = pkg;

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

  // Deploy the contract
  console.log("Deploying contract...");
  const tFAKEUSD = await ethers.deployContract("tFAKEUSD");
  await tFAKEUSD.waitForDeployment();

  const contractAddress = await tFAKEUSD.getAddress();
  console.log("\n✅ tFAKEUSD deployed successfully!");
  console.log("Contract address:", contractAddress);
  console.log("\n📋 Add this to your .env.local:");
  console.log(`NEXT_PUBLIC_TFAKEUSD_ADDRESS=${contractAddress}`);
  console.log("\n🔗 View on Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${contractAddress}`);

  // Verify whitelisted addresses
  console.log("\n📝 Whitelisted addresses:");
  console.log("  - Deployer:", deployer.address);
  console.log("  - Additional:", "0x033C4BE38e0265ab17E12f50BEc914e0a56f269f");

  // Mint some initial tokens to deployer for testing
  console.log("\n🪙 Minting initial tokens to deployer...");
  const mintTx = await tFAKEUSD.claim();
  await mintTx.wait();
  
  const deployerBalance = await tFAKEUSD.balanceOf(deployer.address);
  console.log("Deployer tFAKEUSD balance:", ethers.formatEther(deployerBalance), "tFAKEUSD");

  console.log("\n🎉 Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

