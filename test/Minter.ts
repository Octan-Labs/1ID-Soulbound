import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Bytes, utils, TypedDataDomain, Overrides, BytesLike, BigNumber } from "ethers";
import {
  Management, Management__factory,
  ReputationV2, ReputationV2__factory,
  Minter, Minter__factory,
  Token20, Token20__factory
} from "../typechain-types";
import { Address } from "hardhat-deploy/dist/types";

function keccak256(data : Bytes) {
  return utils.keccak256(data);
}

const MANAGER_ROLE = keccak256(utils.toUtf8Bytes("MANAGER_ROLE"));
const MINTER_ROLE = keccak256(utils.toUtf8Bytes("MINTER_ROLE"));
const AUTHORIZER_ROLE = keccak256(utils.toUtf8Bytes("AUTHORIZER_ROLE"));
const AddressZero = ethers.constants.AddressZero;
const Zero = ethers.constants.Zero;
const minutes = 60;
const provider = ethers.provider;

const issueType = {
  Issue: [
    { name: "option", type: "bytes32" },
    { name: "caller", type: "address" },
    { name: "soulboundId", type: "uint256" },
    { name: "nonce", type: "uint128" },
    { name: "expiry", type: "uint128" },
  ],
};

const revokeType = {
  Revoke: [
    { name: "option", type: "bytes32" },
    { name: "caller", type: "address" },
    { name: "soulboundId", type: "uint256" },
    { name: "nonce", type: "uint128" },
    { name: "expiry", type: "uint128" },
  ],
};

const changeType = {
  Change: [
    { name: "soulboundId", type: "uint256" },
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "nonce", type: "uint128" },
    { name: "expiry", type: "uint128" },
  ],
};

const ISSUE_OPCODE = keccak256(utils.toUtf8Bytes('ISSUE'));
const REVOKE_OPCODE = keccak256(utils.toUtf8Bytes('REVOKE'));

async function gen_issue_sig(
  signer: SignerWithAddress,
  caller: Address,
  soulboundId: BigNumber,
  nonce: BigNumber,
  expiry: BigNumber,
  domain: TypedDataDomain
): Promise<BytesLike> {
  const values = {
    option: ISSUE_OPCODE,
    caller: caller,
    soulboundId: soulboundId,
    nonce: nonce,
    expiry: expiry
  };
  return await signer._signTypedData(domain, issueType, values);
}

async function gen_revoke_sig(
  signer: SignerWithAddress,
  caller: Address,
  soulboundId: BigNumber,
  nonce: BigNumber,
  expiry: BigNumber,
  domain: TypedDataDomain
): Promise<BytesLike> {
  const values = {
    option: REVOKE_OPCODE,
    caller: caller,
    soulboundId: soulboundId,
    nonce: nonce,
    expiry: expiry
  };
  return await signer._signTypedData(domain, revokeType, values);
}

async function gen_change_sig(
  signer: SignerWithAddress,
  soulboundId: BigNumber,
  from: Address,
  to: Address,
  nonce: BigNumber,
  expiry: BigNumber,
  domain: TypedDataDomain
): Promise<BytesLike> {
  const values = {
    soulboundId: soulboundId,
    from: from,
    to: to,
    nonce: nonce,
    expiry: expiry
  };
  return await signer._signTypedData(domain, changeType, values);
}

describe("Minter Contract Testing", () => {
  let admin: SignerWithAddress, treasury: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let management: Management;
  let reputation: ReputationV2;
  let minter: Minter;
  let usdt: Token20;
  let domain: TypedDataDomain, invalidDomain1: TypedDataDomain, invalidDomain2: TypedDataDomain;

  const name = 'Octan Soulbound';
  const symbol = 'OST';
  const uri = 'https://octan.network/reputation/';

  before(async () => {
    [admin, treasury, ...accounts] = await ethers.getSigners();

    const Management = await ethers.getContractFactory('Management', admin) as Management__factory;
    management = await Management.deploy();

    const ReputationV2Factory = await ethers.getContractFactory('ReputationV2', admin) as ReputationV2__factory;
    reputation = await ReputationV2Factory.deploy(management.address, name, symbol, uri);

    const MinterFactory = await ethers.getContractFactory('Minter', admin) as Minter__factory;
    minter = await MinterFactory.deploy(management.address, reputation.address);

    const Token20Factory = await ethers.getContractFactory('Token20', admin) as Token20__factory;
    usdt = await Token20Factory.deploy();

    const chainId  = (await provider.getNetwork()).chainId;
    domain = {
      name: "Reputation Minter",
      version: "Version 1",
      chainId: chainId,
      verifyingContract: minter.address,
    };
    invalidDomain1 = {
      name: "Reputation Minter",
      version: "Version 1",
      chainId: 100,       //  wrong chainId
      verifyingContract: minter.address,
    };
    invalidDomain2 = {
      name: "Reputation Minter",
      version: "Version 1",
      chainId: chainId,
      verifyingContract: usdt.address,    //  wrong Minter Contract address
    };

    //  set Treasury address
    await management.connect(admin).setTreasury(treasury.address);

    //  grant MANAGER_ROLE and OPERATOR_ROLE to `admin`
    await management.connect(admin).grantRole(MANAGER_ROLE, admin.address);
    await management.connect(admin).grantRole(AUTHORIZER_ROLE, admin.address);

    //  grant MINTER_ROLE to Minter contract
    await management.connect(admin).grantRole(MINTER_ROLE, minter.address);
  });

  it('Should be able to check the initialized infor of Minter contract', async() => {
    expect(await minter.reputation()).deep.equal(reputation.address);
    expect(await minter.management()).deep.equal(management.address);
    expect(await minter.paymentToken()).deep.equal(AddressZero);
    expect(await minter.fee()).deep.equal(Zero);
  });

  it('Should revert when Unauthorizer tries to set payment', async() => {
    const amount = 100;
    expect(await minter.paymentToken()).deep.equal(AddressZero);
    expect(await minter.fee()).deep.equal(Zero);

    await expect(
      minter.connect(accounts[0]).setPayment(usdt.address, amount)
    ).to.be.revertedWith('Unauthorized');

    expect(await minter.paymentToken()).deep.equal(AddressZero);
    expect(await minter.fee()).deep.equal(Zero);
  });

  it('Should succeed when MANAGER_ROLE set payment and payment token = 0x00', async() => {
    //  Note: if payment token = 0x00, Native coin is accepted
    const amount = 100;
    expect(await minter.paymentToken()).deep.equal(AddressZero);
    expect(await minter.fee()).deep.equal(Zero);

    await minter.connect(admin).setPayment(AddressZero, amount)

    expect(await minter.paymentToken()).deep.equal(AddressZero);
    expect(await minter.fee()).deep.equal(amount);
  });

  it('Should succeed when MANAGER_ROLE set ERC-20 as payment acceptance', async() => {
    const amount = 100;
    expect(await minter.paymentToken()).deep.equal(AddressZero);
    expect(await minter.fee()).deep.equal(amount);

    await minter.connect(admin).setPayment(usdt.address, amount)

    expect(await minter.paymentToken()).deep.equal(usdt.address);
    expect(await minter.fee()).deep.equal(amount);
  });

  it('Should succeed when MANAGER_ROLE change fee', async() => {
    const currentFee = 100;
    expect(await minter.paymentToken()).deep.equal(usdt.address);
    expect(await minter.fee()).deep.equal(currentFee);

    await minter.connect(admin).setPayment(usdt.address, Zero)

    expect(await minter.paymentToken()).deep.equal(usdt.address);
    expect(await minter.fee()).deep.equal(Zero);
  });

  it('Should revert when User tries to issue a soulbound but authorized signature is empty', async() => {
    const soulboundId = 0;
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const emptySig = ethers.utils.arrayify(0);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(soulboundId, expiry, emptySig)
    ).to.be.revertedWith('ECDSA: invalid signature length');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to issue a soulbound but signature is signed by Unauthorizer', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(accounts[0], accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to issue a soulbound but invalid domain - Wrong ChainId', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), invalidDomain1);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to issue a soulbound but invalid domain - wrong Minter Contract Address', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), invalidDomain2);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to issue a soulbound but signature is expired', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp - 1 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(soulboundId, expiry, signature)
    ).to.be.revertedWith('Signature is expired');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to issue a soulbound but invalid signature caused by params mismatch - SoulboundId', async() => {
    const soulboundId = BigNumber.from('0');
    const signedSoulboundId = BigNumber.from('1');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, signedSoulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.ownerOf(signedSoulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.ownerOf(signedSoulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to issue a soulbound but invalid signature caused by params mismatch - Expiry', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const signedExpiry = (await provider.getBlock(block)).timestamp + 5 * minutes;
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(signedExpiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to issue a soulbound but invalid signature caused by params mismatch - Caller', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[1].address); 
    const signature = await gen_issue_sig(admin, accounts[1].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
    await expect(
      reputation.tokenOf(accounts[1].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
    await expect(
      reputation.tokenOf(accounts[1].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to issue a soulbound but invalid signature caused by params mismatch - Nonce', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, BigNumber.from('1'), BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to issue a soulbound but invalid signature caused by params mismatch - Invalid Option', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_revoke_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to issue a soulbound but invalid payment - Amount = 0', async() => {
    //  temporarily set accepted payment token = 0x00 and fee = 100
    const amount = 100;
    await minter.connect(admin).setPayment(AddressZero, amount)
    expect(await minter.paymentToken()).deep.equal(AddressZero);
    expect(await minter.fee()).deep.equal(amount);

    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    const optional = {value: ethers.utils.parseUnits('0', 'wei')} as Overrides;
    await expect(
      minter.connect(accounts[0]).issue(
        soulboundId, expiry, signature, optional
      )
    ).to.be.revertedWith('Invalid payment');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    // set back to normal
    await minter.connect(admin).setPayment(usdt.address, Zero)
    expect(await minter.paymentToken()).deep.equal(usdt.address);
    expect(await minter.fee()).deep.equal(Zero);
  });

  it('Should revert when User tries to issue a soulbound but invalid payment - Less than requiring fee', async() => {
    //  temporarily set accepted payment token = 0x00 and fee = 100
    const amount = 100;
    await minter.connect(admin).setPayment(AddressZero, amount)
    expect(await minter.paymentToken()).deep.equal(AddressZero);
    expect(await minter.fee()).deep.equal(amount);

    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    const optional = {value: ethers.utils.parseUnits('99', 'wei')} as Overrides;
    await expect(
      minter.connect(accounts[0]).issue(
        soulboundId, expiry, signature, optional
      )
    ).to.be.revertedWith('Invalid payment');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    // set back to normal
    await minter.connect(admin).setPayment(usdt.address, Zero)
    expect(await minter.paymentToken()).deep.equal(usdt.address);
    expect(await minter.fee()).deep.equal(Zero);
  });

  it('Should revert when User tries to issue a soulbound but invalid payment - Greater than requiring fee', async() => {
    //  temporarily set accepted payment token = 0x00 and fee = 100
    const amount = 100;
    await minter.connect(admin).setPayment(AddressZero, amount)
    expect(await minter.paymentToken()).deep.equal(AddressZero);
    expect(await minter.fee()).deep.equal(amount);

    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    const optional = {value: ethers.utils.parseUnits('101', 'wei')} as Overrides;
    await expect(
      minter.connect(accounts[0]).issue(
        soulboundId, expiry, signature, optional
      )
    ).to.be.revertedWith('Invalid payment');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    // set back to normal
    await minter.connect(admin).setPayment(usdt.address, Zero)
    expect(await minter.paymentToken()).deep.equal(usdt.address);
    expect(await minter.fee()).deep.equal(Zero);
  });

  it('Should revert when User tries to issue a soulbound but not set allowance', async() => {
    //  temporarily set accepted payment token = USDT and fee = 100
    const amount = 100;
    await minter.connect(admin).setPayment(usdt.address, amount)
    expect(await minter.paymentToken()).deep.equal(usdt.address);
    expect(await minter.fee()).deep.equal(amount);

    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(
        soulboundId, expiry, signature
      )
    ).to.be.revertedWith('ERC20: insufficient allowance');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    // set back to normal
    await minter.connect(admin).setPayment(usdt.address, Zero)
    expect(await minter.paymentToken()).deep.equal(usdt.address);
    expect(await minter.fee()).deep.equal(Zero);
  });

  it('Should revert when User tries to issue a soulbound but insufficient balance', async() => {
    //  temporarily set accepted payment token = USDT and fee = 100
    const amount = 100;
    await minter.connect(admin).setPayment(usdt.address, amount)
    expect(await minter.paymentToken()).deep.equal(usdt.address);
    expect(await minter.fee()).deep.equal(amount);

    await usdt.connect(accounts[0]).approve(minter.address, 1000000000000);

    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).issue(
        soulboundId, expiry, signature
      )
    ).to.be.revertedWith('ERC20: transfer amount exceeds balance');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    // set back to normal
    await minter.connect(admin).setPayment(usdt.address, Zero)
    expect(await minter.paymentToken()).deep.equal(usdt.address);
    expect(await minter.fee()).deep.equal(Zero);
  });

  it('Should succeed when User issues a soulbound', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await minter.connect(accounts[0]).issue(soulboundId, expiry, signature)

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
  });

  it('Should revert when User issues a soulbound, but account already linked to a soulbound', async() => {
    const soulboundId = BigNumber.from('1');
    const currentSoulbound = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(currentSoulbound);
    
    await expect(
      minter.connect(accounts[0]).issue(soulboundId, expiry, signature)
    ).to.be.revertedWith('SoulBound: account already assigned a soulbound');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(currentSoulbound);
  });

  it('Should revert when User issues a soulbound, but soulboundId already linked to an account', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[1].address); 
    const signature = await gen_issue_sig(admin, accounts[1].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[1].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
    
    await expect(
      minter.connect(accounts[1]).issue(soulboundId, expiry, signature)
    ).to.be.revertedWith('SoulBound: token already minted');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[1].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to revoke a soulbound but signature is signed by Unauthorizer', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_revoke_sig(accounts[0], accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    await expect(
      minter.connect(accounts[0]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
  });

  it('Should revert when User tries to revoke a soulbound but invalid domain - Wrong ChainId', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_revoke_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), invalidDomain1);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    await expect(
      minter.connect(accounts[0]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
  });

  it('Should revert when User tries to revoke a soulbound but invalid domain - Minter Contract Address', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_revoke_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), invalidDomain2);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    await expect(
      minter.connect(accounts[0]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
  });

  it('Should revert when User tries to revoke a soulbound but signature is expired', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp - 1 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_revoke_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    await expect(
      minter.connect(accounts[0]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('Signature is expired');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
  });

  it('Should revert when User tries to revoke a soulbound but invalid signature caused by params mismatch - SoulboundId', async() => {
    const soulboundId = BigNumber.from('0');
    const signedSoulboundId = BigNumber.from('1');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_revoke_sig(admin, accounts[0].address, signedSoulboundId, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    await expect(
      reputation.ownerOf(signedSoulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      minter.connect(accounts[0]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    await expect(
      reputation.ownerOf(signedSoulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should revert when User tries to revoke a soulbound but invalid signature caused by params mismatch - Expiry', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const signedExpiry = (await provider.getBlock(block)).timestamp + 5 * minutes;
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_revoke_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(signedExpiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    await expect(
      minter.connect(accounts[0]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
  });

  it('Should revert when User tries to revoke a soulbound but invalid signature caused by params mismatch - Caller', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[1].address); 
    const signature = await gen_revoke_sig(admin, accounts[1].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    await expect(
      reputation.tokenOf(accounts[1].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    await expect(
      reputation.tokenOf(accounts[1].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to revoke a soulbound but invalid signature caused by params mismatch - Nonce', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const signature = await gen_revoke_sig(admin, accounts[0].address, soulboundId, BigNumber.from('2'), BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    await expect(
      minter.connect(accounts[0]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
  });

  it('Should revert when User tries to revoke a soulbound but invalid signature caused by params mismatch - Invalid Option', async() => {
    const soulboundId =BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    await expect(
      minter.connect(accounts[0]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
  });

  it('Should revert when User tries to revoke a soulbound but soulbound not exist', async() => {
    const soulboundId = BigNumber.from('2');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_revoke_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      minter.connect(accounts[0]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should revert when User tries to revoke a soulbound but soulbound not owned', async() => {
    const soulboundId =BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[1].address); 
    const signature = await gen_revoke_sig(admin, accounts[1].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    await expect(
      minter.connect(accounts[1]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('Soulbound not owned');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
  });

  it('Should succeed when User revokes a soulbound', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_revoke_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    await minter.connect(accounts[0]).revoke(soulboundId, expiry, signature);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);
  });

  it('Should revert when User tries to revoke a soulbound but already revoked', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_revoke_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);

    await expect(
      minter.connect(accounts[0]).revoke(soulboundId, expiry, signature)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);
  });

  it('Should succeed when User re-issues a soulbound', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_issue_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);

    await minter.connect(accounts[0]).issue(soulboundId, expiry, signature)

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
  });

  it('Should revert when User tries to change a soulbound between two accounts but signature is signed by Unauthorizer', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_change_sig(accounts[0], soulboundId, accounts[0].address, accounts[2].address, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to change a soulbound between two accounts but invalid domain - Wrong ChainId', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_change_sig(admin, soulboundId, accounts[0].address, accounts[2].address, nonce, BigNumber.from(expiry), invalidDomain1);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to change a soulbound between two accounts but invalid domain - Minter Contract Address', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_change_sig(admin, soulboundId, accounts[0].address, accounts[2].address, nonce, BigNumber.from(expiry), invalidDomain2);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to change a soulbound between two accounts but signature is expired', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp - 1 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_change_sig(admin, soulboundId, accounts[0].address, accounts[2].address, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('Signature is expired');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to change a soulbound between two accounts but invalid signature caused by params mismatch - SoulboundId', async() => {
    const soulboundId = BigNumber.from('0');
    const signedSoulboundId = BigNumber.from('1');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_change_sig(admin, signedSoulboundId, accounts[0].address, accounts[2].address, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to change a soulbound between two accounts but invalid signature caused by params mismatch - Expiry', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const signedExpiry = (await provider.getBlock(block)).timestamp + 5 * minutes;
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_change_sig(admin, soulboundId, accounts[0].address, accounts[2].address, nonce, BigNumber.from(signedExpiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to change a soulbound between two accounts but invalid signature caused by params mismatch - Caller', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[1].address); 
    const signature = await gen_change_sig(admin, soulboundId, accounts[1].address, accounts[2].address, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to change a soulbound between two accounts but invalid signature caused by params mismatch - Nonce', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const signature = await gen_change_sig(admin, soulboundId, accounts[0].address, accounts[2].address, BigNumber.from(100), BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to change a soulbound between two accounts but invalid signature caused by params mismatch - Wrong Destination Address', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_change_sig(admin, soulboundId, accounts[0].address, accounts[1].address, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should revert when User tries to change a soulbound between two accounts but soulbound not owned', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[1].address); 
    const signature = await gen_change_sig(admin, soulboundId, accounts[1].address, accounts[2].address, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      minter.connect(accounts[1]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('Soulbound not owned');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');
  });

  it('Should succeed when User tries to change a soulbound between two accounts', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_change_sig(admin, soulboundId, accounts[0].address, accounts[2].address, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    await expect(
      reputation.tokenOf(accounts[2].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[2].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.tokenOf(accounts[2].address)).deep.equal(soulboundId);
  });

  it('Should revert when User tries to change a soulbound between two accounts but soulbound linked to another account', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_change_sig(admin, soulboundId, accounts[0].address, accounts[2].address, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[2].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.tokenOf(accounts[2].address)).deep.equal(soulboundId);

    await expect(
      minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('Soulbound not owned');

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[2].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.tokenOf(accounts[2].address)).deep.equal(soulboundId);
  });

  it('Should succeed when User tries to change a soulbound between two accounts', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[2].address); 
    const signature = await gen_change_sig(admin, soulboundId, accounts[2].address, accounts[0].address, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[2].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.tokenOf(accounts[2].address)).deep.equal(soulboundId);

    await minter.connect(accounts[2]).change(soulboundId, accounts[0].address, expiry, signature);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.tokenOf(accounts[2].address)).deep.equal(soulboundId);
  });

  it('Should succeed when User revokes a soulbound', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_revoke_sig(admin, accounts[0].address, soulboundId, nonce, BigNumber.from(expiry), domain);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.isRevoked(soulboundId)).deep.equal(false);

    await minter.connect(accounts[0]).revoke(soulboundId, expiry, signature);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);
  });

  it('Should revert when User tries to change a soulbound between two accounts but soulbound was revoked', async() => {
    const soulboundId = BigNumber.from('0');
    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await minter.nonces(accounts[0].address); 
    const signature = await gen_change_sig(admin, soulboundId, accounts[0].address, accounts[2].address, nonce, BigNumber.from(expiry), domain);

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.tokenOf(accounts[2].address)).deep.equal(soulboundId);

    await expect(
      minter.connect(accounts[0]).change(soulboundId, accounts[2].address, expiry, signature)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.tokenOf(accounts[2].address)).deep.equal(soulboundId);
  });

});