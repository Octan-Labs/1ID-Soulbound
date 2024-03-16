import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Bytes, utils, BigNumber } from "ethers";
import {
  Management, Management__factory,
  ReputationV2, ReputationV2__factory,
} from "../typechain-types";

function keccak256(data : Bytes) {
  return utils.keccak256(data);
}

const MANAGER_ROLE = keccak256(utils.toUtf8Bytes("MANAGER_ROLE"));
const MINTER_ROLE = keccak256(utils.toUtf8Bytes("MINTER_ROLE"));
const OPERATOR_ROLE = keccak256(utils.toUtf8Bytes("OPERATOR_ROLE"));
const AddressZero = ethers.constants.AddressZero;
const Zero = ethers.constants.Zero;
const GENERAL_REPUTATION_SCORE = 1;
const emptyLatestScore = [
  BigNumber.from(0), BigNumber.from(0)
]

describe("ReputationV2 Contract Testing", () => {
  let admin: SignerWithAddress, treasury: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let management: Management;
  let reputation: ReputationV2;

  const name = 'Octan Soulbound';
  const symbol = 'OST';
  const uri = 'https://octan.network/reputation/';

  before(async () => {
    [admin, treasury, ...accounts] = await ethers.getSigners();

    const Management = await ethers.getContractFactory('Management', admin) as Management__factory;
    management = await Management.deploy();

    const ReputationV2Factory = await ethers.getContractFactory('ReputationV2', admin) as ReputationV2__factory;
    reputation = await ReputationV2Factory.deploy(management.address, name, symbol, uri);
    
    //  set Treasury address
    await management.connect(admin).setTreasury(treasury.address);

    //  grant MANAGER_ROLE, MINTER_ROLE, and OPERATOR_ROLE to `admin`
    await management.connect(admin).grantRole(MANAGER_ROLE, admin.address);
    await management.connect(admin).grantRole(MINTER_ROLE, admin.address);
    await management.connect(admin).grantRole(OPERATOR_ROLE, admin.address);
  });

  it('Should be able to check the info of Reputation contract', async() => {
    const fromIdx = 0;
    const toIdx = 0;
    const listOfAttributes = [GENERAL_REPUTATION_SCORE];
    expect(await reputation.name()).deep.equal(name);
    expect(await reputation.symbol()).deep.equal(symbol);
    expect(await reputation.totalSupply()).deep.equal(Zero);
    expect(await reputation.numOfAttributes()).deep.equal(listOfAttributes.length);
    expect(await reputation.isValidAttribute(GENERAL_REPUTATION_SCORE)).deep.equal(true);
    expect(await reputation.listOfAttributes(fromIdx, toIdx)).deep.equal(listOfAttributes)
  });

  it('Should revert when Unauthorizer tries to issue a soulbound', async() => {
    const soulboundId = 0;
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      reputation.connect(accounts[0]).issue(accounts[0].address, soulboundId)
    ).to.be.revertedWith('Unauthorized');
    
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should succeed when MINTER_ROLE issues a soulbound', async() => {
    const soulboundId = 0;
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    const tx = await reputation.connect(admin).issue(accounts[0].address, soulboundId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Issued' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.owner).deep.equal( accounts[0].address );
    
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
  });

  it('Should be able to check info that binds to a newly created soulbound', async() => {
    const soulboundId = 0;
    const fromIdx = 0;
    const toIdx = 0;
    const list = [accounts[0].address];
    const listOfAttributes = [GENERAL_REPUTATION_SCORE];
    const tokenURI = uri + soulboundId;
    const attributeURI = uri + soulboundId + '/' + GENERAL_REPUTATION_SCORE;

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await reputation.linkedAccounts(soulboundId, fromIdx, toIdx)).deep.equal(list);
    expect(await reputation.sizeOf(soulboundId)).deep.equal(listOfAttributes.length);
    expect(await reputation.listOf(soulboundId, fromIdx, toIdx)).deep.equal(listOfAttributes)
    expect(await reputation.tokenURI(soulboundId)).deep.equal(tokenURI);
    expect(await reputation.attributeURI(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(attributeURI);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
  })

  it('Should revert when MINTER_ROLE issues a soulbound, but `soulboundId` already in-use', async() => {
    const soulboundId = 0;
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[1].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      reputation.connect(admin).issue(accounts[1].address, soulboundId)
    ).to.be.revertedWith('SoulBound: token already minted');
    
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[1].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when MINTER_ROLE issues a soulbound, but owner = 0x00', async() => {
    const soulboundId = 1;
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      reputation.connect(admin).issue(AddressZero, soulboundId)
    ).to.be.revertedWith('SoulBound: mint to the zero address');
    
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should revert when MINTER_ROLE issues a soulbound, but address already linked to an existed soulbound', async() => {
    const soulboundId = 1;
    const currentSoulBoundId = 0;
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(currentSoulBoundId);

    await expect(
      reputation.connect(admin).issue(accounts[0].address, soulboundId)
    ).to.be.revertedWith('SoulBound: account already assigned a soulbound');
    
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(currentSoulBoundId);
  });

  it('Should succeed when MINTER_ROLE issues a soulbound to a different account', async() => {
    const soulboundId = 1;
    await expect(
        reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    const tx = await reputation.connect(admin).issue(accounts[1].address, soulboundId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Issued' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.owner).deep.equal( accounts[1].address );
    
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
  });

  it('Should be able to check info that binds to a newly created soulbound', async() => {
    const soulboundId = 1;
    const fromIdx = 0;
    const toIdx = 0;
    const list = [accounts[1].address];
    const listOfAttributes = [GENERAL_REPUTATION_SCORE];
    const tokenURI = uri + soulboundId;
    const attributeURI = uri + soulboundId + '/' + GENERAL_REPUTATION_SCORE;

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    expect(await reputation.tokenOf(accounts[1].address)).deep.equal(soulboundId);
    expect(await reputation.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await reputation.linkedAccounts(soulboundId, fromIdx, toIdx)).deep.equal(list);
    expect(await reputation.sizeOf(soulboundId)).deep.equal(listOfAttributes.length);
    expect(await reputation.listOf(soulboundId, fromIdx, toIdx)).deep.equal(listOfAttributes)
    expect(await reputation.tokenURI(soulboundId)).deep.equal(tokenURI);
    expect(await reputation.attributeURI(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(attributeURI);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
  })

  it('Should be able to check soulbounds, as a list, existence', async() => {
    const validList = [BigNumber.from(0), BigNumber.from(1)];
    const invalidList1 = [BigNumber.from(0), BigNumber.from(2)];
    const invalidList2 = [BigNumber.from(2), BigNumber.from(0)];
    
    //  Method exist() is designed to be called by Service contract to check validity of SoulboundIds
    //  If one of them is not existed, return false to revert
    expect(await reputation.exist(validList)).deep.equal(true);
    expect(await reputation.exist(invalidList1)).deep.equal(false);
    expect(await reputation.exist(invalidList2)).deep.equal(false);
  });

  it('Should be able to check a soulbound contains an attribute', async() => {
    //  By default, Each soulbound in Reputation contract has GENERAL_REPUTATION_SCORE as default attribute
    const soulboundId1 = 0;
    const soulboundId2 = 1;
    const invalidAttributeId = 2;

    expect(await reputation.existAttributeOf(soulboundId1, GENERAL_REPUTATION_SCORE)).deep.equal(true);
    expect(await reputation.existAttributeOf(soulboundId1, invalidAttributeId)).deep.equal(false);
    expect(await reputation.existAttributeOf(soulboundId2, GENERAL_REPUTATION_SCORE)).deep.equal(true);
    expect(await reputation.existAttributeOf(soulboundId2, invalidAttributeId)).deep.equal(false);
  });

  it('Should revert when Unauthorizer tries to add attribute to one soulbound', async() => {
    const soulboundId = 0;
    const attributeId = 2;

    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);

    await expect(
      reputation.connect(accounts[0]).addAttributeOf(soulboundId, attributeId)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);
  });

  it('Should revert when OPERATOR_ROLE tries to add attribute to one soulbound, but attribute not supported', async() => {
    const soulboundId = 0;
    const attributeId = 2;

    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);

    await expect(
      reputation.connect(admin).addAttributeOf(soulboundId, attributeId)
    ).to.be.revertedWith('Attribute not supported');

    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);
  });

  it('Should revert when OPERATOR_ROLE tries to add attribute to one soulbound, but attribute already added', async() => {
    const soulboundId = 0;

    expect(await reputation.existAttributeOf(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(true);

    await expect(
      reputation.connect(admin).addAttributeOf(soulboundId, GENERAL_REPUTATION_SCORE)
    ).to.be.revertedWith('Attribute added already to the Soulbound');

    expect(await reputation.existAttributeOf(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(true);
  });

  it('Should revert when OPERATOR_ROLE tries to add attribute to one soulbound, but soulbound not yet minted', async() => {
    const soulboundId = 2;
    const attributeId = 1;

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);

    await expect(
      reputation.connect(admin).addAttributeOf(soulboundId, GENERAL_REPUTATION_SCORE)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);
  });

  it('Should succeed when OPERATOR_ROLE adds attribute to one soulbound', async() => {
    const attributeId = 2;
    await reputation.connect(admin).setAttribute(attributeId, false);

    const soulboundId = 0;

    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);

    const tx = await reputation.connect(admin).addAttributeOf(soulboundId, attributeId)
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'AttributeTo' });

    expect(event != undefined).true;
    expect(event?.args?.operator).deep.equal( admin.address );
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.attributeId).deep.equal( attributeId );

    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(true);
  });

  it('Should be able to check info that binds to a soulbound', async() => {
    const soulboundId = 0;
    const fromIdx = 0;
    const toIdx1 = 0;
    const list = [accounts[0].address];
    const toIdx2 = 1;
    const listOfAttributes = [GENERAL_REPUTATION_SCORE, 2];
    const tokenURI = uri + soulboundId;
    const attributeURI = uri + soulboundId + '/' + GENERAL_REPUTATION_SCORE;

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await reputation.linkedAccounts(soulboundId, fromIdx, toIdx1)).deep.equal(list);
    expect(await reputation.sizeOf(soulboundId)).deep.equal(listOfAttributes.length);
    expect(await reputation.listOf(soulboundId, fromIdx, toIdx2)).deep.equal(listOfAttributes)
    expect(await reputation.tokenURI(soulboundId)).deep.equal(tokenURI);
    expect(await reputation.attributeURI(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(attributeURI);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
  });

  it('Should revert when Unauthorizer tries to call updateRS() to update latest score', async() => {
    const soulboundId = BigNumber.from(0);
    const score = BigNumber.from(100);
    
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    
    await expect(
      reputation.connect(accounts[0]).updateRS(soulboundId, GENERAL_REPUTATION_SCORE, score)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
  });

  it('Should revert when OPERATOR_ROLE tries to call updateRS() to update latest score, but attribute not exist', async() => {
    const invalidAttributeId = 3;
    const soulboundId = BigNumber.from(0);
    const score = BigNumber.from(100);
    
    await expect(
      reputation.connect(admin).updateRS(soulboundId, invalidAttributeId, score)
    ).to.be.revertedWith('Attribute not supported');
  });

  it('Should revert when OPERATOR_ROLE tries to call updateRS() to update latest score, but attribute was removed', async() => {
    const soulboundId = BigNumber.from(0);
    const score = BigNumber.from(100);
    
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    //  temporarily remove GENERAL_REPUTATION_SCORE
    expect(await reputation.isValidAttribute(GENERAL_REPUTATION_SCORE)).deep.equal(true); 
    await reputation.connect(admin).setAttribute(GENERAL_REPUTATION_SCORE, true);
    expect(await reputation.isValidAttribute(GENERAL_REPUTATION_SCORE)).deep.equal(false);
    
    await expect(
      reputation.connect(admin).updateRS(soulboundId, GENERAL_REPUTATION_SCORE, score)
    ).to.be.revertedWith('Attribute not supported');

    //  set back to normal
    await reputation.connect(admin).setAttribute(GENERAL_REPUTATION_SCORE, false);
    expect(await reputation.isValidAttribute(GENERAL_REPUTATION_SCORE)).deep.equal(true);

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
  });

  it('Should revert when OPERATOR_ROLE tries to call updateRS(), but soulbound not yet minted', async() => {
    const soulboundId = BigNumber.from(2);
    const score = BigNumber.from(120);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    
    await expect(
      reputation.connect(admin).updateRS(soulboundId, GENERAL_REPUTATION_SCORE, score)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should succeed when OPERATOR_ROLE calls updateRS()', async() => {
    const soulboundId = BigNumber.from(0);
    const score = BigNumber.from(100);
    
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    const tx = await reputation.connect(admin).updateRS(soulboundId, GENERAL_REPUTATION_SCORE, score);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'UpdateRS' });

    expect(event != undefined).true;
    expect(event?.args?.operator).deep.equal( admin.address );
    expect(event?.args?.attributeId).deep.equal( GENERAL_REPUTATION_SCORE );
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.score).deep.equal( score );
    
    expect( (await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).score ).deep.equal( score );
  });

  it('Should succeed when OPERATOR_ROLE calls updateRS()', async() => {
    const soulboundId = BigNumber.from(1);
    const score = BigNumber.from(110);
    
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    const tx = await reputation.connect(admin).updateRS(soulboundId, GENERAL_REPUTATION_SCORE, score);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'UpdateRS' });

    expect(event != undefined).true;
    expect(event?.args?.operator).deep.equal( admin.address );
    expect(event?.args?.attributeId).deep.equal( GENERAL_REPUTATION_SCORE );
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.score).deep.equal( score );
    
    expect( (await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).score ).deep.equal( score );
  });

  it('Should revert when Unauthorizer tries to revoke a soulbound', async() => {
    const soulboundId = 1;
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    await expect(
      reputation.connect(accounts[1]).revoke(soulboundId)
    ).to.be.revertedWith('Unauthorized');
    
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
  });

  it('Should revert when MINTER_ROLE tries to revoke a soulbound, but soulboundId not exist', async() => {
    const soulboundId = 2;
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      reputation.connect(admin).revoke(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should succeed when MINTER_ROLE revokes a soulbound', async() => {
    const soulboundId = 1;
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);

    const tx = await reputation.connect(admin).revoke(soulboundId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Revoked' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.owner).deep.equal( accounts[1].address );
    
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should revert when MINTER_ROLE tries to revoke a soulbound, but already revoked', async() => {
    const soulboundId = 1;
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      reputation.connect(admin).revoke(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should succeed when OPERATOR_ROLE adds attribute to one soulbound, but soulbound was revoked', async() => {
    const soulboundId = 1;
    const attributeId = 2;

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);

    await expect(
      reputation.connect(admin).addAttributeOf(soulboundId, attributeId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);
  });

  it('Should revert when OPERATOR_ROLE tries to call updateRS() to update latest score, but soulbound was revoked', async() => {
    const soulboundId = BigNumber.from(1);
    const score = BigNumber.from(110);
    
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      reputation.connect(admin).updateRS(soulboundId, GENERAL_REPUTATION_SCORE, score)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should succeed when MINTER_ROLE re-issues a soulbound', async() => {
    const soulboundId = 1;
    await expect(
        reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.tokenOf(accounts[1].address)).deep.equal(soulboundId);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);

    const tx = await reputation.connect(admin).issue(accounts[1].address, soulboundId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Issued' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.owner).deep.equal( accounts[1].address );
    
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    expect(await reputation.tokenOf(accounts[1].address)).deep.equal(soulboundId);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
  });

  it('Should be able to check info that binds to a soulbound after re-issue', async() => {
    const soulboundId = 1;
    const fromIdx = 0;
    const toIdx = 0;
    const list = [accounts[1].address];
    const listOfAttributes = [GENERAL_REPUTATION_SCORE];
    const tokenURI = uri + soulboundId;
    const attributeURI = uri + soulboundId + '/' + GENERAL_REPUTATION_SCORE;
    const lastScore = BigNumber.from(110);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    expect(await reputation.tokenOf(accounts[1].address)).deep.equal(soulboundId);
    expect(await reputation.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await reputation.linkedAccounts(soulboundId, fromIdx, toIdx)).deep.equal(list);
    expect(await reputation.sizeOf(soulboundId)).deep.equal(listOfAttributes.length);
    expect(await reputation.listOf(soulboundId, fromIdx, toIdx)).deep.equal(listOfAttributes)
    expect(await reputation.tokenURI(soulboundId)).deep.equal(tokenURI);
    expect(await reputation.attributeURI(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(attributeURI);
    expect( (await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).score ).deep.equal(lastScore);
  });

  it('Should revert when Unauthorizer tries to change a soulbound between two accounts', async() => {
    const soulboundId = 1;
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      reputation.tokenOf(accounts[3].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      reputation.connect(accounts[1]).change(soulboundId, accounts[1].address, accounts[3].address)
    ).to.be.revertedWith('Unauthorized');
    
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      reputation.tokenOf(accounts[3].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when MINTER_ROLE tries to change a soulbound between two accounts, but soulbound was revoked', async() => {
    const soulboundId = 0;

    //  temporarily revoke soulboundId
    await reputation.connect(admin).revoke(soulboundId);
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      reputation.connect(admin).change(soulboundId, accounts[0].address, accounts[2].address)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    //  set back to normal
    await reputation.connect(admin).issue(accounts[0].address,soulboundId);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
  });

  it('Should revert when MINTER_ROLE tries to change a soulbound from 0x00 to another account, and soulbound was revoked', async() => {
    const soulboundId = 0;

    //  temporarily revoke soulboundId
    await reputation.connect(admin).revoke(soulboundId);
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      reputation.connect(admin).change(soulboundId, AddressZero, accounts[2].address)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    //  set back to normal
    await reputation.connect(admin).issue(accounts[0].address,soulboundId);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
  });

  it('Should revert when MINTER_ROLE tries to change a soulbound from 0x00 to another account, but soulbound currently active', async() => {
    const soulboundId = 0;
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      reputation.connect(admin).change(soulboundId, AddressZero, accounts[2].address)
    ).to.be.revertedWith('SoulBound: soulbound not owned by owner');
    
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when MINTER_ROLE tries to change a soulbound between two accounts, but soulbound not exist', async() => {
    const soulboundId = 2;
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      reputation.connect(admin).change(soulboundId, accounts[0].address, accounts[2].address)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when MINTER_ROLE tries to change a soulbound between two accounts, but soulbound not owned', async() => {
    const soulboundId = 1;
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      reputation.connect(admin).change(soulboundId, accounts[0].address, accounts[2].address)
    ).to.be.revertedWith('SoulBound: soulbound not owned by owner');
    
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should succeed when MINTER_ROLE tries to change a soulbound between two accounts', async() => {
    const soulboundId = 1;
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      reputation.tokenOf(accounts[3].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    const tx = await reputation.connect(admin).change(soulboundId, accounts[1].address, accounts[3].address);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Changed' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.from).deep.equal( accounts[1].address );
    expect(event?.args?.to).deep.equal( accounts[3].address );
    
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[3].address);
    expect(await reputation.tokenOf(accounts[3].address)).deep.equal(soulboundId);
  });

  it('Should succeed when OPERATOR_ROLE adds attribute to one soulbound after being changed to a new account', async() => {
    const attributeId = 3;
    await reputation.connect(admin).setAttribute(attributeId, false);

    const soulboundId = 1;

    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);

    const tx = await reputation.connect(admin).addAttributeOf(soulboundId, attributeId)
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'AttributeTo' });

    expect(event != undefined).true;
    expect(event?.args?.operator).deep.equal( admin.address );
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.attributeId).deep.equal( attributeId );

    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(true);
  });

  it('Should revert when OPERATOR_ROLE tries to call updateRS(), but attribute not exist', async() => {
    const attributeId = 3;
    const soulboundId = BigNumber.from(0);
    const score = BigNumber.from(200);
    
    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);
    await expect(
      reputation.latestAnswer(soulboundId, attributeId)
    ).to.be.revertedWith('Attribute not exist in this soulbound');

    //  Note: attributeId = 3 is valid, but soulboundId not yet registered this attribute
    await expect(
      reputation.connect(admin).updateRS(soulboundId, attributeId, score)
    ).to.be.revertedWith('Soulbound does not have this attribute');

    await expect(
      reputation.latestAnswer(soulboundId, attributeId)
    ).to.be.revertedWith('Attribute not exist in this soulbound');
  });

  it('Should succeed when OPERATOR_ROLE calls updateRS() to update latest score', async() => {
    const attributeId = 3;
    const soulboundId = BigNumber.from(1);
    const score = BigNumber.from(310);
    
    expect(await reputation.latestAnswer(soulboundId, attributeId)).deep.equal(emptyLatestScore);
    
    const tx = await reputation.connect(admin).updateRS(soulboundId, attributeId, score);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'UpdateRS' });

    expect(event != undefined).true;
    expect(event?.args?.operator).deep.equal( admin.address );
    expect(event?.args?.attributeId).deep.equal( attributeId );
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.score).deep.equal( score );
    
    expect( (await reputation.latestAnswer(soulboundId, attributeId)).score ).deep.equal( score );
  });

  it('Should be able to check info that binds to a soulbound after updating', async() => {
    const soulboundId = 1;
    const fromIdx = 0;
    const toIdx = 1;
    const list = [accounts[1].address, accounts[3].address];
    const listOfAttributes = [GENERAL_REPUTATION_SCORE, 3];
    const tokenURI = uri + soulboundId;
    const attributeURI1 = uri + soulboundId + '/' + GENERAL_REPUTATION_SCORE;
    const attributeURI2 = uri + soulboundId + '/' + listOfAttributes[1];
    const lastScore1 = BigNumber.from(110);
    const lastScore2 = BigNumber.from(310);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[3].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    expect(await reputation.tokenOf(accounts[1].address)).deep.equal(soulboundId);
    expect(await reputation.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await reputation.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await reputation.linkedAccounts(soulboundId, fromIdx, toIdx)).deep.equal(list);
    expect(await reputation.sizeOf(soulboundId)).deep.equal(listOfAttributes.length);
    expect(await reputation.listOf(soulboundId, fromIdx, toIdx)).deep.equal(listOfAttributes)
    expect(await reputation.tokenURI(soulboundId)).deep.equal(tokenURI);
    expect(await reputation.attributeURI(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(attributeURI1);
    expect(await reputation.attributeURI(soulboundId, listOfAttributes[1])).deep.equal(attributeURI2);
    expect( (await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).score ).deep.equal(lastScore1);
    expect( (await reputation.latestAnswer(soulboundId, listOfAttributes[1])).score ).deep.equal(lastScore2);
  });
})