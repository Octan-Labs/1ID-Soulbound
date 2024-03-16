import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Address } from "hardhat-deploy/dist/types";
import { Bytes, utils, Wallet } from "ethers";
import {
    Management, Management__factory,
    SoulBoundMintable, SoulBoundMintable__factory,
} from "../typechain-types";

function keccak256(data : Bytes) {
  return utils.keccak256(data);
}

function array_range(start : number, end: number) : number[] {
  return Array(end - start + 1).fill(null).map((_, idx) => start + idx)
}

function gen_multiple_addrs(num_of_accounts: number) : Address[] {
  return Array(num_of_accounts).fill(null).map( _=> Wallet.createRandom().address );
}

const MANAGER_ROLE = keccak256(utils.toUtf8Bytes("MANAGER_ROLE"));
const MINTER_ROLE = keccak256(utils.toUtf8Bytes("MINTER_ROLE"));
const AddressZero = ethers.constants.AddressZero;
const Zero = ethers.constants.Zero;

describe("SoulBoundMintable Contract Testing", () => {
  let admin: SignerWithAddress, treasury: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let management: Management, newManagement: Management;
  let soulbound: SoulBoundMintable;

  const name = 'SoulBound Example';
  const symbol = 'SBE';
  const uri = 'https://octan.network/soulbound/';

  before(async () => {
    [admin, treasury, ...accounts] = await ethers.getSigners();

    const Management = await ethers.getContractFactory('Management', admin) as Management__factory;
    management = await Management.deploy();
    newManagement = await Management.deploy();

    const SoulBound = await ethers.getContractFactory('SoulBoundMintable', admin) as SoulBoundMintable__factory;
    soulbound = await SoulBound.deploy(management.address, name, symbol, uri);
    
    //  set Treasury address
    await management.connect(admin).setTreasury(treasury.address);

    //  grant MANAGER_ROLE and MINTER_ROLE to `admin`
    await management.connect(admin).grantRole(MANAGER_ROLE, admin.address);
    await management.connect(admin).grantRole(MINTER_ROLE, admin.address);
    await newManagement.connect(admin).grantRole(MANAGER_ROLE, admin.address);
    await newManagement.connect(admin).grantRole(MINTER_ROLE, admin.address);
  });

  it('Should be able to check the info of Soulbound contract', async() => {
    expect(await soulbound.name()).deep.equal(name);
    expect(await soulbound.symbol()).deep.equal(symbol);
    expect(await soulbound.totalSupply()).deep.equal(Zero);
  });

  it('Should be able to query current Management contract', async() => {
    expect(await soulbound.management()).deep.equal(management.address);
  });

  it('Should revert when Unauthorizer tries to set new Management contract', async() => {
    expect(await soulbound.management()).deep.equal(management.address);

    await expect(
        soulbound.connect(accounts[0]).setManagement(newManagement.address)
    ).to.be.revertedWith('Unauthorized');
    
    expect(await soulbound.management()).deep.equal(management.address);
  });

  it('Should revert when MANAGER_ROLE tries to set new Management contract, but set EOA', async() => {
    expect(await soulbound.management()).deep.equal(management.address);

    await expect(
        soulbound.connect(admin).setManagement(admin.address)
    ).to.be.revertedWith('Must be a contract');
    
    expect(await soulbound.management()).deep.equal(management.address);
  });

  it('Should succeed when MANAGER_ROLE sets new Management contract', async() => {
    expect(await soulbound.management()).deep.equal(management.address);

    await soulbound.connect(admin).setManagement(newManagement.address);
    
    expect(await soulbound.management()).deep.equal(newManagement.address);

    //  set back to normal
    await soulbound.connect(admin).setManagement(management.address);
    expect(await soulbound.management()).deep.equal(management.address);
  });

  it('Should revert when Unauthorizer tries to set `attributeId`', async() => {
    const attributeId = 0;
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(false);

    await expect(
        soulbound.connect(accounts[0]).setAttribute(attributeId, false)
    ).to.be.revertedWith('Unauthorized');
    
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(false);
  });

  it('Should succeed when MANAGER_ROLE sets `attributeId`', async() => {
    const attributeId = 0;
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(false);

    const tx = await soulbound.connect(admin).setAttribute(attributeId, false)
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Set' });

    expect(event != undefined).true;
    expect(event?.args?.soulbound).deep.equal( soulbound.address );
    expect(event?.args?.attributeId).deep.equal( attributeId );
    
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(true);
  });

  it('Should be able to query a current number of attribute', async() => {
    expect(await soulbound.numOfAttributes()).deep.equal(1);
  });

  it('Should revert when MANAGER_ROLE tries to set `attributeId`, but set already', async() => {
    const attributeId = 0;
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(true);

    await expect(
        soulbound.connect(admin).setAttribute(attributeId, false)
    ).to.be.revertedWith('Attribute already set');
    
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(true);
  });

  it('Should revert when Unauthorizer tries to remove `attributeId`', async() => {
    const attributeId = 0;
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(true);

    await expect(
        soulbound.connect(accounts[0]).setAttribute(attributeId, true)
    ).to.be.revertedWith('Unauthorized');
    
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(true);
  });

  it('Should revert when MANAGER_ROLE tries to remove `attributeId`, but not found', async() => {
    const attributeId = 1;
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(false);

    await expect(
        soulbound.connect(admin).setAttribute(attributeId, true)
    ).to.be.revertedWith('Attribute not recorded');
    
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(false);
  });

  it('Should succeed when MANAGER_ROLE removes `attributeId`', async() => {
    const attributeId = 0;
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(true);

    const tx = await soulbound.connect(admin).setAttribute(attributeId, true);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Removed' });

    expect(event != undefined).true;
    expect(event?.args?.soulbound).deep.equal( soulbound.address );
    expect(event?.args?.attributeId).deep.equal( attributeId );
    
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(false);
  });

  it('Should be able to query a current number of attribute', async() => {
    expect(await soulbound.numOfAttributes()).deep.equal(0);
  });

  it('Should revert when MANAGER_ROLE tries to remove `attributeId`, but removed already', async() => {
    const attributeId = 0;
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(false);

    await expect(
        soulbound.connect(admin).setAttribute(attributeId, true)
    ).to.be.revertedWith('Attribute not recorded');
    
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(false);
  });

  it('Should succeed when MANAGER_ROLE sets `attributeId` that was removed before', async() => {
    const attributeId = 0;
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(false);

    await soulbound.connect(admin).setAttribute(attributeId, false)
    
    expect(await soulbound.isValidAttribute(attributeId)).deep.equal(true);
  });

  it('Should revert when Unauthorizer tries to issue a soulbound', async() => {
    const soulboundId = 0;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      soulbound.connect(accounts[0]).issue(accounts[0].address, soulboundId)
    ).to.be.revertedWith('Unauthorized');
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should succeed when MINTER_ROLE issues a soulbound', async() => {
    const soulboundId = 0;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    const tx = await soulbound.connect(admin).issue(accounts[0].address, soulboundId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Issued' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.owner).deep.equal( accounts[0].address );
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[0].address);
  });

  it('Should revert when MINTER_ROLE issues a soulbound, but `soulboundId` already in-use', async() => {
    const soulboundId = 0;
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[0].address);

    await expect(
      soulbound.connect(admin).issue(accounts[1].address, soulboundId)
    ).to.be.revertedWith('SoulBound: token already minted');
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[0].address);
  });

  it('Should revert when MINTER_ROLE issues a soulbound, but owner = 0x00', async() => {
    const soulboundId = 1;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      soulbound.connect(admin).issue(AddressZero, soulboundId)
    ).to.be.revertedWith('SoulBound: mint to the zero address');
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should revert when MINTER_ROLE issues a soulbound, but address already linked to an existed soulbound', async() => {
    const soulboundId = 1;
    const currentSoulBoundId = 0;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(currentSoulBoundId);

    await expect(
      soulbound.connect(admin).issue(accounts[0].address, soulboundId)
    ).to.be.revertedWith('SoulBound: account already assigned a soulbound');
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(currentSoulBoundId);
  });

  it('Should succeed when MINTER_ROLE issues a soulbound to a different account', async() => {
    const soulboundId = 1;
    await expect(
        soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    const tx = await soulbound.connect(admin).issue(accounts[1].address, soulboundId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Issued' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.owner).deep.equal( accounts[1].address );
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
  });

  it('Should be able to check a number of issued soulbounds', async() => {
    const amount = 2;
    expect(await soulbound.totalSupply()).deep.equal(amount);
  });

  it('Should be able to check current linked account to a soulbound', async() => {
    const soulboundId = 0;
    const fromIdx = 0;
    const toIdx = 0;
    const list = [accounts[0].address];
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await soulbound.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await soulbound.linkedAccounts(soulboundId, fromIdx, toIdx)).deep.equal(list);
  });

  it('Should revert when checking linked account to a soulbound, but soulbound not existed', async() => {
    const soulboundId = 2;
    const fromIdx = 0;
    const toIdx = 0;
    expect(await soulbound.numOfLinkedAccounts(soulboundId)).deep.equal(Zero);
    await expect(
      soulbound.linkedAccounts(soulboundId, fromIdx, toIdx)
    ).to.be.revertedWith('SoulBound: id not linked to any accounts');
  });

  it('Should revert when checking linked account to a soulbound, but index out of bound', async() => {
    const soulboundId = 1;
    const fromIdx = 0;
    const toIdx = 1;
    const list = [accounts[1].address];
    expect(await soulbound.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    await expect(
      soulbound.linkedAccounts(soulboundId, fromIdx, toIdx)
    ).to.be.revertedWith('SoulBound: index out of bounds');
  });

  it('Should be able to query tokenURI of an existed soulbound', async() => {
    const soulboundId = 0;
    const tokenURI = uri + soulboundId;

    expect(await soulbound.tokenURI(soulboundId)).deep.equal(tokenURI);
  });

  it('Should revert when querying tokenURI, but soulbound not existed', async() => {
    const soulboundId = 2;

    await expect(
      soulbound.tokenURI(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should be able to query attributeURI of an existed soulbound', async() => {
    const soulboundId = 0;
    const attributeId = 0;
    const attributeURI = uri + soulboundId + '/' + attributeId;

    expect(await soulbound.attributeURI(soulboundId, attributeId)).deep.equal(attributeURI);
  });

  it('Should revert when querying attributeURI, but attributeId not existed', async() => {
    const soulboundId = 0;
    const attributeId = 1;

    await expect(
        soulbound.attributeURI(soulboundId, attributeId)
    ).to.be.revertedWith('Attribute not recorded');
  });

  it('Should revert when Unauthorizer tries to set new URI', async() => {
    const newURI = 'https://octan.network/soulbound/newURI/';
    await expect(
        soulbound.connect(accounts[0]).setBaseURI(newURI)
    ).to.be.revertedWith('Unauthorized');
  });

  it('Should succeed when MANAGER_ROLE sets new URI', async() => {
    const newURI = 'https://octan.network/soulbound/newURI/';
    await soulbound.connect(admin).setBaseURI(newURI);

    const soulboundId = 0;
    const attributeId = 0;
    const tokenURI = newURI + soulboundId;
    const attributeURI = newURI + soulboundId + '/' + attributeId;

    expect(await soulbound.tokenURI(soulboundId)).deep.equal(tokenURI);
    expect(await soulbound.attributeURI(soulboundId, attributeId)).deep.equal(attributeURI);

    //  set back to normal
    await soulbound.connect(admin).setBaseURI(uri);
  });

  it('Should revert when Unauthorizer tries to revoke a soulbound', async() => {
    const soulboundId = 0;
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[0].address);

    await expect(
      soulbound.connect(accounts[0]).revoke(soulboundId)
    ).to.be.revertedWith('Unauthorized');
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[0].address);
  });

  it('Should revert when MINTER_ROLE tries to revoke a soulbound, but soulboundId not existed', async() => {
    const soulboundId = 2;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      soulbound.connect(admin).revoke(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should succeed when MINTER_ROLE revokes a soulbound', async() => {
    const soulboundId = 0;
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[0].address);

    const tx = await soulbound.connect(admin).revoke(soulboundId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Revoked' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.owner).deep.equal( accounts[0].address );
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should be able to check linked account to a revoked soulbound', async() => {
    const soulboundId = 0;
    const fromIdx = 0;
    const toIdx = 0;
    const list = [accounts[0].address];

    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await soulbound.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await soulbound.linkedAccounts(soulboundId, fromIdx, toIdx)).deep.equal(list);
  });

  it('Should revert when MINTER_ROLE tries to revoke a soulbound, but already revoked', async() => {
    const soulboundId = 0;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      soulbound.connect(admin).revoke(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should revert when MINTER_ROLE issues a soulbound, but account already linked to a revoked soulbound', async() => {
    const soulboundId = 2;
    const revokedSoulboundId = 0;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(revokedSoulboundId);

    await expect(
      soulbound.connect(admin).issue(accounts[0].address, soulboundId)
    ).to.be.revertedWith('SoulBound: account already assigned a soulbound');
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(revokedSoulboundId);
  });

  it('Should revert when MINTER_ROLE issues a soulbound, but soulbound was revoked and already linked to an account', async() => {
    const soulboundId = 0;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(true);

    await expect(
      soulbound.connect(admin).issue(accounts[2].address, soulboundId)
    ).to.be.revertedWith('SoulBound: revoked soulbound not contain the account');
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(true);
  });

  it('Should succeed when MINTER_ROLE re-issues a soulbound', async() => {
    const soulboundId = 0;
    await expect(
        soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(true);

    const tx = await soulbound.connect(admin).issue(accounts[0].address, soulboundId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Issued' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.owner).deep.equal( accounts[0].address );
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(false);
  });

  it('Should be able to check current linked account to a soulbound', async() => {
    const soulboundId = 0;
    const fromIdx = 0;
    const toIdx = 0;
    const list = [accounts[0].address];
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await soulbound.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await soulbound.linkedAccounts(soulboundId, fromIdx, toIdx)).deep.equal(list);
  });

  it('Should succeed when MINTER_ROLE revokes a soulbound again', async() => {
    const soulboundId = 0;
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[0].address);

    const tx = await soulbound.connect(admin).revoke(soulboundId);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Revoked' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.owner).deep.equal( accounts[0].address );
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should be able to check linked account to a revoked soulbound', async() => {
    const soulboundId = 0;
    const fromIdx = 0;
    const toIdx = 0;
    const list = [accounts[0].address];

    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(true);
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await soulbound.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await soulbound.linkedAccounts(soulboundId, fromIdx, toIdx)).deep.equal(list);
  });

  it('Should revert when Unauthorizer tries to change a soulbound from one account to another account', async() => {
    const soulboundId = 1;
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      soulbound.tokenOf(accounts[3].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      soulbound.connect(accounts[1]).change(soulboundId, accounts[1].address, accounts[3].address)
    ).to.be.revertedWith('Unauthorized');
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      soulbound.tokenOf(accounts[3].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when MINTER_ROLE tries to change a soulbound from one account to another account, but soulbound was revoked', async() => {
    const soulboundId = 0;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(true);
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      soulbound.connect(admin).change(soulboundId, accounts[0].address, accounts[2].address)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(true);
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when MINTER_ROLE tries to change a soulbound from 0x00 to another account, and soulbound was revoked', async() => {
    const soulboundId = 0;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(true);
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      soulbound.connect(admin).change(soulboundId, AddressZero, accounts[2].address)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(true);
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when MINTER_ROLE tries to change a soulbound from 0x00 to another account, but soulbound currently active', async() => {
    const soulboundId = 1;
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(false);
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      soulbound.connect(admin).change(soulboundId, AddressZero, accounts[2].address)
    ).to.be.revertedWith('SoulBound: soulbound not owned by owner');
    
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(false);
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when MINTER_ROLE tries to change a soulbound from one account to another account, but soulbound not exist', async() => {
    const soulboundId = 2;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      soulbound.connect(admin).change(soulboundId, accounts[0].address, accounts[2].address)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when MINTER_ROLE tries to change a soulbound from one account to another account, but soulbound not owned', async() => {
    const soulboundId = 1;
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      soulbound.connect(admin).change(soulboundId, accounts[0].address, accounts[2].address)
    ).to.be.revertedWith('SoulBound: soulbound not owned by owner');
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should succeed when MINTER_ROLE tries to change a soulbound from one account to another account', async() => {
    const soulboundId = 1;
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      soulbound.tokenOf(accounts[3].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    const tx = await soulbound.connect(admin).change(soulboundId, accounts[1].address, accounts[3].address);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Changed' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.from).deep.equal( accounts[1].address );
    expect(event?.args?.to).deep.equal( accounts[3].address );
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[3].address);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
  });

  it('Should be able to check linked account when soulbound has been changed', async() => {
    const soulboundId = 1;
    const fromIdx = 0;
    const toIdx = 1;
    const list = [accounts[1].address, accounts[3].address];

    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[3].address);
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(false);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await soulbound.linkedAccounts(soulboundId, fromIdx, toIdx)).deep.equal(list);
  });

  it('Should succeed when MINTER_ROLE tries to change a soulbound from one account to another account, and soulbound was revoked', async() => {
    const soulboundId = 0;
    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(true);
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await soulbound.connect(admin).issue(accounts[0].address, soulboundId);

    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(false);
    await expect(
      soulbound.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    const tx = await soulbound.connect(admin).change(soulboundId, accounts[0].address, accounts[2].address);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Changed' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.from).deep.equal( accounts[0].address );
    expect(event?.args?.to).deep.equal( accounts[2].address );
    
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(false);
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[2].address);
    expect(await soulbound.tokenOf(accounts[2].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
  });

  it('Should be able to check linked account when soulbound has been changed', async() => {
    const soulboundId = 0;
    const fromIdx = 0;
    const toIdx = 1;
    const list = [accounts[0].address, accounts[2].address];

    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[2].address);
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(false);
    expect(await soulbound.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[2].address)).deep.equal(soulboundId);
    expect(await soulbound.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await soulbound.linkedAccounts(soulboundId, fromIdx, toIdx)).deep.equal(list);
  });

  it('Should revert when MINTER_ROLE tries to change a soulbound from one account to another account, but soulbound previously owned by an account', async() => {
    const soulboundId = 1;
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[3].address);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);
    await expect(
      soulbound.tokenOf(accounts[5].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      soulbound.connect(admin).change(soulboundId, accounts[1].address, accounts[5].address)
    ).to.be.revertedWith('SoulBound: soulbound not owned by owner');
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[3].address);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);
    await expect(
      soulbound.tokenOf(accounts[5].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should succeed when MINTER_ROLE tries to change a soulbound from one account to another account - Back to last change', async() => {
    //  Note: `soulboundId = 1` has been changed from `account1` to `account3`
    //  Now, this scenario is to change from `account3` back to `account1`
    const soulboundId = 1;
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[3].address);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);

    const tx = await soulbound.connect(admin).change(soulboundId, accounts[3].address, accounts[1].address);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Changed' });

    expect(event != undefined).true;
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.from).deep.equal( accounts[3].address );
    expect(event?.args?.to).deep.equal( accounts[1].address );
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);
  });

  it('Should succeed to revoke, then change soulbound between two accounts by MINTER_ROLE', async() => {
    const soulboundId = 1;
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);

    await soulbound.connect(admin).revoke(soulboundId);

    await expect(
      soulbound.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);

    await soulbound.connect(admin).issue(accounts[1].address, soulboundId);

    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);
    await expect(
      soulbound.tokenOf(accounts[5].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await soulbound.connect(admin).change(soulboundId, accounts[1].address, accounts[5].address);
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[5].address);
    expect(await soulbound.tokenOf(accounts[5].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);
  });

  it('Should succeed to change soulbound between multiple accounts by MINTER_ROLE', async() => {
    const soulboundId = 1;
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[5].address);
    await expect(
      soulbound.tokenOf(accounts[7].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
    expect(await soulbound.tokenOf(accounts[5].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);

    await soulbound.connect(admin).change(soulboundId, accounts[5].address, accounts[1].address);
    
    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    await expect(
      soulbound.tokenOf(accounts[7].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
    expect(await soulbound.tokenOf(accounts[5].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);

    await soulbound.connect(admin).change(soulboundId, accounts[1].address, accounts[7].address);

    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[7].address);
    expect(await soulbound.tokenOf(accounts[7].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[5].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);

    await soulbound.connect(admin).change(soulboundId, accounts[7].address, accounts[3].address);

    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[3].address);
    expect(await soulbound.tokenOf(accounts[7].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[5].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);
  });

  it('Should be able to check linked account when soulbound has been changed', async() => {
    const soulboundId = 1;
    const fromIdx = 0;
    const toIdx = 3;
    const list = [
      accounts[1].address, accounts[3].address, accounts[5].address, accounts[7].address
    ];

    expect(await soulbound.ownerOf(soulboundId)).deep.equal(accounts[3].address);
    expect(await soulbound.isRevoked(soulboundId)).deep.equal(false);
    expect(await soulbound.tokenOf(accounts[7].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[5].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[3].address)).deep.equal(soulboundId);
    expect(await soulbound.tokenOf(accounts[1].address)).deep.equal(soulboundId);
    expect(await soulbound.numOfLinkedAccounts(soulboundId)).deep.equal(list.length);
    expect(await soulbound.linkedAccounts(soulboundId, fromIdx, toIdx)).deep.equal(list);
  });
});
