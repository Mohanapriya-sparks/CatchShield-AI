const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying CatchShieldLedger to local Hardhat node...");
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const Ledger = await ethers.getContractFactory("CatchShieldLedger");
  const ledger = await Ledger.deploy();
  await ledger.waitForDeployment();

  const address = await ledger.getAddress();
  console.log(`CatchShieldLedger deployed to: ${address}`);
  console.log("\nAdd to backend .env:");
  console.log(`CHAIN_CONTRACT_ADDRESS=${address}`);
  console.log(`CHAIN_RPC_URL=http://127.0.0.1:8545`);

  // Write address to file for convenience
  const fs = require("fs");
  fs.writeFileSync(
    "deployed_address.txt",
    `CONTRACT_ADDRESS=${address}\nRPC_URL=http://127.0.0.1:8545\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
