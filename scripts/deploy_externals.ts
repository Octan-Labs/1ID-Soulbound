import { ethers } from "hardhat";
import config from "../config/config";

async function main() {
  const [Deployer] = await ethers.getSigners();

  console.log("Deployer account:", Deployer.address);
  console.log("Account balance:", (await Deployer.getBalance()).toString());

  const Management = "0xE5554D702bF1406fcE73e96842F0eDcad54794e1";
  const Reputation = "0xcb6BD451B2724518719Da77Bfa49B6fB56Cde4Ee";

  //  Deploy Minter contract
  console.log("\nDeploy Minter Contract .........");
  const Minter = await ethers.getContractFactory("Minter", Deployer);
  const minter = await Minter.deploy(Management, Reputation);
  console.log("Tx Hash: %s", minter.deployTransaction.hash);
  await minter.deployed();

  console.log("Minter Contract: ", minter.address);

  //  Deploy Updater contract
  console.log("\nDeploy Updater Contract .........");
  const Updater = await ethers.getContractFactory("Updater", Deployer);
  const updater = await Updater.deploy(Management);
  console.log("Tx Hash: %s", updater.deployTransaction.hash);
  await updater.deployed();

  console.log("Updater Contract: ", updater.address);

  //  Deploy Profile contract
  console.log("\nDeploy Profile Contract .........");
  const Profile = await ethers.getContractFactory("Profile", Deployer);
  const profile = await Profile.deploy(
    Management,
    config.name,
    config.symbol,
    config.baseURI
  );
  console.log("Tx Hash: %s", profile.deployTransaction.hash);
  await profile.deployed();

  console.log("Profile Contract: ", profile.address);

  console.log("\n===== DONE =====");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
