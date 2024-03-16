import hre from "hardhat";
import config from "../config/config";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  console.log("Verify Management Contract ......");
  const Management = "";

  await hre.run("verify:verify", {
    address: Management,
    constructorArguments: [],
  });

  console.log("Verify Reputation Contract ......");
  const Reputation = "";

  await hre.run("verify:verify", {
    address: Reputation,
    contract: "contracts/versions/ReputationV2.sol:ReputationV2",
    constructorArguments: [
      Management,
      config.name,
      config.symbol,
      config.baseURI,
    ],
  });

  console.log("Verify Minter Contract ......");
  const Minter = "";

  await hre.run("verify:verify", {
    address: Minter,
    constructorArguments: [Management, Reputation],
  });

  console.log("Verify Updater Contract ......");
  const Updater = "";

  await hre.run("verify:verify", {
    address: Updater,
    constructorArguments: [Management],
  });

  console.log("\n===== DONE =====");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
