import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Bytes, utils, TypedDataDomain, Overrides, BytesLike } from "ethers";
import {
  Management, Management__factory,
  ReputationV2, ReputationV2__factory,
  Updater, Updater__factory,
  Token20, Token20__factory
} from "../typechain-types";
import { Address } from "hardhat-deploy/dist/types";

function keccak256(data : Bytes) : string {
  return utils.keccak256(data);
}

const AUTHORIZER_ROLE = keccak256(utils.toUtf8Bytes("AUTHORIZER_ROLE"));
const MANAGER_ROLE = keccak256(utils.toUtf8Bytes("MANAGER_ROLE"));
const MINTER_ROLE = keccak256(utils.toUtf8Bytes("MINTER_ROLE"));
const OPERATOR_ROLE = keccak256(utils.toUtf8Bytes("OPERATOR_ROLE"));
const AddressZero = ethers.constants.AddressZero;
const Zero = ethers.constants.Zero;
const provider = ethers.provider;
const emptySig = ethers.utils.arrayify(0);
const GENERAL_REPUTATION_SCORE = BigNumber.from('1');
const minutes = 60;
const emptyLatestScore = [
  BigNumber.from(0), BigNumber.from(0)
]

interface Data {
  soulbound: Address;
  soulboundId: BigNumber;
  paymentToken: Address,
  fee: BigNumber;
  expiry: BigNumber;
  attributeIds: BigNumber[];
  scores: BigNumber[];
  signature: BytesLike;
}

const typeUpdateRS = {
  UpdateRS: [
    { name: "caller", type: "address" },
    { name: "soulbound", type: "address" },
    { name: "soulboundId", type: "uint256" },
    { name: "paymentToken", type: "address" },
    { name: "fee", type: "uint256" },
    { name: "data", type: "bytes32" },
    { name: "nonce", type: "uint128" },
    { name: "expiry", type: "uint128" },
  ],
};

async function gen_updateRS_sig(
  signer: SignerWithAddress,
  caller: Address,
  soulbound: Address,
  soulboundId: BigNumber,
  paymentToken: Address,
  fee: BigNumber,
  attributeIds: BigNumber[],
  scores: BigNumber[],
  nonce: BigNumber,
  expiry: BigNumber,
  domain: TypedDataDomain,
): Promise<Data> {
  const data : string = gen_data_hash(attributeIds, scores);
  const values = {
    "caller": caller,
    "soulbound": soulbound,
    "soulboundId": soulboundId,
    "paymentToken": paymentToken,
    "fee": fee,
    "data": data,
    "nonce": nonce,
    "expiry": expiry,
  }
  const signature = await signer._signTypedData(domain, typeUpdateRS, values);
  return {
    soulbound: soulbound,
    soulboundId: soulboundId,
    paymentToken: paymentToken,
    fee: fee,
    expiry: expiry,
    attributeIds: attributeIds,
    scores: scores,
    signature: signature,
  }
}

function gen_data_hash(attributeIds : BigNumber[], scores : BigNumber[]) : string {
  return ethers.utils.solidityKeccak256(['uint256[]', 'uint256[]'], [attributeIds, scores]);
}

describe("Updater Contract Testing", () => {
  let admin: SignerWithAddress, treasury: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let management: Management, newManagement: Management;
  let reputation: ReputationV2;
  let updater: Updater;
  let usdt: Token20;
  let domain: TypedDataDomain, invalidDomain1: TypedDataDomain, invalidDomain2: TypedDataDomain;

  const name = 'Octan Soulbound';
  const symbol = 'OST';
  const uri = 'https://octan.network/reputation/';

  before(async () => {
    [admin, treasury, ...accounts] = await ethers.getSigners();

    const Management = await ethers.getContractFactory('Management', admin) as Management__factory;
    management = await Management.deploy();
    newManagement = await Management.deploy();

    const ReputationV2Factory = await ethers.getContractFactory('ReputationV2', admin) as ReputationV2__factory;
    reputation = await ReputationV2Factory.deploy(management.address, name, symbol, uri);

    const UpdaterFactory = await ethers.getContractFactory('Updater', admin) as Updater__factory;
    updater = await UpdaterFactory.deploy(management.address);

    const Token20Factory = await ethers.getContractFactory('Token20', admin) as Token20__factory;
    usdt = await Token20Factory.deploy();

    const chainId  = (await provider.getNetwork()).chainId;
    domain = {
      name: "Reputation Updater",
      version: "Version 1",
      chainId: chainId,
      verifyingContract: updater.address,
    };
    invalidDomain1 = {
      name: "Reputation Updater",
      version: "Version 1",
      chainId: 100,       //  wrong chainId
      verifyingContract: updater.address,
    };
    invalidDomain2 = {
      name: "Reputation Updater",
      version: "Version 1",
      chainId: chainId,
      verifyingContract: usdt.address,    //  wrong Minter Contract address
    };

    //  set Treasury address
    await management.connect(admin).setTreasury(treasury.address);

    //  grant MANAGER_ROLE and OPERATOR_ROLE to `admin`
    await management.connect(admin).grantRole(MANAGER_ROLE, admin.address);
    await management.connect(admin).grantRole(AUTHORIZER_ROLE, admin.address);
    await newManagement.connect(admin).grantRole(MANAGER_ROLE, admin.address);

    //  grant MINTER_ROLE to admin
    await management.connect(admin).grantRole(MINTER_ROLE, admin.address);

    //  grant OPERATOR_ROLE to Updater contract
    await management.connect(admin).grantRole(OPERATOR_ROLE, updater.address);
  });

  it('Should be able to check the initialized infor of Updater contract', async() => {
    expect(await updater.management()).deep.equal(management.address);
  });

  it('Should revert when Unauthorizer tries to set Management contract', async() => {
    expect(await updater.management()).deep.equal(management.address);

    await expect(
      updater.connect(accounts[0]).setManagement(newManagement.address)
    ).to.be.revertedWith('Unauthorized');

    expect(await updater.management()).deep.equal(management.address); 
  });

  it('Should revert when MANAGER_ROLE tries to set 0x00 as Management contract', async() => {
    expect(await updater.management()).deep.equal(management.address);

    await expect(
      updater.connect(admin).setManagement(AddressZero)
    ).to.be.revertedWith('Must be a contract');

    expect(await updater.management()).deep.equal(management.address); 
  });

  it('Should revert when MANAGER_ROLE tries to set EOA as Management contract', async() => {
    expect(await updater.management()).deep.equal(management.address);

    await expect(
      updater.connect(admin).setManagement(admin.address)
    ).to.be.revertedWith('Must be a contract');

    expect(await updater.management()).deep.equal(management.address); 
  });

  it('Should succeed when MANAGER_ROLE set new Management contract', async() => {
    expect(await updater.management()).deep.equal(management.address);

    await updater.connect(admin).setManagement(newManagement.address);

    expect(await updater.management()).deep.equal(newManagement.address); 

    //  set back to normal
    await updater.connect(admin).setManagement(management.address);
    expect(await updater.management()).deep.equal(management.address); 
  });

  it('Should revert when Caller tries to request updating RS, but length is mismatched', async() => {
    //  2 Attributes, but 1 Score
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE, BigNumber.from('2')];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, AddressZero, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('Length mismatch');
  });

  it('Should revert when Caller tries to request updating RS, but length is mismatched', async() => {
    //  1 Attribute, but 2 Scores
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100'), BigNumber.from('200')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const optional = {value: ethers.utils.parseUnits(fee.toString(), 'wei')} as Overrides;
    await expect(
      updater.connect(accounts[0]).update(params, optional)
    ).to.be.revertedWith('Length mismatch');
  });

  it('Should revert when Caller tries to request updating RS, but signature is expired', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE, BigNumber.from('2')];
    const scores = [BigNumber.from('100'), BigNumber.from('200')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp - 1;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('Signature is expired');
  });

  it('Should revert when Caller tries to request updating RS, but soulbound not yet issued', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE, BigNumber.from('2')];
    const scores = [BigNumber.from('100'), BigNumber.from('200')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    await expect(
      reputation.tokenOf(accounts[0].address)
    ).to.be.revertedWith('SoulBound: account not yet assigned a soulbound');

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should revert when Caller tries to request updating RS, but soulbound not owned', async() => {
    const soulboundId = BigNumber.from('0');
    await reputation.connect(admin).issue(accounts[0].address, soulboundId);

    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[1].address);

    const params = await gen_updateRS_sig(
      admin, accounts[1].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    await expect(
      updater.connect(accounts[1]).update(params)
    ).to.be.revertedWith('Soulbound not owned');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
  });

  it('Should revert when Caller tries to request updating RS, but soulbound is revoked', async() => {
    const soulboundId = BigNumber.from('0');
    await reputation.connect(admin).revoke(soulboundId);

    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    await expect(
      reputation.ownerOf(soulboundId)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
    expect(await reputation.isRevoked(soulboundId)).deep.equal(true);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('SoulBound: invalid soulbound ID');
  });

  it('Should revert when Caller tries to request updating RS, but payment fee is invalid - Zero payment - Native Coin', async() => {
    const soulboundId = BigNumber.from('0');
    await reputation.connect(admin).issue(accounts[0].address, soulboundId);

    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, AddressZero, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    const optional = {value: ethers.utils.parseUnits('0', 'wei')} as Overrides;
    await expect(
      updater.connect(accounts[0]).update(params, optional)
    ).to.be.revertedWith('Invalid payment fee');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
  });

  it('Should revert when Caller tries to request updating RS, but payment fee is invalid - Less than fee - Native Coin', async() => {
    const soulboundId = BigNumber.from('0');

    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, AddressZero, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    const optional = {value: ethers.utils.parseUnits(fee.sub(1).toString(), 'wei')} as Overrides;
    await expect(
      updater.connect(accounts[0]).update(params, optional)
    ).to.be.revertedWith('Invalid payment fee');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
  });

  it('Should revert when Caller tries to request updating RS, but payment fee is invalid - Greater than fee - Native Coin', async() => {
    const soulboundId = BigNumber.from('0');

    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, AddressZero, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    const optional = {value: ethers.utils.parseUnits(fee.add(1).toString(), 'wei')} as Overrides;
    await expect(
      updater.connect(accounts[0]).update(params, optional)
    ).to.be.revertedWith('Invalid payment fee');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
  });

  it('Should revert when Caller tries to request updating RS, but not yet set allowance', async() => {
    const soulboundId = BigNumber.from('0');

    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('ERC20: insufficient allowance');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
  });

  it('Should revert when Caller tries to request updating RS, but insufficient balance - Zero balance - ERC20', async() => {
    await usdt.connect(accounts[0]).approve(updater.address, '10000000');

    const soulboundId = BigNumber.from('0');

    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );
    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(balance).deep.equal(Zero);

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('ERC20: transfer amount exceeds balance');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but insufficient balance - ERC20', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    await usdt.connect(admin).mint(accounts[0].address, fee.sub(1));
    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('ERC20: transfer amount exceeds balance');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but empty signature', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    const params = {
      soulbound: reputation.address,
      soulboundId: soulboundId,
      paymentToken: usdt.address,
      fee: fee,
      expiry: expiry,
      attributeIds: attributeIds,
      scores: scores,
      signature: emptySig,
    }

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('ECDSA: invalid signature length');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but signature is signed by Unauthorizer', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      accounts[0], accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but invalid authorized signature - Caller not matched', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[1].address);

    const params = await gen_updateRS_sig(
      admin, accounts[1].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance1 = await usdt.balanceOf(accounts[0].address);
    const balance2 = await usdt.balanceOf(accounts[1].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance1);
    expect(await usdt.balanceOf(accounts[1].address)).deep.equal(balance2);
  });

  it('Should revert when Caller tries to request updating RS, but invalid authorized signature - SoulboundId not match', async() => {
    const soulboundId1 = BigNumber.from('0');
    const soulboundId2 = BigNumber.from('1');
    await reputation.connect(admin).issue(accounts[1].address, soulboundId2)
    
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[1].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId2, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance1 = await usdt.balanceOf(accounts[0].address);
    const balance2 = await usdt.balanceOf(accounts[1].address);

    expect(await reputation.ownerOf(soulboundId1)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId1);
    expect(await reputation.ownerOf(soulboundId2)).deep.equal(accounts[1].address);
    expect(await reputation.tokenOf(accounts[1].address)).deep.equal(soulboundId2);
    expect(await reputation.latestAnswer(soulboundId1, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await reputation.latestAnswer(soulboundId2, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    let invalidParams = params;
    invalidParams.soulboundId = soulboundId1;

    await expect(
      updater.connect(accounts[0]).update(invalidParams)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId1, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await reputation.latestAnswer(soulboundId2, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance1);
    expect(await usdt.balanceOf(accounts[1].address)).deep.equal(balance2);
  });

  it('Should revert when Caller tries to request updating RS, but invalid authorized signature - Payment Token not matched', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, AddressZero, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    let invalidParams = params;
    invalidParams.paymentToken = usdt.address;

    await expect(
      updater.connect(accounts[0]).update(invalidParams)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but invalid authorized signature - Payment Fee not matched', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    let invalidParams = params;
    invalidParams.fee = fee.sub(1);

    await expect(
      updater.connect(accounts[0]).update(invalidParams)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but invalid authorized signature - Nonce not matched', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce.add(1), BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but invalid authorized signature - Expiry not matched', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    let invalidParams = params;
    invalidParams.expiry = BigNumber.from(expiry + 1);

    await expect(
      updater.connect(accounts[0]).update(invalidParams)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but invalid authorized signature - AttributeId not matched', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const invalidAttributeIds = [BigNumber.from('2')];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    let invalidParams = params;
    invalidParams.attributeIds = invalidAttributeIds;

    await expect(
      updater.connect(accounts[0]).update(invalidParams)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but invalid authorized signature - Score not matched', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];
    const invalidScores = [BigNumber.from('10000')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    let invalidParams = params;
    invalidParams.scores = invalidScores;

    await expect(
      updater.connect(accounts[0]).update(invalidParams)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but invalid domain - Invalid ChainId', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), invalidDomain1
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but invalid domain - Invalid Updater contract', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), invalidDomain2
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('Unauthorized');

    expect(await reputation.latestAnswer(soulboundId, GENERAL_REPUTATION_SCORE)).deep.equal(emptyLatestScore);
    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but invalid authorized signature - Hash data not matched', async() => {
    //  Register `attributeId = 2`
    const attributeId = 2;
    await reputation.connect(admin).setAttribute(attributeId, false);

    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];
    const invalidAttributeIds = [GENERAL_REPUTATION_SCORE, BigNumber.from('2')];
    const invalidScores = [BigNumber.from('10000'), BigNumber.from('20000')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    Promise.all(invalidAttributeIds.map(async(attributeId) => {
      expect(await reputation.latestAnswer(soulboundId, attributeId)).deep.equal(emptyLatestScore);
    }));

    let invalidParams = params;
    invalidParams.attributeIds = invalidAttributeIds;
    invalidParams.scores = invalidScores;

    await expect(
      updater.connect(accounts[0]).update(invalidParams)
    ).to.be.revertedWith('Unauthorized');

    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
    Promise.all(invalidAttributeIds.map(async(attributeId) => {
      expect(await reputation.latestAnswer(soulboundId, attributeId)).deep.equal(emptyLatestScore);
    }));
  });

  it('Should revert when Caller tries to request updating RS, but attribute not supported', async() => {
    await usdt.connect(admin).mint(accounts[0].address, '1000000000000');

    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [BigNumber.from('3')];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.isValidAttribute(attributeIds[0])).deep.equal(false);

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('Attribute not supported');

    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
  });

  it('Should revert when Caller tries to request updating RS, but one of attributes not supported', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE, BigNumber.from('3')];
    const scores = [BigNumber.from('100'), BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.isValidAttribute(attributeIds[1])).deep.equal(false);
    expect(await reputation.latestAnswer(soulboundId, attributeIds[0])).deep.equal(emptyLatestScore);
    await expect(
      reputation.latestAnswer(soulboundId, attributeIds[1])
    ).to.be.revertedWith('Attribute not exist in this soulbound');

    await expect(
      updater.connect(accounts[0]).update(params)
    ).to.be.revertedWith('Attribute not supported');

    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance);
    expect(await reputation.latestAnswer(soulboundId, attributeIds[0])).deep.equal(emptyLatestScore);
    await expect(
      reputation.latestAnswer(soulboundId, attributeIds[1])
    ).to.be.revertedWith('Attribute not exist in this soulbound');
  });

  it('Should succeed when Caller requests to update RS - Single RS', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('1000');
    const attributeIds = [GENERAL_REPUTATION_SCORE];
    const scores = [BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);
    const treasuryBal = await usdt.balanceOf(treasury.address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);
    expect(await reputation.latestAnswer(soulboundId, attributeIds[0])).deep.equal(emptyLatestScore);

    //  Request to update default RS
    const tx = await updater.connect(accounts[0]).update(params);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Updated' });

    expect(event != undefined).true;
    expect(event?.args?.sender).deep.equal( accounts[0].address );
    expect(event?.args?.soulbound).deep.equal( reputation.address );
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.nonce).deep.equal( nonce );
    expect(event?.args?.paymentToken).deep.equal( usdt.address );
    expect(event?.args?.fee).deep.equal( fee );

    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance.sub(fee));
    expect(await usdt.balanceOf(treasury.address)).deep.equal(treasuryBal.add(fee));
    expect( (await reputation.latestAnswer(soulboundId, attributeIds[0])).score ).deep.equal(scores[0]);
  });

  it('Should succeed when Caller requests to update RS - Batch RS', async() => {
    const soulboundId = BigNumber.from('0');
    const fee = BigNumber.from('2000');
    const attributeIds = [GENERAL_REPUTATION_SCORE, BigNumber.from('2')];
    const scores = [BigNumber.from('300'), BigNumber.from('100')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[0].address);

    const params = await gen_updateRS_sig(
      admin, accounts[0].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[0].address);
    const treasuryBal = await usdt.balanceOf(treasury.address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[0].address);
    expect(await reputation.tokenOf(accounts[0].address)).deep.equal(soulboundId);

    //  Request to:
    //  - Update Default RS (Default RS was updated before)
    //  - Add new `attribute` into soulbound and update RS
    const tx = await updater.connect(accounts[0]).update(params);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Updated' });

    expect(event != undefined).true;
    expect(event?.args?.sender).deep.equal( accounts[0].address );
    expect(event?.args?.soulbound).deep.equal( reputation.address );
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.nonce).deep.equal( nonce );
    expect(event?.args?.paymentToken).deep.equal( usdt.address );
    expect(event?.args?.fee).deep.equal( fee );

    expect(await usdt.balanceOf(accounts[0].address)).deep.equal(balance.sub(fee));
    expect(await usdt.balanceOf(treasury.address)).deep.equal(treasuryBal.add(fee));
    Promise.all(attributeIds.map(async(attributeId, idx) => {
      expect( (await reputation.latestAnswer(soulboundId, attributeId)).score ).deep.equal(scores[idx]);
    }));
  });

  it('Should succeed when Caller requests to update RS - Batch RS', async() => {
    await usdt.connect(admin).mint(accounts[1].address, '1000000000000');
    await usdt.connect(accounts[1]).approve(updater.address, '1000000000000');

    const soulboundId = BigNumber.from('1');
    const fee = BigNumber.from('2000');
    const attributeIds = [GENERAL_REPUTATION_SCORE, BigNumber.from('2')];
    const scores = [BigNumber.from('500'), BigNumber.from('200')];

    const block = await provider.getBlockNumber();
    const expiry = (await provider.getBlock(block)).timestamp + 15 * minutes;
    const nonce = await updater.nonces(accounts[1].address);

    const params = await gen_updateRS_sig(
      admin, accounts[1].address, reputation.address, soulboundId, usdt.address, 
      fee, attributeIds, scores, nonce, BigNumber.from(expiry), domain
    );

    const balance = await usdt.balanceOf(accounts[1].address);
    const treasuryBal = await usdt.balanceOf(treasury.address);

    expect(await reputation.ownerOf(soulboundId)).deep.equal(accounts[1].address);
    expect(await reputation.tokenOf(accounts[1].address)).deep.equal(soulboundId);

    //  Request to:
    //  - Update Default RS (first time)
    //  - Add new `attribute` into soulbound and update RS
    const tx = await updater.connect(accounts[1]).update(params);
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => { return e.event == 'Updated' });

    expect(event != undefined).true;
    expect(event?.args?.sender).deep.equal( accounts[1].address );
    expect(event?.args?.soulbound).deep.equal( reputation.address );
    expect(event?.args?.soulboundId).deep.equal( soulboundId );
    expect(event?.args?.nonce).deep.equal( nonce );
    expect(event?.args?.paymentToken).deep.equal( usdt.address );
    expect(event?.args?.fee).deep.equal( fee );

    expect(await usdt.balanceOf(accounts[1].address)).deep.equal(balance.sub(fee));
    expect(await usdt.balanceOf(treasury.address)).deep.equal(treasuryBal.add(fee));
    Promise.all(attributeIds.map(async(attributeId, idx) => {
      expect( (await reputation.latestAnswer(soulboundId, attributeId)).score ).deep.equal(scores[idx]);
    }));
  });

});