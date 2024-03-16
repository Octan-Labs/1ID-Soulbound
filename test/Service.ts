import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Bytes, utils, BigNumber, Overrides } from "ethers";
import {
  Management, Management__factory,
  ReputationV2, ReputationV2__factory,
  Service, Service__factory,
  Token20, Token20__factory
} from "../typechain-types";

function keccak256(data : Bytes) {
  return utils.keccak256(data);
}

async function adjustTime(duration : number): Promise<void> {
  ethers.provider.send("evm_increaseTime", [duration]);
  ethers.provider.send("evm_mine", []);
}

const MANAGER_ROLE = keccak256(utils.toUtf8Bytes("MANAGER_ROLE"));
const MINTER_ROLE = keccak256(utils.toUtf8Bytes("MINTER_ROLE"));
const OPERATOR_ROLE = keccak256(utils.toUtf8Bytes("OPERATOR_ROLE"));
const AddressZero = ethers.constants.AddressZero;
const GENERAL_REPUTATION_SCORE = 1;
const days = 24 * 3600;
const provider = ethers.provider;

describe("Service Contract Testing", () => {
  let admin: SignerWithAddress, treasury: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let management: Management, newManagement: Management;

  let reputation: ReputationV2;
  let service: Service;
  let usdt: Token20;

  const name = 'Octan Soulbound';
  const symbol = 'OST';
  const uri = 'https://octan.network/reputation/';

  const initDelayTime = 30 * days;
  const initPaymentToken = AddressZero;
  const initPaymentFee = 50;

  before(async () => {
    [admin, treasury, ...accounts] = await ethers.getSigners();

    const Management = await ethers.getContractFactory('Management', admin) as Management__factory;
    management = await Management.deploy();
    newManagement = await Management.deploy();

    const ReputationV2Factory = await ethers.getContractFactory('ReputationV2', admin) as ReputationV2__factory;
    reputation = await ReputationV2Factory.deploy(management.address, name, symbol, uri);

    const ServiceFactory = await ethers.getContractFactory('Service', admin) as Service__factory;
    service = await ServiceFactory.deploy(
      management.address, reputation.address, initPaymentToken, initPaymentFee, initDelayTime
    );

    const Token20Factory = await ethers.getContractFactory('Token20', admin) as Token20__factory;
    usdt = await Token20Factory.deploy();
    
    //  set Treasury address
    await management.connect(admin).setTreasury(treasury.address);

    //  grant MANAGER_ROLE and OPERATOR_ROLE to `admin`
    await management.connect(admin).grantRole(MANAGER_ROLE, admin.address);
    await management.connect(admin).grantRole(MINTER_ROLE, admin.address);
    await management.connect(admin).grantRole(OPERATOR_ROLE, admin.address);
    await newManagement.connect(admin).grantRole(MANAGER_ROLE, admin.address);

    //  grant OPERATOR_ROLE to Service contract
    await management.connect(admin).grantRole(OPERATOR_ROLE, service.address);

    //  issue SoulBounds
    await reputation.connect(admin).issue(accounts[0].address, 0);
    await reputation.connect(admin).issue(accounts[1].address, 1);

    //  add User to whitelist
    const addWhitelistOpt = 1;
    const whitelist = [accounts[9].address];
    await management.addToList(addWhitelistOpt, whitelist);
  });

  it('Should be able to check the info of Reputation contract', async() => {
    expect(await service.management()).deep.equal(management.address);
    expect(await service.reputation()).deep.equal(reputation.address);
    expect(await service.paymentToken()).deep.equal(initPaymentToken);
    expect(await service.fee()).deep.equal(initPaymentFee);
    expect(await service.delayTime()).deep.equal(initDelayTime);
  });

  it('Should revert when Unauthorizer tries to set Management contract', async() => {
    expect(await service.management()).deep.equal(management.address);

    await expect(
      service.connect(accounts[0]).setManagement(newManagement.address)
    ).to.be.revertedWith('Unauthorized');

    expect(await service.management()).deep.equal(management.address); 
  });

  it('Should revert when MANAGER_ROLE tries to set 0x00 as Management contract', async() => {
    expect(await service.management()).deep.equal(management.address);

    await expect(
      service.connect(admin).setManagement(AddressZero)
    ).to.be.revertedWith('Must be a contract');

    expect(await service.management()).deep.equal(management.address); 
  });

  it('Should revert when MANAGER_ROLE tries to set EOA as Management contract', async() => {
    expect(await service.management()).deep.equal(management.address);

    await expect(
      service.connect(admin).setManagement(admin.address)
    ).to.be.revertedWith('Must be a contract');

    expect(await service.management()).deep.equal(management.address); 
  });

  it('Should succeed when MANAGER_ROLE set new Management contract', async() => {
    expect(await service.management()).deep.equal(management.address);

    await service.connect(admin).setManagement(newManagement.address);

    expect(await service.management()).deep.equal(newManagement.address); 

    //  set back to normal
    await service.connect(admin).setManagement(management.address);
    expect(await service.management()).deep.equal(management.address); 
  });

  it('Should revert when Unauthorizer tries to set fee', async() => {
    const fee = 100;
    expect(await service.paymentToken()).deep.equal(initPaymentToken);
    expect(await service.fee()).deep.equal(initPaymentFee);

    await expect(
      service.connect(accounts[0]).setFee(usdt.address, fee)
    ).to.be.revertedWith('Unauthorized');

    expect(await service.paymentToken()).deep.equal(initPaymentToken);
    expect(await service.fee()).deep.equal(initPaymentFee);
  });

  it('Should succeed when MANAGER_ROLE sets Payment Token Acceptance and Fee', async() => {
    const fee = 100;
    expect(await service.paymentToken()).deep.equal(initPaymentToken);
    expect(await service.fee()).deep.equal(initPaymentFee);

    await service.connect(admin).setFee(usdt.address, fee)

    expect(await service.paymentToken()).deep.equal(usdt.address);
    expect(await service.fee()).deep.equal(fee);
  });

  it('Should succeed when MANAGER_ROLE sets new Payment Token Acceptance = 0x00', async() => {
    const fee = 100;
    expect(await service.paymentToken()).deep.equal(usdt.address);
    expect(await service.fee()).deep.equal(fee);

    await service.connect(admin).setFee(AddressZero, fee)

    expect(await service.paymentToken()).deep.equal(AddressZero);
    expect(await service.fee()).deep.equal(fee);
  });

  it('Should succeed when MANAGER_ROLE sets new Payment Fee', async() => {
    const fee = 100;
    const newFee = 500;
    expect(await service.paymentToken()).deep.equal(AddressZero);
    expect(await service.fee()).deep.equal(fee);

    await service.connect(admin).setFee(AddressZero, newFee)

    expect(await service.paymentToken()).deep.equal(AddressZero);
    expect(await service.fee()).deep.equal(newFee);

    //  set back to normal
    await service.connect(admin).setFee(usdt.address, fee);
    expect(await service.paymentToken()).deep.equal(usdt.address);
    expect(await service.fee()).deep.equal(fee);
  });

  it('Should revert when Unauthorizer tries to set delay time', async() => {
    const delayTime = 7 * days;
    expect(await service.delayTime()).deep.equal(initDelayTime);

    await expect(
      service.connect(accounts[0]).setDelayTime(delayTime)
    ).to.be.revertedWith('Unauthorized');

    expect(await service.delayTime()).deep.equal(initDelayTime);
  });

  it('Should succeed when MANAGER_ROLE sets delay time', async() => {
    const delayTime = 7 * days;
    expect(await service.delayTime()).deep.equal(initDelayTime);

    await service.connect(admin).setDelayTime(delayTime);

    expect(await service.delayTime()).deep.equal(delayTime);

    //  set back to normal
    await service.connect(admin).setDelayTime(initDelayTime);
    expect(await service.delayTime()).deep.equal(initDelayTime);
  });

  it('Should revert when Un-whitelist Caller tries to request to update GENERAL_REPUTATION_SCORE', async() => {
    const soulboundIds = [BigNumber.from(0), BigNumber.from(1)];

    await expect(
      service.connect(accounts[0]).generalRequest(soulboundIds)
    ).to.be.revertedWith('Only whitelist');
  });

  it('Should revert when whitelist Caller tries to request to update GENERAL_REPUTATION_SCORE, but contains non-existed soulbound', async() => {
    const soulboundIds = [BigNumber.from(0), BigNumber.from(1), BigNumber.from(2)];

    await expect(
      service.connect(accounts[9]).generalRequest(soulboundIds)
    ).to.be.revertedWith('Contain non-existed soulboundId');
  });

  it('Should revert when whitelist Caller tries to request to update GENERAL_REPUTATION_SCORE, but contains revoked soulbound', async() => {
    const soulboundIds = [BigNumber.from(0), BigNumber.from(1)];

    expect(await reputation.isRevoked(soulboundIds[1])).deep.equal(false);
    await reputation.connect(admin).revoke(soulboundIds[1]);
    expect(await reputation.isRevoked(soulboundIds[1])).deep.equal(true);

    await expect(
      service.connect(accounts[9]).generalRequest(soulboundIds)
    ).to.be.revertedWith('Contain non-existed soulboundId');

    //  set back to normal
    await reputation.connect(admin).issue(accounts[1].address, soulboundIds[1]);
    expect(await reputation.isRevoked(soulboundIds[1])).deep.equal(false);
  });

  it('Should succeed when whitelist Caller requests to update GENERAL_REPUTATION_SCORE', async() => {
    const soulboundIds = [BigNumber.from(0), BigNumber.from(1)];

    const tx = await service.connect(accounts[9]).generalRequest(soulboundIds);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Request' });

    expect(event != undefined).true;
    expect(event?.args?.requestor).deep.equal( accounts[9].address );
    expect(event?.args?.attributeId).deep.equal( GENERAL_REPUTATION_SCORE );
    expect(event?.args?.soulboundIds).deep.equal( soulboundIds );
  });

  it('Should succeed when whitelist Caller requests to update GENERAL_REPUTATION_SCORE after soulbound changed between two accounts', async() => {
    const soulboundIds = [BigNumber.from(0), BigNumber.from(1)];

    expect(await reputation.ownerOf(soulboundIds[0])).deep.equal(accounts[0].address);
    await reputation.connect(admin).change(soulboundIds[0], accounts[0].address, accounts[2].address);
    expect(await reputation.ownerOf(soulboundIds[0])).deep.equal(accounts[2].address);

    const tx = await service.connect(accounts[9]).generalRequest(soulboundIds);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Request' });

    expect(event != undefined).true;
    expect(event?.args?.requestor).deep.equal( accounts[9].address );
    expect(event?.args?.attributeId).deep.equal( GENERAL_REPUTATION_SCORE );
    expect(event?.args?.soulboundIds).deep.equal( soulboundIds );
  });

  it('Should revert when Caller tries to request to update GENERAL_REPUTATION_SCORE, but calling a wrong method - categoryRequest()', async() => {
    const soulboundId = 0;

    //  categoryRequest() is designed to request updating Category Reputation Score only
    await expect(
      service.connect(accounts[2]).categoryRequest(soulboundId, GENERAL_REPUTATION_SCORE)
    ).to.be.revertedWith('Invalid attributeId');
  });

  it('Should revert when Caller tries to request updating Category Reputation Score, but soulbound not owned', async() => {
    const requestSoulbound = 0;
    const ownedSoulbound = 1;
    const attributeId = 2;

    expect(await reputation.ownerOf(requestSoulbound)).deep.equal(accounts[2].address);
    expect(await reputation.tokenOf(accounts[1].address)).deep.equal(ownedSoulbound);

    await expect(
      service.connect(accounts[1]).categoryRequest(requestSoulbound, attributeId)
    ).to.be.revertedWith('Soulbound not owned');
  });

  it('Should revert when Caller tries to request updating Category Reputation Score, but soulbound currently linked to another account', async() => {
    const soulboundId = 0;
    const attributeId = 2;

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[2].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.tokenOf(accounts[2].address)).deep.equal(soulboundId);

    await expect(
      service.connect(accounts[1]).categoryRequest(soulboundId, attributeId)
    ).to.be.revertedWith('Soulbound not owned');
  });

  it('Should revert when Caller tries to request updating Category Reputation Score, but attribute is invalid', async() => {
    const soulboundId = 0;
    const attributeId = 2;

    expect(await reputation.isValidAttribute(attributeId)).deep.equal(false);

    await expect(
      service.connect(accounts[2]).categoryRequest(soulboundId, attributeId)
    ).to.be.revertedWith('Invalid attributeId');
  });

  it('Should revert when Caller tries to request updating Category Reputation Score, but payment = 0', async() => {
    const soulboundId = 0;
    const attributeId = 2;
    const fee = 100;

    //  temporarily set Payment Token Acceptance = 0x00
    await service.connect(admin).setFee(AddressZero, fee);
    expect(await service.paymentToken()).deep.equal(AddressZero);

    await reputation.connect(admin).setAttribute(attributeId, false);
    expect(await reputation.isValidAttribute(attributeId)).deep.equal(true);
    expect(await service.fee()).deep.equal(fee);

    const optional = {value: ethers.utils.parseUnits('0', 'wei')} as Overrides;
    await expect(
      service.connect(accounts[2]).categoryRequest(soulboundId, attributeId, optional)
    ).to.be.revertedWith('Invalid payment');

    //  set back to USDT
    await service.connect(admin).setFee(usdt.address, fee);
    expect(await service.paymentToken()).deep.equal(usdt.address);
  });

  it('Should revert when Caller tries to request updating Category Reputation Score, but payment < fee', async() => {
    const soulboundId = 0;
    const attributeId = 2;
    const fee = 100;

    //  temporarily set Payment Token Acceptance = 0x00
    await service.connect(admin).setFee(AddressZero, fee);
    expect(await service.paymentToken()).deep.equal(AddressZero);
    expect(await service.fee()).deep.equal(fee);

    const optional = {value: ethers.utils.parseUnits('99', 'wei')} as Overrides;
    await expect(
      service.connect(accounts[2]).categoryRequest(soulboundId, attributeId, optional)
    ).to.be.revertedWith('Invalid payment');

    //  set back to USDT
    await service.connect(admin).setFee(usdt.address, fee);
    expect(await service.paymentToken()).deep.equal(usdt.address);
  });

  it('Should revert when Caller tries to request updating Category Reputation Score, but payment > fee', async() => {
    const soulboundId = 0;
    const attributeId = 2;
    const fee = 100;

    //  temporarily set Payment Token Acceptance = 0x00
    await service.connect(admin).setFee(AddressZero, fee);
    expect(await service.paymentToken()).deep.equal(AddressZero);
    expect(await service.fee()).deep.equal(fee);

    const optional = {value: ethers.utils.parseUnits('101', 'wei')} as Overrides;
    await expect(
      service.connect(accounts[2]).categoryRequest(soulboundId, attributeId, optional)
    ).to.be.revertedWith('Invalid payment');

    //  set back to USDT
    await service.connect(admin).setFee(usdt.address, fee);
    expect(await service.paymentToken()).deep.equal(usdt.address);
  });

  it('Should revert when Caller tries to request updating Category Reputation Score, but not approve allowance', async() => {
    const soulboundId = 0;
    const attributeId = 2;

    await expect(
      service.connect(accounts[2]).categoryRequest(soulboundId, attributeId)
    ).to.be.revertedWith('ERC20: insufficient allowance');
  });

  it('Should revert when Caller tries to request updating Category Reputation Score, but insufficient balance', async() => {
    const soulboundId = 0;
    const attributeId = 2;

    await usdt.connect(accounts[2]).approve(service.address, 1000000000000000);

    await expect(
      service.connect(accounts[2]).categoryRequest(soulboundId, attributeId)
    ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
  });

  it('Should succeed when Caller requests updating Category Reputation Score for the first time', async() => {
    const soulboundId = 0;
    const attributeId = 2;
    const fee = 100;

    await usdt.connect(accounts[2]).mint(accounts[2].address, 1000000000000);
    const balance1 = await usdt.balanceOf(treasury.address);
    const balance2 = await usdt.balanceOf(accounts[2].address);

    //  For the first time request, `attributeId` of Category Reputation Score not exist in the soulbound
    //  Once success, the attribute is added to a soulbound
    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(false);

    const tx = await service.connect(accounts[2]).categoryRequest(soulboundId, attributeId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Request' });

    expect(event != undefined).true;
    expect(event?.args?.requestor).deep.equal( accounts[2].address );
    expect(event?.args?.attributeId).deep.equal( attributeId );
    expect(event?.args?.soulboundIds).deep.equal( [soulboundId] );

    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(true);
    expect(await usdt.balanceOf(treasury.address)).deep.equal(balance1.add(fee));
    expect(await usdt.balanceOf(accounts[2].address)).deep.equal(balance2.sub(fee));
  });

  it('Should revert when Caller tries to request updating Category Reputation Score, but soulbound is revoke', async() => {
    const soulboundId = 0;
    const attributeId = 2;

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[2].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    await reputation.connect(admin).revoke(soulboundId);
    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);

    await expect(
      service.connect(accounts[2]).categoryRequest(soulboundId, attributeId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should succeed when Caller requests updating Category Reputation Score after re-issuing a soulbound', async() => {
    const soulboundId = 0;
    const attributeId = 2;
    const fee = 100;

    await usdt.connect(accounts[0]).mint(accounts[0].address, 1000000000000);
    await usdt.connect(accounts[0]).approve(service.address, 1000000000000000);
    const balance1 = await usdt.balanceOf(treasury.address);
    const balance2 = await usdt.balanceOf(accounts[0].address);

    //  re-issue soulbound
    await reputation.connect(admin).issue(accounts[0].address, soulboundId);
    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    //  Soulbound already requested to update this attribute
    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(true);

    const tx = await service.connect(accounts[0]).categoryRequest(soulboundId, attributeId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Request' });

    expect(event != undefined).true;
    expect(event?.args?.requestor).deep.equal( accounts[0].address );
    expect(event?.args?.attributeId).deep.equal( attributeId );
    expect(event?.args?.soulboundIds).deep.equal( [soulboundId] );

    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(true);
    expect(await usdt.balanceOf(treasury.address)).deep.equal(balance1.add(fee));
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance2.sub(fee));
  });

  it('Should revert when Caller tries to request updating Category Reputation Score, but request too close', async() => {
    const soulboundId = 0;
    const attributeId = 2;

    //  assume previous request has been fulfilled
    await reputation.connect(admin).updateRS(soulboundId, attributeId, '100');

    const balance1 = await usdt.balanceOf(treasury.address);
    const balance2 = await usdt.balanceOf(accounts[0].address);

    await expect(
      service.connect(accounts[0]).categoryRequest(soulboundId, attributeId)
    ).to.be.revertedWith('Request too close');

    expect(await usdt.balanceOf(treasury.address)).deep.equal(balance1);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance2);
  });

  it('Should succeed when Caller requests updating Category Reputation Score after delay time', async() => {
    const soulboundId = 0;
    const attributeId = 2;
    const fee = 100;

    const balance1 = await usdt.balanceOf(treasury.address);
    const balance2 = await usdt.balanceOf(accounts[0].address);

    const lastUpdate = (await reputation.latestAnswer(soulboundId, attributeId)).lastUpdate;
    const block = await provider.getBlockNumber();
    const timestamp = (await provider.getBlock(block)).timestamp;

    let timeAllowance: BigNumber = lastUpdate.add(initDelayTime);
    let duration: number;
    if (timeAllowance.gt(timestamp)) {
      duration = timeAllowance.sub(timestamp).toNumber();
      await adjustTime(duration);
    }

    const tx = await service.connect(accounts[0]).categoryRequest(soulboundId, attributeId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Request' });

    expect(event != undefined).true;
    expect(event?.args?.requestor).deep.equal( accounts[0].address );
    expect(event?.args?.attributeId).deep.equal( attributeId );
    expect(event?.args?.soulboundIds).deep.equal( [soulboundId] );

    expect(await reputation.existAttributeOf(soulboundId, attributeId)).deep.equal(true);
    expect(await usdt.balanceOf(treasury.address)).deep.equal(balance1.add(fee));
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance2.sub(fee));

    //  set back to normal
    if (timeAllowance.gt(timestamp)) {
      duration = timeAllowance.sub(timestamp).toNumber();
      await adjustTime(duration);
    }
  });

});