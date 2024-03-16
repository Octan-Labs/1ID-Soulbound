import { ethers } from "hardhat";
import config from "../config/config";

async function main() {
  const [Deployer] = await ethers.getSigners();

  console.log("Deployer account:", Deployer.address);
  console.log("Account balance:", (await Deployer.getBalance()).toString());

  // //  Deploy Management contract
  // console.log('\nDeploy Management Contract .........');
  // const Management = await ethers.getContractFactory('Management', Deployer);
  // const management = await Management.deploy();
  // console.log('Tx Hash: %s', management.deployTransaction.hash);
  // await management.deployed();

  // console.log('Management Contract: ', management.address);

  // //  Deploy ReputationV2 contract
  // console.log('\nDeploy Reputation Contract .........');
  // const Reputation = await ethers.getContractFactory('ReputationV2', Deployer);
  // const reputation = await Reputation.deploy(
  //     management.address, config.name, config.symbol, config.baseURI
  // );
  // console.log('Tx Hash: %s', reputation.deployTransaction.hash);
  // await reputation.deployed();

  // console.log('Reputation Contract: ', reputation.address);

  // console.log('\n===== DONE =====')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
